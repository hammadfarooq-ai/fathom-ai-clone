import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "subtle" | "danger";
type Size = "xs" | "sm" | "md" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white shadow-card hover:bg-brand-800 active:bg-brand-900 disabled:bg-brand-700/50",
  secondary: "border border-line bg-surface text-ink shadow-card hover:bg-subtle hover:border-line-strong active:bg-line/60",
  ghost: "text-ink-2 hover:bg-subtle hover:text-ink active:bg-line/60",
  subtle: "bg-subtle text-ink-2 hover:bg-line/70 hover:text-ink",
  danger: "border border-red-200 bg-surface text-red-700 hover:bg-red-50",
};

const sizes: Record<Size, string> = {
  xs: "h-7 gap-1.5 rounded-md px-2 text-xs",
  sm: "h-8 gap-1.5 rounded-lg px-2.5 text-[13px]",
  md: "h-9 gap-2 rounded-lg px-3.5 text-sm",
  icon: "size-9 rounded-lg",
  "icon-sm": "size-8 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const buttonClass = (variant: Variant = "secondary", size: Size = "md", className?: string) =>
  cn(
    "inline-flex shrink-0 cursor-pointer select-none items-center justify-center font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
});
