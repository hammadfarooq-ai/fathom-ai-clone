import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import * as t from "@/db/schema";
import type {
  ActionItem,
  Highlight,
  Meeting,
  MeetingListItem,
  MeetingType,
  Person,
  ProcessingState,
  TranscriptEntry,
} from "@/types";
import { tsQuery } from "./text-search";

/* ------------------------------------------------------------------ */
/* Processing pipeline (the capture layer is stubbed)                   */
/* ------------------------------------------------------------------ */

export const PROCESSING_STEPS = [
  { id: "recording", label: "Recording", detail: "Notetaker captures audio and video", weight: 0.3 },
  { id: "transcribing", label: "Transcribing", detail: "Speaker-separated transcript", weight: 0.4 },
  { id: "analyzing", label: "Analyzing", detail: "Summary, decisions, and action items", weight: 0.3 },
  { id: "ready", label: "Ready", detail: "Notes are ready", weight: 0 },
] as const;

/** Pipeline step from elapsed time. While still processing it never reports "Ready". */
export function processingState(startedAt: Date, readyAt: Date, now = Date.now()): ProcessingState {
  const total = readyAt.getTime() - startedAt.getTime();
  let elapsed = (now - startedAt.getTime()) / Math.max(1, total);
  let step = PROCESSING_STEPS.length - 1;
  for (let i = 0; i < PROCESSING_STEPS.length - 1; i++) {
    if (elapsed < PROCESSING_STEPS[i].weight) {
      step = i;
      break;
    }
    elapsed -= PROCESSING_STEPS[i].weight;
  }
  return {
    step: Math.min(step, PROCESSING_STEPS.length - 2),
    steps: PROCESSING_STEPS.map(({ id, label, detail }) => ({ id, label, detail })),
    startedAt: startedAt.toISOString(),
    readyAt: readyAt.toISOString(),
  };
}

/**
 * Promote stubbed captures whose simulated pipeline has finished. Imports are
 * promoted by their analysis job instead. Cheap; runs before reads.
 */
export async function settleProcessing() {
  await getDb()
    .update(t.meetings)
    .set({ status: "ready" })
    .where(and(eq(t.meetings.status, "processing"), eq(t.meetings.source, "capture"), lte(t.meetings.processingReadyAt, new Date())));
}

/* ------------------------------------------------------------------ */
/* People                                                               */
/* ------------------------------------------------------------------ */

export async function listPeople(): Promise<Person[]> {
  const rows = await getDb().select().from(t.people).orderBy(asc(t.people.external), asc(t.people.name));
  return rows.map(toPerson);
}

function toPerson(p: typeof t.people.$inferSelect): Person {
  return { id: p.id, name: p.name, email: p.email, role: p.role, company: p.company, color: p.color, external: p.external };
}

async function peopleById(ids: Iterable<string>): Promise<Record<string, Person>> {
  const list = [...new Set(ids)];
  if (list.length === 0) return {};
  const rows = await getDb().select().from(t.people).where(inArray(t.people.id, list));
  return Object.fromEntries(rows.map((p) => [p.id, toPerson(p)]));
}

/* ------------------------------------------------------------------ */
/* Full meetings                                                        */
/* ------------------------------------------------------------------ */

/** Load complete meetings (transcript, actions, highlights, people) in a few queries. */
export async function getMeetings(ids: string[]): Promise<Meeting[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const [rows, participants, transcript, actions, highlights] = await Promise.all([
    db.select().from(t.meetings).where(inArray(t.meetings.id, ids)),
    db.select().from(t.meetingParticipants).where(inArray(t.meetingParticipants.meetingId, ids)).orderBy(asc(t.meetingParticipants.position)),
    db
      .select({
        id: t.transcriptEntries.id,
        meetingId: t.transcriptEntries.meetingId,
        startSec: t.transcriptEntries.startSec,
        speakerId: t.transcriptEntries.speakerId,
        text: t.transcriptEntries.text,
      })
      .from(t.transcriptEntries)
      .where(inArray(t.transcriptEntries.meetingId, ids))
      .orderBy(asc(t.transcriptEntries.position)),
    db.select().from(t.actionItems).where(inArray(t.actionItems.meetingId, ids)).orderBy(asc(t.actionItems.position), asc(t.actionItems.createdAt)),
    db.select().from(t.highlights).where(inArray(t.highlights.meetingId, ids)).orderBy(asc(t.highlights.startSec)),
  ]);

  const group = <T extends { meetingId: string }>(list: T[]) => {
    const map = new Map<string, T[]>();
    for (const item of list) map.set(item.meetingId, [...(map.get(item.meetingId) ?? []), item]);
    return map;
  };
  const byParticipants = group(participants);
  const byTranscript = group(transcript);
  const byActions = group(actions);
  const byHighlights = group(highlights);

  const referenced = new Set<string>();
  rows.forEach((m) => referenced.add(m.hostId));
  participants.forEach((p) => referenced.add(p.personId));
  transcript.forEach((e) => referenced.add(e.speakerId));
  actions.forEach((a) => referenced.add(a.ownerId));
  highlights.forEach((h) => referenced.add(h.createdBy));
  const people = await peopleById(referenced);

  const now = Date.now();
  const meetings = rows.map((m): Meeting => {
    const status =
      m.status === "processing" && m.source === "capture" && m.processingReadyAt && m.processingReadyAt.getTime() <= now ? "ready" : m.status;
    const entries: TranscriptEntry[] = (byTranscript.get(m.id) ?? []).map((e) => ({
      id: e.id,
      start: e.startSec,
      speakerId: e.speakerId,
      text: e.text,
    }));
    const participantIds = (byParticipants.get(m.id) ?? []).map((p) => p.personId);
    const local = new Set([m.hostId, ...participantIds, ...entries.map((e) => e.speakerId)]);
    (byActions.get(m.id) ?? []).forEach((a) => local.add(a.ownerId));
    (byHighlights.get(m.id) ?? []).forEach((h) => local.add(h.createdBy));
    return {
      id: m.id,
      title: m.title,
      date: m.startsAt.toISOString(),
      durationSec: m.durationSec,
      meetingType: m.meetingType,
      hostId: m.hostId,
      participants: participantIds,
      recording: { durationSec: m.durationSec, platform: m.platform, url: m.recordingUrl ?? undefined },
      summary: m.summary,
      keyDecisions: m.keyDecisions,
      topics: m.topics,
      takeaways: m.takeaways,
      actionItems: (byActions.get(m.id) ?? []).map(toActionItem),
      highlights: (byHighlights.get(m.id) ?? []).map(toHighlight),
      transcript: entries,
      template: m.template,
      tags: m.tags,
      tone: m.tone,
      suggestedQuestions: m.suggestedQuestions,
      people: Object.fromEntries([...local].filter((id) => people[id]).map((id) => [id, people[id]])),
      status,
      source: m.source,
    };
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return meetings.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const [meeting] = await getMeetings([id]);
  return meeting ?? null;
}

export async function getProcessing(id: string): Promise<ProcessingState | null> {
  await settleProcessing();
  const [row] = await getDb()
    .select({ status: t.meetings.status, startedAt: t.meetings.processingStartedAt, readyAt: t.meetings.processingReadyAt })
    .from(t.meetings)
    .where(eq(t.meetings.id, id));
  if (!row || row.status === "ready" || !row.startedAt || !row.readyAt) return null;
  return processingState(row.startedAt, row.readyAt);
}

export function toActionItem(a: typeof t.actionItems.$inferSelect): ActionItem {
  return { id: a.id, title: a.title, ownerId: a.ownerId, dueDate: a.dueDate, completed: a.completed };
}

export function toHighlight(h: typeof t.highlights.$inferSelect): Highlight {
  return {
    id: h.id,
    meetingId: h.meetingId,
    start: h.startSec,
    end: h.endSec,
    title: h.title,
    description: h.description,
    transcriptEntryId: h.transcriptEntryId ?? "",
    createdBy: h.createdBy,
    createdAt: h.createdAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Meeting list                                                         */
/* ------------------------------------------------------------------ */

export interface ListFilters {
  q?: string;
  type?: MeetingType;
  scope?: "all" | "external" | "internal";
  limit?: number;
}

export async function listMeetings(filters: ListFilters = {}): Promise<MeetingListItem[]> {
  await settleProcessing();
  const db = getDb();

  const conditions = [];
  if (filters.type) conditions.push(eq(t.meetings.meetingType, filters.type));
  const query = filters.q ? tsQuery(filters.q) : null;
  if (filters.q && !query) return [];
  if (query) {
    conditions.push(
      sql`(${t.meetings.searchVector} @@ to_tsquery('english', ${query})
        OR EXISTS (SELECT 1 FROM ${t.transcriptEntries} te WHERE te.meeting_id = meetings.id AND te.search_vector @@ to_tsquery('english', ${query})))`,
    );
  }
  if (filters.scope && filters.scope !== "all") {
    const hasExternal = sql`EXISTS (SELECT 1 FROM ${t.meetingParticipants} mp JOIN ${t.people} p ON p.id = mp.person_id WHERE mp.meeting_id = meetings.id AND p.external)`;
    conditions.push(filters.scope === "external" ? hasExternal : sql`NOT ${hasExternal}`);
  }

  const rows = await db
    .select({
      id: t.meetings.id,
      title: t.meetings.title,
      startsAt: t.meetings.startsAt,
      durationSec: t.meetings.durationSec,
      meetingType: t.meetings.meetingType,
      platform: t.meetings.platform,
      hostId: t.meetings.hostId,
      tags: t.meetings.tags,
      summary: t.meetings.summary,
      status: t.meetings.status,
      source: t.meetings.source,
      processingStartedAt: t.meetings.processingStartedAt,
      processingReadyAt: t.meetings.processingReadyAt,
      openActions: sql<number>`(SELECT count(*)::int FROM ${t.actionItems} a WHERE a.meeting_id = meetings.id AND NOT a.completed)`,
      totalActions: sql<number>`(SELECT count(*)::int FROM ${t.actionItems} a WHERE a.meeting_id = meetings.id)`,
      highlightCount: sql<number>`(SELECT count(*)::int FROM ${t.highlights} h WHERE h.meeting_id = meetings.id)`,
      participants: sql<string[]>`(SELECT coalesce(array_agg(mp.person_id ORDER BY mp.position), '{}') FROM ${t.meetingParticipants} mp WHERE mp.meeting_id = meetings.id)`,
    })
    .from(t.meetings)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(t.meetings.startsAt))
    .limit(filters.limit ?? 200);

  const talk = await talkTime(rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    date: r.startsAt.toISOString(),
    durationSec: r.durationSec,
    meetingType: r.meetingType,
    platform: r.platform,
    hostId: r.hostId,
    participants: r.participants,
    tags: r.tags,
    summary: r.summary,
    status: r.status,
    source: r.source,
    openActions: r.openActions,
    totalActions: r.totalActions,
    highlightCount: r.highlightCount,
    talkTime: talk.get(r.id) ?? [],
    processing:
      r.status === "processing" && r.processingStartedAt && r.processingReadyAt
        ? processingState(r.processingStartedAt, r.processingReadyAt)
        : undefined,
  }));
}

/**
 * Share of speaking time per speaker, computed in SQL: each line lasts until the
 * next line starts (the last one until the end of the recording).
 */
async function talkTime(ids: string[]): Promise<Map<string, { personId: string; share: number }[]>> {
  const result = new Map<string, { personId: string; share: number }[]>();
  if (ids.length === 0) return result;
  const rows = await getDb().execute<{ meeting_id: string; speaker_id: string; seconds: number }>(sql`
    WITH spans AS (
      SELECT te.meeting_id, te.speaker_id,
        coalesce(lead(te.start_sec) OVER (PARTITION BY te.meeting_id ORDER BY te.position), m.duration_sec) - te.start_sec AS seconds
      FROM ${t.transcriptEntries} te JOIN ${t.meetings} m ON m.id = te.meeting_id
      WHERE te.meeting_id IN ${ids}
    )
    SELECT meeting_id, speaker_id, sum(greatest(seconds, 0))::int AS seconds FROM spans GROUP BY meeting_id, speaker_id
  `);
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.meeting_id, (totals.get(r.meeting_id) ?? 0) + r.seconds);
  for (const r of rows) {
    const list = result.get(r.meeting_id) ?? [];
    list.push({ personId: r.speaker_id, share: r.seconds / (totals.get(r.meeting_id) || 1) });
    result.set(r.meeting_id, list);
  }
  result.forEach((list) => list.sort((a, b) => b.share - a.share));
  return result;
}
