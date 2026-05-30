import Button from "@/components/Button";
import { Panel } from "@/components/dashboard/panel";
import { cn } from "@/lib/utils";

type DeveloperPanelCardProps = {
  className?: string;
  ownerMode?: boolean;
};

export function DeveloperPanelCard({
  className,
  ownerMode = false,
}: DeveloperPanelCardProps) {
  return (
    <Panel className={cn("flex flex-col py-4", className)}>
      <header className="px-6">
        <h2 className="text-base leading-5 font-bold text-neutral-800">
          Dev tools
        </h2>
      </header>

      <div className="mt-4 h-px shrink-0 bg-stroke" />

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pt-4">
        <p className="text-sm leading-5 text-black/50">
          {ownerMode
            ? "Owner mode is active. Dev tools can run private actions here."
            : "Public mode. Dev tools are visible but locked."}
        </p>
        <Button
          type="button"
          disabled={!ownerMode}
          className="mt-auto w-full px-3 py-2"
        >
          Placeholder dev action
        </Button>
      </div>
    </Panel>
  );
}
