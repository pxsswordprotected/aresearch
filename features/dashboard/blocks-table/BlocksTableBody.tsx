"use client";

import { BlockRow } from "./BlockRow";
import { BlocksTableBodySkeleton } from "./BlocksTableBodySkeleton";
import { useSearchHits } from "./useSearchHits";

// Param-reading subtree. Mounted inside a <Suspense> boundary so
// useSearchParams doesn't de-opt the whole route to client-render
// during prerender.
export function BlocksTableBody() {
  const state = useSearchHits();

  if (state.status === "idle") {
    return (
      <div className="px-6 py-4 text-sm leading-5 text-black/50">
        Search to see blocks.
      </div>
    );
  }

  if (state.status === "loading") {
    return <BlocksTableBodySkeleton />;
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center justify-between gap-3 px-6 py-4 text-sm leading-5">
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
      <div className="px-6 py-4 text-sm leading-5 text-black/50">
        No results.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {visible.map((hit, i) => (
        <BlockRow
          key={`${hit.match_type}-${hit.block_id}-${hit.chunk_index ?? "b"}`}
          hit={hit}
          index={i}
          page={page}
          pageSize={pageSize}
        />
      ))}
    </div>
  );
}
