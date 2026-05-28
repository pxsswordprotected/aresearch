import { BLOCK_GRID_COLUMNS } from "./columns";

const SKELETON_ROW_COUNT = 8;

// Fallback for the Suspense boundary in BlocksTableCard. Mirrors the
// real BlocksTableContent's shape exactly:
//   [rows (flex-1, justify-evenly)] [divider] [footer slot]
// so the swap is layout-stable.
//
// The Loading branch of BlocksTableContent also reuses just the rows
// block (via `renderFooterSlot={false}`) so the real footer isn't
// double-rendered during in-flight fetches.
export function BlocksTableContentSkeleton({
  renderFooterSlot = true,
}: {
  renderFooterSlot?: boolean;
} = {}) {
  const rows = (
    <div className="flex flex-1 flex-col justify-evenly">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
        <div
          key={i}
          className="grid items-center gap-4 px-6"
          style={{ gridTemplateColumns: BLOCK_GRID_COLUMNS }}
          aria-hidden="true"
        >
          <div className="h-3 rounded-sm bg-black/5" />
          <div className="h-3 rounded-sm bg-black/5" />
          <div className="h-3 rounded-sm bg-black/5" />
          <div className="h-3 rounded-sm bg-black/5" />
          <div className="h-3 rounded-sm bg-black/5" />
          <div className="h-3 rounded-sm bg-black/5" />
        </div>
      ))}
    </div>
  );

  if (!renderFooterSlot) return rows;

  return (
    <>
      {rows}
      <div className="h-px shrink-0 bg-stroke" />
      <div className="mt-4 h-5 px-6" aria-hidden="true" />
    </>
  );
}
