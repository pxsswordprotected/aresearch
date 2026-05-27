#!/usr/bin/env node
// Scans for odd px/rem literals and arbitrary Tailwind values in app/components/css.
// Informational only — does NOT exit non-zero. Wire into CI once legacy values
// are cleaned up.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const ROOTS = ["app", "components"];
const EXTS = new Set([".ts", ".tsx", ".css"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

const ROOT = resolve(process.cwd());

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

// Match `<number>px` and `<number>rem`. Captures the numeric literal.
const NUM_UNIT = /(?<![A-Za-z0-9_.-])(-?\d+(?:\.\d+)?)(px|rem)\b/g;

type Finding = { file: string; line: number; col: number; raw: string; value: number; unit: string };
const findings: Finding[] = [];

for (const root of ROOTS) {
  const abs = resolve(ROOT, root);
  for (const file of walk(abs)) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      NUM_UNIT.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = NUM_UNIT.exec(line)) !== null) {
        const value = parseFloat(m[1]);
        const unit = m[2];
        // px → must be integer & even. rem → must be a multiple of 0.125 (2px @ 16px base).
        const px = unit === "px" ? value : value * 16;
        if (!Number.isFinite(px)) continue;
        if (px === 0) continue;
        if (Math.abs(px % 2) > 1e-6) {
          findings.push({
            file: relative(ROOT, file),
            line: i + 1,
            col: m.index + 1,
            raw: m[0],
            value,
            unit,
          });
        }
      }
    }
  }
}

if (findings.length === 0) {
  console.log("check-even-spacing: ok — no odd px/rem values found.");
  process.exit(0);
}

console.log(`check-even-spacing: ${findings.length} odd value(s) found:`);
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}:${f.col}  ${f.raw}`);
}
// Informational only.
process.exit(0);
