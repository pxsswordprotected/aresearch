import { Panel } from "@/components/dashboard/panel";

export function SyncCard({ className }: { className?: string }) {
  return (
    <Panel className={className}>
      <div className="flex h-full w-full items-center justify-center">
        SyncCard
      </div>
    </Panel>
  );
}
