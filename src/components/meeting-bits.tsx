"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Platform, ProcessingState } from "@/types";

export const PLATFORM_LABEL: Record<Platform, string> = { zoom: "Zoom", "google-meet": "Google Meet", teams: "Teams", upload: "Imported" };

/** Horizontal pipeline: Recording → Transcribing → Analyzing → Ready. */
export function ProcessingSteps({ state, className }: { state: ProcessingState; className?: string }) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]", className)} aria-label="Processing">
      {state.steps.map((s, i) => {
        const done = i < state.step;
        const current = i === state.step;
        return (
          <li key={s.id} className={cn("flex items-center gap-1.5", done ? "text-ok" : current ? "font-medium text-ink" : "text-faint")} aria-current={current ? "step" : undefined}>
            {done ? (
              <Check className="size-3.5" />
            ) : current ? (
              <span className="size-2 animate-pulse-dot rounded-full bg-accent" />
            ) : (
              <span className="size-2 rounded-full border border-rule-strong" />
            )}
            {s.label}
            {i < state.steps.length - 1 ? <span className="ml-1.5 h-px w-4 bg-rule-strong" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}
