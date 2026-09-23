import { getPerson } from "@/data/people";
import type { Meeting } from "@/types";
import { snippetAround, stem, tokenize, words } from "./text";

export type MatchType = "title" | "summary" | "topic" | "decision" | "action" | "highlight" | "transcript";

export const MATCH_LABELS: Record<MatchType, string> = {
  title: "Title",
  summary: "Summary",
  topic: "Topic",
  decision: "Decision",
  action: "Action item",
  highlight: "Highlight",
  transcript: "Transcript",
};

const WEIGHTS: Record<MatchType, number> = {
  title: 12,
  topic: 6,
  decision: 5,
  highlight: 5,
  action: 4,
  summary: 4,
  transcript: 3,
};

export interface SearchMatch {
  type: MatchType;
  snippet: string;
  start?: number;
  entryId?: string;
  speakerId?: string;
  score: number;
}

export interface MeetingSearchResult {
  meeting: Meeting;
  score: number;
  matches: SearchMatch[];
}

/**
 * Does `text` match the query? Exact phrase matches win; otherwise every
 * content term (stemmed) must appear somewhere in the text.
 */
function matchScore(text: string, phrase: string, terms: string[]): number {
  const lower = text.toLowerCase();
  if (phrase && lower.includes(phrase)) return 2;
  if (terms.length === 0) return 0;
  const stems = new Set(words(text).map(stem));
  const all = terms.every((t) => stems.has(t) || lower.includes(t));
  return all ? 1 : 0;
}

export function searchMeetings(meetings: Meeting[], query: string): MeetingSearchResult[] {
  const phrase = query.trim().toLowerCase();
  if (phrase.length < 2) return [];
  const terms = tokenize(query);

  const results: MeetingSearchResult[] = [];
  for (const meeting of meetings) {
    const matches: SearchMatch[] = [];
    const add = (type: MatchType, text: string, extra: Partial<SearchMatch> = {}) => {
      const m = matchScore(text, phrase, terms);
      if (m > 0) matches.push({ type, snippet: snippetAround(text, query), score: WEIGHTS[type] * m, ...extra });
    };

    add("title", meeting.title);
    meeting.topics.forEach((t) => add("topic", t.title, { start: t.start }));
    meeting.keyDecisions.forEach((d) => add("decision", d));
    add("summary", meeting.summary);
    meeting.actionItems.forEach((a) => add("action", `${a.title} — ${getPerson(a.ownerId).name}`));
    meeting.highlights.forEach((h) => add("highlight", `${h.title}. ${h.description}`, { start: h.start, entryId: h.transcriptEntryId }));
    meeting.transcript.forEach((e) =>
      add("transcript", e.text, { start: e.start, entryId: e.id, speakerId: e.speakerId }),
    );

    if (matches.length) {
      const score = matches.reduce((acc, m) => acc + m.score, 0);
      matches.sort((a, b) => {
        // Keep transcript matches in chronological order after richer match types.
        if (a.type === "transcript" && b.type === "transcript") return (a.start ?? 0) - (b.start ?? 0);
        return b.score - a.score;
      });
      results.push({ meeting, score, matches });
    }
  }
  return results.sort((a, b) => b.score - a.score || b.meeting.date.localeCompare(a.meeting.date));
}

export const SEARCH_SUGGESTIONS = ["pricing", "SSO", "October launch", "discount", "Helix", "performance", "BAA", "metrics layer"];
