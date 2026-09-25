import type { Meeting, SummarySection, SummarySectionItem, TemplateId, TranscriptEntry } from "@/types";
import { personOf } from "./people";

export interface TemplateDef {
  id: TemplateId;
  name: string;
  description: string;
}

export const TEMPLATES: TemplateDef[] = [
  { id: "general", name: "General", description: "Summary, decisions, topics, and next steps" },
  { id: "sales", name: "Sales Call", description: "Pain points, objections, buying signals, pricing" },
  { id: "research", name: "Customer Research", description: "Insights, pain points, requests, and quotes" },
  { id: "one-on-one", name: "1:1", description: "Wins, blockers, feedback, and commitments" },
  { id: "interview", name: "Interview", description: "Strengths, concerns, and recommendation" },
  { id: "product", name: "Product Meeting", description: "Decisions, requirements, risks, and timeline" },
];

export function getTemplate(id: TemplateId): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/* ------------------------------------------------------------------ */
/* Deterministic transcript classifiers                                */
/* ------------------------------------------------------------------ */

const PATTERNS = {
  concern: /\b(concern|risk|worr|blocker|problem|pain|painful|slip|slow|issue|frustrat|hard to|stale|drift|too late|lock themselves out|brutal|tension|non-negotiable|deal-breaker|weakness|over-own|eroding|misleading|dead|unnoticed|muddies|what about|flag it|don't onboard|without it|auditors)\w*/i,
  positive: /\b(love|great|excited|excellent|win|went really well|promising|proud|happy|perfect|strong|clearest|tested well|best|enthusiastic|good instinct|within what i can approve)\w*/i,
  need: /\b(need|want|wish|would love|would be nice|must|require|mandat|asks? (?:for|about)|requested|non-negotiable|checkbox|table stakes)\w*/i,
  pricing: /\b(price|pricing|cost|budget|discount|per seat|dollars|thousand|contract|commit|overage|margin)\w*/i,
  timeline: /\b(january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|next week|this week|by the|twentieth|twenty-seventh|timeline|quarter|q[1-4]|days|weeks|milestone)\b/i,
  feedback: /\b(feedback|push you|strength|growth|i tend to|try posting|fair|more of those)\w*/i,
};

type PatternKey = keyof typeof PATTERNS;

function toItem(entry: TranscriptEntry): SummarySectionItem {
  return { text: entry.text, start: entry.start, speakerId: entry.speakerId };
}

function pick(
  meeting: Meeting,
  patterns: PatternKey[],
  { limit = 4, external, minLength = 45, exclude = new Set<string>() }: { limit?: number; external?: boolean; minLength?: number; exclude?: Set<string> } = {},
): SummarySectionItem[] {
  const hasExternal = meeting.participants.some((p) => personOf(meeting, p).external);
  const scored = meeting.transcript
    .filter((e) => !exclude.has(e.id) && e.text.length >= minLength)
    .filter((e) => (external === undefined || !hasExternal ? true : personOf(meeting, e.speakerId).external === external))
    .map((e) => ({
      e,
      score: patterns.reduce((acc, p) => acc + (PATTERNS[p].test(e.text) ? 1 : 0), 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.e.text.length - a.e.text.length)
    .slice(0, limit)
    .sort((a, b) => a.e.start - b.e.start);
  scored.forEach((x) => exclude.add(x.e.id));
  return scored.map((x) => toItem(x.e));
}

function questions(meeting: Meeting, limit = 3): SummarySectionItem[] {
  return meeting.transcript
    .filter((e) => e.text.trim().endsWith("?") && e.text.length > 25)
    .slice(0, limit)
    .map(toItem);
}

function quotes(meeting: Meeting, limit = 3, exclude = new Set<string>()): SummarySectionItem[] {
  const externals = meeting.transcript.filter((e) => personOf(meeting, e.speakerId).external && !exclude.has(e.id));
  const pool = externals.length >= 2 ? externals : meeting.transcript.filter((e) => !exclude.has(e.id));
  return [...pool]
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, limit)
    .sort((a, b) => a.start - b.start)
    .map(toItem);
}

function list(texts: string[]): SummarySectionItem[] {
  return texts.map((text) => ({ text }));
}

function actions(meeting: Meeting): SummarySectionItem[] {
  return meeting.actionItems.map((a) => ({ text: a.title, speakerId: a.ownerId }));
}

function topics(meeting: Meeting): SummarySectionItem[] {
  return meeting.topics.map((t) => ({ text: t.title, start: t.start }));
}

/**
 * Build the summary sections for a meeting under a given template. Hand-written
 * summary fields are combined with deterministic transcript classification so
 * that every template visibly reorganizes the same meeting.
 */
export function buildSummary(meeting: Meeting, templateId: TemplateId): SummarySection[] {
  const used = new Set<string>();
  const empty = "Nothing notable was captured for this section.";
  const external = meeting.participants.some((p) => personOf(meeting, p).external);

  switch (templateId) {
    case "sales":
      return [
        { id: "overview", title: "Call overview", kind: "paragraph", items: [{ text: meeting.summary }] },
        { id: "pain", title: "Pain points", description: external ? "Problems the other side described" : undefined, kind: "quotes", items: pick(meeting, ["concern", "need"], { external: true, exclude: used }), empty },
        { id: "objections", title: "Objections & concerns", kind: "quotes", items: pick(meeting, ["concern"], { limit: 3, exclude: used }), empty },
        { id: "signals", title: "Buying signals", kind: "quotes", items: pick(meeting, ["positive"], { limit: 3, exclude: used }), empty },
        { id: "pricing", title: "Pricing & commercials", kind: "quotes", items: pick(meeting, ["pricing"], { limit: 3, exclude: used }), empty },
        { id: "next", title: "Agreed next steps", kind: "checklist", items: actions(meeting), empty },
      ];
    case "research":
      return [
        { id: "overview", title: "Research summary", kind: "paragraph", items: [{ text: meeting.summary }] },
        { id: "insights", title: "Key insights", kind: "list", items: list(meeting.takeaways) },
        { id: "pain", title: "Pain points", kind: "quotes", items: pick(meeting, ["concern"], { exclude: used }), empty },
        { id: "requests", title: "Requests & needs", kind: "quotes", items: pick(meeting, ["need"], { limit: 3, exclude: used }), empty },
        { id: "quotes", title: "Notable quotes", kind: "quotes", items: quotes(meeting, 3, used), empty },
        { id: "follow", title: "Follow-ups", kind: "checklist", items: actions(meeting), empty },
      ];
    case "one-on-one":
      return [
        { id: "overview", title: "Check-in", kind: "paragraph", items: [{ text: meeting.summary }] },
        { id: "wins", title: "Wins & progress", kind: "quotes", items: pick(meeting, ["positive"], { limit: 3, exclude: used }), empty },
        { id: "blockers", title: "Blockers & challenges", kind: "quotes", items: pick(meeting, ["concern"], { limit: 3, exclude: used }), empty },
        { id: "feedback", title: "Feedback", kind: "quotes", items: pick(meeting, ["feedback"], { limit: 3, exclude: used }), empty },
        { id: "commitments", title: "Commitments", kind: "checklist", items: actions(meeting), empty },
      ];
    case "interview":
      return [
        { id: "overview", title: "Candidate overview", kind: "paragraph", items: [{ text: meeting.summary }] },
        { id: "recommendation", title: "Recommendation", kind: "list", items: list(meeting.keyDecisions) },
        { id: "strengths", title: "Strengths", kind: "list", items: list(meeting.takeaways.filter((t) => !PATTERNS.concern.test(t))) },
        { id: "concerns", title: "Concerns & growth areas", kind: "quotes", items: pick(meeting, ["concern"], { limit: 3, exclude: used }), empty },
        { id: "answers", title: "Notable answers", kind: "quotes", items: quotes(meeting, 3, used), empty },
        { id: "next", title: "Next steps", kind: "checklist", items: actions(meeting), empty },
      ];
    case "product":
      return [
        { id: "overview", title: "Summary", kind: "paragraph", items: [{ text: meeting.summary }] },
        { id: "decisions", title: "Decisions", kind: "list", items: list(meeting.keyDecisions) },
        { id: "requirements", title: "Requirements", kind: "quotes", items: pick(meeting, ["need"], { limit: 3, exclude: used }), empty },
        { id: "risks", title: "Risks & open questions", kind: "quotes", items: [...pick(meeting, ["concern"], { limit: 3, exclude: used }), ...questions(meeting, 1)], empty },
        { id: "timeline", title: "Timeline & milestones", kind: "quotes", items: pick(meeting, ["timeline"], { limit: 3, exclude: used }), empty },
        { id: "owners", title: "Owners & next steps", kind: "checklist", items: actions(meeting), empty },
      ];
    case "general":
    default:
      return [
        { id: "overview", title: "Summary", kind: "paragraph", items: [{ text: meeting.summary }] },
        { id: "decisions", title: "Key decisions", kind: "list", items: list(meeting.keyDecisions) },
        { id: "topics", title: "Topics discussed", kind: "topics", items: topics(meeting) },
        { id: "takeaways", title: "Important takeaways", kind: "list", items: list(meeting.takeaways) },
        { id: "next", title: "Next steps", kind: "checklist", items: actions(meeting), empty },
      ];
  }
}

/** Plain-text rendering used for "Copy summary". */
export function summaryToText(meeting: Meeting, sections: SummarySection[]): string {
  const lines = [`${meeting.title}`, ""];
  for (const s of sections) {
    lines.push(s.title.toUpperCase());
    if (s.items.length === 0) lines.push(`- ${s.empty ?? "—"}`);
    for (const item of s.items) {
      if (s.kind === "paragraph") lines.push(item.text);
      else if (s.kind === "checklist") lines.push(`- [ ] ${item.text}${item.speakerId ? ` (${personOf(meeting, item.speakerId).name})` : ""}`);
      else if (s.kind === "quotes") lines.push(`- ${personOf(meeting, item.speakerId ?? "").name}: “${item.text}”`);
      else lines.push(`- ${item.text}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
