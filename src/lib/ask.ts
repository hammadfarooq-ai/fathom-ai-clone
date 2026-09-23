import { firstName, getPerson } from "@/data/people";
import type { ActionItem, AskAnswer, AskSource, Meeting, TranscriptEntry } from "@/types";
import { formatShortDate } from "./format";
import { expandQuery, sentences, tokenize, type QueryTerm } from "./text";

/**
 * Deterministic retrieval-based question answering over meeting data.
 *
 * Every summary field and transcript line becomes a small "document". Questions
 * are tokenized, expanded with synonyms, scored with IDF weighting plus a few
 * intent-aware boosts, and the answer is composed from the best-scoring facts
 * (decisions, takeaways, action items) with transcript lines as citations.
 */

type DocKind = "decision" | "takeaway" | "summary" | "action" | "transcript";

interface Doc {
  meeting: Meeting;
  kind: DocKind;
  text: string;
  tokens: Set<string>;
  seq: string[];
  entry?: TranscriptEntry;
  action?: ActionItem;
}

interface Scored {
  doc: Doc;
  score: number;
  baseHits: number;
}

interface Intent {
  decision: boolean;
  actions: boolean;
  when: boolean;
  summary: boolean;
  customers: boolean;
  risk: boolean;
  amount: boolean;
  /** Speakers named in the question ("What did Rachel say…"). */
  speakers: Set<string>;
}

const SYNONYM_WEIGHT = 0.55;
const WEAK_WEIGHT = 0.35;

const KIND_WEIGHT: Record<DocKind, number> = {
  decision: 1.35,
  takeaway: 1.15,
  summary: 1,
  action: 1,
  transcript: 0.95,
};

const TIME_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|week|quarter|q[1-4]|by the|twentieth|twenty-seventh|\d{1,2})\b/i;

function detectIntent(q: string, meetings: Meeting[]): Intent {
  const s = q.toLowerCase();
  const qWords = new Set(s.match(/[a-z]+/g) ?? []);
  const speakers = new Set(
    meetings.flatMap((m) => m.participants).filter((p) => qWords.has(firstName(p).toLowerCase())),
  );
  return {
    speakers,
    amount: /\b(how much|how many|cost|price|pricing|budget|revenue|arr)\b/.test(s),
    decision: /\b(decid|decision|agree|conclu|settle|land(ed)? on|choose|chose)/.test(s),
    actions: /\b(next steps?|action items?|to-?dos?|follow[- ]ups?|who (is|will|owns)|owner|responsible|assigned|tasks?)\b/.test(s),
    when: /\b(when|date|deadline|timeline|how long)\b/.test(s),
    summary: /\b(summar|tl;?dr|overview|recap|what happened|gist|key points)/.test(s),
    customers: /\b(customers?|clients?|prospects?|buyers?|users?)\b/.test(s),
    risk: /\b(risks?|concerns?|worr|blockers?|issues?|problems?)\b/.test(s),
  };
}

function actionSentence(a: ActionItem): string {
  const verb = a.title.charAt(0).toLowerCase() + a.title.slice(1);
  const due = formatShortDate(`${a.dueDate}T00:00:00Z`);
  return `${firstName(a.ownerId)} will ${verb} by ${due}${a.completed ? " (already done)" : ""}.`;
}

function buildDocs(meetings: Meeting[]): Doc[] {
  const docs: Doc[] = [];
  const push = (meeting: Meeting, kind: DocKind, text: string, extra: Partial<Doc> = {}) => {
    const seq = tokenize(text);
    docs.push({ meeting, kind, text, tokens: new Set(seq), seq, ...extra });
  };

  for (const m of meetings) {
    m.keyDecisions.forEach((t) => push(m, "decision", t));
    m.takeaways.forEach((t) => push(m, "takeaway", t));
    sentences(m.summary).forEach((t) => push(m, "summary", t));
    m.actionItems.forEach((a) => push(m, "action", `${a.title} ${getPerson(a.ownerId).name}`, { action: a }));
    m.transcript.forEach((e) => push(m, "transcript", e.text, { entry: e }));
  }
  return docs;
}

function hasBigram(seq: string[], a: string, b: string): boolean {
  for (let i = 0; i < seq.length - 1; i++) if (seq[i] === a && seq[i + 1] === b) return true;
  return false;
}

/** Query terms, with meeting participants' names down-weighted (they appear everywhere). */
function queryTerms(question: string, meetings: Meeting[]): { terms: QueryTerm[]; bigrams: [string, string][] } {
  // Participant names appear everywhere within a single meeting, so they carry little signal.
  const names = new Set(meetings.length === 1 ? meetings[0].participants.map((p) => tokenize(firstName(p))[0]) : []);
  const terms = expandQuery(question, { dropIntentWords: true }).map((t) =>
    t.weight === 1 && names.has(t.term) ? { ...t, weight: WEAK_WEIGHT } : t,
  );
  const base = terms.filter((t) => t.weight === 1).map((t) => t.term);
  const seq = tokenize(question).filter((t) => base.includes(t));
  const bigrams: [string, string][] = [];
  for (let i = 0; i < seq.length - 1; i++) bigrams.push([seq[i], seq[i + 1]]);
  return { terms, bigrams };
}

function scoreDocs(docs: Doc[], terms: QueryTerm[], intent: Intent, bigrams: [string, string][] = []): Scored[] {
  const n = docs.length;
  const df = new Map<string, number>();
  for (const { term } of terms) df.set(term, docs.filter((d) => d.tokens.has(term)).length);

  const baseTerms = new Set(terms.filter((t) => t.weight === 1).map((t) => t.term));
  const baseCount = baseTerms.size || 1;

  return docs
    .map((doc) => {
      let score = 0;
      let baseHits = 0;
      let synHits = 0;
      const covered = new Map<string, number>();
      for (const { term, weight, from } of terms) {
        if (!doc.tokens.has(term)) continue;
        score += weight * Math.log(1 + n / (df.get(term) || 1));
        if (weight === 1) baseHits++;
        else if (weight >= SYNONYM_WEIGHT) synHits++;
        covered.set(from, Math.max(covered.get(from) ?? 0, weight === 1 ? 1 : 0.8));
      }
      // Name/title matches alone (weak terms) don't make a document relevant.
      if (baseHits === 0 && synHits === 0) return { doc, score: 0, baseHits };
      if (baseHits === 0) score *= 0.6;
      for (const [a, b] of bigrams) if (hasBigram(doc.seq, a, b)) score *= 1.4;

      score *= KIND_WEIGHT[doc.kind];
      const coverage = [...covered.entries()].reduce((acc, [from, c]) => acc + (baseTerms.has(from) ? c : 0), 0);
      score *= 0.5 + 0.5 * Math.min(1, coverage / baseCount); // reward covering every query term
      if (intent.decision && doc.kind === "decision") score *= 1.6;
      if (intent.actions && doc.kind === "action") score *= 1.8;
      if (intent.when && TIME_RE.test(doc.text)) score *= 1.3;
      if (intent.customers && doc.entry && getPerson(doc.entry.speakerId).external) score *= 1.5;
      if (intent.customers && !doc.meeting.participants.some((p) => getPerson(p).external)) score *= 0.5;
      if (intent.amount && /\$\d/.test(doc.text)) score *= 1.8;
      else if (intent.amount && /%|\d/.test(doc.text)) score *= 1.3;
      if (doc.entry && intent.speakers.has(doc.entry.speakerId)) score *= 1.6;
      if (intent.risk && /\b(risk|concern|blocker|slip|worr|problem)/i.test(doc.text)) score *= 1.3;
      return { doc, score, baseHits };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

function topicLabel(meeting: Meeting, start: number): string {
  let label = meeting.topics[0]?.title ?? "Discussion";
  for (const t of meeting.topics) if (t.start <= start) label = t.title;
  return label;
}

function toSource(meeting: Meeting, entry: TranscriptEntry): AskSource {
  return {
    meetingId: meeting.id,
    meetingTitle: meeting.title,
    meetingDate: meeting.date,
    entryId: entry.id,
    start: entry.start,
    speakerId: entry.speakerId,
    label: topicLabel(meeting, entry.start),
    excerpt: entry.text,
  };
}

/**
 * Find the transcript line that best supports a given fact. Among lines with
 * near-equal word overlap, prefer the earliest: that's where the point was
 * actually discussed rather than recapped.
 */
function supportingEntry(meeting: Meeting, text: string, candidates?: TranscriptEntry[]): TranscriptEntry | undefined {
  const tokens = new Set(tokenize(text));
  const pool = candidates?.length ? candidates : meeting.transcript;
  const scored = pool.map((e) => ({ e, overlap: tokenize(e.text).filter((t) => tokens.has(t)).length }));
  const best = Math.max(0, ...scored.map((s) => s.overlap));
  if (best < 2) return undefined;
  return scored.filter((s) => s.overlap >= best - 1).sort((a, b) => a.e.start - b.e.start)[0]?.e;
}

function noAnswer(question: string, meeting?: Meeting): AskAnswer {
  const hint = meeting
    ? ` Try asking about ${meeting.topics
        .slice(1, 4)
        .map((t) => t.title.toLowerCase())
        .join(", ")}.`
    : " Try different keywords, like a customer name, feature, or decision.";
  return {
    question,
    answer: `I couldn't find anything that answers that in ${meeting ? "this meeting" : "your meetings"}.${hint}`,
    sources: [],
    mode: "local",
  };
}

export function askMeeting(meeting: Meeting, question: string): AskAnswer {
  const intent = detectIntent(question, [meeting]);
  const { terms, bigrams } = queryTerms(question, [meeting]);
  const baseTerms = terms.filter((t) => t.weight === 1);

  // "What were the next steps?" — list the action items.
  if (intent.actions && baseTerms.length === 0) {
    const open = meeting.actionItems.filter((a) => !a.completed);
    const items = (open.length ? open : meeting.actionItems).slice(0, 4);
    return {
      question,
      answer: `There are ${meeting.actionItems.length} action items (${open.length} open). ${items.map(actionSentence).join(" ")}`,
      sources: items
        .map((a) => supportingEntry(meeting, a.title))
        .filter((e, i, arr): e is TranscriptEntry => Boolean(e) && arr.findIndex((x) => x?.id === e!.id) === i)
        .slice(0, 3)
        .map((e) => toSource(meeting, e)),
      mode: "local",
    };
  }

  // "Summarize this meeting" — return the summary with the first highlights as sources.
  if ((intent.summary || intent.decision) && baseTerms.length === 0) {
    const text = intent.decision
      ? `${meeting.keyDecisions.length} decisions were made. ${meeting.keyDecisions.slice(0, 3).join(" ")}`
      : meeting.summary;
    return {
      question,
      answer: text,
      sources: meeting.highlights
        .slice(0, 3)
        .map((h) => meeting.transcript.find((e) => e.id === h.transcriptEntryId))
        .filter((e): e is TranscriptEntry => Boolean(e))
        .map((e) => toSource(meeting, e)),
      mode: "local",
    };
  }

  const scored = scoreDocs(buildDocs([meeting]), terms, intent, bigrams);
  if (scored.length === 0) return noAnswer(question, meeting);

  const facts = scored.filter((s) => s.doc.kind !== "transcript" && s.doc.kind !== "action");
  const actions = scored.filter((s) => s.doc.kind === "action");
  const lines = scored.filter((s) => s.doc.kind === "transcript");
  const top = scored[0].score;

  const parts: string[] = [];
  const chosen = facts.filter((f) => f.score >= top * 0.6).slice(0, 2);
  if (chosen.length === 0 && facts[0] && facts[0].score >= top * 0.3) chosen.push(facts[0]);
  // Avoid repeating the summary if a decision/takeaway already covers it.
  if (chosen.length === 2 && chosen[1].doc.kind === "summary" && chosen[0].doc.kind !== "summary") chosen.pop();
  chosen.forEach((f) => parts.push(f.doc.text));

  const bestAction = actions[0];
  const actionBar = top * (intent.decision ? 0.2 : 0.35); // decision intent inflates the top score
  if (bestAction && bestAction.score >= actionBar && bestAction.doc.action) {
    parts.push(actionSentence(bestAction.doc.action));
  }

  // When a transcript line is clearly the best evidence, lead with the quote.
  const topLine = lines[0]?.doc.entry;
  if (topLine && (parts.length === 0 || (scored[0].doc.kind === "transcript" && chosen.length === 0))) {
    parts.unshift(`${getPerson(topLine.speakerId).name} said: “${topLine.text}”`);
  }

  // Lead with the line that best supports the chosen fact, then the strongest matches.
  const support = chosen[0] ? supportingEntry(meeting, chosen[0].doc.text, lines.slice(0, 6).map((l) => l.doc.entry!)) : undefined;
  const sourceEntries = [support, ...lines.map((l) => l.doc.entry!)]
    .filter((e, i, arr): e is TranscriptEntry => Boolean(e) && arr.findIndex((x) => x?.id === e!.id) === i)
    .slice(0, 3);

  return {
    question,
    answer: parts.join(" "),
    sources: sourceEntries.map((e) => toSource(meeting, e)),
    mode: "local",
  };
}

export function askAcrossMeetings(meetings: Meeting[], question: string): AskAnswer {
  const intent = detectIntent(question, meetings);
  const { terms, bigrams } = queryTerms(question, meetings);
  if (terms.length === 0) return noAnswer(question);

  const scored = scoreDocs(buildDocs(meetings), terms, intent, bigrams);
  if (scored.length === 0) return noAnswer(question);

  const byMeeting = new Map<string, Scored[]>();
  for (const s of scored) {
    const list = byMeeting.get(s.doc.meeting.id) ?? [];
    list.push(s);
    byMeeting.set(s.doc.meeting.id, list);
  }

  const ranked = [...byMeeting.values()]
    .map((list) => ({
      meeting: list[0].doc.meeting,
      list,
      score: list[0].score + 0.25 * list.slice(1, 3).reduce((a, s) => a + s.score, 0),
    }))
    .sort((a, b) => b.score - a.score);

  const topScore = ranked[0].score;
  const relevant = ranked.filter((r) => r.score >= topScore * 0.3).slice(0, 5);

  const results = relevant.map(({ meeting, list }) => {
    const fact = list.find((s) => s.doc.kind !== "transcript" && s.doc.kind !== "action");
    const lineHits = list.filter((s) => s.doc.kind === "transcript").map((s) => s.doc.entry!);
    const customerLine = intent.customers ? lineHits.find((e) => getPerson(e.speakerId).external) : undefined;
    const line = customerLine ?? lineHits[0] ?? (fact ? supportingEntry(meeting, fact.doc.text) : undefined) ?? meeting.transcript[0];
    return {
      meetingId: meeting.id,
      title: meeting.title,
      date: meeting.date,
      insight: fact?.doc.text ?? line.text,
      excerpt: line.text,
      start: line.start,
      entryId: line.id,
      speakerId: line.speakerId,
    };
  });

  const lead = results
    .slice(0, 2)
    .map((r) => `In ${r.title} (${formatShortDate(r.date)}): ${r.insight}`)
    .join(" ");

  return {
    question,
    answer: `This came up in ${results.length} meeting${results.length === 1 ? "" : "s"}. ${lead}`,
    sources: results.map((r) => {
      const meeting = relevant.find((x) => x.meeting.id === r.meetingId)!.meeting;
      const entry = meeting.transcript.find((e) => e.id === r.entryId)!;
      return toSource(meeting, entry);
    }),
    meetings: results,
    mode: "local",
  };
}

/** Compact context used to ground an optional LLM answer. */
export function buildLlmContext(answer: AskAnswer, meetings: Meeting[]): string {
  const ids = new Set(answer.sources.map((s) => s.meetingId));
  return meetings
    .filter((m) => ids.has(m.id))
    .map((m) => {
      const cited = answer.sources.filter((s) => s.meetingId === m.id);
      return [
        `Meeting: ${m.title} (${formatShortDate(m.date)})`,
        `Summary: ${m.summary}`,
        `Decisions: ${m.keyDecisions.join(" | ")}`,
        `Action items: ${m.actionItems.map(actionSentence).join(" ")}`,
        ...cited.map((s) => `[${s.label} @ ${Math.floor(s.start / 60)}:${String(s.start % 60).padStart(2, "0")}] ${getPerson(s.speakerId).name}: ${s.excerpt}`),
      ].join("\n");
    })
    .join("\n\n");
}
