import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

// Spec: dark vertical gradient (top #5F605F → bottom-extended #2C2C2B),
// 1px inside stroke (--color-stroke), two inner highlights, soft drop shadow,
// rounded-base (4px), Arial bold, white text. Disabled lowers opacity but
// keeps the gradient so the button still reads as the same element.
const BG =
  "linear-gradient(to bottom, #5F605F 0%, #2C2C2B 140%)";

const BOX_SHADOW = [
  // Drop shadow (token: --shadow-base).
  "0 2px 3.6px 0 rgb(0 0 0 / 0.10)",
  // Inner top highlight (token: --shadow-inner-base).
  "inset 2px 2px 12.5px -4px rgb(253 253 253 / 0.85)",
  // Inner bottom subtle lift for depth.
  "inset 0 -1px 0 0 rgb(255 255 255 / 0.08)",
  // 1px inside stroke (token: --color-stroke).
  "inset 0 0 0 1px rgb(0 0 0 / 0.10)",
].join(", ");

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = "", style, type = "button", disabled, ...rest },
  ref,
) {
  const merged = cn(
    "inline-flex items-center justify-center rounded-base px-4 py-2",
    "text-sm font-bold text-white select-none transition-opacity",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={merged}
      style={{ backgroundImage: BG, boxShadow: BOX_SHADOW, ...style }}
      {...rest}
    />
  );
});

export default Button;
