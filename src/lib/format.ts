import { DEMO_TODAY } from "@/data";

const UTC = "UTC";

/** 75 → "01:15", 3725 → "1:02:05" */
export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 3492 → "58 min", 5400 → "1h 30m" */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatHoursMinutes(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: UTC, weekday: "short", month: "short", day: "numeric" });
const longFmt = new Intl.DateTimeFormat("en-US", { timeZone: UTC, weekday: "long", month: "long", day: "numeric", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("en-US", { timeZone: UTC, month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: UTC, hour: "numeric", minute: "2-digit" });

function daysFromToday(iso: string): number {
  const today = Date.parse(`${DEMO_TODAY}T00:00:00Z`);
  const day = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Math.round((day - today) / 86_400_000);
}

/** "Today", "Yesterday", "Tomorrow", or "Mon, Sep 21". */
export function formatRelativeDay(iso: string): string {
  const diff = daysFromToday(iso);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return dayFmt.format(new Date(iso));
}

export function formatDay(iso: string): string {
  return dayFmt.format(new Date(iso));
}

export function formatLongDate(iso: string): string {
  return longFmt.format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return shortFmt.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

export function formatDueDate(date: string): { label: string; overdue: boolean; soon: boolean } {
  const diff = daysFromToday(date);
  const label = diff === 0 ? "Due today" : diff === 1 ? "Due tomorrow" : diff === -1 ? "Due yesterday" : `Due ${shortFmt.format(new Date(`${date}T00:00:00Z`))}`;
  return { label, overdue: diff < 0, soon: diff >= 0 && diff <= 2 };
}

/** Bucket used to group meeting lists. */
export function dateGroup(iso: string): string {
  const diff = daysFromToday(iso);
  if (diff >= 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff >= -6) return "Earlier this week";
  if (diff >= -13) return "Last week";
  return "Earlier";
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Current wall-clock time serialized in the workspace's "UTC wall time" convention. */
export function nowAsWallClockIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00Z`;
}
