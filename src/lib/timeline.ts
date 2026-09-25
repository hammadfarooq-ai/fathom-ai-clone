import type { Meeting, TranscriptEntry } from "@/types";

/** A stretch of the recording where one person is speaking. */
export interface Span {
  entryId: string;
  speakerId: string;
  start: number;
  end: number;
}

/** Each transcript line lasts until the next one starts. */
export function spans(meeting: Pick<Meeting, "transcript" | "durationSec">): Span[] {
  return meeting.transcript.map((e, i) => ({
    entryId: e.id,
    speakerId: e.speakerId,
    start: e.start,
    end: meeting.transcript[i + 1]?.start ?? meeting.durationSec,
  }));
}

/** Speakers ordered by total talk time, with their spans and share. */
export function lanes(meeting: Pick<Meeting, "transcript" | "durationSec" | "participants">) {
  const all = spans(meeting);
  const total = all.reduce((a, s) => a + (s.end - s.start), 0) || 1;
  const bySpeaker = new Map<string, Span[]>();
  for (const s of all) bySpeaker.set(s.speakerId, [...(bySpeaker.get(s.speakerId) ?? []), s]);
  // Participants who never spoke still get an (empty) lane.
  for (const p of meeting.participants) if (!bySpeaker.has(p)) bySpeaker.set(p, []);
  return [...bySpeaker.entries()]
    .map(([speakerId, list]) => ({ speakerId, spans: list, share: list.reduce((a, s) => a + (s.end - s.start), 0) / total }))
    .sort((a, b) => b.share - a.share);
}

/** Index of the line being spoken at `time` (binary search). */
export function activeIndex(transcript: TranscriptEntry[], time: number): number {
  let lo = 0;
  let hi = transcript.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (transcript[mid].start <= time + 0.05) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

export function currentTopic(meeting: Pick<Meeting, "topics">, time: number) {
  let current = meeting.topics[0];
  for (const t of meeting.topics) if (t.start <= time) current = t;
  return current;
}

/** Parse "mm:ss" / "h:mm:ss" (or plain seconds) into seconds; NaN if invalid. */
export function parseClock(value: string): number {
  const parts = value.trim().split(":");
  if (parts.some((p) => !/^\d+$/.test(p)) || parts.length > 3) return NaN;
  return parts.map(Number).reduce((acc, n) => acc * 60 + n, 0);
}
