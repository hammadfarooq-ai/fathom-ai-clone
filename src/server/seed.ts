import { sql } from "drizzle-orm";
import type { getDb } from "@/db";
import * as t from "@/db/schema";
import { seedClips, seedMeetings, seedUpcoming, SEED_TODAY } from "@/db/seed";
import type { SeedMeeting } from "@/db/seed/builders";
import { seedPeople } from "@/db/seed/people";
import { CURRENT_USER_ID } from "@/lib/constants";
import type { WorkspaceSettings } from "@/types";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  calendars: { google: true, outlook: true },
  autoRecord: "all",
  defaultTemplate: "general",
  integrations: { slack: true, hubspot: false, notion: false, linear: false },
  notifications: { summaryEmail: true, actionReminders: true, weeklyDigest: false },
  joinAs: "Parley Notetaker",
};

const DAY_MS = 86_400_000;

/** Whole days between the date the seed was authored for and today (UTC). */
export function seedOffsetDays(now = new Date()): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((today - Date.parse(`${SEED_TODAY}T00:00:00Z`)) / DAY_MS);
}

function shift(iso: string, days: number): Date {
  return new Date(Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso) + days * DAY_MS);
}

function shiftDate(isoDate: string, days: number): string {
  return shift(isoDate, days).toISOString().slice(0, 10);
}

/** Insert one authored meeting (and its transcript, actions, highlights). */
export async function insertMeeting(
  tx: Tx,
  m: SeedMeeting,
  opts: {
    id?: string;
    title?: string;
    startsAt?: Date;
    dayShift?: number;
    source?: "seed" | "capture" | "import";
    status?: "processing" | "ready";
    processingStartedAt?: Date;
    processingReadyAt?: Date;
    platform?: SeedMeeting["recording"]["platform"];
  } = {},
) {
  const id = opts.id ?? m.id;
  const days = opts.dayShift ?? 0;
  const startsAt = opts.startsAt ?? shift(m.date, days);
  // Transcript/action/highlight ids are namespaced by meeting so copies don't collide.
  const rid = (childId: string) => (id === m.id ? childId : `${id}:${childId}`);
  const dueShift = opts.startsAt ? Math.round((startsAt.getTime() - Date.parse(m.date)) / DAY_MS) : days;

  await tx.insert(t.meetings).values({
    id,
    title: opts.title ?? m.title,
    startsAt,
    durationSec: m.durationSec,
    meetingType: m.meetingType,
    platform: opts.platform ?? m.recording.platform,
    hostId: m.hostId,
    template: m.template,
    tone: m.tone,
    summary: m.summary,
    keyDecisions: m.keyDecisions,
    takeaways: m.takeaways,
    topics: m.topics,
    tags: m.tags,
    suggestedQuestions: m.suggestedQuestions,
    recordingUrl: m.recording.url ?? null,
    source: opts.source ?? "seed",
    status: opts.status ?? "ready",
    processingStartedAt: opts.processingStartedAt ?? null,
    processingReadyAt: opts.processingReadyAt ?? null,
  });

  await tx.insert(t.meetingParticipants).values(m.participants.map((personId, position) => ({ meetingId: id, personId, position })));

  await tx.insert(t.transcriptEntries).values(
    m.transcript.map((e, position) => ({ id: rid(e.id), meetingId: id, position, startSec: e.start, speakerId: e.speakerId, text: e.text })),
  );

  if (m.actionItems.length) {
    await tx.insert(t.actionItems).values(
      m.actionItems.map((a, position) => ({
        id: rid(a.id),
        meetingId: id,
        title: a.title,
        ownerId: a.ownerId,
        dueDate: shiftDate(a.dueDate, dueShift),
        completed: a.completed,
        completedAt: a.completed ? startsAt : null,
        position,
      })),
    );
  }

  if (m.highlights.length) {
    await tx.insert(t.highlights).values(
      m.highlights.map((h) => ({
        id: rid(h.id),
        meetingId: id,
        transcriptEntryId: rid(h.transcriptEntryId),
        startSec: h.start,
        endSec: h.end,
        title: h.title,
        description: h.description,
        createdBy: h.createdBy,
        createdAt: new Date(startsAt.getTime() + h.start * 1000),
      })),
    );
  }
}

/**
 * Wipe the workspace and load the demo content, with every date shifted so the
 * workspace looks current. Used by `npm run db:seed` and the in-app reset.
 */
export async function seedDatabase(db: Db, now = new Date()) {
  const days = seedOffsetDays(now);
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`TRUNCATE ${t.clips}, ${t.highlights}, ${t.actionItems}, ${t.transcriptEntries}, ${t.meetingParticipants}, ${t.meetings}, ${t.calendarEvents}, ${t.workspaceSettings}, ${t.people} RESTART IDENTITY CASCADE`,
    );

    await tx.insert(t.people).values(seedPeople);

    for (const m of seedMeetings) await insertMeeting(tx, m, { dayShift: days });

    await tx.insert(t.clips).values(
      seedClips.map((c, i) => ({
        id: c.id,
        meetingId: c.meetingId,
        startSec: c.start,
        endSec: c.end,
        title: c.title,
        views: [14, 9, 6][i] ?? 0,
        createdBy: CURRENT_USER_ID,
        createdAt: new Date(now.getTime() - (i + 1) * 3 * 3_600_000),
      })),
    );

    await tx.insert(t.calendarEvents).values(
      seedUpcoming.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: shift(e.date, days),
        durationMin: e.durationMin,
        platform: e.platform,
        meetingType: e.meetingType,
        participants: e.participants,
        calendar: e.calendar,
        autoRecord: e.autoRecord,
      })),
    );

    await tx.insert(t.workspaceSettings).values({ id: 1, data: DEFAULT_SETTINGS });
  });
  return { meetings: seedMeetings.length, shiftedDays: days };
}
