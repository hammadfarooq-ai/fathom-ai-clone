"use client";

import { ArrowUp, ChevronDown, FileSearch, Loader2, Quote, Search, SearchX, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { getPerson } from "@/data/people";
import { askAcrossMeetings } from "@/lib/ask";
import { formatDay, formatTimestamp } from "@/lib/format";
import { MATCH_LABELS, searchMeetings, SEARCH_SUGGESTIONS, type MatchType, type MeetingSearchResult } from "@/lib/search";
import { useMeetings, useWorkspace } from "@/lib/store";
import { highlightTerms } from "@/lib/text";
import { useAsk } from "@/lib/use-ask";
import { cn, truncate } from "@/lib/utils";
import { MeetingTypeBadge } from "../meeting-meta";
import { ThinkingDots } from "../meeting/ask-panel";
import { Avatar } from "../ui/avatar";
import { HighlightText } from "../ui/highlight-text";
import { Badge, Card, EmptyState, Kbd } from "../ui/primitives";

type Mode = "search" | "ask";

const ASK_EXAMPLES = [
  "What did customers say about SSO?",
  "What did we decide about enterprise pricing?",
  "What are the risks for the October launch?",
  "What do we know about Helix Logistics?",
];

function updateUrl(q: string, mode: Mode) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (mode === "ask") params.set("mode", "ask");
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `/search?${qs}` : "/search");
}

function ResultCard({ result, query, terms, typeFilter }: { result: MeetingSearchResult; query: string; terms: string[]; typeFilter: MatchType | "all" }) {
  const [expanded, setExpanded] = useState(false);
  const matches = typeFilter === "all" ? result.matches : result.matches.filter((m) => m.type === typeFilter);
  const shown = expanded ? matches : matches.slice(0, 4);
  const m = result.meeting;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-5 py-3.5">
        <div className="min-w-0">
          <Link href={`/meetings/${m.id}`} className="text-[15px] font-semibold text-ink hover:text-brand-800 hover:underline">
            <HighlightText text={m.title} terms={terms} />
          </Link>
          <p className="mt-0.5 text-xs text-muted">
            {formatDay(m.date)} · {matches.length} match{matches.length === 1 ? "" : "es"}
          </p>
        </div>
        <MeetingTypeBadge type={m.meetingType} />
      </div>
      <ul className="divide-y divide-line">
        {shown.map((match, i) => {
          const href =
            match.start !== undefined
              ? `/meetings/${m.id}?t=${match.start}&q=${encodeURIComponent(query)}`
              : `/meetings/${m.id}`;
          return (
            <li key={`${match.type}-${match.start ?? i}-${i}`}>
              <Link href={href} className="flex gap-3 px-5 py-3 transition-colors hover:bg-subtle/70">
                <div className="flex w-24 shrink-0 flex-col items-start gap-1">
                  <Badge tone={match.type === "transcript" ? "neutral" : match.type === "highlight" ? "mark" : "brand"}>{MATCH_LABELS[match.type]}</Badge>
                  {match.start !== undefined ? <span className="font-mono text-[11px] text-brand-700 tabular">{formatTimestamp(match.start)}</span> : null}
                </div>
                <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink-2">
                  {match.speakerId ? (
                    <span className="mr-1.5 inline-flex items-center gap-1 align-middle text-xs font-semibold text-ink">
                      <Avatar personId={match.speakerId} size="xs" />
                      {getPerson(match.speakerId).name.split(" ")[0]}
                    </span>
                  ) : null}
                  <HighlightText text={match.snippet} terms={terms} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {matches.length > 4 ? (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full cursor-pointer items-center justify-center gap-1 border-t border-line py-2 text-xs font-medium text-muted hover:bg-subtle hover:text-ink"
        >
          {expanded ? "Show fewer" : `Show all ${matches.length} matches`}
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      ) : null}
    </Card>
  );
}

function KeywordResults({ query }: { query: string }) {
  const meetings = useMeetings();
  const deferred = useDeferredValue(query);
  const pending = deferred !== query;
  const results = useMemo(() => searchMeetings(meetings, deferred), [meetings, deferred]);
  const terms = useMemo(() => highlightTerms(deferred), [deferred]);
  const [typeFilter, setTypeFilter] = useState<MatchType | "all">("all");

  const counts = useMemo(() => {
    const c: Partial<Record<MatchType, number>> = {};
    results.forEach((r) => r.matches.forEach((m) => (c[m.type] = (c[m.type] ?? 0) + 1)));
    return c;
  }, [results]);
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const visible = typeFilter === "all" ? results : results.filter((r) => r.matches.some((m) => m.type === typeFilter));

  if (deferred.trim().length < 2) return null;

  if (results.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<SearchX />}
          title={`No results for “${deferred.trim()}”`}
          description="Try a broader keyword, a person's name, or ask the question in plain English with Ask AI."
        />
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4 transition-opacity", pending && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[13px] text-muted">
          <span className="font-medium text-ink">{total}</span> matches in <span className="font-medium text-ink">{results.length}</span> meetings
        </span>
        {pending ? <Loader2 className="size-3.5 animate-spin text-muted" aria-label="Searching" /> : null}
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {(["all", ...(Object.keys(MATCH_LABELS) as MatchType[]).filter((t) => counts[t])] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              aria-pressed={typeFilter === t}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                typeFilter === t ? "border-brand-300 bg-brand-50 text-brand-800" : "border-line bg-surface text-ink-2 hover:border-line-strong",
              )}
            >
              {t === "all" ? "All" : MATCH_LABELS[t]} <span className="text-faint tabular">{t === "all" ? total : counts[t]}</span>
            </button>
          ))}
        </div>
      </div>
      {visible.map((r) => (
        <ResultCard key={r.meeting.id} result={r} query={deferred} terms={terms} typeFilter={typeFilter} />
      ))}
    </div>
  );
}

function AskResults({ question, onAsk }: { question: string; onAsk: (q: string) => void }) {
  const meetings = useMeetings();
  const imports = useWorkspace((s) => s.imports);
  const payload = useMemo(() => ({ includeIds: imports.map((i) => i.id) }), [imports]);
  const local = useCallback((q: string) => askAcrossMeetings(meetings, q), [meetings]);
  const { turns, ask } = useAsk(payload, local);
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (question && asked.current !== question) {
      asked.current = question;
      void ask(question);
    }
  }, [question, ask]);

  if (turns.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <Sparkles className="size-4 text-brand-600" /> Ask across all your meetings
        </div>
        <p className="mt-1 max-w-xl text-[13px] text-muted">
          Get an answer synthesized from every transcript, summary, and decision — with the exact moments it came from.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {ASK_EXAMPLES.map((q) => (
            <button
              key={q}
              onClick={() => onAsk(q)}
              className="cursor-pointer rounded-xl border border-line px-3.5 py-3 text-left text-[13px] text-ink-2 transition-colors hover:border-brand-200 hover:bg-brand-50/50 hover:text-ink"
            >
              {q}
            </button>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {[...turns].reverse().map((turn) => (
        <Card key={turn.id} className="overflow-hidden animate-slide-up">
          <div className="border-b border-line bg-gradient-to-br from-brand-50 to-surface px-5 py-4">
            <p className="text-xs font-medium text-brand-700">Question</p>
            <p className="mt-0.5 text-[15px] font-semibold text-ink">{turn.question}</p>
          </div>
          <div className="p-5">
            {turn.status === "loading" || !turn.answer ? (
              <ThinkingDots label="Reading transcripts across your meetings…" />
            ) : (
              <div className="space-y-5">
                <div className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
                    <Sparkles className="size-3.5" />
                  </span>
                  <p className="pt-0.5 text-[14.5px] leading-relaxed text-ink">{turn.answer.answer}</p>
                </div>
                {turn.answer.meetings?.length ? (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">
                      <Quote className="size-3" /> Sources · {turn.answer.meetings.length} meetings
                    </p>
                    <ul className="grid gap-2.5 md:grid-cols-2">
                      {turn.answer.meetings.map((m) => (
                        <li key={m.meetingId}>
                          <Link
                            href={`/meetings/${m.meetingId}?t=${m.start}`}
                            className="flex h-full flex-col rounded-xl border border-line p-3.5 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[13.5px] font-semibold text-ink">{m.title}</span>
                              <span className="shrink-0 text-xs text-muted">{formatDay(m.date)}</span>
                            </div>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{m.insight}</p>
                            <div className="mt-2.5 flex items-start gap-2 border-t border-line pt-2.5 text-xs text-muted">
                              <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] text-brand-700 tabular">{formatTimestamp(m.start)}</span>
                              <span>
                                <span className="font-medium text-ink-2">{getPerson(m.speakerId).name.split(" ")[0]}:</span> “{truncate(m.excerpt, 120)}”
                              </span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function SearchView({ initialQuery, initialMode }: { initialQuery: string; initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [query, setQuery] = useState(initialQuery);
  const [question, setQuestion] = useState(initialMode === "ask" ? initialQuery : "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target as HTMLElement).closest("input, textarea")) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    updateUrl(query, m);
    inputRef.current?.focus();
  };

  const submitAsk = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setQuestion(trimmed);
    updateUrl(trimmed, "ask");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Search</h1>
        <p className="mt-1 text-sm text-muted">Find any moment across titles, summaries, transcripts, topics, and action items.</p>
      </div>

      <Card className="p-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "ask") submitAsk(query);
          }}
        >
          <div role="tablist" aria-label="Search mode" className="flex shrink-0 rounded-lg bg-subtle p-0.5">
            {(["search", "ask"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  mode === m ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
                )}
              >
                {m === "search" ? <Search className="size-3.5" /> : <Sparkles className="size-3.5 text-brand-600" />}
                <span className="hidden sm:inline">{m === "search" ? "Keyword" : "Ask AI"}</span>
              </button>
            ))}
          </div>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (mode === "search") updateUrl(e.target.value, "search");
            }}
            placeholder={mode === "search" ? "Search for “pricing”, “SSO”, a person…" : "Ask a question, e.g. What did customers say about SSO?"}
            aria-label={mode === "search" ? "Search meetings" : "Ask a question across meetings"}
            className="h-10 min-w-0 flex-1 bg-transparent px-1 text-[15px] text-ink outline-none placeholder:text-faint focus-visible:outline-none"
          />
          {mode === "ask" ? (
            <button
              type="submit"
              disabled={!query.trim()}
              aria-label="Ask"
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg bg-brand-700 text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-line-strong"
            >
              <ArrowUp className="size-4" />
            </button>
          ) : (
            <Kbd className="mr-2 hidden sm:inline-flex">/</Kbd>
          )}
        </form>
      </Card>

      {mode === "search" ? (
        query.trim().length < 2 ? (
          <Card>
            <EmptyState
              icon={<FileSearch />}
              title="Search every conversation"
              description="Results include meeting titles, AI summaries, decisions, action items, highlights, and word-for-word transcript matches."
              action={
                <div className="flex flex-wrap justify-center gap-1.5">
                  {SEARCH_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setQuery(s);
                        updateUrl(s, "search");
                      }}
                      className="cursor-pointer rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2 transition-colors hover:border-line-strong hover:bg-subtle"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              }
            />
          </Card>
        ) : (
          <KeywordResults query={query} />
        )
      ) : (
        <AskResults question={question} onAsk={submitAsk} />
      )}
    </div>
  );
}
