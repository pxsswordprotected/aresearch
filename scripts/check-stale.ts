// Stale-embedding audit. Pure SQL — no API calls. Six checks per the
// safety-pass plan:
//   1. blocks with non-empty search_text but no vec_blocks row
//   2. vec_blocks.embedding_model != current EMBEDDING_MODEL
//   3. block_ocr.ocr_processed_at > vec_blocks.created_at
//   4. block_link_content.fetched_at > vec_blocks.created_at
//   5. block_transcripts.fetched_at > vec_blocks.created_at
//   6. block_chunks rows missing from vec_block_chunks (or wrong model)
// Exit 0 = all current; exit 1 = at least one category has stale rows.
//
// Run with: npm run check:stale
import { getDb } from "../lib/db.ts";
import { EMBEDDING_MODEL } from "../lib/embeddings.ts";

type Counted = { n: number };

function count(db: ReturnType<typeof getDb>, sql: string, ...params: unknown[]): number {
  const row = db.prepare(sql).get(...params) as Counted | undefined;
  return row?.n ?? 0;
}

function main(): void {
  const db = getDb();

  const unembedded = count(
    db,
    `SELECT COUNT(*) AS n
       FROM blocks b
       LEFT JOIN vec_blocks v ON v.block_id = b.id
      WHERE b.search_text IS NOT NULL
        AND length(trim(b.search_text)) > 0
        AND v.block_id IS NULL`,
  );

  const wrongModel = count(
    db,
    `SELECT COUNT(*) AS n
       FROM vec_blocks
      WHERE embedding_model IS NOT ?`,
    EMBEDDING_MODEL,
  );

  const ocrNewer = count(
    db,
    `SELECT COUNT(*) AS n
       FROM block_ocr o
       JOIN vec_blocks v ON v.block_id = o.block_id
      WHERE o.ocr_processed_at IS NOT NULL
        AND v.created_at IS NOT NULL
        AND o.ocr_processed_at > v.created_at`,
  );

  const linkNewer = count(
    db,
    `SELECT COUNT(*) AS n
       FROM block_link_content lc
       JOIN vec_blocks v ON v.block_id = lc.block_id
      WHERE lc.fetched_at IS NOT NULL
        AND v.created_at IS NOT NULL
        AND lc.fetched_at > v.created_at`,
  );

  const transcriptNewer = count(
    db,
    `SELECT COUNT(*) AS n
       FROM block_transcripts t
       JOIN vec_blocks v ON v.block_id = t.block_id
      WHERE t.fetched_at IS NOT NULL
        AND v.created_at IS NOT NULL
        AND t.fetched_at > v.created_at`,
  );

  const unembeddedChunks = count(
    db,
    `SELECT COUNT(*) AS n
       FROM block_chunks ch
       LEFT JOIN vec_block_chunks vc ON vc.chunk_id = ch.id
      WHERE vc.chunk_id IS NULL`,
  );

  const wrongModelChunks = count(
    db,
    `SELECT COUNT(*) AS n
       FROM vec_block_chunks
      WHERE embedding_model IS NOT ?`,
    EMBEDDING_MODEL,
  );

  const rows: Array<[string, number, string]> = [
    ["blocks with search_text but no embedding", unembedded, "POST /api/embed"],
    [`vec_blocks not on ${EMBEDDING_MODEL}`, wrongModel, "POST /api/embed (after model change)"],
    ["OCR fetched after embedding", ocrNewer, "POST /api/embed"],
    ["external content fetched after embedding", linkNewer, "POST /api/embed"],
    ["transcripts fetched after embedding", transcriptNewer, "POST /api/embed"],
    ["block_chunks without vec row", unembeddedChunks, "POST /api/chunks then /api/embed"],
    [`vec_block_chunks not on ${EMBEDDING_MODEL}`, wrongModelChunks, "POST /api/embed (after model change)"],
  ];

  const width = Math.max(...rows.map((r) => r[0].length));
  console.log("stale-embedding audit");
  console.log("-".repeat(width + 10));
  for (const [label, n] of rows) {
    console.log(`${label.padEnd(width)}  ${String(n).padStart(5)}`);
  }
  console.log("-".repeat(width + 10));

  const stale = rows.filter((r) => r[1] > 0);
  if (stale.length === 0) {
    console.log("all embeddings current");
    process.exit(0);
  }

  console.log("\nactions:");
  const seen = new Set<string>();
  for (const [, , action] of stale) {
    if (seen.has(action)) continue;
    seen.add(action);
    console.log(`  - ${action}`);
  }
  process.exit(1);
}

main();
