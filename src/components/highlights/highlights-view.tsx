"use client";

import { Copy, ExternalLink, Highlighter, Play, Scissors, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { seededClips } from "@/data";
import { getPerson } from "@/data/people";
import { clipTranscript } from "@/lib/clips";
import { formatDay, formatDuration, formatTimestamp } from "@/lib/format";
import { deleteClip, removeHighlight, restoreHighlight, useClips, useHighlights, useMeetings } from "@/lib/store";
import { cn, truncate } from "@/lib/utils";
import { useProcessingIds } from "@/lib/workspace-hooks";
import { Avatar } from "../ui/avatar";
import { Button, buttonClass } from "../ui/button";
import { Badge, Card, EmptyState, Input } from "../ui/primitives";

type Tab = "highlights" | "clips";

function ClipsList() {
  const clips = useClips();
  const meetings = useMeetings();
  const byId = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings]);
  const seededIds = new Set(seededClips.map((c) => c.id));

  if (clips.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Scissors />} title="No clips yet" description="Open a meeting and use Clip to share a specific moment." />
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {clips.map((clip) => {
        const m = byId.get(clip.meetingId);
        if (!m) return null;
        const lines = clipTranscript(m, clip.start, clip.end);
        const copy = async () => {
          try {
            await navigator.clipboard.writeText(`${window.location.origin}/clips/${clip.id}`);
            toast.success("Clip link copied");
          } catch {
            toast.error("Couldn't access the clipboard");
          }
        };
        return (
          <Card key={clip.id} className="flex flex-col p-4">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Badge tone="brand" className="tabular">
                {formatTimestamp(clip.start)} – {formatTimestamp(clip.end)}
              </Badge>
              <span>{formatDuration(clip.end - clip.start)}</span>
            </div>
            <p className="mt-2 text-[14px] font-semibold text-ink">{clip.title}</p>
            <p className="text-xs text-muted">{m.title}</p>
            {lines[0] ? (
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-ink-2">
                <span className="font-medium text-ink">{getPerson(lines[0].speakerId).name.split(" ")[0]}:</span> “{truncate(lines[0].text, 140)}”
              </p>
            ) : null}
            <div className="mt-3 flex items-center gap-1 border-t border-line pt-3">
              <Link href={`/clips/${clip.id}`} target="_blank" className={buttonClass("ghost", "xs")}>
                <ExternalLink /> Open
              </Link>
              <Button size="xs" variant="ghost" onClick={copy}>
                <Copy /> Copy link
              </Button>
              {!seededIds.has(clip.id) ? (
                <Button
                  size="xs"
                  variant="ghost"
                  className="ml-auto"
                  aria-label={`Delete clip ${clip.title}`}
                  onClick={() => {
                    deleteClip(clip.id);
                    toast("Clip removed from your library", { description: "Existing links keep working." });
                  }}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function HighlightsView() {
  const meetings = useMeetings();
  const processing = useProcessingIds();
  const ready = useMemo(() => meetings.filter((m) => !processing.has(m.id)), [meetings, processing]);
  const highlights = useHighlights(ready);
  const [tab, setTab] = useState<Tab>("highlights");
  const [meetingFilter, setMeetingFilter] = useState("all");
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings]);
  const clips = useClips();

  const withMeetings = [...new Set(highlights.map((h) => h.meetingId))];
  const filtered = highlights.filter((h) => {
    if (meetingFilter !== "all" && h.meetingId !== meetingFilter) return false;
    if (!query.trim()) return true;
    const m = byId.get(h.meetingId);
    const entry = m?.transcript.find((e) => e.id === h.transcriptEntryId);
    return `${h.title} ${h.description} ${entry?.text ?? ""} ${m?.title ?? ""}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Highlights</h1>
        <p className="mt-1 text-sm text-muted">The moments worth remembering, from every meeting.</p>
      </div>

      <div role="tablist" aria-label="Library" className="flex gap-4 border-b border-line">
        {(
          [
            ["highlights", "Highlights", highlights.length],
            ["clips", "Shared clips", clips.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "relative -mb-px cursor-pointer border-b-2 pb-2.5 text-[13.5px] font-medium transition-colors",
              tab === id ? "border-brand-600 text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {label} <span className="ml-1 rounded-full bg-subtle px-1.5 text-[11px] text-muted tabular">{count}</span>
          </button>
        ))}
      </div>

      {tab === "clips" ? (
        <ClipsList />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search highlights" aria-label="Search highlights" className="pl-9" />
            </div>
            <select
              value={meetingFilter}
              onChange={(e) => setMeetingFilter(e.target.value)}
              aria-label="Filter by meeting"
              className="h-9 cursor-pointer rounded-lg border border-line bg-surface px-3 text-sm text-ink shadow-card outline-none hover:border-line-strong focus:border-brand-400 focus:ring-3 focus:ring-brand-100 sm:w-72"
            >
              <option value="all">All meetings ({withMeetings.length})</option>
              {withMeetings.map((id) => (
                <option key={id} value={id}>
                  {byId.get(id)?.title}
                </option>
              ))}
            </select>
          </div>

          {highlights.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Highlighter />}
                title="No highlights yet"
                description="Open any meeting, hover a line in the transcript, and click Highlight. It will show up here."
                action={
                  <Link href="/meetings" className={buttonClass("primary")}>
                    Browse meetings
                  </Link>
                }
              />
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState icon={<Search />} title="No matching highlights" description="Try a different keyword or meeting." />
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((h) => {
                const m = byId.get(h.meetingId);
                const entry = m?.transcript.find((e) => e.id === h.transcriptEntryId);
                return (
                  <Card key={h.id} className="flex flex-col p-4 transition-shadow hover:shadow-pop">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/meetings/${h.meetingId}`} className="min-w-0 truncate text-xs font-medium text-muted hover:text-ink hover:underline">
                        {m?.title}
                      </Link>
                      <span className="shrink-0 text-xs text-faint">{m ? formatDay(m.date) : ""}</span>
                    </div>
                    <div className="mt-2.5 flex items-start gap-2.5">
                      <Badge tone="mark" className="mt-0.5 font-mono tabular">
                        {formatTimestamp(h.start)}
                      </Badge>
                      <p className="text-[14px] font-semibold text-ink">{h.title}</p>
                    </div>
                    {entry ? (
                      <p className="mt-2 flex-1 border-l-2 border-mark-200 pl-3 text-[13px] leading-relaxed text-ink-2">
                        <span className="font-medium text-ink">{getPerson(entry.speakerId).name}:</span> “{truncate(entry.text, 200)}”
                      </p>
                    ) : null}
                    <div className="mt-3 flex items-center gap-1 border-t border-line pt-3">
                      <span className="mr-auto flex items-center gap-1.5 text-xs text-muted">
                        <Avatar personId={h.createdBy} size="xs" />
                        {getPerson(h.createdBy).name.split(" ")[0]}
                      </span>
                      <Link href={`/meetings/${h.meetingId}?t=${h.start}`} className={buttonClass("secondary", "xs")}>
                        <Play /> Open meeting
                      </Link>
                      <Button
                        size="xs"
                        variant="ghost"
                        aria-label={`Remove highlight ${h.title}`}
                        onClick={() => {
                          removeHighlight(h.id);
                          toast("Highlight removed", { action: { label: "Undo", onClick: () => restoreHighlight(h) } });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
