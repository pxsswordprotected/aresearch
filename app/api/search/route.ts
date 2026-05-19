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
};

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
    const db = getDb();

    // sqlite-vec KNN runs inside a CTE so the virtual-table MATCH isn't
    // confused by the surrounding joins. Then enrich with one channel.
    const rows = db
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
      .all(Buffer.from(vec.buffer), limit) as Hit[];

    return NextResponse.json({ query: q.trim(), hits: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
