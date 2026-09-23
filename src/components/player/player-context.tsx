"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Media player state for a meeting recording.
 *
 * When `src` is provided the player drives a real <audio> element. Without a
 * source (the capture layer is stubbed in this app) it runs a simulated clock
 * with the same API, so a real recording URL can be dropped in later without
 * touching any consuming component.
 */

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

interface PlayerControls {
  duration: number;
  playing: boolean;
  rate: number;
  volume: number;
  muted: boolean;
  simulated: boolean;
  range: { start: number; end: number };
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number, opts?: { play?: boolean }) => void;
  skip: (delta: number) => void;
  setRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

const ControlsContext = createContext<PlayerControls | null>(null);
const TimeContext = createContext(0);

const TICK_MS = 200;

export function PlayerProvider({
  duration,
  src,
  initialTime = 0,
  range,
  children,
}: {
  duration: number;
  src?: string;
  initialTime?: number;
  /** Restrict playback to a sub-range (used by shared clips). */
  range?: { start: number; end: number };
  children: ReactNode;
}) {
  const bounds = useMemo(() => range ?? { start: 0, end: duration }, [range, duration]);
  const clamp = useCallback((t: number) => Math.min(bounds.end, Math.max(bounds.start, t)), [bounds]);

  const [time, setTime] = useState(() => Math.min(bounds.end, Math.max(bounds.start, initialTime)));
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeRef = useRef(time);

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  // Simulated clock.
  useEffect(() => {
    if (!playing || src) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const next = timeRef.current + ((now - last) / 1000) * rate;
      last = now;
      if (next >= bounds.end) {
        setTime(bounds.end);
        setPlaying(false);
      } else {
        setTime(next);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, rate, src, bounds.end]);

  // Real media element sync.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = rate;
    el.volume = volume;
    el.muted = muted;
  }, [rate, volume, muted]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [playing]);

  const seek = useCallback(
    (t: number, opts?: { play?: boolean }) => {
      const next = clamp(t);
      setTime(next);
      timeRef.current = next;
      if (audioRef.current) audioRef.current.currentTime = next;
      if (opts?.play) setPlaying(true);
    },
    [clamp],
  );

  const play = useCallback(() => {
    if (timeRef.current >= bounds.end - 0.25) seek(bounds.start);
    setPlaying(true);
  }, [bounds, seek]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);
  const skip = useCallback((delta: number) => seek(timeRef.current + delta), [seek]);
  const setRate = useCallback((r: number) => setRateState(r), []);
  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    setMuted(v === 0);
  }, []);
  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const controls = useMemo<PlayerControls>(
    () => ({
      duration,
      playing,
      rate,
      volume,
      muted,
      simulated: !src,
      range: bounds,
      play,
      pause,
      toggle,
      seek,
      skip,
      setRate,
      setVolume,
      toggleMute,
    }),
    [duration, playing, rate, volume, muted, src, bounds, play, pause, toggle, seek, skip, setRate, setVolume, toggleMute],
  );

  return (
    <ControlsContext.Provider value={controls}>
      <TimeContext.Provider value={time}>
        {src ? (
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onEnded={() => setPlaying(false)}
            hidden
          />
        ) : null}
        {children}
      </TimeContext.Provider>
    </ControlsContext.Provider>
  );
}

export function usePlayer(): PlayerControls {
  const ctx = useContext(ControlsContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

export function usePlayerTime(): number {
  return useContext(TimeContext);
}
