import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { MeetingStatus, MeetingType, Platform, TemplateId, Topic, WorkspaceSettings } from "@/types";

/**
 * Postgres schema. Column names are snake_case in the database (see `casing`
 * in db/index.ts and drizzle.config.ts) and camelCase in TypeScript.
 *
 * Full-text search uses stored, generated tsvector columns with GIN indexes:
 * one per meeting (title, summary, decisions, takeaways, topics) and one per
 * transcript line, so search and Ask retrieval run inside Postgres.
 */

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};

export const people = pgTable("people", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().default(""),
  role: text().notNull().default(""),
  company: text().notNull().default(""),
  color: text().notNull(),
  external: boolean().notNull().default(false),
  ...timestamps,
});

export const meetings = pgTable(
  "meetings",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    durationSec: integer().notNull(),
    meetingType: text().$type<MeetingType>().notNull(),
    platform: text().$type<Platform>().notNull(),
    hostId: text()
      .notNull()
      .references(() => people.id),
    /** The template the notes open with; users can switch it per meeting. */
    template: text().$type<TemplateId>().notNull().default("general"),
    tone: text().notNull().default(""),
    summary: text().notNull().default(""),
    keyDecisions: jsonb().$type<string[]>().notNull().default([]),
    takeaways: jsonb().$type<string[]>().notNull().default([]),
    topics: jsonb().$type<Topic[]>().notNull().default([]),
    tags: jsonb().$type<string[]>().notNull().default([]),
    suggestedQuestions: jsonb().$type<string[]>().notNull().default([]),
    /** Set when a real audio/video file exists; otherwise playback is simulated. */
    recordingUrl: text(),
    /** seed | capture (stubbed bot) | import (uploaded transcript) */
    source: text().$type<"seed" | "capture" | "import">().notNull().default("seed"),
    status: text().$type<MeetingStatus>().notNull().default("ready"),
    processingStartedAt: timestamp({ withTimezone: true }),
    processingReadyAt: timestamp({ withTimezone: true }),
    searchVector: tsvector().generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A')
        || setweight(to_tsvector('english', coalesce(summary, '')), 'B')
        || setweight(jsonb_to_tsvector('english', key_decisions, '["string"]'), 'B')
        || setweight(jsonb_to_tsvector('english', takeaways, '["string"]'), 'C')
        || setweight(jsonb_to_tsvector('english', topics, '["string"]'), 'C')
        || setweight(jsonb_to_tsvector('english', tags, '["string"]'), 'C')`,
    ),
    ...timestamps,
  },
  (t) => [index("meetings_starts_at_idx").on(t.startsAt), index("meetings_search_idx").using("gin", t.searchVector)],
);

export const meetingParticipants = pgTable(
  "meeting_participants",
  {
    meetingId: text()
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    personId: text()
      .notNull()
      .references(() => people.id),
    position: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.meetingId, t.personId] }), index("participants_person_idx").on(t.personId)],
);

export const transcriptEntries = pgTable(
  "transcript_entries",
  {
    id: text().primaryKey(),
    meetingId: text()
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    /** Offset from the start of the recording, in seconds. */
    startSec: integer().notNull(),
    speakerId: text()
      .notNull()
      .references(() => people.id),
    text: text().notNull(),
    searchVector: tsvector().generatedAlwaysAs(sql`to_tsvector('english', text)`),
  },
  (t) => [
    index("transcript_meeting_idx").on(t.meetingId, t.position),
    index("transcript_search_idx").using("gin", t.searchVector),
  ],
);

export const actionItems = pgTable(
  "action_items",
  {
    id: text().primaryKey(),
    meetingId: text()
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    title: text().notNull(),
    ownerId: text()
      .notNull()
      .references(() => people.id),
    dueDate: date().notNull(),
    completed: boolean().notNull().default(false),
    completedAt: timestamp({ withTimezone: true }),
    position: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [index("action_items_meeting_idx").on(t.meetingId), index("action_items_open_idx").on(t.completed, t.dueDate)],
);

export const highlights = pgTable(
  "highlights",
  {
    id: text().primaryKey(),
    meetingId: text()
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    transcriptEntryId: text().references(() => transcriptEntries.id, { onDelete: "set null" }),
    startSec: integer().notNull(),
    endSec: integer().notNull(),
    title: text().notNull(),
    description: text().notNull().default(""),
    createdBy: text()
      .notNull()
      .references(() => people.id),
    ...timestamps,
  },
  (t) => [index("highlights_meeting_idx").on(t.meetingId), index("highlights_created_idx").on(t.createdAt)],
);

export const clips = pgTable(
  "clips",
  {
    /** Short, unguessable public id used in /c/<id>. */
    id: text().primaryKey(),
    meetingId: text()
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    startSec: integer().notNull(),
    endSec: integer().notNull(),
    title: text().notNull(),
    views: integer().notNull().default(0),
    createdBy: text()
      .notNull()
      .references(() => people.id),
    ...timestamps,
  },
  (t) => [index("clips_meeting_idx").on(t.meetingId)],
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    durationMin: integer().notNull(),
    platform: text().$type<Platform>().notNull(),
    meetingType: text().$type<MeetingType>().notNull(),
    participants: jsonb().$type<string[]>().notNull().default([]),
    calendar: text().$type<"google" | "outlook">().notNull(),
    autoRecord: boolean().notNull().default(true),
  },
  (t) => [index("calendar_events_starts_idx").on(t.startsAt)],
);

/** Single-row workspace settings (id = 1). */
export const workspaceSettings = pgTable("workspace_settings", {
  id: integer().primaryKey().default(1),
  data: jsonb().$type<WorkspaceSettings>().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
