// Shared visual shell for every dashboard card.
// Background, stroke, radius, and the stacked drop + inner shadow are all
// pulled from tokens in `app/globals.css` so theme tweaks land in one place.
export function Panel({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-base border border-stroke bg-dashboard font-sans text-black shadow-[var(--shadow-base),var(--shadow-inner-base)] ${className}`}
    >
      {name}
    </div>
  );
}
