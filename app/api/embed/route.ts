import { NextResponse } from "next/server";
import { embedPendingBlocks } from "@/lib/embed-blocks";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const url = new URL(req.url);
  const rebuild = url.searchParams.get("rebuild") === "1";
  try {
    const result = await embedPendingBlocks({ rebuild });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
