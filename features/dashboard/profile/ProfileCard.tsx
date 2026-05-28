import { Panel } from "@/components/dashboard/panel";

export function ProfileCard({ className }: { className?: string }) {
  return (
    <Panel className={className}>
      <div className="flex h-full w-full items-center justify-center">
        ProfileCard
      </div>
    </Panel>
  );
}
