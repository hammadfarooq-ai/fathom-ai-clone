"use client";

import { Gauge, Pause, Play, RotateCcw, RotateCw, Volume1, Volume2, VolumeX } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { getPerson } from "@/data/people";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Highlight, Meeting, TranscriptEntry } from "@/types";
import { PLATFORM_LABEL } from "../meeting-meta";
import { PLAYBACK_RATES, usePlayer, usePlayerTime } from "../player/player-context";
import { Avatar } from "../ui/avatar";
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "../ui/menu";

/** Index of the transcript entry being spoken at `time`. */
export function activeEntryIndex(transcript: TranscriptEntry[], time: number): number {
  let lo = 0;
  let hi = transcript.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (transcript[mid].start <= time + 0.05) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function Stage({ meeting }: { meeting: Meeting }) {
  const time = usePlayerTime();
  const { playing, toggle, simulated } = usePlayer();
  const idx = activeEntryIndex(meeting.transcript, time);
  const entry = idx >= 0 ? meeting.transcript[idx] : undefined;
  const speakerId = entry?.speakerId;
  const tiles = meeting.participants.slice(0, 6);

  return (
    <div
      className="relative aspect-video w-full cursor-pointer overflow-hidden rounded-t-2xl bg-[radial-gradient(120%_120%_at_0%_0%,#1e3a35_0%,#10201d_45%,#0b1413_100%)] select-none"
      onClick={toggle}
      role="presentation"
    >
      <div
        className={cn(
          "absolute inset-0 grid gap-2 p-3 sm:gap-3 sm:p-5",
          tiles.length <= 2 ? "grid-cols-2" : tiles.length <= 4 ? "grid-cols-2 grid-rows-2" : "grid-cols-3 grid-rows-2",
        )}
      >
        {tiles.map((id) => {
          const p = getPerson(id);
          const speaking = id === speakerId && playing;
          const isSpeaker = id === speakerId;
          return (
            <div
              key={id}
              className={cn(
                "relative flex items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] transition-all duration-300",
                isSpeaker && "bg-white/[0.07] ring-2 ring-brand-300/70",
              )}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  {speaking ? <span className="absolute -inset-1.5 animate-ping rounded-full bg-brand-300/20" /> : null}
                  <Avatar personId={id} size={tiles.length > 4 ? "lg" : "xl"} className="relative" />
                </div>
              </div>
              <span className="absolute bottom-1.5 left-2 flex max-w-[85%] items-center gap-1.5 truncate rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white/90 sm:text-[11px]">
                {speaking ? (
                  <span className="flex h-2.5 items-end gap-px" aria-hidden>
                    {[0, 1, 2].map((b) => (
                      <span key={b} className="w-[2px] animate-pulse rounded-full bg-brand-300" style={{ height: `${5 + ((b * 3) % 5)}px`, animationDelay: `${b * 120}ms` }} />
                    ))}
                  </span>
                ) : null}
                {p.name}
              </span>
            </div>
          );
        })}
      </div>

      <div className="absolute top-3 left-3 flex items-center gap-1.5 sm:top-4 sm:left-4">
        <span className="rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white/85 backdrop-blur sm:text-[11px]">
          {PLATFORM_LABEL[meeting.recording.platform]}
        </span>
        {simulated ? (
          <span className="rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white/60 backdrop-blur sm:text-[11px]" title="Capture is stubbed; playback is simulated from the transcript timeline.">
            Demo recording
          </span>
        ) : null}
      </div>

      {entry && (playing || time > 0) ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pt-10 pb-3 sm:px-8 sm:pb-5">
          <p className="mx-auto line-clamp-2 max-w-2xl text-center text-[12px] leading-snug text-white/95 sm:text-[14px]">
            <span className="font-semibold text-brand-200">{getPerson(entry.speakerId).name.split(" ")[0]}: </span>
            {entry.text}
          </p>
        </div>
      ) : null}

      {!playing ? (
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid size-14 place-items-center rounded-full bg-white/90 text-ink shadow-pop transition-transform hover:scale-105 sm:size-16">
            <Play className="ml-1 size-6 fill-current" />
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Timeline({ meeting, highlights }: { meeting: Meeting; highlights: Highlight[] }) {
  const time = usePlayerTime();
  const { duration, seek } = usePlayer();
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const pct = (t: number) => `${(t / duration) * 100}%`;

  const timeAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration;
  };

  const topicAt = (t: number) => {
    let title = meeting.topics[0]?.title;
    for (const tp of meeting.topics) if (tp.start <= t) title = tp.title;
    return title;
  };

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 30 : 5;
    if (e.key === "ArrowRight") seek(time + step);
    else if (e.key === "ArrowLeft") seek(time - step);
    else if (e.key === "Home") seek(0);
    else if (e.key === "End") seek(duration);
    else return;
    e.preventDefault();
  };

  return (
    <div className="relative px-4 pt-4 sm:px-5">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${formatTimestamp(time)} of ${formatTimestamp(duration)}`}
        onKeyDown={onKey}
        onPointerDown={(e: PointerEvent) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          seek(timeAt(e.clientX));
        }}
        onPointerMove={(e) => {
          const t = timeAt(e.clientX);
          setHover(t);
          if (dragging) seek(t);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setHover(null)}
        className="group relative flex h-5 cursor-pointer touch-none items-center"
      >
        {/* Topic segments */}
        <div className="absolute inset-x-0 flex h-1.5 gap-[2px] overflow-hidden rounded-full group-hover:h-2">
          {meeting.topics.map((tp, i) => {
            const end = meeting.topics[i + 1]?.start ?? duration;
            return <span key={tp.start} className="h-full bg-line-strong/70" style={{ width: pct(end - tp.start) }} />;
          })}
        </div>
        <div className="pointer-events-none absolute left-0 h-1.5 rounded-full bg-brand-600 group-hover:h-2" style={{ width: pct(time) }} />
        {hover !== null ? (
          <div className="pointer-events-none absolute h-1.5 rounded-full bg-ink/10 group-hover:h-2" style={{ width: pct(hover) }} />
        ) : null}
        <span
          className="pointer-events-none absolute size-3.5 -translate-x-1/2 rounded-full border-2 border-white bg-brand-600 shadow"
          style={{ left: pct(time) }}
        />
        {hover !== null ? (
          <div
            className="pointer-events-none absolute bottom-6 z-10 -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-center text-[11px] whitespace-nowrap text-white shadow-pop"
            style={{ left: `clamp(48px, ${pct(hover)}, calc(100% - 48px))` }}
          >
            <span className="font-semibold tabular">{formatTimestamp(hover)}</span>
            <span className="text-white/60"> · {topicAt(hover)}</span>
          </div>
        ) : null}
      </div>
      {/* Highlight markers */}
      <div className="relative h-3">
        {highlights.map((h) => (
          <button
            key={h.id}
            onClick={() => seek(h.start, { play: true })}
            title={`${formatTimestamp(h.start)} · ${h.title}`}
            aria-label={`Jump to highlight: ${h.title} at ${formatTimestamp(h.start)}`}
            className="absolute top-0 h-2.5 w-1.5 -translate-x-1/2 cursor-pointer rounded-sm bg-mark-400 transition-transform hover:scale-y-150"
            style={{ left: pct(h.start) }}
          />
        ))}
      </div>
    </div>
  );
}

export function PlayerControls() {
  const time = usePlayerTime();
  const { duration, playing, toggle, skip, rate, setRate, volume, setVolume, muted, toggleMute } = usePlayer();
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-1 px-2.5 pt-1 pb-3 sm:gap-1.5 sm:px-3.5">
      <button
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="grid size-9 cursor-pointer place-items-center rounded-full bg-ink text-white transition-colors hover:bg-ink-2"
      >
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
      </button>
      <button onClick={() => skip(-10)} aria-label="Back 10 seconds" className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-subtle">
        <RotateCcw className="size-4" />
      </button>
      <button onClick={() => skip(10)} aria-label="Forward 10 seconds" className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-subtle">
        <RotateCw className="size-4" />
      </button>
      <span className="ml-1 text-[12.5px] text-muted tabular" aria-live="off">
        <span className="font-medium text-ink">{formatTimestamp(time)}</span> / {formatTimestamp(duration)}
      </span>

      <div className="ml-auto flex items-center gap-1">
        <div className="group flex items-center">
          <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-subtle">
            <VolumeIcon className="size-4" />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
            className="hidden h-1 w-20 cursor-pointer accent-brand-600 sm:block"
          />
        </div>
        <Menu>
          <MenuTrigger asChild>
            <button aria-label={`Playback speed ${rate}x`} className="flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium text-ink-2 tabular hover:bg-subtle">
              <Gauge className="size-4 text-muted" />
              {rate}×
            </button>
          </MenuTrigger>
          <MenuContent className="min-w-36">
            <MenuLabel>Playback speed</MenuLabel>
            <MenuRadioGroup value={String(rate)} onValueChange={(v) => setRate(Number(v))}>
              {PLAYBACK_RATES.map((r) => (
                <MenuRadioItem key={r} value={String(r)}>
                  {r === 1 ? "Normal" : `${r}×`}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuContent>
        </Menu>
      </div>
    </div>
  );
}

export function MeetingPlayer({ meeting, highlights }: { meeting: Meeting; highlights: Highlight[] }) {
  const sorted = useMemo(() => [...highlights].sort((a, b) => a.start - b.start), [highlights]);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <Stage meeting={meeting} />
      <Timeline meeting={meeting} highlights={sorted} />
      <PlayerControls />
    </div>
  );
}
