"use client";

import { BlockRow } from "./BlockRow";
import { BlocksTableContentSkeleton } from "./BlocksTableContentSkeleton";
import { BlocksTableFooter } from "./BlocksTableFooter";
import {
  DEFAULT_PAGE_SIZE,
  useSearchHits,
  type SearchHitsState,
} from "./useSearchHits";

// The Suspense child for BlocksTableCard. Calls the hook once and
// renders three siblings as a fragment so the parent Panel's flex
// column lays them out directly:
//   [body (flex-1)] [divider] [footer]
// `flex-1` lets the body absorb all remaining vertical space; inside
// the ready branch the row container uses `justify-evenly` so the
// top, between-row, and bottom gaps are all equal. That equal bottom
// gap is what makes the spacing under the last row consistent with
// the spacing between rows — the divider sits flush at the end of
// the body, then the footer follows with its own `mt-4`.
export function BlocksTableContent() {
  const state = useSearchHits();

  return (
    <>
      <BodyArea state={state} />
      <div className="h-px shrink-0 bg-stroke" />
      <BlocksTableFooter
        status={state.status}
        page={state.page}
        pageSize={state.pageSize}
        totalCount={state.totalCount}
      />
    </>
  );
}

// Every branch returns a `flex-1` wrapper so the body always claims
// the full height between the column-header divider and the footer
// divider; downstream siblings ([divider] [footer]) follow it.
function BodyArea({
  state,
}: {
  state: SearchHitsState & { retry: () => void };
}) {
  if (state.status === "idle") {
    return (
      <div className="flex-1 px-6 pt-4 text-sm leading-5 text-black/50">
        Search to see blocks.
      </div>
    );
  }

  if (state.status === "loading") {
    return <BlocksTableContentSkeleton renderFooterSlot={false} />;
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-1 items-start justify-between gap-3 px-6 pt-4 text-sm leading-5">
        <span className="text-error">Search failed: {state.error}</span>
        <button
          type="button"
          onClick={state.retry}
          className="text-link-external underline hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  const { hits, page, pageSize } = state;
  const start = (page - 1) * pageSize;
  const visible = hits.slice(start, start + pageSize);

  if (visible.length === 0) {
    return (
      <div className="flex-1 px-6 pt-4 text-sm leading-5 text-black/50">
        No results.
      </div>
    );
  }

  // Render a fixed number of slots so the auto-distributed gap stays
  // identical whether the page is full or sparse. Slot count is
  // max(visible.length, DEFAULT_PAGE_SIZE): full pages use exactly
  // pageSize slots; sparse pages (last page / few hits) fill the
  // remainder with invisible spacers so the real rows sit at the top
  // with the same gap rhythm as a full page. Spacer height matches
  // a row's intrinsic height (text-base leading-6 = 24px = h-6).
  const slotCount = Math.max(visible.length, DEFAULT_PAGE_SIZE);

  return (
    <div className="flex flex-1 flex-col justify-evenly">
      {Array.from({ length: slotCount }, (_, i) => {
        const hit = visible[i];
        if (hit) {
          return (
            <BlockRow
              key={`${hit.match_type}-${hit.block_id}-${hit.chunk_index ?? "b"}`}
              hit={hit}
              index={i}
              page={page}
              pageSize={pageSize}
            />
          );
        }
        return (
          <div
            key={`spacer-${i}`}
            aria-hidden="true"
            className="invisible h-6"
          />
        );
      })}
    </div>
  );
}
