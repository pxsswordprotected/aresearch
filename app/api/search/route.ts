import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { embed } from "@/lib/embeddings";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { query?: string; k?: number };
  const query = body.query?.trim();
  const k = Math.min(Math.max(body.k ?? 10, 1), 100);
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const db = getDb();
  const embedding = await embed(query);

  const rows = db
    .prepare(
      `SELECT d.id AS id, d.text AS text, v.distance AS distance
       FROM vec_documents v
       JOIN documents d ON d.id = v.rowid
       WHERE v.embedding MATCH ? AND k = ?
       ORDER BY v.distance`,
    )
    .all(embedding.buffer, k) as { id: number; text: string; distance: number }[];

  return NextResponse.json({ hits: rows });
}
