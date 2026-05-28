import { twMerge } from "tailwind-merge";

// Joins class fragments and resolves Tailwind conflicts so the LAST conflicting
// utility wins regardless of stylesheet source order. Lets consumers override
// component-internal classes (e.g. `<Button className="p-0">` beats the
// component's own `px-4 py-2`).
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return twMerge(parts.filter(Boolean).join(" "));
}
