/**
 * Tiny, dependency-free text utilities shared by search, "Ask", and summary
 * templates. Deterministic by design so results are identical on server and client.
 */

const STOPWORDS = new Set(
  (
    "a an and are as at be been but by can could did do does doing for from had has have how i if in into is it its " +
    "just me my of on or our out over say said says so than that the their them then there these they this those to " +
    "up us was we were what whats when where which who whom why will with would you your about any anything all " +
    "tell talked talk discuss discussed mention mentioned meeting meetings call calls think thought get got going let lets " +
    "should shall much many some more most take takes run make work there's it's we're i'm i'd i'll you're"
  ).split(" "),
);

/** Words that express the kind of question rather than its subject. */
export const INTENT_WORDS = new Set(["decide", "decid", "decis", "agre", "conclud", "conclus", "summar", "summary", "summariz", "recap", "overview", "tldr", "next", "step", "action", "item", "todo", "follow", "owner", "own", "responsibl", "happen"]);

const SYNONYMS: string[][] = [
  ["pric", "cost", "discount"],
  ["need", "requir", "requirement", "must"],
  ["strength", "strong"],
  ["well", "win", "great", "love", "good", "success"],
  ["caus", "root", "trac", "reason"],
  ["metric", "number", "arr", "nrr", "revenu", "retention", "kpi"],
  ["migrat", "mov", "upgrad"],
  ["sso", "saml", "identity", "okta"],
  ["launch", "releas", "ship"],
  ["hir", "hire", "candidat", "interview"],
  ["deadlin", "timelin", "date"],
  ["risk", "concern", "worri", "blocker", "weakness"],
  ["slow", "slowdown", "performanc", "regress", "latency"],
  ["customer", "client", "prospect", "buyer"],
  ["metric", "definit"],
  ["deprovis", "scim", "provis"],
  ["fundrais", "rais", "sery"],
  ["arr", "revenu"],
];

export function stem(word: string): string {
  let w = word.toLowerCase().replace(/['’]s$/, "").replace(/[^a-z0-9+]/g, "");
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("es") && !w.endsWith("ses")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  if (w.length > 6 && w.endsWith("ion")) w = w.slice(0, -3);
  return w;
}

export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9+]+(?:['’][a-z]+)?/g) ?? [];
}

/** Content tokens: stemmed, stopwords removed. */
export function tokenize(text: string): string[] {
  return words(text)
    .map((w) => w.replace(/['’](s|re|ll|d|m|ve)$/, ""))
    .filter((w) => !STOPWORDS.has(w) && w.length > 1)
    .map(stem)
    .filter(Boolean);
}

export interface QueryTerm {
  term: string;
  weight: number;
  /** The query term this was expanded from (itself for base terms). */
  from: string;
}

/** Tokenize a query and expand synonyms at a reduced weight. */
export function expandQuery(text: string, { dropIntentWords = false } = {}): QueryTerm[] {
  const base = tokenize(text).filter((t) => !dropIntentWords || !INTENT_WORDS.has(t));
  const out = new Map<string, QueryTerm>();
  for (const t of base) out.set(t, { term: t, weight: 1, from: t });
  for (const t of base) {
    for (const group of SYNONYMS) {
      if (group.includes(t)) for (const s of group) if (!out.has(s)) out.set(s, { term: s, weight: 0.55, from: t });
    }
  }
  return [...out.values()];
}

/** Split a paragraph into sentences. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Return a window of `size` chars around the first occurrence of any term. */
export function snippetAround(text: string, query: string, size = 170): string {
  const lower = text.toLowerCase();
  const needles = [query.toLowerCase().trim(), ...words(query).filter((w) => !STOPWORDS.has(w))].filter(Boolean);
  let idx = -1;
  for (const n of needles) {
    idx = lower.indexOf(n);
    if (idx === -1 && n.length > 4) idx = lower.indexOf(stem(n));
    if (idx !== -1) break;
  }
  if (idx === -1 || text.length <= size) return text.length <= size ? text : `${text.slice(0, size).trimEnd()}…`;
  const start = Math.max(0, idx - Math.floor(size / 3));
  const end = Math.min(text.length, start + size);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  const from = start > 0 ? text.indexOf(" ", start) + 1 || start : 0;
  return `${prefix}${text.slice(from, end).trim()}${suffix}`;
}

/** Terms to visually mark in UI for a given query (raw words, not stems). */
export function highlightTerms(query: string): string[] {
  const phrase = query.trim();
  const ws = words(phrase).filter((w) => !STOPWORDS.has(w) && w.length > 1);
  return [...new Set([...ws.map((w) => (w.length > 5 ? stem(w) : w))])];
}
