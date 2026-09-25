import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import * as t from "@/db/schema";
import { sampleRecordings } from "@/db/seed";
import { CURRENT_USER_ID } from "@/lib/constants";
import type {
  ActionItemWithMeeting,
  MeetingType,
  Clip,
  HighlightWithContext,
  Platform,
  TemplateId,
  UpcomingMeeting,
  WorkspaceSettings,
} from "@/types";
import { analyzeTranscript, estimateDuration, parseTranscript } from "./analyze";
import { toActionItem, toHighlight } from "./meetings";
import { DEFAULT_SETTINGS, insertMeeting, seedDatabase } from "./seed";

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
  }
}

export function newId(prefix: string, bytes = 6): string {
  return `${prefix}_${randomBytes(bytes).toString("base64url")}`;
}

async function assertMeeting(meetingId: string) {
  const [row] = await getDb().select({ id: t.meetings.id }).from(t.meetings).where(eq(t.meetings.id, meetingId));
  if (!row) throw new NotFoundError("Meeting");
}

/* ------------------------------------------------------------------ */
/* Meetings                                                             */
/* ------------------------------------------------------------------ */

export async function updateMeeting(id: string, patch: { title?: string; template?: TemplateId }) {
  const [row] = await getDb().update(t.meetings).set(patch).where(eq(t.meetings.id, id)).returning({ id: t.meetings.id });
  if (!row) throw new NotFoundError("Meeting");
}

export async function deleteMeeting(id: string) {
  const [row] = await getDb().delete(t.meetings).where(eq(t.meetings.id, id)).returning({ id: t.meetings.id });
  if (!row) throw new NotFoundError("Meeting");
}

/** Pipeline duration for stubbed captures and imports. */
const CAPTURE_MS = 9_000;
const IMPORT_MS = 5_000;

function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "meeting"
  );
}

/**
 * Stubbed capture: the "notetaker" records one of the bundled sample
 * recordings. Everything downstream (rows, pipeline status, notes) is real.
 */
export async function startCapture(input: { sampleId: string; title?: string; platform: Platform }) {
  const sample = sampleRecordings.find((s) => s.id === input.sampleId);
  if (!sample) throw new NotFoundError("Sample recording");
  const title = input.title?.trim() || sample.title;
  const id = `${slugify(title)}-${randomBytes(3).toString("hex")}`;
  const now = new Date();
  const startsAt = new Date(now.getTime() - sample.durationSec * 1000);
  startsAt.setUTCSeconds(0, 0);
  await getDb().transaction((tx) =>
    insertMeeting(tx, sample, {
      id,
      title,
      startsAt,
      platform: input.platform,
      source: "capture",
      status: "processing",
      processingStartedAt: now,
      processingReadyAt: new Date(now.getTime() + CAPTURE_MS),
    }),
  );
  return { id };
}

const GUEST_COLORS = ["#b4533a", "#3d6b8f", "#6b7d3a", "#8a4f8c", "#b08428", "#2f7a6d", "#9b4550", "#55608f"];

/**
 * Import a transcript: parse it, map speakers onto people (creating guests for
 * unknown names), and store the meeting as "processing". The returned `analyze`
 * callback produces the notes; the route runs it after responding.
 */
export async function importTranscript(input: { title: string; transcript: string; meetingType: MeetingType; date?: string }) {
  const lines = parseTranscript(input.transcript);
  if (lines.length < 2) throw new RangeError("Couldn't find at least two transcript lines. Put one turn per line, like \"Name: what they said\".");
  if (lines.length > 3000) throw new RangeError("Transcripts are limited to 3,000 lines.");

  const db = getDb();
  const everyone = await db.select().from(t.people);
  const byName = new Map(everyone.map((p) => [p.name.toLowerCase(), p.id]));
  const firstNames = new Map<string, string[]>();
  for (const p of everyone) {
    const first = p.name.split(" ")[0].toLowerCase();
    firstNames.set(first, [...(firstNames.get(first) ?? []), p.id]);
  }

  const speakerIds = new Map<string, string>();
  const guests: (typeof t.people.$inferInsert)[] = [];
  for (const name of new Set(lines.map((l) => l.speaker))) {
    const key = name.toLowerCase();
    const first = firstNames.get(key.split(" ")[0]);
    const existing = byName.get(key) ?? (!key.includes(" ") && first?.length === 1 ? first[0] : undefined);
    if (existing) {
      speakerIds.set(name, existing);
      continue;
    }
    const id = `guest-${slugify(name)}`;
    speakerIds.set(name, id);
    if (!everyone.some((p) => p.id === id) && !guests.some((g) => g.id === id)) {
      guests.push({ id, name, color: GUEST_COLORS[(everyone.length + guests.length) % GUEST_COLORS.length], external: true, role: "Guest" });
    }
  }

  const id = `${slugify(input.title)}-${randomBytes(3).toString("hex")}`;
  const durationSec = estimateDuration(lines);
  const now = new Date();
  const startsAt = input.date ? new Date(input.date) : new Date(now.getTime() - durationSec * 1000);
  const participants = [...new Set(lines.map((l) => speakerIds.get(l.speaker)!))];
  const hostId = participants.includes(CURRENT_USER_ID) ? CURRENT_USER_ID : participants[0];
  const entries = lines.map((l, i) => ({ id: `${id}:t${i + 1}`, start: l.start, speakerId: speakerIds.get(l.speaker)!, text: l.text }));

  await db.transaction(async (tx) => {
    if (guests.length) await tx.insert(t.people).values(guests).onConflictDoNothing();
    await tx.insert(t.meetings).values({
      id,
      title: input.title,
      startsAt,
      durationSec,
      meetingType: input.meetingType,
      platform: "upload",
      hostId,
      source: "import",
      status: "processing",
      processingStartedAt: now,
      processingReadyAt: new Date(now.getTime() + IMPORT_MS),
    });
    await tx.insert(t.meetingParticipants).values(participants.map((personId, position) => ({ meetingId: id, personId, position })));
    await tx.insert(t.transcriptEntries).values(
      entries.map((e, position) => ({ id: e.id, meetingId: id, position, startSec: e.start, speakerId: e.speakerId, text: e.text })),
    );
  });

  const analyze = async () => {
    const names = new Map([...everyone, ...guests].map((p) => [p.id!, p.name!]));
    const speakers = Object.fromEntries(participants.map((pid) => [pid, names.get(pid) ?? pid]));
    try {
      const notes = await analyzeTranscript({ title: input.title, date: startsAt.toISOString(), meetingType: input.meetingType, durationSec, speakers, lines: entries });
      await getDb().transaction(async (tx) => {
        await tx
          .update(t.meetings)
          .set({
            summary: notes.summary,
            keyDecisions: notes.keyDecisions,
            takeaways: notes.takeaways,
            topics: notes.topics,
            tags: notes.tags,
            tone: notes.tone,
            suggestedQuestions: notes.suggestedQuestions,
            template: notes.template,
            status: "ready",
            processingReadyAt: new Date(),
          })
          .where(eq(t.meetings.id, id));
        if (notes.actionItems.length) {
          await tx.insert(t.actionItems).values(
            notes.actionItems.map((a, position) => ({ id: newId("act"), meetingId: id, title: a.title, ownerId: a.ownerId, dueDate: a.dueDate, position })),
          );
        }
      });
    } catch (error) {
      console.error(`Import analysis failed for ${id}`, error);
      await getDb()
        .update(t.meetings)
        .set({ status: "ready", summary: "Notes couldn't be generated for this transcript. The transcript is still searchable.", processingReadyAt: new Date() })
        .where(eq(t.meetings.id, id));
    }
  };

  return { id, analyze };
}

export function listSampleRecordings() {
  return sampleRecordings.map((s) => ({ id: s.id, title: s.title, durationSec: s.durationSec, platform: s.recording.platform, participants: s.participants.length }));
}

/* ------------------------------------------------------------------ */
/* Action items                                                         */
/* ------------------------------------------------------------------ */

export async function listActionItems(filter: { status?: "open" | "done" | "all" } = {}): Promise<ActionItemWithMeeting[]> {
  const status = filter.status ?? "all";
  const rows = await getDb()
    .select({ item: t.actionItems, meetingTitle: t.meetings.title, meetingDate: t.meetings.startsAt })
    .from(t.actionItems)
    .innerJoin(t.meetings, eq(t.meetings.id, t.actionItems.meetingId))
    .where(status === "all" ? eq(t.meetings.status, "ready") : and(eq(t.meetings.status, "ready"), eq(t.actionItems.completed, status === "done")))
    .orderBy(asc(t.actionItems.dueDate), asc(t.actionItems.position));
  return rows.map((r) => ({ ...toActionItem(r.item), meetingId: r.item.meetingId, meetingTitle: r.meetingTitle, meetingDate: r.meetingDate.toISOString() }));
}

export async function createActionItem(meetingId: string, input: { title: string; ownerId: string; dueDate: string }) {
  await assertMeeting(meetingId);
  const [{ next }] = await getDb()
    .select({ next: sql<number>`coalesce(max(${t.actionItems.position}) + 1, 0)::int` })
    .from(t.actionItems)
    .where(eq(t.actionItems.meetingId, meetingId));
  const [row] = await getDb()
    .insert(t.actionItems)
    .values({ id: newId("act"), meetingId, title: input.title, ownerId: input.ownerId, dueDate: input.dueDate, position: next })
    .returning();
  return toActionItem(row);
}

export async function updateActionItem(id: string, patch: { title?: string; ownerId?: string; dueDate?: string; completed?: boolean }) {
  const set: Partial<typeof t.actionItems.$inferInsert> = { ...patch };
  if (patch.completed !== undefined) set.completedAt = patch.completed ? new Date() : null;
  const [row] = await getDb().update(t.actionItems).set(set).where(eq(t.actionItems.id, id)).returning();
  if (!row) throw new NotFoundError("Action item");
  return toActionItem(row);
}

export async function deleteActionItem(id: string) {
  const [row] = await getDb().delete(t.actionItems).where(eq(t.actionItems.id, id)).returning({ id: t.actionItems.id });
  if (!row) throw new NotFoundError("Action item");
}

/* ------------------------------------------------------------------ */
/* Highlights                                                           */
/* ------------------------------------------------------------------ */

export async function listHighlights(): Promise<HighlightWithContext[]> {
  const rows = await getDb()
    .select({
      h: t.highlights,
      meetingTitle: t.meetings.title,
      meetingDate: t.meetings.startsAt,
      quote: t.transcriptEntries.text,
      speakerId: t.transcriptEntries.speakerId,
    })
    .from(t.highlights)
    .innerJoin(t.meetings, eq(t.meetings.id, t.highlights.meetingId))
    .leftJoin(t.transcriptEntries, eq(t.transcriptEntries.id, t.highlights.transcriptEntryId))
    .orderBy(desc(t.highlights.createdAt));
  return rows.map((r) => ({
    ...toHighlight(r.h),
    meetingTitle: r.meetingTitle,
    meetingDate: r.meetingDate.toISOString(),
    quote: r.quote ?? r.h.description,
    speakerId: r.speakerId ?? r.h.createdBy,
  }));
}

export async function createHighlight(
  meetingId: string,
  input: { id?: string; transcriptEntryId?: string; start: number; end: number; title: string; description?: string },
) {
  await assertMeeting(meetingId);
  const [row] = await getDb()
    .insert(t.highlights)
    .values({
      id: input.id ?? newId("hl"),
      meetingId,
      transcriptEntryId: input.transcriptEntryId ?? null,
      startSec: Math.round(input.start),
      endSec: Math.round(input.end),
      title: input.title,
      description: input.description ?? "",
      createdBy: CURRENT_USER_ID,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new Error("Highlight already exists");
  return toHighlight(row);
}

export async function deleteHighlight(id: string) {
  const [row] = await getDb().delete(t.highlights).where(eq(t.highlights.id, id)).returning();
  if (!row) throw new NotFoundError("Highlight");
  return toHighlight(row);
}

/* ------------------------------------------------------------------ */
/* Clips                                                                */
/* ------------------------------------------------------------------ */

function toClip(c: typeof t.clips.$inferSelect, meetingTitle?: string): Clip {
  return { id: c.id, meetingId: c.meetingId, start: c.startSec, end: c.endSec, title: c.title, views: c.views, createdAt: c.createdAt.toISOString(), meetingTitle };
}

export async function listClips(): Promise<Clip[]> {
  const rows = await getDb()
    .select({ c: t.clips, meetingTitle: t.meetings.title })
    .from(t.clips)
    .innerJoin(t.meetings, eq(t.meetings.id, t.clips.meetingId))
    .orderBy(desc(t.clips.createdAt));
  return rows.map((r) => toClip(r.c, r.meetingTitle));
}

export async function createClip(input: { meetingId: string; start: number; end: number; title: string }) {
  const [meeting] = await getDb().select({ duration: t.meetings.durationSec }).from(t.meetings).where(eq(t.meetings.id, input.meetingId));
  if (!meeting) throw new NotFoundError("Meeting");
  const start = Math.max(0, Math.round(input.start));
  const end = Math.min(meeting.duration, Math.round(input.end));
  if (end - start < 3) throw new RangeError("A clip must be at least 3 seconds long");
  const [row] = await getDb()
    .insert(t.clips)
    .values({ id: randomBytes(6).toString("base64url"), meetingId: input.meetingId, startSec: start, endSec: end, title: input.title, createdBy: CURRENT_USER_ID })
    .returning();
  return toClip(row);
}

export async function getClip(id: string, opts: { countView?: boolean } = {}): Promise<Clip | null> {
  const db = getDb();
  const [row] = opts.countView
    ? await db.update(t.clips).set({ views: sql`${t.clips.views} + 1` }).where(eq(t.clips.id, id)).returning()
    : await db.select().from(t.clips).where(eq(t.clips.id, id));
  return row ? toClip(row) : null;
}

export async function deleteClip(id: string) {
  const [row] = await getDb().delete(t.clips).where(eq(t.clips.id, id)).returning({ id: t.clips.id });
  if (!row) throw new NotFoundError("Clip");
}

/* ------------------------------------------------------------------ */
/* Calendar                                                             */
/* ------------------------------------------------------------------ */

export async function listUpcoming(opts: { days?: number } = {}): Promise<UpcomingMeeting[]> {
  const settings = await getSettings();
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  const rows = await getDb()
    .select()
    .from(t.calendarEvents)
    .where(gte(t.calendarEvents.startsAt, from))
    .orderBy(asc(t.calendarEvents.startsAt));
  const until = from.getTime() + (opts.days ?? 14) * 86_400_000;
  return rows
    .filter((e) => settings.calendars[e.calendar] && e.startsAt.getTime() < until)
    .map((e) => ({
      id: e.id,
      title: e.title,
      date: e.startsAt.toISOString(),
      durationMin: e.durationMin,
      platform: e.platform,
      participants: e.participants,
      meetingType: e.meetingType,
      autoRecord: e.autoRecord,
      calendar: e.calendar,
    }));
}

export async function setAutoRecord(id: string, autoRecord: boolean) {
  const [row] = await getDb().update(t.calendarEvents).set({ autoRecord }).where(eq(t.calendarEvents.id, id)).returning({ id: t.calendarEvents.id });
  if (!row) throw new NotFoundError("Calendar event");
}

/* ------------------------------------------------------------------ */
/* Settings                                                             */
/* ------------------------------------------------------------------ */

export async function getSettings(): Promise<WorkspaceSettings> {
  const [row] = await getDb().select().from(t.workspaceSettings).where(eq(t.workspaceSettings.id, 1));
  return mergeSettings(DEFAULT_SETTINGS, row?.data ?? {});
}

function mergeSettings(base: WorkspaceSettings, patch: DeepPartial<WorkspaceSettings>): WorkspaceSettings {
  return {
    ...base,
    ...patch,
    calendars: { ...base.calendars, ...patch.calendars },
    integrations: { ...base.integrations, ...patch.integrations },
    notifications: { ...base.notifications, ...patch.notifications },
  } as WorkspaceSettings;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export async function updateSettings(patch: DeepPartial<WorkspaceSettings>): Promise<WorkspaceSettings> {
  const next = mergeSettings(await getSettings(), patch);
  await getDb()
    .insert(t.workspaceSettings)
    .values({ id: 1, data: next })
    .onConflictDoUpdate({ target: t.workspaceSettings.id, set: { data: next, updatedAt: new Date() } });
  return next;
}

/* ------------------------------------------------------------------ */
/* Overview                                                             */
/* ------------------------------------------------------------------ */

export async function getOverviewStats() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [row] = await getDb().execute<{
    meetings_week: number;
    seconds_week: number;
    open_actions: number;
    overdue_actions: number;
    highlights_week: number;
    clip_views: number;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM ${t.meetings} WHERE starts_at >= ${weekAgo} AND status = 'ready') AS meetings_week,
      (SELECT coalesce(sum(duration_sec), 0)::int FROM ${t.meetings} WHERE starts_at >= ${weekAgo} AND status = 'ready') AS seconds_week,
      (SELECT count(*)::int FROM ${t.actionItems} WHERE NOT completed) AS open_actions,
      (SELECT count(*)::int FROM ${t.actionItems} WHERE NOT completed AND due_date < current_date) AS overdue_actions,
      (SELECT count(*)::int FROM ${t.highlights} WHERE created_at >= ${weekAgo}) AS highlights_week,
      (SELECT coalesce(sum(views), 0)::int FROM ${t.clips}) AS clip_views
  `);
  return {
    meetingsThisWeek: row.meetings_week,
    secondsThisWeek: row.seconds_week,
    openActions: row.open_actions,
    overdueActions: row.overdue_actions,
    highlightsThisWeek: row.highlights_week,
    clipViews: row.clip_views,
  };
}

export async function resetWorkspace() {
  return seedDatabase(getDb());
}
