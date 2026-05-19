// Embed blocks that don't yet have a row in `vec_blocks`.
//
// Strategy: pull every block whose `search_text` is non-empty and is not
// already embedded, push them through OpenAI in batches, write each
// embedding into the sqlite-vec virtual table. Idempotent: re-running
// only embeds what's missing.

import { getDb } from "@/lib/db";
import { EMBEDDING_MODEL, embedMany } from "@/lib/embeddings";

const BATCH_SIZE = 100;
// text-embedding-3-small accepts 8192 tokens. ~4 chars/token average →
// 8000 chars is a comfortable cap that never trips the API limit and
// preserves the semantically meaningful prefix of long blocks.
const MAX_CHARS = 8000;

export type EmbedResult = {
  embedded: number;
  skipped: number;
  batches: number;
};

type PendingRow = { id: number; search_text: string };

export async function embedPendingBlocks(): Promise<EmbedResult> {
  const db = getDb();

  const pending = db
    .prepare(
      `SELECT b.id, b.search_text
         FROM blocks b
         LEFT JOIN vec_blocks v ON v.block_id = b.id
        WHERE v.block_id IS NULL
          AND b.search_text IS NOT NULL
          AND length(trim(b.search_text)) > 0`,
    )
    .all() as PendingRow[];

  if (pending.length === 0) {
    return { embedded: 0, skipped: 0, batches: 0 };
  }

  const insert = db.prepare(
    `INSERT INTO vec_blocks (block_id, embedding, embedding_model, created_at)
     VALUES (?, ?, ?, datetime('now'))`,
  );
  const writeBatch = db.transaction(
    (rows: PendingRow[], vectors: Float32Array[]) => {
      for (let i = 0; i < rows.length; i++) {
        insert.run(
          // sqlite-vec 0.1.9 rejects JS `number` for the vec0 PK column;
          // BigInt sidesteps the broken type check.
          BigInt(rows[i].id),
          Buffer.from(vectors[i].buffer),
          EMBEDDING_MODEL,
        );
      }
    },
  );

  let embedded = 0;
  let batches = 0;
  let skipped = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const slice = pending.slice(i, i + BATCH_SIZE);
    const inputs = slice.map((r) => r.search_text.slice(0, MAX_CHARS));
    const vectors = await embedMany(inputs);
    if (vectors.length !== slice.length) {
      // Defensive: openai sdk should return one embedding per input.
      skipped += slice.length - vectors.length;
    }
    writeBatch(slice.slice(0, vectors.length), vectors);
    embedded += vectors.length;
    batches += 1;
  }

  return { embedded, skipped, batches };
}
