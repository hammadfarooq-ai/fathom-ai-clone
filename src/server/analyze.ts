import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { formatTimestamp } from "@/lib/format";
import { sentences, stem, tokenize, words } from "@/lib/text";
import type { MeetingType, TemplateId, Topic } from "@/types";

/**
 * Turns a pasted or uploaded transcript into meeting notes.
 *
 * 1. `parseTranscript` understands WebVTT/SRT, "[mm:ss] Name: text",
 *    "Name (mm:ss): text" and plain "Name: text" (times are then estimated
 *    from speaking rate).
 * 2. `analyzeTranscript` produces summary, decisions, takeaways, topics,
 *    action items, and tags. With ANTHROPIC_API_KEY set, Claude extracts them
 *    with a structured-output schema; otherwise (or on any failure) a local
 *    extractive analyzer does, so imports always work.
 */

export interface ParsedLine {
  start: number;
  speaker: string;
  text: string;
}

const TIME = String.raw`(\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?`;
const VTT_CUE = new RegExp(String.raw`^(${TIME})\s*-->\s*(${TIME})`);
const BRACKET_LINE = new RegExp(String.raw`^\[?(${TIME})\]?\s*[-–—]?\s*([^:]{1,40}):\s*(.+)$`);
const NAME_TIME_LINE = new RegExp(String.raw`^([^:(\[]{1,40})\s*[(\[](${TIME})[)\]]\s*:?\s*(.*)$`);
const NAME_LINE = /^([A-Z][\p{L}.'’-]*(?: [A-Z][\p{L}.'’-]*){0,3}):\s*(.+)$/u;
const VOICE_TAG = /^<v\s+([^>]+)>(.*?)(?:<\/v>)?$/;
const WORDS_PER_SECOND = 2.5;

function toSeconds(stamp: string): number {
  const parts = stamp.replace(",", ".").split(":").map(Number);
  return Math.floor(parts.reduce((acc, n) => acc * 60 + n, 0));
}

export function parseTranscript(raw: string): ParsedLine[] {
  const lines = raw.replace(/\r/g, "").split("\n").map((l) => l.trim());
  const out: ParsedLine[] = [];
  let cueStart: number | null = null;
  let lastSpeaker = "Speaker 1";

  const push = (start: number | null, speaker: string, text: string) => {
    const clean = text.replace(/<[^>]+>/g, "").trim();
    if (!clean) return;
    const prev = out.at(-1);
    // Merge consecutive fragments from the same speaker (common in VTT/SRT).
    if (prev && prev.speaker === speaker && (start === null || start - prev.start < 20) && prev.text.length < 400) {
      prev.text = `${prev.text} ${clean}`;
      return;
    }
    out.push({ start: start ?? -1, speaker, text: clean });
  };

  for (const line of lines) {
    if (!line || line === "WEBVTT" || /^\d+$/.test(line) || /^(NOTE|STYLE|Kind:|Language:)/.test(line)) continue;
    const cue = line.match(VTT_CUE);
    if (cue) {
      cueStart = toSeconds(cue[1]);
      continue;
    }
    const voice = line.match(VOICE_TAG);
    if (voice) {
      lastSpeaker = voice[1].trim();
      push(cueStart, lastSpeaker, voice[2]);
      continue;
    }
    const bracket = line.match(BRACKET_LINE);
    if (bracket) {
      lastSpeaker = bracket[3].trim();
      push(toSeconds(bracket[1]), lastSpeaker, bracket[4]);
      continue;
    }
    const nameTime = line.match(NAME_TIME_LINE);
    if (nameTime && nameTime[3]) {
      lastSpeaker = nameTime[1].trim();
      push(toSeconds(nameTime[2]), lastSpeaker, nameTime[3]);
      continue;
    }
    const named = line.match(NAME_LINE);
    if (named) {
      lastSpeaker = named[1].trim();
      push(cueStart, lastSpeaker, named[2]);
      continue;
    }
    push(cueStart, lastSpeaker, line);
  }

  // Fill in missing times from speaking rate, keeping them strictly increasing.
  let clock = 0;
  for (const line of out) {
    if (line.start < clock) line.start = clock;
    clock = line.start + Math.max(2, Math.round(line.text.split(/\s+/).length / WORDS_PER_SECOND));
  }
  return out;
}

export function estimateDuration(lines: ParsedLine[]): number {
  const last = lines.at(-1);
  if (!last) return 0;
  return last.start + Math.max(4, Math.round(last.text.split(/\s+/).length / WORDS_PER_SECOND)) + 2;
}

/* ------------------------------------------------------------------ */
/* Analysis                                                             */
/* ------------------------------------------------------------------ */

export interface AnalysisInput {
  title: string;
  date: string;
  meetingType: MeetingType;
  durationSec: number;
  /** Speaker display names by id. */
  speakers: Record<string, string>;
  lines: { id: string; start: number; speakerId: string; text: string }[];
}

export interface Analysis {
  summary: string;
  keyDecisions: string[];
  takeaways: string[];
  topics: Topic[];
  actionItems: { title: string; ownerId: string; dueDate: string }[];
  tags: string[];
  tone: string;
  suggestedQuestions: string[];
  template: TemplateId;
  engine: "claude" | "local";
}

const TEMPLATE_FOR_TYPE: Partial<Record<MeetingType, TemplateId>> = {
  Sales: "sales",
  Research: "research",
  "1:1": "one-on-one",
  Interview: "interview",
  Product: "product",
  Engineering: "product",
};

export async function analyzeTranscript(input: AnalysisInput): Promise<Analysis> {
  if (process.env.ANTHROPIC_API_KEY) {
    const llm = await analyzeWithClaude(input).catch((error) => {
      console.error("Transcript analysis with Claude failed; using local analyzer", error);
      return null;
    });
    if (llm) return llm;
  }
  return analyzeLocally(input);
}

/* ---------- Claude ---------------------------------------------------- */

const NotesSchema = z.object({
  summary: z.string().describe("Three to five sentence summary of what happened and why it matters."),
  keyDecisions: z.array(z.string()).describe("Decisions the group actually made. Empty if none."),
  takeaways: z.array(z.string()).describe("Important facts, numbers, risks, or insights."),
  topics: z.array(z.object({ title: z.string(), startSec: z.number().int() })).describe("Chapters in order, 3-8 of them."),
  actionItems: z
    .array(
      z.object({
        title: z.string().describe("Imperative, e.g. 'Send the revised proposal to Acme'."),
        owner: z.string().describe("Speaker name exactly as it appears in the transcript."),
        dueDate: z.string().nullable().describe("YYYY-MM-DD if a date or weekday was mentioned, else null."),
      }),
    )
    .describe("Concrete commitments someone took on."),
  tags: z.array(z.string()).describe("Two to four short lowercase tags."),
  tone: z.string().describe("Short descriptor like 'Collaborative · decision-focused'."),
  suggestedQuestions: z.array(z.string()).describe("Three questions a teammate might ask about this meeting."),
});

let client: Anthropic | null = null;

async function analyzeWithClaude(input: AnalysisInput): Promise<Analysis | null> {
  client ??= new Anthropic();
  const transcript = input.lines.map((l) => `[${formatTimestamp(l.start)}] ${input.speakers[l.speakerId]}: ${l.text}`).join("\n");
  const response = await client.messages.parse(
    {
      model: "claude-opus-5",
      max_tokens: 16000,
      output_config: { effort: "low", format: zodOutputFormat(NotesSchema) },
      system:
        "You write meeting notes for a meeting-notes product. Use only what is in the transcript. Be specific: keep names, numbers, and dates.",
      messages: [
        {
          role: "user",
          content: `Meeting: ${input.title}\nType: ${input.meetingType}\nDate: ${input.date.slice(0, 10)}\nDuration: ${formatTimestamp(input.durationSec)}\n\nTranscript:\n${transcript}`,
        },
      ],
    },
    { timeout: 60_000 },
  );
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  const notes = response.parsed_output;

  const byName = new Map(Object.entries(input.speakers).map(([id, name]) => [name.toLowerCase(), id]));
  const byFirst = new Map(Object.entries(input.speakers).map(([id, name]) => [name.split(" ")[0].toLowerCase(), id]));
  const fallbackOwner = input.lines[0]?.speakerId ?? Object.keys(input.speakers)[0];
  const owner = (name: string) => byName.get(name.toLowerCase()) ?? byFirst.get(name.split(" ")[0].toLowerCase()) ?? fallbackOwner;

  return {
    summary: notes.summary,
    keyDecisions: notes.keyDecisions,
    takeaways: notes.takeaways,
    topics: notes.topics
      .map((t) => ({ title: t.title, start: Math.max(0, Math.min(input.durationSec, t.startSec)) }))
      .sort((a, b) => a.start - b.start),
    actionItems: notes.actionItems.map((a) => ({
      title: a.title,
      ownerId: owner(a.owner),
      dueDate: a.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate) ? a.dueDate : addDays(input.date, 7),
    })),
    tags: notes.tags.slice(0, 4).map((t) => t.toLowerCase()),
    tone: notes.tone,
    suggestedQuestions: notes.suggestedQuestions.slice(0, 3),
    template: TEMPLATE_FOR_TYPE[input.meetingType] ?? "general",
    engine: "claude",
  };
}

/* ---------- Local extractive analyzer --------------------------------- */

const DECISION = /\b(we(?:'ve| have)? decided|decision is|let's go with|we(?:'ll| will) go with|agreed|we're going (?:to|with)|final answer|settled on|the plan is|we'll ship|we won't|we will not)\b/i;
const COMMITMENT = /\b(i'll|i will|i'm going to|i can take|let me|i'll take|i'll send|i'll share|i'll follow up|i'll get|i'll write|i'll set up|i'll draft|we'll send|action item)\b/i;
const REQUEST = /\b(can you|could you|would you mind|please)\b/i;
const SIGNAL = /(\$\d|\d+%|\b\d{2,}\b|\b(risk|concern|blocker|deadline|budget|churn|revenue|customers?|launch)\b)/i;
const FILLER = /^(ok(?:ay)?|so|yeah|right|um+|uh+|well|and|great|sure|cool|alright|perfect)[,.\s]+/i;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);
}

function dueFrom(text: string, meetingDate: string): string {
  const s = text.toLowerCase();
  if (/\b(today|end of day|eod|tonight)\b/.test(s)) return meetingDate.slice(0, 10);
  if (/\btomorrow\b/.test(s)) return addDays(meetingDate, 1);
  if (/\bnext week\b/.test(s)) return addDays(meetingDate, 7);
  if (/\bend of (the )?week\b/.test(s)) s.replace("end of the week", "friday");
  const day = WEEKDAYS.findIndex((d) => s.includes(d));
  if (day >= 0 || /\bend of (the )?week\b/.test(s)) {
    const target = day >= 0 ? day : 5;
    const current = new Date(meetingDate).getUTCDay();
    return addDays(meetingDate, ((target - current + 7) % 7) || 7);
  }
  return addDays(meetingDate, 7);
}

function cleanSentence(text: string): string {
  let s = text.trim();
  for (let i = 0; i < 3; i++) s = s.replace(FILLER, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toTask(sentence: string): string {
  let s = cleanSentence(sentence).replace(/[?!.]+$/, "");
  s = s.replace(/^(i'll|i will|i'm going to|i can|let me|we'll|we will|can you|could you|would you mind|please)\s+/i, "");
  s = s.replace(/^(take|go ahead and|also|just)\s+/i, "");
  s = s.replace(/\s*\b((by|before|on) (monday|tuesday|wednesday|thursday|friday|tomorrow|end of (the )?(day|week)|next week)|tomorrow|today|next week|this week)\b.*$/i, "").trim();
  s = s.replace(/,\s*\w+$/, ""); // trailing vocative ("…, Priya")
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleCase(words: string[]): string {
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" & ");
}

export function analyzeLocally(input: AnalysisInput): Analysis {
  const all = input.lines.flatMap((line, lineIndex) =>
    sentences(line.text).map((text) => ({ text, line, lineIndex, tokens: tokenize(text) })),
  );

  // Term frequency across the meeting, ignoring speaker names.
  const nameTokens = new Set(Object.values(input.speakers).flatMap((n) => tokenize(n)));
  const tf = new Map<string, number>();
  for (const s of all) for (const tok of new Set(s.tokens)) if (!nameTokens.has(tok) && tok.length > 2) tf.set(tok, (tf.get(tok) ?? 0) + 1);
  // Most common surface form per stem, so titles read "Pricing", not "pric".
  const surfaceCounts = new Map<string, Map<string, number>>();
  for (const l of input.lines)
    for (const w of words(l.text)) {
      const forms = surfaceCounts.get(stem(w)) ?? new Map<string, number>();
      forms.set(w, (forms.get(w) ?? 0) + 1);
      surfaceCounts.set(stem(w), forms);
    }
  const surface = (tok: string) => [...(surfaceCounts.get(tok)?.entries() ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0] ?? tok;
  const score = (tokens: string[]) => {
    const uniq = [...new Set(tokens)].filter((t) => tf.has(t));
    return uniq.length ? uniq.reduce((a, t) => a + Math.log(1 + (tf.get(t) ?? 0)), 0) / Math.sqrt(tokens.length + 1) : 0;
  };

  const substantive = all.filter((s) => s.text.split(/\s+/).length >= 7 && !s.text.trim().endsWith("?"));
  const summarySentences = [...substantive]
    .sort((a, b) => score(b.tokens) - score(a.tokens))
    .slice(0, 3)
    .sort((a, b) => a.line.start - b.line.start);
  const used = new Set(summarySentences.map((s) => s.text));

  const keyDecisions = substantive.filter((s) => DECISION.test(s.text)).slice(0, 4).map((s) => cleanSentence(s.text));
  keyDecisions.forEach((d) => used.add(d));

  const takeaways = substantive
    .filter((s) => SIGNAL.test(s.text) && !used.has(s.text))
    .sort((a, b) => score(b.tokens) - score(a.tokens))
    .slice(0, 3)
    .sort((a, b) => a.line.start - b.line.start)
    .map((s) => cleanSentence(s.text));

  const actionItems: Analysis["actionItems"] = [];
  const seen = new Set<string>();
  for (const s of all) {
    if (actionItems.length >= 8) break;
    let ownerId: string | null = null;
    if (COMMITMENT.test(s.text)) ownerId = s.line.speakerId;
    else if (REQUEST.test(s.text)) {
      // "Can you send the deck?" — the next different speaker is usually the owner.
      const next = input.lines.slice(s.lineIndex + 1).find((l) => l.speakerId !== s.line.speakerId);
      ownerId = next?.speakerId ?? null;
    }
    if (!ownerId) continue;
    const title = toTask(s.text);
    if (title.split(/\s+/).length < 3 || title.length > 140) continue;
    // Skip near-duplicates ("Draft the email nudge copy" / "Draft the nudge copy").
    const toks = new Set(tokenize(title));
    const duplicate = actionItems.some((a) => {
      const other = new Set(tokenize(a.title));
      const overlap = [...toks].filter((x) => other.has(x)).length;
      return overlap / Math.max(1, Math.min(toks.size, other.size)) >= 0.75;
    });
    if (duplicate || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    actionItems.push({ title, ownerId, dueDate: dueFrom(s.text, input.date) });
  }

  // Topics: split into chapters and name each by its most distinctive terms.
  const chapters = Math.max(2, Math.min(8, Math.round(input.durationSec / 300)));
  const size = Math.ceil(input.lines.length / chapters);
  const topics: Topic[] = [];
  for (let i = 0; i < input.lines.length; i += size) {
    const chunk = input.lines.slice(i, i + size);
    const local = new Map<string, number>();
    for (const l of chunk) for (const tok of tokenize(l.text)) if (tf.has(tok) && !nameTokens.has(tok)) local.set(tok, (local.get(tok) ?? 0) + 1);
    const best = [...local.entries()]
      .map(([tok, n]) => ({ tok, s: n / Math.sqrt(tf.get(tok) ?? 1) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 2)
      .map((x) => x.tok);
    topics.push({ title: i === 0 ? "Opening" : best.length ? titleCase(best.map(surface)) : `Part ${topics.length + 1}`, start: chunk[0].start });
  }

  const tags = [...tf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tok]) => surface(tok).toLowerCase());
  const questions = all.filter((s) => s.text.trim().endsWith("?")).length;
  const speakerCount = new Set(input.lines.map((l) => l.speakerId)).size;

  return {
    summary: summarySentences.map((s) => cleanSentence(s.text)).join(" ") || "No summary could be generated from this transcript.",
    keyDecisions,
    takeaways,
    topics,
    actionItems,
    tags,
    tone: `${speakerCount} speaker${speakerCount === 1 ? "" : "s"} · ${questions / Math.max(1, all.length) > 0.2 ? "exploratory" : keyDecisions.length ? "decision-focused" : "discussion"}`,
    suggestedQuestions: [
      keyDecisions.length ? "What did we decide?" : "What was this meeting about?",
      "What are the next steps?",
      tags[0] ? `What was said about ${tags[0]}?` : "Who spoke the most?",
    ],
    template: TEMPLATE_FOR_TYPE[input.meetingType] ?? "general",
    engine: "local",
  };
}
