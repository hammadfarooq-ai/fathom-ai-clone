"use client";

import { useMemo, useSyncExternalStore } from "react";
import { baseMeetingId, findMeeting, seededClips, seededMeetings } from "@/data";
import { CURRENT_USER_ID } from "@/data/people";
import type { Clip, Highlight, Meeting, Platform, TemplateId } from "@/types";

/**
 * Client-side workspace state. Seeded data is immutable and ships with the app;
 * everything a user changes (action items, highlights, clips, simulated imports,
 * settings) is stored here and persisted to localStorage. Swapping this module
 * for API calls is the seam for a real backend.
 */

export interface ImportedMeeting {
  id: string;
  baseId: string;
  title: string;
  date: string;
  platform: Platform;
  /** Epoch ms timestamps for the simulated processing pipeline. */
  startedAt: number;
  readyAt: number;
}

export interface WorkspaceSettings {
  calendars: { google: boolean; outlook: boolean };
  autoRecord: "all" | "external" | "none";
  defaultTemplate: TemplateId;
  integrations: Record<"slack" | "hubspot" | "notion" | "linear", boolean>;
  notifications: { summaryEmail: boolean; actionReminders: boolean; weeklyDigest: boolean };
  joinAs: string;
}

interface State {
  actionOverrides: Record<string, boolean>;
  userHighlights: Highlight[];
  removedHighlightIds: string[];
  imports: ImportedMeeting[];
  templates: Record<string, TemplateId>;
  clips: Clip[];
  settings: WorkspaceSettings;
}

const STORAGE_KEY = "parley:workspace:v1";

const INITIAL: State = {
  actionOverrides: {},
  userHighlights: [],
  removedHighlightIds: [],
  imports: [],
  templates: {},
  clips: [],
  settings: {
    calendars: { google: true, outlook: false },
    autoRecord: "all",
    defaultTemplate: "general",
    integrations: { slack: true, hubspot: false, notion: false, linear: false },
    notifications: { summaryEmail: true, actionReminders: true, weeklyDigest: false },
    joinAs: "Parley Notetaker",
  },
};

let state: State = INITIAL;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      state = { ...INITIAL, ...parsed, settings: { ...INITIAL.settings, ...parsed.settings } };
    }
  } catch {
    state = INITIAL;
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode); state still works in memory.
  }
}

function setState(update: (s: State) => Partial<State>) {
  load();
  state = { ...state, ...update(state) };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    loaded = false;
    load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return state;
}

function getServerSnapshot() {
  return INITIAL;
}

export function useWorkspace<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(getServerSnapshot()),
  );
}

/* ------------------------------------------------------------------ */
/* Meetings                                                            */
/* ------------------------------------------------------------------ */

export function meetingFromImport(imp: ImportedMeeting): Meeting | undefined {
  const base = findMeeting(imp.id);
  if (!base) return undefined;
  return { ...base, title: imp.title, date: imp.date, recording: { ...base.recording, platform: imp.platform } };
}

/** All meetings in the workspace (seeded + imported), newest first. */
export function useMeetings(): Meeting[] {
  const imports = useWorkspace((s) => s.imports);
  return useMemo(() => {
    const imported = imports.map(meetingFromImport).filter((m): m is Meeting => Boolean(m));
    return [...imported, ...seededMeetings].sort((a, b) => b.date.localeCompare(a.date));
  }, [imports]);
}

export function useImport(id: string): ImportedMeeting | undefined {
  const imports = useWorkspace((s) => s.imports);
  return imports.find((i) => i.id === id);
}

export function startImport(input: { baseId: string; title: string; platform: Platform; date: string }): ImportedMeeting {
  load();
  const existing = state.imports.filter((i) => i.baseId === input.baseId).length;
  const id = existing === 0 ? input.baseId : `${input.baseId}--${existing + 1}`;
  const now = Date.now();
  const imp: ImportedMeeting = { id, ...input, startedAt: now, readyAt: now + PROCESSING_TOTAL_MS };
  setState((s) => ({ imports: [imp, ...s.imports] }));
  return imp;
}

export function deleteImport(id: string) {
  setState((s) => ({ imports: s.imports.filter((i) => i.id !== id) }));
}

export const PROCESSING_STEPS = [
  { id: "recording", label: "Recording", detail: "Capturing audio and video", ms: 1800 },
  { id: "transcribing", label: "Transcribing", detail: "Speaker-separated transcript", ms: 2400 },
  { id: "analyzing", label: "Analyzing", detail: "Summary, decisions, and action items", ms: 2200 },
  { id: "ready", label: "Ready", detail: "Your meeting notes are ready", ms: 0 },
] as const;

export const PROCESSING_TOTAL_MS = PROCESSING_STEPS.reduce((a, s) => a + s.ms, 0);

/** Index of the current processing step for an import at time `now`. */
export function processingStep(imp: ImportedMeeting, now: number): number {
  let elapsed = now - imp.startedAt;
  for (let i = 0; i < PROCESSING_STEPS.length - 1; i++) {
    if (elapsed < PROCESSING_STEPS[i].ms) return i;
    elapsed -= PROCESSING_STEPS[i].ms;
  }
  return PROCESSING_STEPS.length - 1;
}

/* ------------------------------------------------------------------ */
/* Action items                                                        */
/* ------------------------------------------------------------------ */

export function useActionOverrides() {
  return useWorkspace((s) => s.actionOverrides);
}

export function setActionCompleted(id: string, completed: boolean) {
  setState((s) => ({ actionOverrides: { ...s.actionOverrides, [id]: completed } }));
}

/* ------------------------------------------------------------------ */
/* Highlights                                                          */
/* ------------------------------------------------------------------ */

/** Seeded + user highlights, minus removed ones, for the given meetings. */
export function useHighlights(meetings: Meeting[]): Highlight[] {
  const user = useWorkspace((s) => s.userHighlights);
  const removed = useWorkspace((s) => s.removedHighlightIds);
  return useMemo(() => {
    const ids = new Set(meetings.map((m) => m.id));
    const removedSet = new Set(removed);
    const seeded = meetings.flatMap((m) => m.highlights.map((h) => ({ ...h, meetingId: m.id })));
    return [...seeded, ...user.filter((h) => ids.has(h.meetingId))]
      .filter((h) => !removedSet.has(h.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.start - b.start);
  }, [meetings, user, removed]);
}

export function addHighlight(input: Omit<Highlight, "id" | "createdAt" | "createdBy">): Highlight {
  const h: Highlight = {
    ...input,
    id: `uh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdBy: CURRENT_USER_ID,
    createdAt: new Date().toISOString(),
  };
  setState((s) => ({ userHighlights: [h, ...s.userHighlights] }));
  return h;
}

export function removeHighlight(id: string) {
  setState((s) =>
    id.startsWith("uh-")
      ? { userHighlights: s.userHighlights.filter((h) => h.id !== id) }
      : { removedHighlightIds: [...s.removedHighlightIds, id] },
  );
}

export function restoreHighlight(h: Highlight) {
  setState((s) =>
    h.id.startsWith("uh-")
      ? { userHighlights: [h, ...s.userHighlights] }
      : { removedHighlightIds: s.removedHighlightIds.filter((id) => id !== h.id) },
  );
}

/* ------------------------------------------------------------------ */
/* Templates, clips, settings                                          */
/* ------------------------------------------------------------------ */

export function useTemplate(meeting: Meeting): TemplateId {
  const chosen = useWorkspace((s) => s.templates[meeting.id]);
  return chosen ?? meeting.template;
}

export function setTemplate(meetingId: string, template: TemplateId) {
  setState((s) => ({ templates: { ...s.templates, [meetingId]: template } }));
}

export function useClips(): Clip[] {
  const clips = useWorkspace((s) => s.clips);
  return useMemo(() => [...clips, ...seededClips], [clips]);
}

export function saveClip(clip: Clip) {
  setState((s) => ({ clips: [clip, ...s.clips.filter((c) => c.id !== clip.id)] }));
}

export function deleteClip(id: string) {
  setState((s) => ({ clips: s.clips.filter((c) => c.id !== id) }));
}

export function useSettings(): WorkspaceSettings {
  return useWorkspace((s) => s.settings);
}

export function updateSettings(patch: Partial<WorkspaceSettings>) {
  setState((s) => ({ settings: { ...s.settings, ...patch } }));
}

export function resetWorkspace() {
  setState(() => INITIAL);
}

export { baseMeetingId };
