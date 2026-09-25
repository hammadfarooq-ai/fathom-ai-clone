"use client";

import { ArrowUp, Loader2, Quote, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar, PersonName } from "@/components/people";
import { askQuestion } from "@/lib/api";
import { formatShortDate, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AskAnswer, AskSource } from "@/types";

interface Turn {
  id: number;
  question: string;
  answer?: AskAnswer;
  error?: string;
}

/**
 * Question/answer thread against /api/ask. Each answer cites transcript lines;
 * inside a meeting, sources seek the player, elsewhere they link to the moment.
 */
export function AskThread({
  meetingId,
  suggestions,
  initialQuestion,
  onSource,
  compact,
}: {
  meetingId?: string;
  suggestions: string[];
  initialQuestion?: string;
  /** When set (inside a meeting), sources call this instead of navigating. */
  onSource?: (s: AskSource) => void;
  compact?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const id = nextId.current++;
    setTurns((t) => [...t, { id, question }]);
    setDraft("");
    setBusy(true);
    try {
      const answer = await askQuestion(question, meetingId);
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, answer } : x)));
    } catch (e) {
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: e instanceof Error ? e.message : "Something went wrong" } : x)));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialQuestion && !asked.current) {
      asked.current = true;
      void ask(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("scrollbar-thin min-h-0 flex-1 overflow-y-auto", compact ? "px-6" : "")}>
        {turns.length === 0 ? (
          <div className={cn(compact ? "pt-2" : "pt-4")}>
            <p className="eyebrow">Try asking</p>
            <div className="mt-2.5 flex flex-col items-start gap-1.5">
              {suggestions.map((s) => (
                <button key={s} onClick={() => void ask(s)} className="rounded-full border border-rule px-3 py-1.5 text-left text-[13px] text-ink-2 hover:border-ink hover:text-ink">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-8 pb-6">
          {turns.map((t) => (
            <article key={t.id} className="animate-rise">
              <p className={cn("font-display leading-tight text-ink", compact ? "text-[22px]" : "text-[28px]")}>{t.question}</p>
              {t.error ? (
                <p className="mt-3 text-[14px] text-danger">{t.error}</p>
              ) : !t.answer ? (
                <p className="mt-3 flex items-center gap-2 text-[13.5px] text-muted">
                  <Loader2 className="size-4 animate-spin" /> Reading {meetingId ? "the transcript" : "your meetings"}…
                </p>
              ) : (
                <div className="mt-3">
                  <p className="text-[15.5px] leading-[1.7] text-ink">{t.answer.answer}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-faint">
                    <Sparkles className="size-3" />
                    {t.answer.mode === "llm" ? "Phrased by Claude from the cited lines" : "Composed from the cited lines"}
                  </p>
                  {t.answer.sources.length > 0 ? (
                    <div className="mt-4">
                      <p className="eyebrow">Sources</p>
                      <ol className="mt-2 space-y-2">
                        {t.answer.sources.map((s, i) => {
                          const body = (
                            <>
                              <span className="flex items-center gap-2 text-[12px] text-muted">
                                <span className="tabular font-mono text-faint">{String(i + 1).padStart(2, "0")}</span>
                                {!meetingId ? <span className="truncate font-medium text-ink-2">{s.meetingTitle}</span> : null}
                                {!meetingId ? <span>· {formatShortDate(s.meetingDate)}</span> : <span className="truncate">{s.label}</span>}
                                <span className="tabular font-mono">{formatTimestamp(s.start)}</span>
                              </span>
                              <span className="mt-1 flex gap-2">
                                <Avatar personId={s.speakerId} size="xs" className="mt-0.5" />
                                <span className="text-[13.5px] leading-relaxed text-ink-2">
                                  <PersonName id={s.speakerId} first className="mr-1" />
                                  <Quote className="mr-0.5 inline size-3 -translate-y-0.5 text-faint" />
                                  {s.excerpt}
                                </span>
                              </span>
                            </>
                          );
                          const cls = "block w-full rounded-md border border-rule bg-card px-3 py-2.5 text-left transition-colors hover:border-ink";
                          return (
                            <li key={`${s.meetingId}-${s.entryId}`}>
                              {onSource ? (
                                <button className={cls} onClick={() => onSource(s)}>
                                  {body}
                                </button>
                              ) : (
                                <Link className={cls} href={`/meetings/${s.meetingId}?t=${s.start}`}>
                                  {body}
                                </Link>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ) : null}
                </div>
              )}
            </article>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
        className={cn("border-t border-rule pt-3", compact ? "px-6 pb-5" : "pb-2")}
      >
        <div className="flex items-end gap-2 rounded-lg border border-rule-strong bg-card p-1.5 pl-3 focus-within:border-ink">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(draft);
              }
            }}
            rows={1}
            placeholder={meetingId ? "Ask about this meeting…" : "Ask across every meeting…"}
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-[14px] outline-none placeholder:text-faint"
            aria-label="Question"
          />
          <button type="submit" disabled={!draft.trim() || busy} className="grid size-9 shrink-0 place-items-center rounded-md bg-ink text-paper disabled:opacity-30" aria-label="Ask">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
