import { NextResponse } from "next/server";
import { embedPendingBlocks } from "@/lib/embed-blocks";

export const runtime = "nodejs";
// Embedding a few hundred blocks comfortably exceeds Vercel's default
// 10s function budget. Local dev has no limit, but flag it for prod.
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await embedPendingBlocks();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
