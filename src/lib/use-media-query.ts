"use client";

import { useSyncExternalStore } from "react";

/** Media query match; assumes a desktop viewport during SSR. */
export function useMediaQuery(query: string, serverValue = true): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
