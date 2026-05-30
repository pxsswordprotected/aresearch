import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { processChunks } from "@/lib/chunks";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const rebuild = url.searchParams.get("rebuild") === "1";
  try {
    const result = await processChunks({ rebuild });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
