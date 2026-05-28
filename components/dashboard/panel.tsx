// Shared visual shell for every dashboard card.
// Background, stroke, radius, and the stacked drop + inner shadow are all
// pulled from tokens in `app/globals.css` so theme tweaks land in one place.
import { cn } from "@/lib/utils";

const SHELL =
  "rounded-base border border-stroke bg-dashboard bg-[image:var(--gradient-panel)] font-sans text-black select-none shadow-[var(--shadow-base),var(--shadow-inner-base)]";

export function Panel({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section className={cn(SHELL, className)} {...props}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {action}
    </header>
  );
}

export function PanelBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}
