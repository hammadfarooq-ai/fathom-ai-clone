"use client";

import { ChevronDown, ChevronUp, Highlighter, Link2, LocateFixed, Scissors, Search, X } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getPerson } from "@/data/people";
import { formatTimestamp } from "@/lib/format";
import { highlightTerms, stem, words } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { TranscriptEntry } from "@/types";
import { usePlayer, usePlayerTime } from "../player/player-context";
import { Avatar } from "../ui/avatar";
import { HighlightText } from "../ui/highlight-text";
import { useMeeting } from "./meeting-context";
import { activeEntryIndex } from "./player";

function matchesQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (text.toLowerCase().includes(q)) return true;
  const stems = new Set(words(text).map(stem));
  const qWords = words(q);
  return qWords.length > 0 && qWords.every((w) => stems.has(stem(w)));
}

interface RowProps {
  entry: TranscriptEntry;
  active: boolean;
  highlighted: boolean;
  focused: boolean;
  flash: boolean;
  terms: string[];
  showSpeaker: boolean;
  onSeek: (entry: TranscriptEntry) => void;
  onHighlight: (entry: TranscriptEntry) => void;
  onClip: (entry: TranscriptEntry) => void;
  onCopyLink: (entry: TranscriptEntry) => void;
}

const TranscriptRow = memo(function TranscriptRow({
  entry,
  active,
  highlighted,
  focused,
  flash,
  terms,
  showSpeaker,
  onSeek,
  onHighlight,
  onClip,
  onCopyLink,
}: RowProps) {
  const person = getPerson(entry.speakerId);
  return (
    <li
      data-entry-id={entry.id}
      className={cn(
        "group relative rounded-xl border-l-2 border-transparent py-2 pr-2 pl-3 transition-colors",
        showSpeaker ? "mt-2" : "mt-0",
        highlighted && "border-mark-400 bg-mark-50/70",
        active && !highlighted && "border-brand-500 bg-brand-50/70",
        active && highlighted && "bg-mark-100/60",
        !active && !highlighted && "hover:bg-subtle/80",
        focused && "ring-2 ring-mark-200",
        flash && "animate-flash",
      )}
    >
      {showSpeaker ? (
        <div className="mb-1 flex items-center gap-2">
          <Avatar personId={person.id} size="xs" />
          <span className="text-[12.5px] font-semibold text-ink">{person.name}</span>
          {person.external ? <span className="text-[11px] text-faint">{person.company}</span> : null}
        </div>
      ) : null}
      <div className="flex gap-3">
        <button
          onClick={() => onSeek(entry)}
          className={cn(
            "h-fit shrink-0 cursor-pointer rounded-md px-1 py-0.5 font-mono text-[11px] tabular transition-colors",
            active ? "bg-brand-600 text-white" : "text-brand-700 hover:bg-brand-100",
          )}
          aria-label={`Play from ${formatTimestamp(entry.start)}`}
        >
          {formatTimestamp(entry.start)}
        </button>
        <p className={cn("min-w-0 flex-1 text-[13.5px] leading-relaxed", active ? "text-ink" : "text-ink-2")}>
          <HighlightText text={entry.text} terms={terms} />
        </p>
      </div>
      <div
        className={cn(
          "absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 opacity-0 shadow-card transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
          highlighted && "opacity-100",
          // On touch-sized screens, show actions inline for the current or highlighted line only.
          "max-md:static max-md:mt-1.5 max-md:w-fit max-md:shadow-none",
          active || highlighted ? "max-md:opacity-100" : "max-md:hidden",
        )}
      >
        <button
          onClick={() => onHighlight(entry)}
          aria-pressed={highlighted}
          aria-label={highlighted ? "Remove highlight" : "Highlight this moment"}
          title={highlighted ? "Remove highlight" : "Highlight"}
          className={cn(
            "flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-colors",
            highlighted ? "bg-mark-100 text-mark-700" : "text-muted hover:bg-subtle hover:text-ink",
          )}
        >
          <Highlighter className="size-3.5" />
          <span>{highlighted ? "Highlighted" : "Highlight"}</span>
        </button>
        <button
          onClick={() => onClip(entry)}
          aria-label="Create clip from here"
          title="Create clip"
          className="grid size-7 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          <Scissors className="size-3.5" />
        </button>
        <button
          onClick={() => onCopyLink(entry)}
          aria-label="Copy link to this moment"
          title="Copy link to timestamp"
          className="grid size-7 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          <Link2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
});

export function TranscriptPanel({
  initialQuery = "",
  focusEntryId,
  className,
}: {
  initialQuery?: string;
  focusEntryId?: string;
  className?: string;
}) {
  const { meeting, highlights, openClip, toggleHighlight } = useMeeting();
  const time = usePlayerTime();
  const { seek, playing } = usePlayer();
  const [query, setQuery] = useState(initialQuery);
  const [matchCursor, setMatchCursor] = useState(0);
  const [follow, setFollow] = useState(true);
  const listRef = useRef<HTMLOListElement>(null);
  const programmaticScroll = useRef(false);

  const transcript = meeting.transcript;
  const activeIdx = activeEntryIndex(transcript, time);
  const activeId = activeIdx >= 0 ? transcript[activeIdx].id : undefined;
  const highlightedIds = useMemo(() => new Set(highlights.map((h) => h.transcriptEntryId)), [highlights]);
  const terms = useMemo(() => highlightTerms(query), [query]);
  const matches = useMemo(() => (query.trim().length > 1 ? transcript.filter((e) => matchesQuery(e.text, query)).map((e) => e.id) : []), [query, transcript]);
  const cursor = matches.length ? Math.min(matchCursor, matches.length - 1) : 0;
  const focusedMatch = matches[cursor];

  const scrollToEntry = (id: string | undefined, behavior: ScrollBehavior = "smooth") => {
    const list = listRef.current;
    if (!list || !id) return;
    const el = list.querySelector<HTMLElement>(`[data-entry-id="${id}"]`);
    if (!el) return;
    programmaticScroll.current = true;
    list.scrollTo({ top: el.offsetTop - list.clientHeight / 3, behavior });
    window.setTimeout(() => (programmaticScroll.current = false), 600);
  };

  // Follow playback.
  useEffect(() => {
    if (follow && playing) scrollToEntry(activeId);
  }, [activeId, follow, playing]);

  // Jump to the moment the page was opened with (?t=) or a search match.
  useEffect(() => {
    if (focusEntryId) scrollToEntry(focusEntryId, "auto");
  }, [focusEntryId]);

  useEffect(() => {
    if (focusedMatch) scrollToEntry(focusedMatch);
  }, [focusedMatch]);

  const onSeek = (entry: TranscriptEntry) => {
    seek(entry.start, { play: true });
    setFollow(true);
  };
  const onClip = (entry: TranscriptEntry) => {
    const i = transcript.indexOf(entry);
    const end = transcript[Math.min(transcript.length - 1, i + 2)]?.start ?? meeting.durationSec;
    openClip({ start: entry.start, end: end > entry.start ? end : meeting.durationSec });
  };
  const onCopyLink = async (entry: TranscriptEntry) => {
    const url = `${window.location.origin}/meetings/${meeting.id}?t=${entry.start}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: `Opens ${meeting.title} at ${formatTimestamp(entry.start)}` });
    } catch {
      toast.error("Couldn't access the clipboard", { description: url });
    }
  };
  const onHighlight = (entry: TranscriptEntry) => toggleHighlight(entry.id);

  const stepMatch = (delta: number) => {
    if (!matches.length) return;
    setMatchCursor((c) => (c + delta + matches.length) % matches.length);
  };

  return (
    <section aria-label="Transcript" className={cn("flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card", className)}>
      <div className="border-b border-line px-4 pt-3.5 pb-3">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-ink">
            Transcript <span className="font-normal text-faint">· {transcript.length} segments</span>
          </h2>
          {!follow || !playing ? (
            <button
              onClick={() => {
                setFollow(true);
                scrollToEntry(activeId);
              }}
              className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              <LocateFixed className="size-3.5" /> Current moment
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="size-1.5 animate-pulse rounded-full bg-brand-500" /> Following playback
            </span>
          )}
        </div>
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-faint" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMatchCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") stepMatch(e.shiftKey ? -1 : 1);
              if (e.key === "Escape") setQuery("");
            }}
            placeholder="Search transcript"
            aria-label="Search transcript"
            className="h-8 w-full rounded-lg border border-line bg-subtle/60 pr-28 pl-8 text-[13px] outline-none placeholder:text-faint focus:border-brand-400 focus:bg-surface focus:ring-3 focus:ring-brand-100"
          />
          {query ? (
            <div className="absolute right-1 flex items-center gap-0.5">
              <span className="px-1 text-[11px] text-muted tabular" aria-live="polite">
                {matches.length ? `${cursor + 1}/${matches.length}` : "0 results"}
              </span>
              <button onClick={() => stepMatch(-1)} aria-label="Previous match" className="grid size-6 cursor-pointer place-items-center rounded text-muted hover:bg-line/60">
                <ChevronUp className="size-3.5" />
              </button>
              <button onClick={() => stepMatch(1)} aria-label="Next match" className="grid size-6 cursor-pointer place-items-center rounded text-muted hover:bg-line/60">
                <ChevronDown className="size-3.5" />
              </button>
              <button onClick={() => setQuery("")} aria-label="Clear search" className="grid size-6 cursor-pointer place-items-center rounded text-muted hover:bg-line/60">
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <ol
        ref={listRef}
        onWheel={() => !programmaticScroll.current && playing && setFollow(false)}
        onTouchMove={() => !programmaticScroll.current && playing && setFollow(false)}
        className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-6"
      >
        {transcript.map((entry, i) => (
          <TranscriptRow
            key={entry.id}
            entry={entry}
            active={entry.id === activeId && time > 0}
            highlighted={highlightedIds.has(entry.id)}
            focused={entry.id === focusedMatch}
            flash={entry.id === focusEntryId}
            terms={matches.includes(entry.id) ? terms : []}
            showSpeaker={i === 0 || transcript[i - 1].speakerId !== entry.speakerId}
            onSeek={onSeek}
            onHighlight={onHighlight}
            onClip={onClip}
            onCopyLink={onCopyLink}
          />
        ))}
      </ol>
    </section>
  );
}
