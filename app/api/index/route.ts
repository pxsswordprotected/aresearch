import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { embedMany } from "@/lib/embeddings";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { texts?: string[] };
  const texts = (body.texts ?? []).map((t) => t.trim()).filter(Boolean);
  if (texts.length === 0) {
    return NextResponse.json({ error: "texts is required" }, { status: 400 });
  }

  const db = getDb();
  const embeddings = await embedMany(texts);

  const insertDoc = db.prepare("INSERT INTO documents (text) VALUES (?)");
  const insertVec = db.prepare(
    "INSERT INTO vec_documents (rowid, embedding) VALUES (?, ?)",
  );

  const ids: number[] = [];
  const tx = db.transaction(() => {
    for (let i = 0; i < texts.length; i++) {
      const info = insertDoc.run(texts[i]);
      const id = Number(info.lastInsertRowid);
      insertVec.run(id, embeddings[i].buffer);
      ids.push(id);
    }
  });
  tx();

  return NextResponse.json({ ids });
}
