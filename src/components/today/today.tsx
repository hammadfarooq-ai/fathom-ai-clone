"use client";

import { ArrowRight, ArrowUpRight, CalendarOff, MessageCircleQuestion } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ActionRow } from "@/components/action-row";
import { PLATFORM_LABEL, ProcessingSteps } from "@/components/meeting-bits";
import { AvatarStack, TalkStrip, usePerson } from "@/components/people";
import { useShell } from "@/components/shell/shell-context";
import { Empty, Eyebrow, Segmented, Switch, Tag } from "@/components/ui/primitives";
import { setAutoRecord, useActionItems, useMeetings, useOverview, useUpcoming } from "@/lib/api";
import { CURRENT_USER_ID } from "@/lib/constants";
import { daysFromToday, formatDuration, formatRelativeDay, formatTime, nowAsWallClockIso } from "@/lib/format";
import { cn, truncate } from "@/lib/utils";
import type { ActionItemWithMeeting, UpcomingMeeting } from "@/types";

const longDate = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });

/** Local-time greeting, computed only in the browser to avoid hydration drift. */
function useGreeting() {
  return useSyncExternalStore(
    () => () => {},
    () => {
      const h = new Date().getHours();
      return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    },
    () => "Hello",
  );
}

function useNowIso() {
  return useSyncExternalStore(
    () => () => {},
    () => nowAsWallClockIso().slice(0, 16),
    () => "",
  );
}

function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="flex items-end justify-between gap-3 border-b border-ink pb-2">
        <Eyebrow as="h2" className="text-ink">
          {title}
        </Eyebrow>
        {action}
      </div>
      {children}
    </section>
  );
}

function Agenda({ events }: { events: UpcomingMeeting[] }) {
  const now = useNowIso();
  const byDay = useMemo(() => {
    const map = new Map<string, UpcomingMeeting[]>();
    for (const e of events) map.set(e.date.slice(0, 10), [...(map.get(e.date.slice(0, 10)) ?? []), e]);
    return [...map.entries()].slice(0, 4);
  }, [events]);

  if (events.length === 0) {
    return (
      <Empty title="No calendar connected" icon={<CalendarOff />}>
        Connect Google or Outlook in <Link href="/settings" className="underline">Settings</Link> and upcoming calls show up here, ready to record.
      </Empty>
    );
  }

  return (
    <div className="divide-y divide-rule">
      {byDay.map(([day, list]) => (
        <div key={day} className="grid gap-x-4 py-3 sm:grid-cols-[110px_1fr]">
          <div className="flex items-baseline gap-2 pt-1 sm:block">
            <p className="font-display text-[22px] leading-none text-ink">{formatRelativeDay(`${day}T00:00:00Z`)}</p>
            <p className="text-[12px] text-muted sm:mt-1">{longDate.format(new Date(`${day}T12:00:00Z`)).split(",")[0]}</p>
          </div>
          <ul className="min-w-0">
            {list.map((e) => {
              const ended = now !== "" && e.date.slice(0, 16) < now && daysFromToday(e.date) === 0;
              return (
                <li key={e.id} className={cn("flex items-center gap-3 py-2", ended && "opacity-55")}>
                  <span className="tabular w-[68px] shrink-0 font-mono text-[12px] text-ink-2">{formatTime(e.date)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{e.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
                      <AvatarStack ids={e.participants} size="xs" max={4} />
                      <span>
                        {e.durationMin} min · {PLATFORM_LABEL[e.platform]}
                      </span>
                      {ended ? <span>· Ended</span> : null}
                    </p>
                  </div>
                  <label className="flex shrink-0 items-center gap-2 text-[12px] text-muted">
                    <span className="hidden sm:inline">{e.autoRecord ? "Recording" : "Skip"}</span>
                    <Switch
                      size="sm"
                      checked={e.autoRecord}
                      label={`Record ${e.title}`}
                      onChange={async (v) => {
                        try {
                          await setAutoRecord(e.id, v);
                          toast(v ? "Parley will join and take notes" : "Parley will skip this one", { description: e.title });
                        } catch {
                          toast.error("Couldn't update that event");
                        }
                      }}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function groupActions(items: ActionItemWithMeeting[]) {
  const groups: { label: string; items: ActionItemWithMeeting[] }[] = [
    { label: "Overdue", items: [] },
    { label: "This week", items: [] },
    { label: "Later", items: [] },
  ];
  for (const a of items) {
    const d = daysFromToday(a.dueDate);
    groups[d < 0 ? 0 : d <= 6 ? 1 : 2].items.push(a);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function Today() {
  const me = usePerson(CURRENT_USER_ID);
  const greeting = useGreeting();
  const router = useRouter();
  const { openCapture } = useShell();
  const { data: events = [] } = useUpcoming();
  const { data: open = [] } = useActionItems("open");
  const { data: meetings = [] } = useMeetings();
  const { data: stats } = useOverview();
  const [who, setWho] = useState<"mine" | "all">("mine");
  const [question, setQuestion] = useState("");

  const today = new Date();
  const todays = events.filter((e) => daysFromToday(e.date) === 0);
  const mine = open.filter((a) => a.ownerId === CURRENT_USER_ID);
  const shown = who === "mine" ? mine : open;
  const recent = meetings.slice(0, 5);
  const overdue = open.filter((a) => daysFromToday(a.dueDate) < 0).length;

  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-8 sm:px-6 sm:pt-12">
      <header className="animate-rise">
        <Eyebrow>{longDate.format(today)}</Eyebrow>
        <h1 className="mt-2 font-display text-[40px] leading-[1.02] tracking-tight text-ink sm:text-[56px]">
          {greeting}, <em className="text-accent">{me.name.split(" ")[0]}</em>.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2 sm:text-[16px]">
          {todays.length === 0 ? "Nothing else on the calendar today." : `${todays.length} ${todays.length === 1 ? "call" : "calls"} on the calendar today.`}{" "}
          {mine.length > 0 ? `You own ${mine.length} open follow-up${mine.length === 1 ? "" : "s"}` : "You're clear on follow-ups"}
          {overdue > 0 ? `, and the team has ${overdue} overdue.` : "."}
        </p>
      </header>

      {stats ? (
        <dl className="mt-8 grid grid-cols-2 border-y border-rule sm:grid-cols-4">
          {[
            { label: "Meetings this week", value: stats.meetingsThisWeek },
            { label: "Hours recorded", value: (stats.secondsThisWeek / 3600).toFixed(1) },
            { label: "Open follow-ups", value: stats.openActions, note: stats.overdueActions ? `${stats.overdueActions} overdue` : undefined },
            { label: "Clip views", value: stats.clipViews },
          ].map((s, i) => (
            <div key={s.label} className={cn("px-1 py-4 sm:px-5", i % 2 === 1 && "border-l border-rule", i >= 2 && "border-t border-rule sm:border-t-0", i === 2 && "sm:border-l")}>
              <dt className="eyebrow">{s.label}</dt>
              <dd className="mt-1 flex items-baseline gap-2">
                <span className="tabular font-display text-[34px] leading-none text-ink">{s.value}</span>
                {s.note ? <span className="text-[12px] font-medium text-danger">{s.note}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-10 grid gap-x-12 gap-y-12 lg:grid-cols-12">
        <div className="space-y-12 lg:col-span-7">
          <Section
            title="On the calendar"
            action={
              <Link href="/settings" className="text-[12px] text-muted hover:text-ink">
                Recording rules
              </Link>
            }
          >
            <Agenda events={events} />
          </Section>

          <Section
            title="Recently captured"
            action={
              <Link href="/library" className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
                Library <ArrowRight className="size-3" />
              </Link>
            }
          >
            {recent.length === 0 ? (
              <Empty title="Nothing recorded yet">
                <button onClick={openCapture} className="underline">
                  Capture your first meeting
                </button>
                .
              </Empty>
            ) : (
              <ul className="divide-y divide-rule">
                {recent.map((m) => (
                  <li key={m.id}>
                    <Link href={`/meetings/${m.id}`} className="group block py-4">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="font-display text-[22px] leading-tight text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{m.title}</h3>
                        <span className="shrink-0 text-[12px] text-muted">{formatRelativeDay(m.date)}</span>
                      </div>
                      {m.status === "processing" && m.processing ? (
                        <ProcessingSteps state={m.processing} className="mt-2" />
                      ) : (
                        <>
                          <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2">{truncate(m.summary, 220)}</p>
                          <div className="mt-3 flex items-center gap-3">
                            <TalkStrip talk={m.talkTime} className="w-28 sm:w-40" />
                            <span className="text-[12px] text-muted">
                              {formatDuration(m.durationSec)} · {m.participants.length} people
                            </span>
                            {m.openActions > 0 ? <Tag>{m.openActions} open</Tag> : null}
                          </div>
                        </>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-12 lg:col-span-5">
          <Section
            title="Follow-ups"
            action={
              <Segmented
                label="Whose follow-ups"
                value={who}
                onChange={setWho}
                options={[
                  { value: "mine", label: "Mine", count: mine.length },
                  { value: "all", label: "Team", count: open.length },
                ]}
              />
            }
          >
            {shown.length === 0 ? (
              <Empty title="All caught up">Nothing open. New action items appear here as meetings are processed.</Empty>
            ) : (
              <div className="pt-2">
                {groupActions(shown).map((g) => (
                  <div key={g.label} className="pt-3">
                    <p className={cn("eyebrow", g.label === "Overdue" && "text-danger")}>{g.label}</p>
                    <ul className="divide-y divide-rule/70">
                      {g.items.slice(0, 6).map((a) => (
                        <ActionRow key={a.id} item={a} meeting={{ id: a.meetingId, title: a.meetingTitle }} compact />
                      ))}
                    </ul>
                    {g.items.length > 6 ? <p className="pt-1 text-[12px] text-muted">+{g.items.length - 6} more</p> : null}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Ask your meetings">
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (question.trim()) router.push(`/ask?q=${encodeURIComponent(question.trim())}`);
              }}
            >
              <div className="flex items-center gap-2 rounded-lg border border-rule-strong bg-card p-1.5 pl-3 focus-within:border-ink">
                <MessageCircleQuestion className="size-4 shrink-0 text-faint" />
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What did customers say about SSO?"
                  className="h-9 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
                  aria-label="Ask a question about your meetings"
                />
                <button type="submit" className="grid size-9 place-items-center rounded-md bg-ink text-paper disabled:opacity-40" disabled={!question.trim()} aria-label="Ask">
                  <ArrowUpRight className="size-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["What did we decide about pricing?", "Who owns the SSO work?", "What's blocking Helix?"].map((q) => (
                  <Link key={q} href={`/ask?q=${encodeURIComponent(q)}`} className="rounded-full border border-rule px-2.5 py-1 text-[12px] text-ink-2 hover:border-ink hover:text-ink">
                    {q}
                  </Link>
                ))}
              </div>
            </form>
          </Section>
        </div>
      </div>
    </div>
  );
}
