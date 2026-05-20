import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { embed } from "@/lib/embeddings";

export const runtime = "nodejs";

type Hit = {
  block_id: number;
  arena_block_id: number;
  title: string | null;
  block_type: string | null;
  source_url: string | null;
  arena_url: string | null;
  snippet: string | null;
  channel_title: string | null;
  channel_url: string | null;
  distance: number;
  match_type: "block" | "chunk";
  chunk_index?: number;
  source_start_char?: number;
  source_end_char?: number;
};

type BlockHitRow = Omit<Hit, "match_type">;
type ChunkHitRow = Omit<Hit, "match_type"> & {
  chunk_index: number;
  source_start_char: number;
  source_end_char: number;
};

function chooseBetter(existing: Hit | undefined, candidate: Hit): Hit {
  if (!existing) return candidate;
  return candidate.distance < existing.distance ? candidate : existing;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  if (!q || !q.trim()) {
    return NextResponse.json({ error: "Missing ?q=" }, { status: 400 });
  }
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("k") ?? 10), 1),
    50,
  );

  try {
    const vec = await embed(q.trim());
    const vector = Buffer.from(vec.buffer);
    const db = getDb();
    const blockK = Math.max(limit * 4, 20);
    const chunkK = Math.max(limit * 8, 50);

    // sqlite-vec KNN runs inside CTEs so MATCH isn't confused by the
    // surrounding joins. We retrieve block-level and chunk-level candidates
    // separately, then dedupe by parent block in TypeScript.
    const blockRows = db
      .prepare(
        `WITH knn AS MATERIALIZED (
            SELECT block_id, distance
              FROM vec_blocks
             WHERE embedding MATCH ?
               AND k = ?
          )
          SELECT
            knn.block_id     AS block_id,
            knn.distance     AS distance,
            b.arena_block_id AS arena_block_id,
            b.title          AS title,
            b.block_type     AS block_type,
            b.source_url     AS source_url,
            b.arena_url      AS arena_url,
            substr(b.search_text, 1, 240) AS snippet,
            c.title          AS channel_title,
            c.url            AS channel_url
           FROM knn
           JOIN blocks b ON b.id = knn.block_id
           LEFT JOIN block_channels bc ON bc.block_id = knn.block_id
           LEFT JOIN channels c        ON c.id = bc.channel_id
          GROUP BY knn.block_id
          ORDER BY knn.distance`,
      )
      .all(vector, blockK) as BlockHitRow[];

    const chunkRows = db
      .prepare(
        `WITH knn AS MATERIALIZED (
            SELECT chunk_id, distance
              FROM vec_block_chunks
             WHERE embedding MATCH ?
               AND k = ?
          )
          SELECT
            ch.block_id             AS block_id,
            knn.distance            AS distance,
            b.arena_block_id        AS arena_block_id,
            b.title                 AS title,
            b.block_type            AS block_type,
            b.source_url            AS source_url,
            b.arena_url             AS arena_url,
            substr(ch.text, 1, 240) AS snippet,
            c.title                 AS channel_title,
            c.url                   AS channel_url,
            ch.chunk_index          AS chunk_index,
            ch.source_start_char    AS source_start_char,
            ch.source_end_char      AS source_end_char
           FROM knn
           JOIN block_chunks ch ON ch.id = knn.chunk_id
           JOIN blocks b        ON b.id = ch.block_id
           LEFT JOIN block_channels bc ON bc.block_id = ch.block_id
           LEFT JOIN channels c        ON c.id = bc.channel_id
          GROUP BY knn.chunk_id
          ORDER BY knn.distance`,
      )
      .all(vector, chunkK) as ChunkHitRow[];

    const byBlock = new Map<number, Hit>();
    for (const row of blockRows) {
      const candidate: Hit = { ...row, match_type: "block" };
      byBlock.set(row.block_id, chooseBetter(byBlock.get(row.block_id), candidate));
    }
    for (const row of chunkRows) {
      const candidate: Hit = { ...row, match_type: "chunk" };
      byBlock.set(row.block_id, chooseBetter(byBlock.get(row.block_id), candidate));
    }

    const hits = Array.from(byBlock.values())
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return NextResponse.json({ query: q.trim(), hits });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
