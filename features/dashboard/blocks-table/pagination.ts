// Pure pagination layout. Returns the items to render between the
// prev/next chevrons. No React, no DOM — trivially unit-testable.
//
// Rules (matches the common dashboard pattern):
// - total <= 1            → no pagination at all (caller renders nothing)
// - total <= MAX_INLINE   → every page, no ellipses
// - otherwise             → page 1 + window around current + page total,
//                           with ellipses bridging gaps.
//
// Examples (total = 24, window = 1):
//   current=1  → 1 2 3 … 24
//   current=2  → 1 2 3 … 24
//   current=5  → 1 … 4 5 6 … 24
//   current=23 → 1 … 22 23 24

export type PageItem =
  | { kind: "page"; n: number }
  | { kind: "ellipsis"; key: "left" | "right" };

// Below this threshold we show every page number (no ellipses). At 7 we
// can fit `1 2 3 4 5 6 7` without crowding; above we collapse.
const MAX_INLINE = 7;

// Number of pages to show on either side of `current` (in the collapsed
// form). 1 yields the `… c-1 c c+1 …` window.
const WINDOW = 1;

export function getPageItems(current: number, total: number): PageItem[] {
  if (total <= 1) return [];

  if (total <= MAX_INLINE) {
    const out: PageItem[] = [];
    for (let n = 1; n <= total; n++) out.push({ kind: "page", n });
    return out;
  }

  // Collapsed form. Compute the window around `current`, clamped so we
  // never re-emit pages 1 or `total` (those are added unconditionally).
  const c = clamp(current, 1, total);
  const windowStart = Math.max(2, c - WINDOW);
  const windowEnd = Math.min(total - 1, c + WINDOW);

  const out: PageItem[] = [{ kind: "page", n: 1 }];

  // Left ellipsis when there's a gap between page 1 and windowStart.
  if (windowStart > 2) out.push({ kind: "ellipsis", key: "left" });

  for (let n = windowStart; n <= windowEnd; n++) {
    out.push({ kind: "page", n });
  }

  // Right ellipsis when there's a gap between windowEnd and total.
  if (windowEnd < total - 1) out.push({ kind: "ellipsis", key: "right" });

  out.push({ kind: "page", n: total });
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}
