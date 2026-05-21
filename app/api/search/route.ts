import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { embed } from "@/lib/embeddings";
import {
  ImageQueryError,
  QUERY_IMAGE_MAX_DATA_URL_CHARS,
  captionImageForQuery,
} from "@/lib/vision-query";

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
  distance: number; // adjusted ranking score
  vec_distance: number; // raw cosine distance from sqlite-vec
  match_type: "block" | "chunk";
  chunk_index?: number;
  source_start_char?: number;
  source_end_char?: number;
};

// Row shapes from SQL. distance below is the raw vec distance; we
// transform into Hit (with adjusted distance + vec_distance) in TS.
type BlockHitRow = {
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
  search_text: string | null;
};
type ChunkHitRow = {
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
  chunk_index: number;
  source_start_char: number;
  source_end_char: number;
  match_text: string | null;
};

function envNum(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

const CHUNK_FLAT_PENALTY = envNum("SEARCH_CHUNK_FLAT_PENALTY", 0.01);
const CHUNK_BROAD_PENALTY = envNum("SEARCH_CHUNK_BROAD_PENALTY", 0.03);
const PHRASE_BOOST = envNum("SEARCH_PHRASE_BOOST", 0.04);
const RARE_TERM_BOOST = envNum("SEARCH_RARE_TERM_BOOST", 0.02);
const TITLE_MATCH_BOOST = envNum("SEARCH_TITLE_MATCH_BOOST", 0.03);
const BROAD_TOKEN_THRESHOLD = envNum("SEARCH_BROAD_TOKEN_THRESHOLD", 3);

// Stopwords filtered from boost calculations. Title and rare-term boosts
// require every (content) token to appear in the candidate; without this
// filter, `to/of/and` would either bias the rare-term path (none qualify
// because of the len>=6 cap, harmless) or — for the title path — demand
// that titles contain trivia like "to" or "of", causing legit matches to
// silently lose the boost. Phrase boost uses the same normalized query
// (with stopwords kept) so verbatim phrase matching still works.
const STOPWORDS = new Set([
  "a", "the", "of", "and", "to", "in", "for", "is",
]);

// Normalize strings for lexical matching: lowercase, fold smart quotes
// and dashes into ASCII, strip markdown emphasis/link punctuation, then
// collapse whitespace. Phrase and token matches both operate on this
// normalized form, so "interaction design" in a query matches
// "**Interaction Design.**" or "[Interaction\nDesign](url)" in body.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[*_`~\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(normalizedQ: string): string[] {
  return normalizedQ
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function lexicalAdjustment(
  text: string | null,
  title: string | null,
  qNorm: string,
  tokens: string[],
): number {
  let adj = 0;
  if (text) {
    const haystack = normalize(text);
    if (tokens.length >= 2 && haystack.includes(qNorm)) adj -= PHRASE_BOOST;
    const rare = tokens.filter((t) => t.length >= 6);
    if (rare.length > 0 && rare.every((t) => haystack.includes(t))) {
      adj -= RARE_TERM_BOOST;
    }
  }
  // Title boost: every content token appears in the title. Selective by
  // construction; safely no-ops on generic single-word queries because we
  // still require all tokens to land on the same title.
  if (title && tokens.length >= 1) {
    const t = normalize(title);
    if (tokens.every((tok) => t.includes(tok))) adj -= TITLE_MATCH_BOOST;
  }
  return adj;
}

function chooseBetter(existing: Hit | undefined, candidate: Hit): Hit {
  if (!existing) return candidate;
  return candidate.distance < existing.distance ? candidate : existing;
}

function parseLimit(raw: string | null): number {
  return Math.min(Math.max(Number(raw ?? 10), 1), 50);
}

// Embed → KNN → lexical re-rank pipeline shared by GET (text query) and
// POST (image query, after captioning).
async function runSearch(qText: string, limit: number): Promise<Hit[]> {
  const qNorm = normalize(qText);
  const tokens = tokenize(qNorm);
  const isBroad = tokens.length <= BROAD_TOKEN_THRESHOLD;

  const vec = await embed(qText);
  const vector = Buffer.from(vec.buffer);
  const db = getDb();
  const blockK = Math.max(limit * 4, 20);
  const chunkK = Math.max(limit * 8, 50);

  // sqlite-vec KNN runs inside CTEs so MATCH isn't confused by the
  // surrounding joins. We retrieve block-level and chunk-level candidates
  // separately, apply ranking adjustments in TS, then dedupe by parent
  // block.
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
          b.search_text    AS search_text,
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
          ch.text                 AS match_text,
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
    const lex = lexicalAdjustment(row.search_text, row.title, qNorm, tokens);
    const adjusted = row.distance + lex;
    const hit: Hit = {
      block_id: row.block_id,
      arena_block_id: row.arena_block_id,
      title: row.title,
      block_type: row.block_type,
      source_url: row.source_url,
      arena_url: row.arena_url,
      snippet: row.snippet,
      channel_title: row.channel_title,
      channel_url: row.channel_url,
      distance: adjusted,
      vec_distance: row.distance,
      match_type: "block",
    };
    byBlock.set(row.block_id, chooseBetter(byBlock.get(row.block_id), hit));
  }
  for (const row of chunkRows) {
    const lex = lexicalAdjustment(row.match_text, row.title, qNorm, tokens);
    let adjusted = row.distance + CHUNK_FLAT_PENALTY + lex;
    if (isBroad) adjusted += CHUNK_BROAD_PENALTY;
    const hit: Hit = {
      block_id: row.block_id,
      arena_block_id: row.arena_block_id,
      title: row.title,
      block_type: row.block_type,
      source_url: row.source_url,
      arena_url: row.arena_url,
      snippet: row.snippet,
      channel_title: row.channel_title,
      channel_url: row.channel_url,
      distance: adjusted,
      vec_distance: row.distance,
      match_type: "chunk",
      chunk_index: row.chunk_index,
      source_start_char: row.source_start_char,
      source_end_char: row.source_end_char,
    };
    byBlock.set(row.block_id, chooseBetter(byBlock.get(row.block_id), hit));
  }

  return Array.from(byBlock.values())
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  if (!q || !q.trim()) {
    return NextResponse.json({ error: "Missing ?q=" }, { status: 400 });
  }
  const limit = parseLimit(url.searchParams.get("k"));
  const qTrim = q.trim();

  try {
    const hits = await runSearch(qTrim, limit);
    return NextResponse.json({ query: qTrim, hits });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Image-input search. The client posts a base64 data URL; we caption it
// with the same vision pass used at index time and feed the caption
// through `runSearch`.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { image_data_url, k } = body as {
    image_data_url?: unknown;
    k?: unknown;
  };
  if (typeof image_data_url !== "string" || !image_data_url) {
    return NextResponse.json(
      { error: "image_data_url is required" },
      { status: 400 },
    );
  }
  // Surface oversize payloads as 413 before the vision call burns a token.
  if (image_data_url.length > QUERY_IMAGE_MAX_DATA_URL_CHARS) {
    return NextResponse.json({ error: "image too large" }, { status: 413 });
  }

  const limit = parseLimit(typeof k === "number" ? String(k) : null);

  try {
    const { caption, ocr_text, ocr_summary } =
      await captionImageForQuery(image_data_url);
    const hits = await runSearch(caption, limit);
    return NextResponse.json({
      query: caption,
      caption_meta: { ocr_text, ocr_summary },
      hits,
    });
  } catch (err) {
    if (err instanceof ImageQueryError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
