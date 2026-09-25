import { cn } from "@/lib/utils";

/** Wordmark: the name in the display serif, led by a small "on air" light. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-ink", className)}>
      <span className="relative grid size-4 place-items-center" aria-hidden>
        <span className="absolute size-4 rounded-full bg-accent/20" />
        <span className="size-2 rounded-full bg-accent" />
      </span>
      <span className="font-display text-[26px] leading-none tracking-tight">Parley</span>
    </span>
  );
}
