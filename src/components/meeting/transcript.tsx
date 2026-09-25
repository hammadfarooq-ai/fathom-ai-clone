"use client";

import { ChevronDown, ChevronUp, Highlighter, Link2, LocateFixed, Scissors, Search, X } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { usePlayer, usePlayerTime } from "@/components/player/player-context";
import { PersonName } from "@/components/people";
import { HighlightWords } from "@/components/ui/primitives";
import { formatTimestamp } from "@/lib/format";
import { activeIndex } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import type { Highlight, Meeting, TranscriptEntry } from "@/types";

interface Turn {
  speakerId: string;
  entries: { entry: TranscriptEntry; index: number }[];
}

function groupTurns(transcript: TranscriptEntry[]): Turn[] {
  const turns: Turn[] = [];
  transcript.forEach((entry, index) => {
    const last = turns.at(-1);
    if (last && last.speakerId === entry.speakerId && last.entries.length < 4) last.entries.push({ entry, index });
    else turns.push({ speakerId: entry.speakerId, entries: [{ entry, index }] });
  });
  return turns;
}

const Line = memo(function Line({
  entry,
  active,
  highlighted,
  query,
  isMatch,
  onSeek,
  onHighlight,
  onClip,
  onCopy,
}: {
  entry: TranscriptEntry;
  active: boolean;
  highlighted: boolean;
  query: string;
  isMatch: boolean;
  onSeek: () => void;
  onHighlight: () => void;
  onClip: () => void;
  onCopy: () => void;
}) {
  return (
    <div
      id={`line-${entry.id}`}
      data-line={entry.id}
      className={cn(
        "group/line relative -mx-2 rounded-md border-l-2 px-2 py-1 transition-colors",
        active ? "border-accent bg-accent-soft/40" : "border-transparent",
        highlighted && !active && "bg-mark-soft/50",
      )}
    >
      <p className={cn("text-[14.5px] leading-[1.65]", active ? "text-ink" : "text-ink-2")}>
        <button onClick={onSeek} className="tabular mr-2 font-mono text-[11px] text-faint hover:text-accent" aria-label={`Play from ${formatTimestamp(entry.start)}`}>
          {formatTimestamp(entry.start)}
        </button>
        {isMatch && query ? <HighlightWords text={entry.text} query={query} /> : entry.text}
      </p>
      <div className="absolute -top-3 right-1 z-10 hidden items-center rounded-md border border-rule bg-card shadow-card group-focus-within/line:flex group-hover/line:flex">
        <button onClick={onHighlight} className="flex h-7 items-center gap-1 px-2 text-[11.5px] text-ink-2 hover:bg-mark-soft" aria-label="Highlight this line">
          <Highlighter className="size-3.5" /> {highlighted ? "Saved" : "Highlight"}
        </button>
        <button onClick={onClip} className="grid size-7 place-items-center text-ink-2 hover:bg-sunken" aria-label="Clip from this line" title="Share a clip">
          <Scissors className="size-3.5" />
        </button>
        <button onClick={onCopy} className="grid size-7 place-items-center text-ink-2 hover:bg-sunken" aria-label="Copy link to this moment" title="Copy link to this moment">
          <Link2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
});

export function Transcript({
  meeting,
  highlights,
  initialQuery,
  onHighlight,
  onClip,
  className,
}: {
  meeting: Meeting;
  highlights: Highlight[];
  initialQuery?: string;
  onHighlight: (entry: TranscriptEntry) => void;
  onClip: (entry: TranscriptEntry) => void;
  className?: string;
}) {
  const player = usePlayer();
  const time = usePlayerTime();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [matchCursor, setMatchCursor] = useState(0);
  const [follow, setFollow] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);

  const turns = useMemo(() => groupTurns(meeting.transcript), [meeting.transcript]);
  const active = activeIndex(meeting.transcript, time);
  const activeId = meeting.transcript[active]?.id;
  const highlightedIds = useMemo(() => new Set(highlights.map((h) => h.transcriptEntryId)), [highlights]);

  const matches = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    if (terms.length === 0) return [] as string[];
    return meeting.transcript.filter((e) => terms.every((t) => e.text.toLowerCase().includes(t))).map((e) => e.id);
  }, [query, meeting.transcript]);
  const matchSet = useMemo(() => new Set(matches), [matches]);

  const scrollTo = (id: string, behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-line="${id}"]`);
    const box = scrollRef.current;
    if (!el || !box) return;
    programmatic.current = true;
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 3, behavior });
    window.setTimeout(() => (programmatic.current = false), 600);
  };

  // Follow playback. The first jump (deep links like ?t=) is instant; smooth
  // scrolling during page load gets interrupted by layout shifts.
  const firstScroll = useRef(true);
  useEffect(() => {
    if (follow && activeId && !query) scrollTo(activeId, firstScroll.current ? "instant" : "smooth");
    firstScroll.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, follow]);

  // Jump to search matches.
  useEffect(() => {
    if (matches.length) scrollTo(matches[Math.min(matchCursor, matches.length - 1)], "smooth");
  }, [matchCursor, matches]);

  const copyLink = (entry: TranscriptEntry) => {
    const url = `${window.location.origin}/meetings/${meeting.id}?t=${entry.start}`;
    void navigator.clipboard?.writeText(url);
    toast.success("Link copied", { description: `Opens at ${formatTimestamp(entry.start)}` });
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-rule pb-2">
        <div className="flex h-8 flex-1 items-center gap-2 rounded-md border border-rule bg-paper px-2.5 focus-within:border-ink">
          <Search className="size-3.5 text-faint" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMatchCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches.length) setMatchCursor((c) => (c + (e.shiftKey ? matches.length - 1 : 1)) % matches.length);
              if (e.key === "Escape") setQuery("");
            }}
            placeholder="Search this transcript"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
            aria-label="Search this transcript"
          />
          {query ? (
            <>
              <span className="tabular shrink-0 text-[11.5px] text-muted">{matches.length ? `${Math.min(matchCursor, matches.length - 1) + 1}/${matches.length}` : "0"}</span>
              <button onClick={() => setMatchCursor((c) => (c + matches.length - 1) % Math.max(1, matches.length))} className="text-muted hover:text-ink" aria-label="Previous match">
                <ChevronUp className="size-4" />
              </button>
              <button onClick={() => setMatchCursor((c) => (c + 1) % Math.max(1, matches.length))} className="text-muted hover:text-ink" aria-label="Next match">
                <ChevronDown className="size-4" />
              </button>
              <button onClick={() => setQuery("")} className="text-muted hover:text-ink" aria-label="Clear search">
                <X className="size-3.5" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={() => {
          if (!programmatic.current && follow) setFollow(false);
        }}
        className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto pt-4 pr-2"
      >
        {turns.map((turn, ti) => (
          <div key={ti} className="mb-4">
            <div className="mb-0.5 flex items-baseline gap-2">
              <PersonName id={turn.speakerId} className="text-[13px]" />
            </div>
            {turn.entries.map(({ entry }) => (
              <Line
                key={entry.id}
                entry={entry}
                active={entry.id === activeId}
                highlighted={highlightedIds.has(entry.id)}
                query={query}
                isMatch={matchSet.has(entry.id)}
                onSeek={() => player.seek(entry.start, { play: true })}
                onHighlight={() => onHighlight(entry)}
                onClip={() => onClip(entry)}
                onCopy={() => copyLink(entry)}
              />
            ))}
          </div>
        ))}
        <div className="h-24" />
      </div>

      {!follow ? (
        <button
          onClick={() => {
            setFollow(true);
            if (activeId) scrollTo(activeId);
          }}
          className="mx-auto -mt-12 mb-3 flex h-8 items-center gap-1.5 rounded-full border border-rule-strong bg-card px-3 text-[12px] font-medium text-ink shadow-pop"
        >
          <LocateFixed className="size-3.5 text-accent" /> Follow playback
        </button>
      ) : null}
    </div>
  );
}
