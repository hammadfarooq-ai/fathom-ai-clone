"use client";

import {
  ArrowRight,
  CalendarClock,
  Clock3,
  Highlighter,
  ListChecks,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { DEMO_TODAY, upcomingMeetings } from "@/data";
import { CURRENT_USER_ID, firstName } from "@/data/people";
import { formatDay, formatHoursMinutes, formatLongDate, formatRelativeDay, formatTime, formatTimestamp } from "@/lib/format";
import { useHighlights, useMeetings } from "@/lib/store";
import { truncate } from "@/lib/utils";
import { useActionItems, useProcessingIds } from "@/lib/workspace-hooks";
import { ActionItemRow } from "../action-item-row";
import { PlatformLabel } from "../meeting-meta";
import { MeetingRow } from "../meetings/meeting-row";
import { AvatarStack } from "../ui/avatar";
import { buttonClass } from "../ui/button";
import { Badge, Card, CardHeader, EmptyState, Input } from "../ui/primitives";

function useGreeting() {
  return useSyncExternalStore(
    () => () => {},
    () => {
      const h = new Date().getHours();
      return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    },
    () => "Welcome back",
  );
}

function Stat({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <span className="grid size-7 place-items-center rounded-lg bg-subtle text-muted [&_svg]:size-4">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular sm:text-[28px]">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{sub}</p>
    </Card>
  );
}

const ASK_EXAMPLES = ["What did customers say about SSO?", "What did we decide about pricing?", "What are the risks for the October launch?"];

export function Overview() {
  const router = useRouter();
  const greeting = useGreeting();
  const meetings = useMeetings();
  const processing = useProcessingIds();
  const ready = useMemo(() => meetings.filter((m) => !processing.has(m.id)), [meetings, processing]);
  const actions = useActionItems(ready);
  const highlights = useHighlights(ready);
  const [ask, setAsk] = useState("");

  const totalSeconds = ready.reduce((acc, m) => acc + m.durationSec, 0);
  const open = actions.filter((a) => !a.completed);
  const thisWeek = ready.filter((m) => m.date >= "2026-09-21").length;
  const meetingById = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings]);
  const todays = upcomingMeetings.filter((u) => u.date.startsWith(DEMO_TODAY));
  const openByMeeting = useMemo(() => {
    const map = new Map<string, number>();
    open.forEach((a) => map.set(a.meeting.id, (map.get(a.meeting.id) ?? 0) + 1));
    return map;
  }, [open]);

  const myOpen = open
    .filter((a) => a.item.ownerId === CURRENT_USER_ID)
    .concat(open.filter((a) => a.item.ownerId !== CURRENT_USER_ID))
    .sort((a, b) => a.item.dueDate.localeCompare(b.item.dueDate))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[13px] font-medium text-muted">{formatLongDate(`${DEMO_TODAY}T09:00:00Z`)}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
            {greeting}, {firstName(CURRENT_USER_ID)}
          </h1>
          <p className="mt-1 text-sm text-muted">
            You have {todays.length} meetings today and {open.length} open action items across your team.
          </p>
        </div>
        <form
          role="search"
          className="relative w-full md:w-80"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q")?.toString().trim();
            if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input name="q" placeholder="Quick search…" aria-label="Quick search meetings" className="pl-9" />
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Meetings" value={String(ready.length)} sub={`${thisWeek} this week`} icon={<Video />} />
        <Stat label="Time analyzed" value={formatHoursMinutes(totalSeconds)} sub="Transcribed & summarized" icon={<Clock3 />} />
        <Stat label="Action items" value={String(actions.length)} sub={`${open.length} open · ${actions.length - open.length} done`} icon={<ListChecks />} />
        <Stat label="Highlights" value={String(highlights.length)} sub={`Across ${new Set(highlights.map((h) => h.meetingId)).size} meetings`} icon={<Highlighter />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Recent meetings"
              description="Recorded, transcribed, and summarized"
              icon={<Video />}
              action={
                <Link href="/meetings" className={buttonClass("ghost", "sm")}>
                  View all <ArrowRight />
                </Link>
              }
            />
            <div className="px-2 pb-2">
              {meetings.slice(0, 7).map((m) => (
                <MeetingRow
                  key={m.id}
                  meeting={m}
                  processing={processing.has(m.id)}
                  openActions={openByMeeting.get(m.id)}
                  highlightCount={highlights.filter((h) => h.meetingId === m.id).length}
                />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Recent highlights"
              description="Moments your team flagged"
              icon={<Highlighter />}
              action={
                <Link href="/highlights" className={buttonClass("ghost", "sm")}>
                  All highlights <ArrowRight />
                </Link>
              }
            />
            {highlights.length === 0 ? (
              <EmptyState icon={<Highlighter />} title="No highlights yet" description="Highlight a transcript moment in any meeting to see it here." />
            ) : (
              <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
                {highlights.slice(0, 4).map((h) => {
                  const m = meetingById.get(h.meetingId);
                  const entry = m?.transcript.find((e) => e.id === h.transcriptEntryId);
                  return (
                    <Link
                      key={h.id}
                      href={`/meetings/${h.meetingId}?t=${h.start}`}
                      className="group rounded-xl border border-line p-3.5 transition-colors hover:border-mark-200 hover:bg-mark-50/40"
                    >
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <Badge tone="mark" className="tabular">
                          {formatTimestamp(h.start)}
                        </Badge>
                        <span className="truncate">{m?.title}</span>
                      </div>
                      <p className="mt-2 text-[13.5px] font-medium text-ink">{h.title}</p>
                      {entry ? <p className="mt-1 text-xs leading-relaxed text-muted">“{truncate(entry.text, 120)}”</p> : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <div className="border-b border-line bg-gradient-to-br from-brand-50 to-surface px-5 py-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <Sparkles className="size-4 text-brand-600" /> Ask your meetings
              </div>
              <p className="mt-0.5 text-xs text-muted">Answers with sources from every transcript.</p>
              <form
                className="mt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (ask.trim()) router.push(`/search?mode=ask&q=${encodeURIComponent(ask.trim())}`);
                }}
              >
                <Input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="What did customers say about SSO?" aria-label="Ask across meetings" />
              </form>
            </div>
            <div className="space-y-1 p-2">
              {ASK_EXAMPLES.map((q) => (
                <Link
                  key={q}
                  href={`/search?mode=ask&q=${encodeURIComponent(q)}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] text-ink-2 transition-colors hover:bg-subtle hover:text-ink"
                >
                  {q}
                  <ArrowRight className="size-3.5 shrink-0 text-faint" />
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Upcoming"
              description="From your connected calendars"
              icon={<CalendarClock />}
              action={
                <Link href="/settings#calendar" className={buttonClass("ghost", "sm")}>
                  Manage
                </Link>
              }
            />
            <ul className="space-y-1 px-2 pb-2">
              {upcomingMeetings.slice(0, 5).map((u) => (
                <li key={u.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <div className="w-12 shrink-0 text-center">
                    <p className="text-[11px] font-medium text-muted uppercase">
                      {formatRelativeDay(u.date) === "Today" ? "Today" : formatDay(u.date).slice(0, 3)}
                    </p>
                    <p className="text-[13px] font-semibold text-ink tabular">{formatTime(u.date).replace(" ", " ")}</p>
                  </div>
                  <div className="min-w-0 flex-1 border-l border-line pl-3">
                    <p className="truncate text-[13.5px] font-medium text-ink">{u.title}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      <PlatformLabel platform={u.platform} />
                      <span>·</span>
                      <span>{u.durationMin} min</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <AvatarStack ids={u.participants} max={2} size="xs" />
                    {u.autoRecord ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-brand-700">
                        <span className="size-1.5 rounded-full bg-brand-500" /> Auto-record
                      </span>
                    ) : (
                      <span className="text-[10px] text-faint">Not recording</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Open action items" description={`${open.length} open across all meetings`} icon={<ListChecks />} />
            {myOpen.length === 0 ? (
              <EmptyState icon={<ListChecks />} title="All caught up" description="Every action item is complete." />
            ) : (
              <ul className="px-3 pb-3">
                {myOpen.map((a) => (
                  <ActionItemRow key={a.item.id} item={a.item} completed={a.completed} meeting={a.meeting} compact />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
