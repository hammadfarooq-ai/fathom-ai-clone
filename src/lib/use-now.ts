"use client";

import { useSyncExternalStore } from "react";

/**
 * Current time, re-rendering every `intervalMs` while `active`. Returns 0 on the
 * server so time-dependent UI never causes hydration mismatches.
 */
export function useNow(intervalMs = 250, active = true): number {
  return useSyncExternalStore(
    (cb) => {
      if (!active) return () => {};
      const id = window.setInterval(cb, intervalMs);
      return () => window.clearInterval(id);
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0,
  );
}
