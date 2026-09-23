import type {
  ActionItem,
  Highlight,
  Meeting,
  MeetingType,
  Platform,
  TemplateId,
  Topic,
  TranscriptEntry,
} from "@/types";

export interface MeetingSpec {
  id: string;
  title: string;
  date: string;
  duration: string;
  meetingType: MeetingType;
  platform: Platform;
  hostId: string;
  participants: string[];
  template: TemplateId;
  tags: string[];
  tone: string;
  summary: string;
  keyDecisions: string[];
  takeaways: string[];
  topics: [string, string][];
  actions: [title: string, owner: string, due: string, completed?: boolean][];
  highlights: [time: string, title: string, description: string, createdBy: string][];
  suggestedQuestions: string[];
  lines: Line[];
}

export function defineMeeting(spec: MeetingSpec): Meeting {
  const durationSec = ts(spec.duration);
  const transcript = buildTranscript(spec.id, spec.lines);
  return {
    id: spec.id,
    title: spec.title,
    date: spec.date,
    durationSec,
    meetingType: spec.meetingType,
    hostId: spec.hostId,
    participants: spec.participants,
    recording: { durationSec, platform: spec.platform },
    summary: spec.summary,
    keyDecisions: spec.keyDecisions,
    takeaways: spec.takeaways,
    topics: buildTopics(spec.topics),
    actionItems: buildActions(spec.id, spec.actions),
    highlights: buildHighlights(spec.id, spec.date, transcript, durationSec, spec.highlights),
    transcript,
    template: spec.template,
    tags: spec.tags,
    tone: spec.tone,
    suggestedQuestions: spec.suggestedQuestions,
  };
}

/** Parse "mm:ss" or "h:mm:ss" into seconds. */
export function ts(value: string): number {
  const parts = value.split(":").map(Number);
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export type Line = [time: string, speaker: string, text: string];

export function buildTranscript(meetingId: string, lines: Line[]): TranscriptEntry[] {
  return lines.map(([time, speakerId, text], i) => ({
    id: `${meetingId}-t${i + 1}`,
    start: ts(time),
    speakerId,
    text,
  }));
}

export function buildTopics(topics: [string, string][]): Topic[] {
  return topics.map(([time, title]) => ({ title, start: ts(time) }));
}

export function buildActions(
  meetingId: string,
  items: [title: string, owner: string, due: string, completed?: boolean][],
): ActionItem[] {
  return items.map(([title, ownerId, dueDate, completed], i) => ({
    id: `${meetingId}-a${i + 1}`,
    title,
    ownerId,
    dueDate,
    completed: Boolean(completed),
  }));
}

/**
 * Build highlights anchored to transcript entries by their timestamp.
 * The highlight spans from the anchored entry to the start of the entry after it.
 */
export function buildHighlights(
  meetingId: string,
  meetingDate: string,
  transcript: TranscriptEntry[],
  durationSec: number,
  items: [time: string, title: string, description: string, createdBy: string][],
): Highlight[] {
  return items.map(([time, title, description, createdBy], i) => {
    const start = ts(time);
    const index = transcript.findIndex((e) => e.start === start);
    if (index === -1) throw new Error(`Highlight ${meetingId}@${time} has no transcript entry`);
    const next = transcript[index + 1];
    return {
      id: `${meetingId}-h${i + 1}`,
      meetingId,
      start,
      end: next ? next.start : durationSec,
      title,
      description,
      transcriptEntryId: transcript[index].id,
      createdBy,
      createdAt: meetingDate,
    };
  });
}
