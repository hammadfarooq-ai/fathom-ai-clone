"use client";

import { Copy, Pause, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getPerson } from "@/data/people";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Clip, Meeting, TranscriptEntry } from "@/types";
import { activeEntryIndex, Stage } from "../meeting/player";
import { PlayerProvider, usePlayer, usePlayerTime } from "../player/player-context";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";

function ClipControls({ clip }: { clip: Clip }) {
  const time = usePlayerTime();
  const { playing, toggle, seek } = usePlayer();
  const length = clip.end - clip.start;
  const elapsed = Math.max(0, time - clip.start);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play clip"}
        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-ink text-white hover:bg-ink-2"
      >
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
      </button>
      <button onClick={() => seek(clip.start)} aria-label="Restart clip" className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-subtle">
        <RotateCcw className="size-4" />
      </button>
      <div
        className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-subtle"
        role="slider"
        tabIndex={0}
        aria-label="Seek within clip"
        aria-valuemin={0}
        aria-valuemax={Math.round(length)}
        aria-valuenow={Math.round(elapsed)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") seek(time + 5);
          if (e.key === "ArrowLeft") seek(time - 5);
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seek(clip.start + ((e.clientX - rect.left) / rect.width) * length);
        }}
      >
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${(elapsed / length) * 100}%` }} />
      </div>
      <span className="shrink-0 text-[12.5px] text-muted tabular">
        <span className="font-medium text-ink">{formatTimestamp(elapsed)}</span> / {formatTimestamp(length)}
      </span>
    </div>
  );
}

function ClipTranscript({ meeting, lines }: { meeting: Meeting; lines: TranscriptEntry[] }) {
  const time = usePlayerTime();
  const { seek } = usePlayer();
  const idx = activeEntryIndex(meeting.transcript, time);
  const activeId = meeting.transcript[idx]?.id;
  return (
    <ol className="space-y-1">
      {lines.map((e) => (
        <li key={e.id} className={cn("rounded-xl border-l-2 px-3 py-2.5 transition-colors", e.id === activeId ? "border-brand-500 bg-brand-50/70" : "border-transparent")}>
          <div className="mb-1 flex items-center gap-2">
            <Avatar personId={e.speakerId} size="xs" />
            <span className="text-[12.5px] font-semibold text-ink">{getPerson(e.speakerId).name}</span>
            <button onClick={() => seek(e.start, { play: true })} className="cursor-pointer rounded px-1 font-mono text-[11px] text-brand-700 tabular hover:bg-brand-100">
              {formatTimestamp(e.start)}
            </button>
          </div>
          <p className="text-[14px] leading-relaxed text-ink-2">{e.text}</p>
        </li>
      ))}
    </ol>
  );
}

export function ClipView({ clip, meeting, lines }: { clip: Clip; meeting: Meeting; lines: TranscriptEntry[] }) {
  const range = { start: clip.start, end: clip.end };
  return (
    <PlayerProvider duration={meeting.durationSec} src={meeting.recording.url} initialTime={clip.start} range={range}>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <Stage meeting={meeting} />
        <ClipControls clip={clip} />
      </div>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-ink">Transcript excerpt</h2>
        <Button
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              toast.success("Clip link copied");
            } catch {
              toast.error("Couldn't access the clipboard");
            }
          }}
        >
          <Copy /> Copy link
        </Button>
      </div>
      <div className="mt-3 rounded-2xl border border-line bg-surface p-2 shadow-card">
        <ClipTranscript meeting={meeting} lines={lines} />
      </div>
    </PlayerProvider>
  );
}
