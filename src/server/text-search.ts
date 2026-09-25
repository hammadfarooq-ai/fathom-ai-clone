import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import * as t from "@/db/schema";
import type { MeetingType } from "@/types";

/**
 * Workspace search, run entirely in Postgres full-text search.
 *
 * The query is turned into a prefix tsquery (`pric:* & sso:*`) so results
 * appear while typing. Meetings match on their weighted search vector
 * (title > summary/decisions > takeaways/topics/tags) and transcript lines
 * on their own GIN-indexed vector. Snippets come from ts_headline, with
 * ⟦ ⟧ as match delimiters so the client can render marks without HTML.
 */

export const MARK_OPEN = "⟦";
export const MARK_CLOSE = "⟧";
const HEADLINE = `StartSel=${MARK_OPEN}, StopSel=${MARK_CLOSE}, MaxWords=28, MinWords=10, MaxFragments=1, FragmentDelimiter=" … "`;

/** Build a safe prefix tsquery from free text; null when nothing searchable remains. */
export function tsQuery(input: string, mode: "all" | "any" = "all"): string | null {
  const terms = (input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 1 || /\d/.test(w)).slice(0, 8);
  if (terms.length === 0) return null;
  return terms.map((term) => `${term}:*`).join(mode === "all" ? " & " : " | ");
}

export type MatchType = "title" | "summary" | "decision" | "topic" | "transcript" | "action" | "highlight";

export interface SearchMatch {
  type: MatchType;
  /** Snippet with ⟦matched⟧ terms. */
  text: string;
  start?: number;
  entryId?: string;
  speakerId?: string;
}

export interface SearchResult {
  meetingId: string;
  title: string;
  date: string;
  meetingType: MeetingType;
  score: number;
  matches: SearchMatch[];
}

export async function searchWorkspace(input: string): Promise<{ query: string; results: SearchResult[] }> {
  const query = tsQuery(input);
  if (!query) return { query: input, results: [] };
  const db = getDb();
  const q = sql`to_tsquery('english', ${query})`;

  const [meetingRows, lineRows, actionRows, highlightRows] = await Promise.all([
    db.execute<{
      id: string;
      title: string;
      starts_at: Date;
      meeting_type: MeetingType;
      rank: number;
      title_hl: string | null;
      summary_hl: string | null;
      decision_hl: string | null;
      topic_hl: string | null;
      topic_start: number | null;
    }>(sql`
      SELECT m.id, m.title, m.starts_at, m.meeting_type, ts_rank(m.search_vector, ${q}) AS rank,
        CASE WHEN to_tsvector('english', m.title) @@ ${q} THEN ts_headline('english', m.title, ${q}, ${HEADLINE}) END AS title_hl,
        CASE WHEN to_tsvector('english', m.summary) @@ ${q} THEN ts_headline('english', m.summary, ${q}, ${HEADLINE}) END AS summary_hl,
        (SELECT ts_headline('english', d, ${q}, ${HEADLINE}) FROM jsonb_array_elements_text(m.key_decisions) d
          WHERE to_tsvector('english', d) @@ ${q} LIMIT 1) AS decision_hl,
        tp.title AS topic_hl, tp.start AS topic_start
      FROM ${t.meetings} m
      LEFT JOIN LATERAL (
        SELECT ts_headline('english', x->>'title', ${q}, ${HEADLINE}) AS title, (x->>'start')::int AS start
        FROM jsonb_array_elements(m.topics) x WHERE to_tsvector('english', x->>'title') @@ ${q} LIMIT 1
      ) tp ON true
      WHERE m.search_vector @@ ${q} AND m.status = 'ready'
    `),
    db.execute<{ id: string; meeting_id: string; start_sec: number; speaker_id: string; snippet: string; rank: number }>(sql`
      SELECT te.id, te.meeting_id, te.start_sec, te.speaker_id,
        ts_headline('english', te.text, ${q}, ${HEADLINE}) AS snippet, ts_rank(te.search_vector, ${q}) AS rank
      FROM ${t.transcriptEntries} te JOIN ${t.meetings} m ON m.id = te.meeting_id AND m.status = 'ready'
      WHERE te.search_vector @@ ${q}
      ORDER BY rank DESC, te.start_sec
      LIMIT 80
    `),
    db.execute<{ meeting_id: string; snippet: string }>(sql`
      SELECT a.meeting_id, ts_headline('english', a.title, ${q}, ${HEADLINE}) AS snippet
      FROM ${t.actionItems} a WHERE to_tsvector('english', a.title) @@ ${q}
    `),
    db.execute<{ meeting_id: string; snippet: string; start_sec: number; entry_id: string | null }>(sql`
      SELECT h.meeting_id, ts_headline('english', h.title || '. ' || h.description, ${q}, ${HEADLINE}) AS snippet,
        h.start_sec, h.transcript_entry_id AS entry_id
      FROM ${t.highlights} h WHERE to_tsvector('english', h.title || ' ' || h.description) @@ ${q}
    `),
  ]);

  const results = new Map<string, SearchResult>();
  for (const m of meetingRows) {
    const matches: SearchMatch[] = [];
    if (m.title_hl) matches.push({ type: "title", text: m.title_hl });
    if (m.summary_hl) matches.push({ type: "summary", text: m.summary_hl });
    if (m.decision_hl) matches.push({ type: "decision", text: m.decision_hl });
    if (m.topic_hl) matches.push({ type: "topic", text: m.topic_hl, start: m.topic_start ?? undefined });
    results.set(m.id, {
      meetingId: m.id,
      title: m.title,
      date: new Date(m.starts_at).toISOString(),
      meetingType: m.meeting_type,
      score: m.rank * 3 + (m.title_hl ? 1 : 0),
      matches,
    });
  }

  // Meetings that only match through transcript/action/highlight rows need their metadata.
  const missing = [...new Set([...lineRows, ...actionRows, ...highlightRows].map((r) => r.meeting_id))].filter((id) => !results.has(id));
  if (missing.length) {
    const rows = await db.execute<{ id: string; title: string; starts_at: Date; meeting_type: MeetingType }>(
      sql`SELECT id, title, starts_at, meeting_type FROM ${t.meetings} WHERE id IN ${missing} AND status = 'ready'`,
    );
    for (const m of rows) {
      results.set(m.id, { meetingId: m.id, title: m.title, date: new Date(m.starts_at).toISOString(), meetingType: m.meeting_type, score: 0, matches: [] });
    }
  }

  for (const a of actionRows) results.get(a.meeting_id)?.matches.push({ type: "action", text: a.snippet });
  for (const h of highlightRows) {
    const r = results.get(h.meeting_id);
    r?.matches.push({ type: "highlight", text: h.snippet, start: h.start_sec, entryId: h.entry_id ?? undefined });
    if (r) r.score += 0.3;
  }
  const perMeeting = new Map<string, number>();
  for (const line of lineRows) {
    const r = results.get(line.meeting_id);
    if (!r) continue;
    const n = perMeeting.get(line.meeting_id) ?? 0;
    perMeeting.set(line.meeting_id, n + 1);
    r.score += line.rank / (n + 1); // diminishing returns for many hits in one meeting
    if (n < 4) r.matches.push({ type: "transcript", text: line.snippet, start: line.start_sec, entryId: line.id, speakerId: line.speaker_id });
  }

  return {
    query: input,
    results: [...results.values()].filter((r) => r.matches.length > 0).sort((a, b) => b.score - a.score || b.date.localeCompare(a.date)),
  };
}

/**
 * Candidate meetings for Ask: rank meetings by how well their summary fields and
 * transcript match any of the question's terms.
 */
export async function rankMeetingsForQuestion(question: string, limit = 6): Promise<string[]> {
  const query = tsQuery(question, "any");
  if (!query) return [];
  const q = sql`to_tsquery('english', ${query})`;
  const rows = await getDb().execute<{ id: string }>(sql`
    SELECT id FROM (
      SELECT m.id,
        ts_rank(m.search_vector, ${q}) * 2
        + coalesce((SELECT sum(r) FROM (SELECT ts_rank(te.search_vector, ${q}) r FROM ${t.transcriptEntries} te
            WHERE te.meeting_id = m.id AND te.search_vector @@ ${q} ORDER BY r DESC LIMIT 5) top), 0) AS score
      FROM ${t.meetings} m
      WHERE m.status = 'ready'
    ) ranked
    WHERE score > 0
    ORDER BY score DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => r.id);
}
