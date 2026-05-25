// Eval runner: feeds evals/queries.jsonl through runSearch and reports
// pass/fail per row. A row passes when at least one hit in the top-k has
// a channel_title whose case-insensitive form contains expect_channel
// (also case-insensitive). Exit 0 on all-pass, 1 otherwise.
//
// Run with: npm run eval
// Requires .env.local for OPENAI_API_KEY (npm script wires --env-file).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { runSearch, type Hit } from "../lib/search-core.ts";

type Row = { q: string; expect_channel: string; note?: string };

const K = 10;
const FIXTURE = path.join(process.cwd(), "evals", "queries.jsonl");

function parseLines(raw: string): Row[] {
  const out: Row[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const row = JSON.parse(t) as Row;
    if (!row.q || !row.expect_channel) {
      throw new Error(`bad row (missing q/expect_channel): ${t}`);
    }
    out.push(row);
  }
  return out;
}

function matchesChannel(hits: Hit[], expect: string): Hit | undefined {
  const needle = expect.toLowerCase();
  return hits.find((h) =>
    (h.channel_title ?? "").toLowerCase().includes(needle),
  );
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n - 1) + "…";
  return s + " ".repeat(n - s.length);
}

async function main(): Promise<void> {
  const raw = await readFile(FIXTURE, "utf8");
  const rows = parseLines(raw);

  let passed = 0;
  const failures: Array<{ row: Row; hits: Hit[] }> = [];

  // Header
  console.log(
    `${pad("res", 5)}${pad("q", 42)}${pad("top channel", 28)}note`,
  );
  console.log("-".repeat(110));

  for (const row of rows) {
    const hits = await runSearch(row.q, K, null);
    const hit = matchesChannel(hits, row.expect_channel);
    const top = hits[0];
    const topCh = top?.channel_title ?? "<no-channel>";
    const pass = Boolean(hit);
    if (pass) passed += 1;
    else failures.push({ row, hits });
    console.log(
      `${pad(pass ? "PASS" : "FAIL", 5)}${pad(row.q, 42)}${pad(topCh, 28)}${row.note ?? ""}`,
    );
  }

  console.log("-".repeat(110));
  console.log(`${passed}/${rows.length} passed`);

  if (failures.length > 0) {
    console.log("\nfailing rows — top-10 channels:");
    for (const f of failures) {
      const channels = f.hits.map((h) => h.channel_title ?? "<none>");
      console.log(
        `  ✗ "${f.row.q}" expected ~"${f.row.expect_channel}"\n    got: ${channels.join(", ")}`,
      );
    }
    process.exit(1);
  }
}

await main();
