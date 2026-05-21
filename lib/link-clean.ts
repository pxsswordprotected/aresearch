// Normalizer for Jina Reader markdown.
//
// Runs on raw Jina output before storage / chunking. Strips:
//   - Jina header lines (Title:, URL Source:, Published Time:, Warning:,
//     Markdown Content:).
//   - Markdown images, including link-wrapped images.
//   - Standalone full-line markdown links (typical nav residue).
//   - Bare URLs >= 200 chars on their own line (CDN noise).
//   - Per-host boilerplate (Medium, GitHub README nav blocks, Apple
//     developer video player, Substack subscribe/share/comments).
// Then collapses runs of >= 3 blank lines and trims.

const HEADER_LINE_RE =
  /^\s*(?:Title|URL Source|Published Time|Warning|Markdown Content)\s*:/i;

const LINK_WRAPPED_IMAGE_RE =
  /\[\s*!\[[^\]]*\]\([^)]*\)\s*\]\([^)]*\)/g;
const MD_IMAGE_RE = /!\[[^\]]*\]\([^)]*\)/g;

const FULL_LINE_LINK_RE = /^\s*\[[^\]]{0,200}\]\([^)]+\)\s*$/;
const LONG_BARE_URL_RE = /^\s*https?:\/\/\S{200,}\s*$/;

const MEDIUM_BOILER_RE: RegExp[] = [
  /^Follow publication$/i,
  /^Press enter or click .+$/i,
  /^\d+$/, // clap counters on their own line
];

// Generic Substack/Medium/blog nav residue. These tokens are unambiguous
// boilerplate when they occupy an entire line; we apply them regardless
// of host because Substack-powered blogs frequently use custom domains
// and Medium nav sometimes lands inside a Markdown heading.
const GENERIC_NAV_RE: RegExp[] = [
  /^Recommended from Medium\b/i,
  /^Top highlight\b/i,
  /^Read next\b/i,
  /^More from\b/i,
  /^Sign in$/i,
  /^Sign up$/i,
  /^Subscribe(?:\s+(?:Sign\s+(?:in|up)|to\s+\S.*))?$/i,
  /^Continue reading$/i,
  /^Discover more from\b/i,
  /^Share this post$/i,
  /^Share$/i,
  /^Comments?$/i,
];

const APPLE_VIDEO_BOILER_RE: RegExp[] = [
  /^Play$/i,
  /^Pause$/i,
  /^Speed$/i,
  /^Closed Captioning$/i,
  /^Picture in Picture$/i,
];
const APPLE_TIMESTAMP_LINK_RE =
  /\[time=\d+\]\(https?:\/\/developer\.apple\.com\/videos\/play\/[^)]*\?time=\d+\)/;

const GH_NAV_MARKERS: RegExp[] = [
  /\*\s+\[Pull requests/i,
  /\*\s+\[Actions/i,
  /\*\s+\[Issues/i,
  /\*\s+\[Wiki/i,
  /\*\s+\[Security/i,
  /\*\s+\[Insights/i,
];

export type CleanOpts = { host?: string };

function normalizeHost(h: string | undefined): string | undefined {
  if (!h) return undefined;
  return h.toLowerCase().replace(/^www\./, "");
}

function computeGithubDropRanges(lines: string[]): Array<[number, number]> {
  // Drop contiguous bullet runs (and adjacent blanks) that contain >= 3
  // nav markers. Runs are bounded by any line that is neither a bullet
  // nor blank.
  const ranges: Array<[number, number]> = [];
  let runStart = -1;
  let runMarkers = 0;
  const isBulletOrBlank = (l: string) =>
    l.trim() === "" || /^\s*\*\s/.test(l);
  for (let i = 0; i <= lines.length; i++) {
    const l = i < lines.length ? lines[i] : null;
    const bullet = l !== null && isBulletOrBlank(l);
    if (bullet) {
      if (runStart < 0) runStart = i;
      if (l !== null && GH_NAV_MARKERS.some((re) => re.test(l))) runMarkers++;
    } else {
      if (runStart >= 0 && runMarkers >= 3) ranges.push([runStart, i - 1]);
      runStart = -1;
      runMarkers = 0;
    }
  }
  return ranges;
}

export function cleanLinkMarkdown(body: string, opts: CleanOpts = {}): string {
  if (!body) return "";
  const host = normalizeHost(opts.host);
  const isMedium = !!host && /(^|\.)medium\.com$/.test(host);
  const isGithub = !!host && /(^|\.)github\.com$/.test(host);
  const isAppleVideo =
    !!host && /(^|\.)developer\.apple\.com$/.test(host);

  // Image strip is line-independent.
  const stripped = body
    .replace(LINK_WRAPPED_IMAGE_RE, "")
    .replace(MD_IMAGE_RE, "");

  const lines = stripped.split("\n");
  const ghDrop = isGithub
    ? computeGithubDropRanges(lines)
    : ([] as Array<[number, number]>);
  const inGhDrop = (i: number) => {
    for (const [a, b] of ghDrop) if (i >= a && i <= b) return true;
    return false;
  };

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    // Strip leading markdown header markers when testing for nav phrases
    // (e.g. "## Recommended from Medium" should match "Recommended from Medium").
    const dehead = trimmed.replace(/^#{1,6}\s+/, "");

    if (isGithub && inGhDrop(i)) continue;
    if (HEADER_LINE_RE.test(raw)) continue;
    if (LONG_BARE_URL_RE.test(raw)) continue;
    if (FULL_LINE_LINK_RE.test(raw)) continue;
    if (GENERIC_NAV_RE.some((re) => re.test(dehead))) continue;

    if (isMedium && MEDIUM_BOILER_RE.some((re) => re.test(trimmed))) continue;
    if (isAppleVideo) {
      if (APPLE_VIDEO_BOILER_RE.some((re) => re.test(trimmed))) continue;
      if (APPLE_TIMESTAMP_LINK_RE.test(trimmed)) continue;
      if (/^\s*\*\s+\[time=\d+\]/.test(raw)) continue;
    }

    out.push(raw);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
