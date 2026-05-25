// VTT parser for YouTube subtitles. Isolated from lib/transcripts.ts so
// node:test can load it without resolving the `@/` path alias.
//
// YouTube auto-subs publish a rolling-window VTT: each cue re-emits the
// previous cue's text plus a couple of new tokens. Naïve concatenation
// produces ~5× duplication. We dedup by tracking the cumulative token
// stream and appending only the suffix that's new relative to the prior
// cue's content. Manual VTTs (no overlap) fall through unchanged because
// no two consecutive cues will share a tail.

const TIMING_RE = /-->/;
const INLINE_TS_RE = /<\d\d:\d\d:\d\d\.\d{3}>/g;
const C_TAG_RE = /<\/?c[^>]*>/gi;
const OTHER_TAG_RE = /<[^>]+>/g;
const WS_RE = /\s+/g;

function stripCueBody(line: string): string {
  return line
    .replace(INLINE_TS_RE, "")
    .replace(C_TAG_RE, "")
    .replace(OTHER_TAG_RE, "")
    .replace(WS_RE, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export function parseVtt(raw: string): string {
  if (!raw) return "";
  const text = raw.replace(/\r\n?/g, "\n");
  const headerEnd = text.indexOf("\n\n");
  const body = headerEnd === -1 ? "" : text.slice(headerEnd + 2);
  if (!body.trim()) return "";

  const cues = body.split(/\n\n+/);
  const cueLines: string[] = [];
  for (const cue of cues) {
    if (!cue.trim()) continue;
    const lines = cue.split("\n");
    const bodyLines: string[] = [];
    let skipBlock = false;
    for (const line of lines) {
      if (!line.trim()) continue;
      if (/^(NOTE|STYLE|REGION)\b/.test(line)) {
        skipBlock = true;
        break;
      }
      if (TIMING_RE.test(line)) continue;
      bodyLines.push(line);
    }
    if (skipBlock || bodyLines.length === 0) continue;

    // Drop a single-line cue identifier preceding the body. Heuristic: a
    // first body line with no whitespace and no tag markup, when at least
    // one more body line follows.
    if (
      bodyLines.length > 1 &&
      !/\s/.test(bodyLines[0]) &&
      !/[<>]/.test(bodyLines[0])
    ) {
      bodyLines.shift();
    }

    const cueText = bodyLines.map(stripCueBody).filter(Boolean).join(" ");
    if (cueText) cueLines.push(cueText);
  }

  const out: string[] = [];
  const TAIL_KEEP = 32;
  let tail: string[] = [];

  for (const cueText of cueLines) {
    const tokens = tokenize(cueText);
    if (tokens.length === 0) continue;

    const max = Math.min(tokens.length, tail.length);
    let overlap = 0;
    for (let k = max; k >= 1; k--) {
      let ok = true;
      for (let i = 0; i < k; i++) {
        if (
          tail[tail.length - k + i].toLowerCase() !== tokens[i].toLowerCase()
        ) {
          ok = false;
          break;
        }
      }
      if (ok) {
        overlap = k;
        break;
      }
    }
    const fresh = tokens.slice(overlap);
    if (fresh.length === 0) continue;
    out.push(fresh.join(" "));
    tail = [...tail, ...fresh];
    if (tail.length > TAIL_KEEP) tail = tail.slice(tail.length - TAIL_KEEP);
  }

  return out.join("\n").trim();
}
