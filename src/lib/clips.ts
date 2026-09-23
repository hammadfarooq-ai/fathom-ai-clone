import { baseMeetingId, findMeeting, getAllKnownMeetings, seededClips } from "@/data";
import type { Clip, Meeting } from "@/types";

/**
 * Clip ids are self-describing so a shared link works in any browser without a
 * database: `<meeting code>-<start>-<end>-<title>` (numbers in base 36, title
 * base64url-encoded). Seeded clips use short human-friendly ids instead.
 */

const codes = getAllKnownMeetings().map((m) => m.id);

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeClipId(clip: Omit<Clip, "id">): string {
  const index = codes.indexOf(baseMeetingId(clip.meetingId));
  const title = toBase64Url(clip.title.trim().slice(0, 80));
  return [index.toString(36), Math.round(clip.start).toString(36), Math.round(clip.end).toString(36), title].join("-");
}

export interface ResolvedClip {
  clip: Clip;
  meeting: Meeting;
}

export function resolveClip(id: string): ResolvedClip | null {
  const seeded = seededClips.find((c) => c.id === id);
  if (seeded) {
    const meeting = findMeeting(seeded.meetingId);
    return meeting ? { clip: seeded, meeting } : null;
  }
  try {
    const [code, start36, end36, ...titleParts] = decodeURIComponent(id).split("-");
    const meetingId = codes[parseInt(code, 36)];
    const meeting = meetingId ? findMeeting(meetingId) : undefined;
    const start = parseInt(start36, 36);
    const end = parseInt(end36, 36);
    if (!meeting || Number.isNaN(start) || Number.isNaN(end) || start < 0 || end <= start || end > meeting.durationSec) {
      return null;
    }
    const title = fromBase64Url(titleParts.join("-")) || `Clip from ${meeting.title}`;
    return { clip: { id, meetingId: meeting.id, start, end, title }, meeting };
  } catch {
    return null;
  }
}

/** Transcript entries that overlap a clip range. */
export function clipTranscript(meeting: Meeting, start: number, end: number) {
  return meeting.transcript.filter((e, i) => {
    const next = meeting.transcript[i + 1]?.start ?? meeting.durationSec;
    return next > start && e.start < end;
  });
}
