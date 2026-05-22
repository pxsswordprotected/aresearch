import Database from "better-sqlite3";
import { getDb } from "@/lib/db";
import { EMBEDDING_MODEL, embedMany } from "@/lib/embeddings";

export const LINK_CHUNK_MIN_CHARS = 8000;
export const LINK_CHUNK_MAX_CHARS = 3000;
export const LINK_CHUNK_OVERLAP_CHARS = 400;
export const EXTERNAL_CONTENT_CHUNK_TYPE = "external_content";

const BATCH_SIZE = 100;

export type ChunkResult = {
  chunked: number;
  embedded: number;
  skipped: number;
  batches: number;
  cleared: number;
};

type Chunk = {
  chunk_index: number;
  text: string;
  source_start_char: number;
  source_end_char: number;
};

type PendingChunk = { id: number; text: string };
type LinkContentRow = { block_id: number; content_text: string };

type ChunkOptions = {
  minChars?: number;
  maxChars?: number;
  overlapChars?: number;
};

function findChunkEnd(text: string, start: number, hardEnd: number): number {
  if (hardEnd >= text.length) return text.length;

  const minEnd = start + Math.floor((hardEnd - start) * 0.6);

  const paragraph = text.lastIndexOf("\n\n", hardEnd - 2);
  if (paragraph >= minEnd) return paragraph + 2;

  for (let i = hardEnd - 1; i >= minEnd; i--) {
    const ch = text.charCodeAt(i);
    if (ch !== 46 && ch !== 33 && ch !== 63) continue; // . ! ?
    const next = text.charCodeAt(i + 1);
    if (next === 32 || next === 10 || next === 13 || Number.isNaN(next)) {
      return i + 1;
    }
  }

  for (let i = hardEnd - 1; i >= minEnd; i--) {
    const ch = text.charCodeAt(i);
    if (ch === 32 || ch === 10 || ch === 13 || ch === 9) return i + 1;
  }

  return hardEnd;
}

export function chunkText(
  text: string,
  opts: ChunkOptions = {},
): Chunk[] {
  const minChars = opts.minChars ?? LINK_CHUNK_MIN_CHARS;
  const maxChars = opts.maxChars ?? LINK_CHUNK_MAX_CHARS;
  const overlapChars = opts.overlapChars ?? LINK_CHUNK_OVERLAP_CHARS;

  if (text.length <= minChars) return [];
  if (maxChars <= 0) throw new Error("chunk maxChars must be positive");
  if (overlapChars < 0 || overlapChars >= maxChars) {
    throw new Error("chunk overlapChars must be >= 0 and < maxChars");
  }

  const chunks: Chunk[] = [];
  let start = 0;
  while (start < text.length) {
    const hardEnd = Math.min(start + maxChars, text.length);
    const end = findChunkEnd(text, start, hardEnd);
    if (end <= start) throw new Error("chunker failed to advance");

    chunks.push({
      chunk_index: chunks.length,
      text: text.slice(start, end),
      source_start_char: start,
      source_end_char: end,
    });

    if (end >= text.length) break;
    const nextStart = Math.max(0, end - overlapChars);
    start = nextStart > start ? nextStart : end;
  }

  return chunks;
}

function deleteChunkVectorsForBlock(
  db: Database.Database,
  blockId: number,
  chunkType: string,
): void {
  db.prepare(
    `DELETE FROM vec_block_chunks
      WHERE chunk_id IN (
        SELECT id FROM block_chunks
         WHERE block_id = ? AND chunk_type = ?
      )`,
  ).run(blockId, chunkType);
}

export function clearChunksForBlock(
  db: Database.Database,
  blockId: number,
  chunkType: string,
): void {
  deleteChunkVectorsForBlock(db, blockId, chunkType);
  db.prepare(
    `DELETE FROM block_chunks WHERE block_id = ? AND chunk_type = ?`,
  ).run(blockId, chunkType);
}


export function rebuildChunksForBlock(
  db: Database.Database,
  blockId: number,
  chunkType: string,
  text: string,
): number {
  const chunks = chunkText(text);
  clearChunksForBlock(db, blockId, chunkType);

  if (chunks.length === 0) return 0;

  const insert = db.prepare(`
    INSERT INTO block_chunks (
      block_id, chunk_type, chunk_index, text,
      source_start_char, source_end_char, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  for (const chunk of chunks) {
    insert.run(
      blockId,
      chunkType,
      chunk.chunk_index,
      chunk.text,
      chunk.source_start_char,
      chunk.source_end_char,
    );
  }
  return chunks.length;
}

function rebuildMissingLinkChunks(db: Database.Database): number {
  const rows = db
    .prepare(
      `SELECT c.block_id, c.content_text
         FROM block_link_content c
        WHERE c.content_text IS NOT NULL
          AND length(c.content_text) > ?
          AND NOT EXISTS (
            SELECT 1 FROM block_chunks bc
             WHERE bc.block_id = c.block_id
               AND bc.chunk_type = ?
          )
        ORDER BY c.block_id`,
    )
    .all(LINK_CHUNK_MIN_CHARS, EXTERNAL_CONTENT_CHUNK_TYPE) as LinkContentRow[];

  let chunked = 0;
  const tx = db.transaction((items: LinkContentRow[]) => {
    for (const row of items) {
      chunked += rebuildChunksForBlock(
        db,
        row.block_id,
        EXTERNAL_CONTENT_CHUNK_TYPE,
        row.content_text,
      );
    }
  });
  tx(rows);
  return chunked;
}

function rebuildAllLinkChunks(db: Database.Database): { chunked: number; cleared: number } {
  const existing = db
    .prepare(
      `SELECT COUNT(*) AS c FROM block_chunks WHERE chunk_type = ?`,
    )
    .get(EXTERNAL_CONTENT_CHUNK_TYPE) as { c: number };

  db.transaction(() => {
    db.prepare(
      `DELETE FROM vec_block_chunks
        WHERE chunk_id IN (
          SELECT id FROM block_chunks WHERE chunk_type = ?
        )`,
    ).run(EXTERNAL_CONTENT_CHUNK_TYPE);
    db.prepare(`DELETE FROM block_chunks WHERE chunk_type = ?`).run(
      EXTERNAL_CONTENT_CHUNK_TYPE,
    );
  })();

  return { chunked: rebuildMissingLinkChunks(db), cleared: existing.c };
}

async function embedPendingChunks(db: Database.Database): Promise<{
  embedded: number;
  skipped: number;
  batches: number;
}> {
  const pending = db
    .prepare(
      `SELECT c.id, c.text
         FROM block_chunks c
         LEFT JOIN vec_block_chunks v ON v.chunk_id = c.id
        WHERE v.chunk_id IS NULL
          AND length(trim(c.text)) > 0
        ORDER BY c.id`,
    )
    .all() as PendingChunk[];

  if (pending.length === 0) return { embedded: 0, skipped: 0, batches: 0 };

  const insert = db.prepare(
    `INSERT INTO vec_block_chunks (chunk_id, embedding, embedding_model, created_at)
     VALUES (?, ?, ?, datetime('now'))`,
  );
  const writeBatch = db.transaction(
    (rows: PendingChunk[], vectors: Float32Array[]) => {
      for (let i = 0; i < rows.length; i++) {
        insert.run(
          BigInt(rows[i].id),
          Buffer.from(vectors[i].buffer),
          EMBEDDING_MODEL,
        );
      }
    },
  );

  let embedded = 0;
  let skipped = 0;
  let batches = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const slice = pending.slice(i, i + BATCH_SIZE);
    const vectors = await embedMany(slice.map((r) => r.text));
    if (vectors.length !== slice.length) {
      skipped += slice.length - vectors.length;
    }
    writeBatch(slice.slice(0, vectors.length), vectors);
    embedded += vectors.length;
    batches += 1;
  }

  return { embedded, skipped, batches };
}

export async function processChunks(
  opts: { rebuild?: boolean } = {},
): Promise<ChunkResult> {
  const db = getDb();
  const { chunked, cleared } = opts.rebuild
    ? rebuildAllLinkChunks(db)
    : { chunked: rebuildMissingLinkChunks(db), cleared: 0 };
  const embedded = await embedPendingChunks(db);
  return {
    chunked,
    embedded: embedded.embedded,
    skipped: embedded.skipped,
    batches: embedded.batches,
    cleared,
  };
}
