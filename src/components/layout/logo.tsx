import { cn } from "@/lib/utils";

/** Original Parley mark: a speech bubble containing a waveform. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-brand-700" />
      <path
        d="M9 9.5h14a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-6.2L12 25v-3.5H9A2.5 2.5 0 0 1 6.5 19v-7A2.5 2.5 0 0 1 9 9.5Z"
        className="fill-brand-50"
      />
      <g className="stroke-brand-700" strokeWidth="1.8" strokeLinecap="round">
        <path d="M11 14.2v2.6" />
        <path d="M14.3 12.5v6" />
        <path d="M17.6 13.6v3.8" />
        <path d="M20.9 14.6v1.8" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-ink">Parley</span>
    </span>
  );
}
