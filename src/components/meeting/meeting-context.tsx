"use client";

import { createContext, useContext } from "react";
import type { Highlight, Meeting } from "@/types";

export interface MeetingContextValue {
  meeting: Meeting;
  highlights: Highlight[];
  openClip: (range?: { start: number; end: number; title?: string }) => void;
  toggleHighlight: (entryId: string) => void;
  showTab: (tab: WorkspaceTab) => void;
}

export type WorkspaceTab = "summary" | "actions" | "highlights" | "ask" | "transcript";

export const MeetingContext = createContext<MeetingContextValue | null>(null);

export function useMeeting(): MeetingContextValue {
  const ctx = useContext(MeetingContext);
  if (!ctx) throw new Error("useMeeting must be used inside the meeting workspace");
  return ctx;
}
