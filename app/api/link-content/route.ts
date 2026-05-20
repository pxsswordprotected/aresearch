import { NextResponse } from "next/server";
import { extractPendingLinks } from "@/lib/link-content";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const url = new URL(req.url);
  const rebuild = url.searchParams.get("rebuild") === "1";
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(500, Number(limitParam))) : 100;
  try {
    const result = await extractPendingLinks({ limit, rebuild });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
