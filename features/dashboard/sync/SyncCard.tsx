import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { Panel } from "@/components/dashboard/panel";

// Hardcoded until sync data lands.
const USERNAME = "j-arab1hdgxzs";
const LAST_SYNC = "2025-05-27 14:32";

export function SyncCard({ className }: { className?: string }) {
  return (
    <Panel className={className}>
      <button
        type="button"
        className="flex h-full w-full flex-col justify-center items-center gap-1.5 px-4 text-left"
      >
        <span className="flex items-center gap-1.5 text-[16px] text-neutral-800">
          <ArrowsClockwise size={26} />
          Sync new blocks
        </span>
        <span className="text-sm text-black/50">
          Last sync for {USERNAME}: {LAST_SYNC}
        </span>
      </button>
    </Panel>
  );
}
