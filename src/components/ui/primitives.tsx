import type { HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-subtle text-ink-2 [&_svg]:size-4">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold tracking-tight text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type Tone = "neutral" | "brand" | "mark" | "blue" | "violet" | "rose" | "orange" | "green" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-subtle text-ink-2",
  brand: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100",
  mark: "bg-mark-50 text-mark-700 ring-1 ring-inset ring-mark-100",
  blue: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100",
  violet: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100",
  rose: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100",
  orange: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-100",
  green: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
  outline: "text-ink-2 ring-1 ring-inset ring-line",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 [&_svg]:size-3",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink shadow-card outline-none transition-colors placeholder:text-faint hover:border-line-strong focus:border-brand-400 focus:ring-3 focus:ring-brand-100 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
});

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface px-1 font-sans text-[10px] font-medium text-muted shadow-[0_1px_0_var(--color-line)]",
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-line/60", className)} {...props} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon ? (
        <div className="mb-4 grid size-11 place-items-center rounded-2xl border border-line bg-surface text-muted shadow-card [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-brand-600" : "bg-line-strong",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function SectionLabel({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[11px] font-semibold tracking-wide text-faint uppercase", className)} {...props} />;
}
