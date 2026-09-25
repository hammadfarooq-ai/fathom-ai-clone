"use client";

import { Check, Copy, Eye, Highlighter, Play, Scissors, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, PersonName, speakerStyle, usePerson } from "@/components/people";
import { Button, Empty, Eyebrow, Segmented } from "@/components/ui/primitives";
import { addHighlight, createClip, deleteClip, removeHighlight, useClips, useHighlights } from "@/lib/api";
import { formatRelativeDay, formatShortDate, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Clip, HighlightWithContext } from "@/types";

function QuoteCard({ h }: { h: HighlightWithContext }) {
  const speaker = usePerson(h.speakerId);
  const [shared, setShared] = useState<string | null>(null);
  return (
    <article className="group relative flex break-inside-avoid flex-col rounded-lg border border-rule bg-card p-5 shadow-card" style={speakerStyle(speaker.color)}>
      <span className="speaker-bg absolute inset-y-5 left-0 w-[3px] rounded-r" aria-hidden />
      <p className="font-display text-[22px] leading-[1.25] text-ink">
        <span className="marker">“{h.quote}”</span>
      </p>
      <div className="mt-4 flex items-center gap-2 text-[12.5px]">
        <Avatar personId={h.speakerId} size="xs" />
        <PersonName id={h.speakerId} />
        <span className="text-faint">·</span>
        <span className="tabular font-mono text-[11.5px] text-muted">{formatTimestamp(h.start)}</span>
      </div>
      <Link href={`/meetings/${h.meetingId}?t=${h.start}`} className="mt-1 truncate text-[12.5px] text-muted hover:text-ink hover:underline">
        {h.meetingTitle} · {formatShortDate(h.meetingDate)}
      </Link>
      <div className="mt-4 flex items-center gap-1 border-t border-rule pt-3">
        <Button asChild size="sm" variant="ghost">
          <Link href={`/meetings/${h.meetingId}?t=${h.start}`}>
            <Play /> Play
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            try {
              const clip = await createClip({ meetingId: h.meetingId, start: h.start, end: Math.max(h.end, h.start + 10), title: h.title });
              const url = `${window.location.origin}/c/${clip.id}`;
              await navigator.clipboard?.writeText(url);
              setShared(url);
              toast.success("Clip link copied", { description: "Anyone with the link can watch this moment." });
            } catch {
              toast.error("Couldn't create a clip");
            }
          }}
        >
          {shared ? <Check /> : <Scissors />} {shared ? "Link copied" : "Share clip"}
        </Button>
        <span className="flex-1" />
        <button
          onClick={async () => {
            try {
              const removed = await removeHighlight(h.meetingId, h.id);
              toast("Highlight removed", {
                action: {
                  label: "Undo",
                  onClick: () =>
                    void addHighlight(h.meetingId, {
                      id: removed.id,
                      transcriptEntryId: removed.transcriptEntryId || undefined,
                      start: removed.start,
                      end: removed.end,
                      title: removed.title,
                      description: removed.description,
                    }),
                },
              });
            } catch {
              toast.error("Couldn't remove it");
            }
          }}
          className="grid size-8 place-items-center rounded-md text-faint opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
          aria-label="Remove highlight"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </article>
  );
}

function ClipRow({ clip }: { clip: Clip }) {
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-4 sm:grid-cols-[minmax(0,1fr)_120px_90px_auto]">
      <div className="min-w-0">
        <a href={`/c/${clip.id}`} target="_blank" rel="noreferrer" className="block truncate text-[15px] font-semibold text-ink hover:underline">
          {clip.title}
        </a>
        <p className="truncate text-[12.5px] text-muted">
          {clip.meetingTitle} · {formatTimestamp(clip.start)}–{formatTimestamp(clip.end)}
        </p>
      </div>
      <span className="hidden text-[12.5px] text-muted sm:block">{clip.createdAt ? formatRelativeDay(clip.createdAt) : ""}</span>
      <span className="tabular hidden items-center gap-1.5 text-[12.5px] text-ink-2 sm:flex">
        <Eye className="size-3.5 text-faint" /> {clip.views ?? 0}
      </span>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard?.writeText(`${window.location.origin}/c/${clip.id}`);
            toast.success("Link copied");
          }}
        >
          <Copy /> Copy link
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Delete clip ${clip.title}`}
          onClick={async () => {
            if (!window.confirm("Delete this clip? Its link stops working.")) return;
            try {
              await deleteClip(clip.id);
              toast("Clip deleted");
            } catch {
              toast.error("Couldn't delete the clip");
            }
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

export function MomentsView() {
  const { data: highlights = [] } = useHighlights();
  const { data: clips = [] } = useClips();
  const [tab, setTab] = useState<"highlights" | "clips">("highlights");
  const [meeting, setMeeting] = useState("");

  const meetings = useMemo(() => {
    const map = new Map<string, string>();
    highlights.forEach((h) => map.set(h.meetingId, h.meetingTitle));
    return [...map.entries()];
  }, [highlights]);
  const shown = meeting ? highlights.filter((h) => h.meetingId === meeting) : highlights;

  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-8 sm:px-6 sm:pt-12">
      <header className="grid gap-6 border-b border-ink pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Eyebrow>Moments</Eyebrow>
          <h1 className="mt-2 font-display text-[40px] leading-[1.02] tracking-tight text-ink sm:text-[52px]">The lines worth keeping.</h1>
          <p className="mt-2 max-w-xl text-[14px] text-muted">Highlights your team saved while listening, and the clips you shared with people who weren&apos;t there.</p>
        </div>
        <Segmented
          label="Show"
          value={tab}
          onChange={setTab}
          options={[
            { value: "highlights", label: "Highlights", count: highlights.length },
            { value: "clips", label: "Shared clips", count: clips.length },
          ]}
        />
      </header>

      {tab === "highlights" ? (
        <>
          {meetings.length > 1 ? (
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-3 sm:mx-0 sm:flex-wrap sm:px-0">
              <button onClick={() => setMeeting("")} className={cn("h-7 shrink-0 rounded-full border px-3 text-[12.5px]", !meeting ? "border-ink bg-ink text-paper" : "border-rule text-ink-2 hover:border-ink")}>
                All meetings
              </button>
              {meetings.map(([id, title]) => (
                <button
                  key={id}
                  onClick={() => setMeeting(meeting === id ? "" : id)}
                  className={cn("h-7 shrink-0 rounded-full border px-3 text-[12.5px]", meeting === id ? "border-ink bg-ink text-paper" : "border-rule text-ink-2 hover:border-ink")}
                >
                  {title}
                </button>
              ))}
            </div>
          ) : null}
          {shown.length === 0 ? (
            <Empty title="No highlights yet" icon={<Highlighter />}>
              Open a meeting and press H while it plays, or hover a transcript line and choose Highlight.
            </Empty>
          ) : (
            <div className="mt-4 columns-1 gap-5 space-y-5 md:columns-2 xl:columns-3">
              {shown.map((h) => (
                <QuoteCard key={h.id} h={h} />
              ))}
            </div>
          )}
        </>
      ) : clips.length === 0 ? (
        <Empty title="No clips shared yet" icon={<Scissors />}>
          Use Clip on any meeting to share a moment with someone who wasn&apos;t on the call.
        </Empty>
      ) : (
        <ul className="mt-2 divide-y divide-rule">
          {clips.map((c) => (
            <ClipRow key={c.id} clip={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
