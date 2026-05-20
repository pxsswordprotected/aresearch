// Single source of truth for the `blocks.search_text` column.
//
// Called from two places:
//   - lib/ingest.ts, with fields sourced from the live Are.na block.
//   - lib/ocr.ts, with fields sourced from the existing DB row + the
//     freshly-written `block_ocr` row.
//
// Whichever process writes last "wins" — but since each call assembles
// the union of every known signal for that block, the result converges
// regardless of order.

export type SearchTextInput = {
  title?: string | null;
  description?: string | null;
  content_text?: string | null;
  ocr_text?: string | null;
  ocr_summary?: string | null;
  block_type?: string | null;
  source_provider_name?: string | null;
  channel_titles: string[];
};

// Filename-shaped titles (CDN slugs, `image.png`, `IMG_0002.jpg`, etc.)
// add noise to the embedding without adding meaning. Drop them from
// `search_text` only when the block has *other* content (real description,
// content, or OCR); if the title is the only signal, keep it as fallback
// so the block stays findable.
export function isFilenameLikeTitle(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;

  // Real titles are sentences/phrases; junk titles lead with the
  // filename/slug. Inspect the first whitespace-delimited token only —
  // anything Are.na appends after (dimensions, "Scaled (70%)") is noise
  // and shouldn't rescue a junk title from the filter.
  const firstToken = trimmed.split(/\s+/)[0] ?? "";
  if (!firstToken) return false;

  // Pattern 1: token ends in a media/document extension.
  if (
    /\.(jpe?g|png|gif|webp|svg|bmp|tiff?|heif|heic|mp4|mov|webm|m4v|mp3|wav|pdf|docx?|xlsx?|pptx?)$/i.test(
      firstToken,
    )
  ) {
    return true;
  }

  // Pattern 2: token is a CDN slug — length ≥ 8, mixed case, AND either
  // contains a digit or has a run of ≥4 consecutive uppercase letters.
  // Spares real CamelCase titles ("Mindfulness", "MichaelJackson") but
  // catches randomized Twitter slugs like `HHUdUSLWAAETYqr`.
  if (
    firstToken.length >= 8 &&
    /[A-Z]/.test(firstToken) &&
    /[a-z]/.test(firstToken) &&
    (/\d/.test(firstToken) || /[A-Z]{4,}/.test(firstToken))
  ) {
    return true;
  }

  return false;
}

// Heavy-repeat the substantive content fields so the embedding vector
// leans toward what the block is *about* rather than its title/metadata.
// Skip the boost when the field is so short it's effectively a title
// itself — repeating "design temporal hierarchy" 3× doesn't add signal,
// just amplifies whatever it already says.
const HEAVY_REPEAT_MIN_CHARS = 120;
const HEAVY_REPEAT_COUNT = 3;
function heavy(s: string): string[] {
  return s.length > HEAVY_REPEAT_MIN_CHARS
    ? new Array(HEAVY_REPEAT_COUNT).fill(s)
    : [s];
}

const clean = (s: string | null | undefined): string =>
  typeof s === "string" ? s.trim() : "";

export function buildSearchText(input: SearchTextInput): string {
  const title = clean(input.title);
  const description = clean(input.description);
  const content = clean(input.content_text);
  const ocrText = clean(input.ocr_text);
  const ocrSummary = clean(input.ocr_summary);

  const hasOtherContent = Boolean(
    description || content || ocrText || ocrSummary,
  );
  const titleIsJunk = title && isFilenameLikeTitle(title);
  const includeTitle = title && (!titleIsJunk || !hasOtherContent);

  const parts: string[] = [];
  if (includeTitle) parts.push(title);
  if (content) parts.push(...heavy(content));
  if (description) parts.push(...heavy(description));
  if (ocrText) parts.push(...heavy(ocrText));
  if (ocrSummary) parts.push(ocrSummary);
  if (input.channel_titles.length > 0) {
    parts.push(`channels: ${input.channel_titles.join(", ")}`);
  }
  const blockType = clean(input.block_type);
  if (blockType) parts.push(`type: ${blockType}`);
  const provider = clean(input.source_provider_name);
  if (provider) parts.push(`source: ${provider}`);
  return parts.join("\n").trim();
}
