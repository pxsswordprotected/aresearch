import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "muted";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  // "primary" — full dark gradient, white text (default).
  // "muted"   — same gradient at 13% opacity, dark text. Reads as a
  //             deactivated peer of the primary form (Figma spec).
  variant?: ButtonVariant;
};

// Spec: dark vertical gradient (top #5F605F → bottom-extended #2C2C2B),
// 1px inside stroke (--color-stroke), inner highlights, soft drop shadow,
// rounded-base (4px), Arial bold, white text. Disabled lowers opacity but
// keeps the gradient so the button still reads as the same element.
const BG = "linear-gradient(to bottom, #5F605F 0%, #2C2C2B 140%)";

// Box shadow for the primary form: drop + inner highlights that suggest
// a domed dark surface. Dropped for "muted" because the inner highlights
// read as smudges over a 13% wash; the 1px stroke + drop shadow are kept
// so the shape is still legible.
const BOX_SHADOW_PRIMARY = [
  // Drop shadow (token: --shadow-base).
  "0 2px 3.6px 0 rgb(0 0 0 / 0.10)",
  // Inner top highlight (token: --shadow-inner-base).
  "inset 2px 2px 12.5px -4px rgb(253 253 253 / 0.85)",
  // Inner bottom subtle lift for depth.
  "inset 0 -1px 0 0 rgb(255 255 255 / 0.08)",
  // 1px inside stroke (token: --color-stroke).
  "inset 0 0 0 1px rgb(0 0 0 / 0.10)",
].join(", ");

const BOX_SHADOW_MUTED = [
  "0 2px 3.6px 0 rgb(0 0 0 / 0.06)",
  "inset 0 0 0 1px rgb(0 0 0 / 0.10)",
].join(", ");

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className = "",
    style,
    type = "button",
    disabled,
    variant = "primary",
    children,
    ...rest
  },
  ref,
) {
  const isPrimary = variant === "primary";

  // `isolate` creates a stacking context on the button so the gradient
  // layer's `-z-10` is contained — children render above it without
  // needing any wrapping element (preserves direct flex children, so
  // user-supplied `gap-…` keeps working between icon + label).
  const merged = cn(
    "relative isolate inline-flex items-center justify-center rounded-base px-4 py-2",
    "text-sm font-bold select-none transition-opacity",
    isPrimary ? "text-white" : "text-neutral-800",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={merged}
      style={{
        boxShadow: isPrimary ? BOX_SHADOW_PRIMARY : BOX_SHADOW_MUTED,
        ...style,
      }}
      {...rest}
    >
      {/* Gradient on its own layer so the muted variant can dial just
          the fill (not the text) to 13% opacity. `-z-10` puts it behind
          children within the button's stacking context. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 rounded-base",
          !isPrimary && "opacity-[0.13]",
        )}
        style={{ backgroundImage: BG }}
      />
      {children}
    </button>
  );
});

export default Button;
