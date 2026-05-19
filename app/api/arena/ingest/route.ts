import { NextResponse } from "next/server";
import { ArenaError, parseUserSlug } from "@/lib/arena";
import { ingestUser, logIngestError } from "@/lib/ingest";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const userParam = url.searchParams.get("user");
  if (!userParam) {
    return NextResponse.json({ error: "Missing ?user=" }, { status: 400 });
  }

  let slug: string;
  try {
    slug = parseUserSlug(userParam);
  } catch (err) {
    if (err instanceof ArenaError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  try {
    const result = await ingestUser(slug);
    return NextResponse.json(result);
  } catch (err) {
    logIngestError(slug, err);
    if (err instanceof ArenaError) {
      return NextResponse.json(
        { error: err.message, status: err.status },
        { status: err.status },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
