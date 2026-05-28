// Pure formatting helpers for the BlocksTable. Kept JSX-free so they
// stay trivially testable and live in one easy-to-find module.

// Maximum visible characters in a snippet cell, including the trailing
// ellipsis when truncated. Mirrors the channel-label rule in
// features/dashboard/channels/ChannelsCard.tsx.
export const SNIPPET_MAX_CHARS = 54;

export function truncateSnippet(s: string | null): string {
  if (!s) return "";
  // Unicode-safe split: Array.from honours surrogate pairs so we don't
  // bisect an emoji or BMP-extended glyph when slicing.
  const chars = Array.from(s);
  if (chars.length <= SNIPPET_MAX_CHARS) return s;
  return chars.slice(0, SNIPPET_MAX_CHARS - 3).join("") + "...";
}

export function formatRank(
  index: number,
  page: number,
  pageSize: number,
): string {
  return String((page - 1) * pageSize + index + 1);
}

export function formatType(t: string | null): string {
  const trimmed = t?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "?";
}

export function formatChannel(title: string | null): string {
  const trimmed = title?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "—";
}
