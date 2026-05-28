import { BLOCK_GRID_COLUMNS } from "./columns";

const SKELETON_ROW_COUNT = 8;

// Fallback used both by the Suspense boundary in BlocksTableCard and
// directly by BlocksTableBody while fetching. Renders fixed-height
// placeholder rows on the same grid so the card never reflows.
export function BlocksTableBodySkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
        <div
          key={i}
          className="grid items-center gap-4 px-6 py-2"
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
}
