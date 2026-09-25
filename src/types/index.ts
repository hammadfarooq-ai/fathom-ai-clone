export type Platform = "zoom" | "google-meet" | "teams" | "upload";

export type MeetingType =
  | "Sales"
  | "Product"
  | "Engineering"
  | "Research"
  | "Investor"
  | "1:1"
  | "Interview"
  | "Onboarding"
  | "Marketing";

export type MeetingStatus = "processing" | "ready";

export type TemplateId =
  | "general"
  | "sales"
  | "research"
  | "one-on-one"
  | "interview"
  | "product";

export interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  /** Tailwind-safe hex color used for avatars and speaker accents. */
  color: string;
  external: boolean;
}

export interface TranscriptEntry {
  id: string;
  /** Offset from the start of the recording, in seconds. */
  start: number;
  speakerId: string;
  text: string;
}

export interface ActionItem {
  id: string;
  title: string;
  ownerId: string;
  /** ISO date (YYYY-MM-DD). */
  dueDate: string;
  completed: boolean;
}

export interface Highlight {
  id: string;
  meetingId: string;
  start: number;
  end: number;
  title: string;
  description: string;
  transcriptEntryId: string;
  createdBy: string;
  createdAt: string;
}

export interface Topic {
  title: string;
  start: number;
}

export interface Recording {
  /**
   * URL to a real audio/video file. When absent the player runs a simulated
   * clock, so a real capture pipeline can be plugged in by filling this field.
   */
  url?: string;
  durationSec: number;
  platform: Platform;
}

export interface Meeting {
  id: string;
  title: string;
  /** Wall-clock start time, stored as ISO with a Z suffix and always formatted in UTC. */
  date: string;
  durationSec: number;
  meetingType: MeetingType;
  hostId: string;
  participants: string[];
  recording: Recording;
  summary: string;
  keyDecisions: string[];
  topics: Topic[];
  takeaways: string[];
  actionItems: ActionItem[];
  highlights: Highlight[];
  transcript: TranscriptEntry[];
  template: TemplateId;
  tags: string[];
  /** Descriptive metadata only, e.g. "Collaborative · decision-focused". */
  tone: string;
  suggestedQuestions: string[];
  /** Everyone referenced by this meeting (participants, owners, highlight authors). */
  people: Record<string, Person>;
  status: MeetingStatus;
  source: "seed" | "capture" | "import";
}

/** Lightweight meeting row for lists (no transcript). */
export interface MeetingListItem {
  id: string;
  title: string;
  date: string;
  durationSec: number;
  meetingType: MeetingType;
  platform: Platform;
  hostId: string;
  participants: string[];
  tags: string[];
  summary: string;
  status: MeetingStatus;
  source: "seed" | "capture" | "import";
  openActions: number;
  totalActions: number;
  highlightCount: number;
  /** Share of speaking time per participant, 0..1, largest first. */
  talkTime: { personId: string; share: number }[];
  /** Pipeline progress for meetings still processing. */
  processing?: ProcessingState;
}

export interface ProcessingState {
  step: number;
  steps: { id: string; label: string; detail: string }[];
  startedAt: string;
  readyAt: string;
}

export interface UpcomingMeeting {
  id: string;
  title: string;
  date: string;
  durationMin: number;
  platform: Platform;
  participants: string[];
  meetingType: MeetingType;
  autoRecord: boolean;
  calendar: "google" | "outlook";
}

export interface Clip {
  id: string;
  meetingId: string;
  start: number;
  end: number;
  title: string;
  views?: number;
  createdAt?: string;
  meetingTitle?: string;
}

export interface ActionItemWithMeeting extends ActionItem {
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
}

export interface HighlightWithContext extends Highlight {
  meetingTitle: string;
  meetingDate: string;
  quote: string;
  speakerId: string;
}

export interface WorkspaceSettings {
  calendars: { google: boolean; outlook: boolean };
  autoRecord: "all" | "external" | "none";
  defaultTemplate: TemplateId;
  integrations: Record<"slack" | "hubspot" | "notion" | "linear", boolean>;
  notifications: { summaryEmail: boolean; actionReminders: boolean; weeklyDigest: boolean };
  joinAs: string;
}

export interface SummarySectionItem {
  text: string;
  /** Optional timestamp this item was derived from. */
  start?: number;
  speakerId?: string;
}

export interface SummarySection {
  id: string;
  title: string;
  description?: string;
  kind: "paragraph" | "list" | "quotes" | "checklist" | "topics";
  items: SummarySectionItem[];
  empty?: string;
}

export interface AskSource {
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  entryId: string;
  start: number;
  speakerId: string;
  label: string;
  excerpt: string;
}

export interface AskAnswer {
  question: string;
  answer: string;
  sources: AskSource[];
  mode: "local" | "llm";
  /** For cross-meeting questions, the meetings that matched. */
  meetings?: {
    meetingId: string;
    title: string;
    date: string;
    insight: string;
    excerpt: string;
    start: number;
    entryId: string;
    speakerId: string;
  }[];
}
