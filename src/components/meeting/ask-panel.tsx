"use client";

import { ArrowUp, Quote, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPerson } from "@/data/people";
import { askMeeting } from "@/lib/ask";
import { formatTimestamp } from "@/lib/format";
import { useAsk } from "@/lib/use-ask";
import { truncate } from "@/lib/utils";
import type { AskSource } from "@/types";
import { usePlayer } from "../player/player-context";
import { Avatar } from "../ui/avatar";
import { useMeeting } from "./meeting-context";

export function ThinkingDots({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px] text-muted" role="status">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </span>
      {label}
    </div>
  );
}

function SourceButton({ source }: { source: AskSource }) {
  const { seek } = usePlayer();
  return (
    <button
      onClick={() => seek(source.start, { play: true })}
      className="group flex w-full cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/50"
    >
      <span className="mt-0.5 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] text-brand-700 tabular group-hover:bg-brand-100">
        {formatTimestamp(source.start)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-ink">{source.label}</span>
        <span className="mt-0.5 flex items-start gap-1.5 text-xs text-muted">
          <Avatar personId={source.speakerId} size="xs" className="mt-px" />
          <span>
            <span className="font-medium text-ink-2">{getPerson(source.speakerId).name.split(" ")[0]}:</span> “{truncate(source.excerpt, 140)}”
          </span>
        </span>
      </span>
    </button>
  );
}

export function AskPanel() {
  const { meeting } = useMeeting();
  const payload = useMemo(() => ({ meetingId: meeting.id }), [meeting.id]);
  const local = useCallback((q: string) => askMeeting(meeting, q), [meeting]);
  const { turns, ask, busy } = useAsk(payload, local);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns]);

  const submit = (q: string) => {
    if (!q.trim() || busy) return;
    setInput("");
    void ask(q);
  };

  return (
    <div className="flex flex-col">
      <div className="space-y-5 p-5">
        {turns.length === 0 ? (
          <div className="rounded-xl bg-gradient-to-br from-brand-50 to-surface p-5">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Sparkles className="size-4 text-brand-600" /> Ask this meeting
            </div>
            <p className="mt-1 text-[13px] text-muted">
              Answers are grounded in this meeting&apos;s transcript, decisions, and action items — with timestamps you can
              play.
            </p>
            <div className="mt-4 flex flex-col gap-1.5">
              {meeting.suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => submit(q)}
                  className="w-fit cursor-pointer rounded-full border border-brand-200 bg-surface px-3 py-1.5 text-left text-[13px] text-brand-800 transition-colors hover:bg-brand-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.map((turn) => (
          <div key={turn.id} className="space-y-3 animate-slide-up">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-[13.5px] text-white">{turn.question}</p>
            </div>
            <div className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
                <Sparkles className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1 pt-1">
                {turn.status === "loading" ? (
                  <ThinkingDots label="Searching the transcript…" />
                ) : turn.answer ? (
                  <div className="space-y-3">
                    <p className="text-[14px] leading-relaxed text-ink">{turn.answer.answer}</p>
                    {turn.answer.sources.length ? (
                      <div>
                        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">
                          <Quote className="size-3" /> Sources
                        </p>
                        <div className="space-y-1.5">
                          {turn.answer.sources.map((s) => (
                            <SourceButton key={s.entryId} source={s} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-0 border-t border-line bg-surface/95 p-3 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1.5 pl-3.5 shadow-card focus-within:border-brand-400 focus-within:ring-3 focus-within:ring-brand-100">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about decisions, owners, dates…"
            aria-label="Ask a question about this meeting"
            className="h-8 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            aria-label="Ask"
            className="grid size-8 cursor-pointer place-items-center rounded-lg bg-brand-700 text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-line-strong"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
