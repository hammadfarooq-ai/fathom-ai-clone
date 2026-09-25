"use client";

import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps, ReactNode } from "react";
import { MARK_CLOSE, MARK_OPEN } from "@/lib/marks";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Buttons                                                              */
/* ------------------------------------------------------------------ */

const VARIANTS = {
  primary: "bg-ink text-paper hover:bg-ink-2 disabled:bg-faint",
  accent: "bg-accent text-accent-ink hover:bg-accent-hover",
  outline: "border border-rule-strong bg-card text-ink hover:border-ink/40 hover:bg-sunken/60",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  danger: "border border-rule-strong bg-card text-danger hover:bg-danger/10",
} as const;

const SIZES = {
  sm: "h-8 gap-1.5 rounded-md px-2.5 text-[13px] [&_svg]:size-3.5",
  md: "h-9 gap-2 rounded-md px-3.5 text-[13.5px] [&_svg]:size-4",
  lg: "h-11 gap-2 rounded-lg px-5 text-[15px] [&_svg]:size-4",
  icon: "size-9 rounded-md [&_svg]:size-4",
  "icon-sm": "size-8 rounded-md [&_svg]:size-4",
} as const;

export function Button({
  variant = "outline",
  size = "md",
  asChild,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof VARIANTS; size?: keyof typeof SIZES; asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                         */
/* ------------------------------------------------------------------ */

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-grid h-5 min-w-5 place-items-center rounded border border-rule-strong bg-card px-1 font-mono text-[10.5px] text-muted", className)}>
      {children}
    </kbd>
  );
}

export function Eyebrow({ children, className, as: As = "p" }: { children: ReactNode; className?: string; as?: "p" | "h2" | "h3" | "span" }) {
  return <As className={cn("eyebrow", className)}>{children}</As>;
}

export function Tag({ children, tone = "plain", className }: { children: ReactNode; tone?: "plain" | "accent" | "mark" | "ok"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-[11px] font-medium whitespace-nowrap",
        tone === "plain" && "bg-sunken text-ink-2",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "mark" && "bg-mark-soft text-ink",
        tone === "ok" && "bg-ok-soft text-ok",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative shrink-0 rounded-full border transition-colors disabled:opacity-50",
        size === "md" ? "h-5 w-9" : "h-4 w-7",
        checked ? "border-ink bg-ink" : "border-rule-strong bg-sunken",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-full bg-card shadow-card transition-all",
          size === "md" ? "size-3.5" : "size-2.5",
          checked ? (size === "md" ? "left-[18px]" : "left-[14px]") : "left-[2px]",
        )}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-md border border-rule bg-sunken/70 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors",
            value === o.value ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
          {o.count !== undefined ? <span className="tabular text-faint">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children, icon, className }: { title: string; children?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-3 text-faint [&_svg]:size-6">{icon}</div> : null}
      <p className="font-display text-2xl text-ink">{title}</p>
      {children ? <div className="mt-1.5 max-w-sm text-[13.5px] text-muted">{children}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-sunken", className)} />;
}

/** Renders ⟦matched⟧ spans from Postgres ts_headline as highlighter marks. */
export function MarkedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(new RegExp(`(${MARK_OPEN}[^${MARK_CLOSE}]*${MARK_CLOSE})`, "g"));
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.startsWith(MARK_OPEN) ? (
          <mark key={i} className="marker">
            {part.slice(1, -1)}
          </mark>
        ) : (
          part
        ),
      )}
    </span>
  );
}

/** Highlights occurrences of `query` words inside plain text (client-side). */
export function HighlightWords({ text, query }: { text: string; query?: string }) {
  const terms = (query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length > 1);
  if (terms.length === 0) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="marker">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
