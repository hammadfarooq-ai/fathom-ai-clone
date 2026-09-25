"use client";

import { ChevronDown, ChevronUp, Highlighter, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { PLAYBACK_RATES, usePlayer, usePlayerTime } from "@/components/player/player-context";
import { speakerStyle, useDirectory } from "@/components/people";
import { formatTimestamp } from "@/lib/format";
import { unknownPerson } from "@/lib/people";
import { currentTopic, lanes as buildLanes, type Span } from "@/lib/timeline";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import type { Highlight, Meeting } from "@/types";

/**
 * The docked player. Above the controls, every participant gets a lane that
 * shows exactly when they spoke, so on a long call with many people you can see
 * the shape of the conversation and jump to anyone's turn. Chapters and saved
 * highlights sit on the top rail; the playhead runs through all lanes.
 */

function Track({ duration, onSeek, children, className, label }: { duration: number; onSeek: (t: number) => void; children: React.ReactNode; className?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const seekFrom = (e: PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration);
  };
  return (
    <div
      ref={ref}
      className={cn("relative cursor-pointer touch-none", className)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFrom(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) seekFrom(e);
      }}
      aria-label={label}
    >
      {children}
    </div>
  );
}

function Playhead({ duration }: { duration: number }) {
  const time = usePlayerTime();
  return <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-accent" style={{ left: `${(time / duration) * 100}%` }} aria-hidden />;
}

function Clock({ duration }: { duration: number }) {
  const time = usePlayerTime();
  return (
    <span className="tabular font-mono text-[12.5px] text-ink-2">
      {formatTimestamp(time)} <span className="text-faint">/ {formatTimestamp(duration)}</span>
    </span>
  );
}

/** Speaker name; clicking jumps to their next turn after the playhead. */
function LaneLabel({ name, color, spans, share }: { name: string; color: string; spans: Span[]; share: number }) {
  const player = usePlayer();
  const time = usePlayerTime();
  return (
    <button
      className="speaker-color flex min-w-0 items-center gap-1.5 py-[3px] text-left text-[11.5px] font-medium hover:underline"
      style={speakerStyle(color)}
      onClick={() => {
        const next = spans.find((s) => s.start > time + 0.5) ?? spans[0];
        if (next) player.seek(next.start, { play: true });
      }}
      title={`${name} spoke ${Math.round(share * 100)}% of the time. Click for their next turn.`}
    >
      <span className="truncate">{name.split(" ")[0]}</span>
      <span className="tabular ml-auto text-[10.5px] font-normal text-faint">{Math.round(share * 100)}%</span>
    </button>
  );
}

function Chapter({ meeting }: { meeting: Meeting }) {
  const time = usePlayerTime();
  const topic = currentTopic(meeting, time);
  return topic ? <span className="truncate text-[12.5px] text-muted">{topic.title}</span> : null;
}

export function TapeDeck({ meeting, highlights, onHighlightNow }: { meeting: Meeting; highlights: Highlight[]; onHighlightNow: () => void }) {
  const player = usePlayer();
  const dir = useDirectory();
  const duration = meeting.durationSec;
  const lanes = useMemo(() => buildLanes(meeting), [meeting]);
  // Many-speaker calls start compact on small screens; lanes are one tap away.
  // Until the viewer chooses, CSS decides (roomy screens show lanes), so the
  // server-rendered HTML is already right and nothing jumps on hydration.
  const roomy = useMediaQuery("(min-width: 768px) and (min-height: 820px)");
  const [choice, setExpanded] = useState<boolean | null>(null);
  const few = lanes.length <= 3;
  const expanded = few || (choice ?? roomy);
  const lanesClass = few || choice === true ? "grid" : choice === false ? "hidden" : "hidden roomy:grid";
  const ribbonClass = few || choice === true ? "hidden" : choice === false ? "block" : "block roomy:hidden";
  const seek = (t: number) => player.seek(t);

  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-rule-strong bg-card/97 shadow-pop backdrop-blur-md">
      <div className="mx-auto max-w-[1320px] px-3 sm:px-6">
        {/* Rails */}
        <div className={cn("grid-cols-[72px_1fr] gap-x-3 pt-2.5 sm:grid-cols-[112px_1fr]", lanesClass)}>
          <span className="eyebrow self-center text-[9.5px]">Chapters</span>
          <Track duration={duration} onSeek={seek} className="h-5" label="Chapters and highlights">
            {meeting.topics.map((t, i) => {
              const end = meeting.topics[i + 1]?.start ?? duration;
              return (
                <button
                  key={`${t.start}-${i}`}
                  title={`${formatTimestamp(t.start)} · ${t.title}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    player.seek(t.start);
                  }}
                  className="absolute inset-y-1 border-l border-rule-strong bg-sunken/70 px-1 text-left text-[10px] leading-3 text-muted hover:bg-sunken hover:text-ink"
                  style={{ left: `${(t.start / duration) * 100}%`, width: `${((end - t.start) / duration) * 100}%` }}
                >
                  <span className="block truncate">{t.title}</span>
                </button>
              );
            })}
            {highlights.map((h) => (
              <span
                key={h.id}
                title={`Highlight · ${h.title}`}
                className="pointer-events-none absolute -top-0.5 z-[5] size-2.5 -translate-x-1/2 rotate-45 border border-card bg-mark"
                style={{ left: `${(h.start / duration) * 100}%` }}
              />
            ))}
            <Playhead duration={duration} />
          </Track>

          {lanes.map((lane) => {
                const person = dir.get(lane.speakerId) ?? unknownPerson(lane.speakerId);
                return (
                  <div key={lane.speakerId} className="contents">
                    <LaneLabel name={person.name} color={person.color} spans={lane.spans} share={lane.share} />
                    <Track duration={duration} onSeek={seek} className="my-[3px] h-2.5 rounded-sm bg-sunken/80" label={`${person.name}'s speaking turns`}>
                      {lane.spans.map((s) => (
                        <span
                          key={s.entryId}
                          className="speaker-bg absolute inset-y-0 rounded-[1px]"
                          style={{ ...speakerStyle(person.color), left: `${(s.start / duration) * 100}%`, width: `max(2px, ${((s.end - s.start) / duration) * 100}%)` }}
                        />
                      ))}
                      <Playhead duration={duration} />
                    </Track>
                  </div>
                );
              })}
        </div>

        {/* Collapsed ribbon: everyone on one bar */}
        {!few ? (
          <Track duration={duration} onSeek={seek} className={cn("mt-2.5 h-2 overflow-hidden rounded-full bg-sunken", ribbonClass)} label="Timeline">
            {lanes.flatMap((lane) =>
              lane.spans.map((s) => (
                <span
                  key={s.entryId}
                  className="speaker-bg absolute inset-y-0"
                  style={{ ...speakerStyle((dir.get(lane.speakerId) ?? unknownPerson(lane.speakerId)).color), left: `${(s.start / duration) * 100}%`, width: `${((s.end - s.start) / duration) * 100}%` }}
                />
              )),
            )}
            <Playhead duration={duration} />
          </Track>
        ) : null}

        {/* Controls */}
        <div className="flex h-14 items-center gap-1.5 sm:gap-3">
          <button onClick={() => player.skip(-10)} className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-sunken" aria-label="Back 10 seconds">
            <RotateCcw className="size-4" />
          </button>
          <button onClick={player.toggle} className="grid size-10 place-items-center rounded-full bg-ink text-paper hover:bg-ink-2" aria-label={player.playing ? "Pause" : "Play"}>
            {player.playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
          </button>
          <button onClick={() => player.skip(10)} className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-sunken" aria-label="Forward 10 seconds">
            <RotateCw className="size-4" />
          </button>
          <Clock duration={duration} />
          <span className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
            <span className="text-faint">·</span>
            <Chapter meeting={meeting} />
          </span>
          <span className="flex-1 md:hidden" />
          {player.simulated ? (
            <span className="hidden text-[11px] text-faint xl:inline" title="Capture is stubbed in this demo, so playback follows the transcript clock.">
              Transcript playback
            </span>
          ) : null}
          <button onClick={onHighlightNow} className="hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-mark-soft hover:text-ink sm:flex" title="Highlight this moment (H)">
            <Highlighter className="size-4" /> Highlight
          </button>
          <button
            onClick={() => {
              const i = PLAYBACK_RATES.indexOf(player.rate as (typeof PLAYBACK_RATES)[number]);
              player.setRate(PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length]);
            }}
            className="tabular h-8 w-12 rounded-md font-mono text-[12px] text-ink-2 hover:bg-sunken"
            aria-label={`Playback speed ${player.rate}x`}
          >
            {player.rate}×
          </button>
          <button onClick={player.toggleMute} className="hidden size-9 place-items-center rounded-md text-ink-2 hover:bg-sunken sm:grid" aria-label={player.muted ? "Unmute" : "Mute"}>
            {player.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-8 items-center gap-1 rounded-md px-2 text-[12px] text-muted hover:bg-sunken hover:text-ink"
            aria-expanded={expanded}
            aria-label={expanded ? "Hide speaker lanes" : "Show speaker lanes"}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
            <span className="hidden sm:inline">{lanes.length} speakers</span>
          </button>
        </div>
      </div>
    </div>
  );
}
