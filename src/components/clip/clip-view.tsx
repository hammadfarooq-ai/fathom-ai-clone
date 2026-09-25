"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { PersonName, PeopleProvider, speakerStyle } from "@/components/people";
import { PlayerProvider, usePlayer, usePlayerTime } from "@/components/player/player-context";
import { Logo } from "@/components/shell/logo";
import { Eyebrow } from "@/components/ui/primitives";
import { formatLongDate, formatTimestamp } from "@/lib/format";
import { activeIndex, spans } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import type { Clip, Meeting } from "@/types";

function ClipPlayer({ meeting, clip }: { meeting: Meeting; clip: Clip }) {
  const player = usePlayer();
  const time = usePlayerTime();
  const length = clip.end - clip.start;
  const progress = Math.max(0, Math.min(1, (time - clip.start) / length));
  const inRange = spans(meeting).filter((s) => s.end > clip.start && s.start < clip.end);
  const lines = meeting.transcript.filter((e, i) => (meeting.transcript[i + 1]?.start ?? meeting.durationSec) > clip.start && e.start < clip.end);
  const activeId = meeting.transcript[activeIndex(meeting.transcript, time)]?.id;
  const barRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  return (
    <div>
      <div className="rounded-xl border border-rule bg-card p-4 shadow-card sm:p-6">
        <div className="flex items-center gap-4">
          <button onClick={player.toggle} className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-accent-ink hover:bg-accent-hover" aria-label={player.playing ? "Pause" : "Play clip"}>
            {player.playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-1 size-5 fill-current" />}
          </button>
          <div className="min-w-0 flex-1">
            <div
              ref={barRef}
              className="relative h-3 cursor-pointer overflow-hidden rounded-full bg-sunken"
              onClick={(e) => {
                const rect = barRef.current!.getBoundingClientRect();
                player.seek(clip.start + ((e.clientX - rect.left) / rect.width) * length);
              }}
              role="slider"
              aria-label="Clip position"
              aria-valuemin={0}
              aria-valuemax={length}
              aria-valuenow={Math.round(time - clip.start)}
            >
              {inRange.map((s) => (
                <span
                  key={s.entryId}
                  className="speaker-bg absolute inset-y-0 opacity-35"
                  style={{
                    ...speakerStyle(meeting.people[s.speakerId]?.color ?? "#888"),
                    left: `${(Math.max(0, s.start - clip.start) / length) * 100}%`,
                    width: `${((Math.min(clip.end, s.end) - Math.max(clip.start, s.start)) / length) * 100}%`,
                  }}
                />
              ))}
              <span className="absolute inset-y-0 left-0 bg-ink/70" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[12px] text-muted">
              <span className="tabular">{formatTimestamp(Math.max(0, time - clip.start))}</span>
              <button onClick={() => player.seek(clip.start, { play: true })} className="flex items-center gap-1 font-sans hover:text-ink">
                <RotateCcw className="size-3" /> Replay
              </button>
              <span className="tabular">{formatTimestamp(length)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Eyebrow>Transcript of this clip</Eyebrow>
        <div className="mt-3 space-y-4">
          {lines.map((e) => (
            <p
              key={e.id}
              ref={e.id === activeId ? activeRef : undefined}
              className={cn("border-l-2 pl-4 text-[15px] leading-relaxed transition-colors", e.id === activeId ? "border-accent text-ink" : "border-transparent text-ink-2")}
            >
              <span className="mb-0.5 flex items-center gap-2 text-[12.5px]">
                <PersonName id={e.speakerId} />
                <button onClick={() => player.seek(Math.max(clip.start, e.start), { play: true })} className="tabular font-mono text-[11px] text-faint hover:text-accent">
                  {formatTimestamp(e.start)}
                </button>
              </span>
              {e.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ClipView({ meeting, clip }: { meeting: Meeting; clip: Clip }) {
  return (
    <PeopleProvider people={Object.values(meeting.people)} live={false}>
      <div className="min-h-dvh">
        <header className="border-b border-rule">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
            <Logo />
            <span className="text-[12.5px] text-muted">Shared clip</span>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 pt-10 pb-20 sm:px-6">
          <Eyebrow>
            {meeting.title} · {formatLongDate(meeting.date)}
          </Eyebrow>
          <h1 className="mt-2 font-display text-[36px] leading-[1.05] tracking-tight text-ink sm:text-[48px]">{clip.title}</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            {formatTimestamp(clip.start)}–{formatTimestamp(clip.end)} of a {Math.round(meeting.durationSec / 60)}-minute {meeting.meetingType.toLowerCase()} meeting · {clip.views ?? 0}{" "}
            {clip.views === 1 ? "view" : "views"}
          </p>
          <div className="mt-8">
            <PlayerProvider duration={meeting.durationSec} src={meeting.recording.url} range={{ start: clip.start, end: clip.end }} initialTime={clip.start}>
              <ClipPlayer meeting={meeting} clip={clip} />
            </PlayerProvider>
          </div>
          <footer className="mt-16 border-t border-rule pt-5 text-[13px] text-muted">
            Shared from <Link href="/" className="font-medium text-ink hover:underline">Parley</Link>, meeting notes you can search, question, and share.
          </footer>
        </main>
      </div>
    </PeopleProvider>
  );
}
