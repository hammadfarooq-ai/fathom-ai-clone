"use client";

import { useMemo } from "react";
import type { ActionItem, Meeting } from "@/types";
import { useActionOverrides, useWorkspace } from "./store";
import { useNow } from "./use-now";

export interface ActionWithMeeting {
  item: ActionItem;
  meeting: Meeting;
  completed: boolean;
}

export function useActionItems(meetings: Meeting[]): ActionWithMeeting[] {
  const overrides = useActionOverrides();
  return useMemo(
    () =>
      meetings.flatMap((meeting) =>
        meeting.actionItems.map((item) => ({ item, meeting, completed: overrides[item.id] ?? item.completed })),
      ),
    [meetings, overrides],
  );
}

/** Ids of imported meetings still in the simulated processing pipeline. */
export function useProcessingIds(): Set<string> {
  const imports = useWorkspace((s) => s.imports);
  // `now` is 0 during SSR/hydration, when everything imported counts as processing.
  const now = useNow(500, imports.length > 0);
  return useMemo(() => new Set(imports.filter((i) => now === 0 || i.readyAt > now).map((i) => i.id)), [imports, now]);
}
