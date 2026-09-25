"use client";

import useSWR, { mutate, type SWRConfiguration } from "swr";
import type {
  ActionItem,
  ActionItemWithMeeting,
  AskAnswer,
  Clip,
  Highlight,
  HighlightWithContext,
  Meeting,
  MeetingListItem,
  MeetingType,
  Person,
  Platform,
  ProcessingState,
  TemplateId,
  UpcomingMeeting,
  WorkspaceSettings,
} from "@/types";
import { meetingsKey } from "./keys";

/**
 * Browser-side access to the REST API. Reads go through SWR (pages seed it
 * with server-rendered data via <SWRConfig fallback>), writes call the API and
 * then revalidate the affected keys so every view stays consistent.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: json === undefined ? rest.headers : { "Content-Type": "application/json", ...rest.headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

const fetcher = <T,>(url: string) => api<T>(url);

/** Revalidate every cached key that starts with one of the prefixes. */
export function refresh(...prefixes: string[]) {
  return mutate((key) => typeof key === "string" && prefixes.some((p) => key.startsWith(p)));
}

export type MeetingWithProcessing = Meeting & { processing?: ProcessingState };

export interface OverviewStats {
  meetingsThisWeek: number;
  secondsThisWeek: number;
  openActions: number;
  overdueActions: number;
  highlightsThisWeek: number;
  clipViews: number;
}

export interface SearchResponse {
  query: string;
  results: {
    meetingId: string;
    title: string;
    date: string;
    meetingType: MeetingType;
    score: number;
    matches: { type: MatchType; text: string; start?: number; entryId?: string; speakerId?: string }[];
  }[];
}

export type MatchType = "title" | "summary" | "decision" | "topic" | "transcript" | "action" | "highlight";

export const MATCH_LABELS: Record<MatchType, string> = {
  title: "Title",
  summary: "Summary",
  decision: "Decision",
  topic: "Chapter",
  transcript: "Transcript",
  action: "Action item",
  highlight: "Highlight",
};

/* ------------------------------------------------------------------ */
/* Keys + reads                                                        */
/* ------------------------------------------------------------------ */

export function useMeetings(params: { q?: string; type?: string; scope?: string } = {}, config?: SWRConfiguration) {
  const key = meetingsKey(params);
  const hasProcessing = (data?: MeetingListItem[]) => Boolean(data?.some((m) => m.status === "processing"));
  return useSWR<MeetingListItem[]>(key, fetcher, {
    keepPreviousData: true,
    refreshInterval: (data) => (hasProcessing(data) ? 1500 : 0),
    ...config,
  });
}

export function useMeeting(id: string, config?: SWRConfiguration) {
  return useSWR<MeetingWithProcessing>(`/api/meetings/${id}`, fetcher, {
    refreshInterval: (data) => (data?.status === "processing" ? 1200 : 0),
    ...config,
  });
}

export const usePeople = () => useSWR<Person[]>("/api/people", fetcher);
export const useActionItems = (status: "open" | "done" | "all" = "all") =>
  useSWR<ActionItemWithMeeting[]>(`/api/action-items?status=${status}`, fetcher);
export const useHighlights = () => useSWR<HighlightWithContext[]>("/api/highlights", fetcher);
export const useClips = () => useSWR<Clip[]>("/api/clips", fetcher);
export const useUpcoming = () => useSWR<UpcomingMeeting[]>("/api/calendar/events?days=14", fetcher);
export const useSettings = () => useSWR<WorkspaceSettings>("/api/settings", fetcher);
export const useOverview = () => useSWR<OverviewStats>("/api/overview", fetcher);

export function useSearch(q: string) {
  const query = q.trim();
  return useSWR<SearchResponse>(query ? `/api/search?q=${encodeURIComponent(query)}` : null, fetcher, { keepPreviousData: true });
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export async function setActionCompleted(item: { id: string; meetingId?: string }, completed: boolean) {
  // Optimistic: flip the item everywhere it is cached, then confirm with the server.
  const flip = <T extends { id: string; completed: boolean }>(list?: T[]) => list?.map((a) => (a.id === item.id ? { ...a, completed } : a));
  await mutate(
    (key) => typeof key === "string" && key.startsWith("/api/action-items"),
    (list?: ActionItemWithMeeting[]) => flip(list),
    { revalidate: false },
  );
  if (item.meetingId) {
    await mutate(`/api/meetings/${item.meetingId}`, (m?: MeetingWithProcessing) => m && { ...m, actionItems: flip(m.actionItems)! }, { revalidate: false });
  }
  try {
    await api<ActionItem>(`/api/action-items/${item.id}`, { method: "PATCH", json: { completed } });
  } finally {
    await refresh("/api/action-items", "/api/meetings", "/api/overview");
  }
}

export async function addActionItem(meetingId: string, input: { title: string; ownerId: string; dueDate: string }) {
  const item = await api<ActionItem>(`/api/meetings/${meetingId}/action-items`, { method: "POST", json: input });
  await refresh(`/api/meetings`, "/api/action-items", "/api/overview");
  return item;
}

export async function removeActionItem(meetingId: string, id: string) {
  await api(`/api/action-items/${id}`, { method: "DELETE" });
  await refresh(`/api/meetings/${meetingId}`, "/api/meetings", "/api/action-items", "/api/overview");
}

export async function addHighlight(meetingId: string, input: { id?: string; transcriptEntryId?: string; start: number; end: number; title: string; description?: string }) {
  const h = await api<Highlight>(`/api/meetings/${meetingId}/highlights`, { method: "POST", json: input });
  await refresh(`/api/meetings`, "/api/highlights", "/api/overview", "/api/search");
  return h;
}

export async function removeHighlight(meetingId: string, id: string) {
  const h = await api<Highlight>(`/api/highlights/${id}`, { method: "DELETE" });
  await refresh(`/api/meetings`, "/api/highlights", "/api/overview", "/api/search");
  return h;
}

export async function setMeetingTemplate(meetingId: string, template: TemplateId) {
  await mutate(`/api/meetings/${meetingId}`, (m?: MeetingWithProcessing) => m && { ...m, template }, { revalidate: false });
  await api(`/api/meetings/${meetingId}`, { method: "PATCH", json: { template } });
}

export async function renameMeeting(meetingId: string, title: string) {
  await api(`/api/meetings/${meetingId}`, { method: "PATCH", json: { title } });
  await refresh("/api/meetings");
}

export async function deleteMeeting(meetingId: string) {
  await api(`/api/meetings/${meetingId}`, { method: "DELETE" });
  await refresh("/api/meetings", "/api/action-items", "/api/highlights", "/api/clips", "/api/overview");
}

export async function createClip(input: { meetingId: string; start: number; end: number; title: string }) {
  const clip = await api<Clip>("/api/clips", { method: "POST", json: input });
  await refresh("/api/clips", "/api/overview");
  return clip;
}

export async function deleteClip(id: string) {
  await api(`/api/clips/${id}`, { method: "DELETE" });
  await refresh("/api/clips", "/api/overview");
}

export async function setAutoRecord(id: string, autoRecord: boolean) {
  await mutate("/api/calendar/events?days=14", (list?: UpcomingMeeting[]) => list?.map((e) => (e.id === id ? { ...e, autoRecord } : e)), { revalidate: false });
  await api(`/api/calendar/events/${id}`, { method: "PATCH", json: { autoRecord } });
}

export async function patchSettings(patch: Partial<{ [K in keyof WorkspaceSettings]: Partial<WorkspaceSettings[K]> | WorkspaceSettings[K] }>) {
  const next = await api<WorkspaceSettings>("/api/settings", { method: "PATCH", json: patch });
  await mutate("/api/settings", next, { revalidate: false });
  if (patch.calendars) await refresh("/api/calendar");
  return next;
}

export async function startCapture(input: { sampleId: string; title?: string; platform: Platform }) {
  const res = await api<{ id: string }>("/api/meetings", { method: "POST", json: { kind: "capture", ...input } });
  await refresh("/api/meetings", "/api/overview");
  return res;
}

export async function importTranscript(input: { title: string; meetingType: MeetingType; transcript: string }) {
  const res = await api<{ id: string }>("/api/meetings", { method: "POST", json: { kind: "import", ...input } });
  await refresh("/api/meetings", "/api/people", "/api/overview");
  return res;
}

export async function askQuestion(question: string, meetingId?: string) {
  return api<AskAnswer>("/api/ask", { method: "POST", json: { question, meetingId } });
}

export async function resetWorkspace() {
  await api("/api/workspace/reset", { method: "POST" });
  await mutate(() => true);
}
