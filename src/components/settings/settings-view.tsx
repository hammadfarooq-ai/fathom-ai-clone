"use client";

import { Bell, CalendarDays, Check, Loader2, Plug, RotateCcw, Sparkles, UserRound, Video } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { upcomingMeetings } from "@/data";
import { CURRENT_USER_ID, getPerson } from "@/data/people";
import { calendarProviders, type CalendarProviderId } from "@/lib/calendar";
import { formatDay, formatTime } from "@/lib/format";
import { resetWorkspace, updateSettings, useSettings, type WorkspaceSettings } from "@/lib/store";
import { TEMPLATES } from "@/lib/templates";
import { cn } from "@/lib/utils";
import type { TemplateId } from "@/types";
import { PlatformLabel } from "../meeting-meta";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { Badge, Card, Input, Switch } from "../ui/primitives";

function Section({ id, icon, title, description, children }: { id: string; icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card>
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-subtle text-ink-2 [&_svg]:size-4">{icon}</span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            <p className="text-[13px] text-muted">{description}</p>
          </div>
        </div>
        <div className="p-5">{children}</div>
      </Card>
    </section>
  );
}

function Row({ title, description, control }: { title: string; description?: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div>
        <p className="text-[13.5px] font-medium text-ink">{title}</p>
        {description ? <p className="text-xs text-muted">{description}</p> : null}
      </div>
      {control}
    </div>
  );
}

function CalendarCard({ id, settings }: { id: CalendarProviderId; settings: WorkspaceSettings }) {
  const provider = calendarProviders[id];
  const connected = settings.calendars[id];
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      if (connected) {
        await provider.disconnect();
        updateSettings({ calendars: { ...settings.calendars, [id]: false } });
        toast(`${provider.name} disconnected`);
      } else {
        const { account } = await provider.connect();
        updateSettings({ calendars: { ...settings.calendars, [id]: true } });
        toast.success(`${provider.name} connected`, { description: account });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-4">
      <div className="flex items-center gap-3">
        <span className={cn("grid size-10 place-items-center rounded-xl", id === "google" ? "bg-blue-50 text-blue-600" : "bg-sky-50 text-sky-700")}>
          <CalendarDays className="size-5" />
        </span>
        <div>
          <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            {provider.name}
            {connected ? (
              <Badge tone="green">
                <Check /> Connected
              </Badge>
            ) : (
              <Badge tone="outline">Not connected</Badge>
            )}
          </p>
          <p className="text-xs text-muted">{connected ? `Syncing events for ${getPerson(CURRENT_USER_ID).email}` : "Connect to auto-record meetings from this calendar"}</p>
        </div>
      </div>
      <Button variant={connected ? "secondary" : "primary"} size="sm" onClick={toggle} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        {busy ? (connected ? "Disconnecting…" : "Connecting…") : connected ? "Disconnect" : "Connect"}
      </Button>
    </div>
  );
}

const INTEGRATIONS: { id: keyof WorkspaceSettings["integrations"]; name: string; description: string }[] = [
  { id: "slack", name: "Slack", description: "Post summaries to the meeting's channel" },
  { id: "hubspot", name: "HubSpot", description: "Log sales call notes and next steps to deals" },
  { id: "notion", name: "Notion", description: "Sync meeting notes to a Notion database" },
  { id: "linear", name: "Linear", description: "Turn action items into Linear issues" },
];

export function SettingsView() {
  const settings = useSettings();
  const me = getPerson(CURRENT_USER_ID);
  const [autoRecord, setAutoRecord] = useState<Record<string, boolean>>(() => Object.fromEntries(upcomingMeetings.map((u) => [u.id, u.autoRecord])));
  const anyCalendar = settings.calendars.google || settings.calendars.outlook;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your calendars, recording preferences, and integrations.</p>
      </div>

      <nav aria-label="Settings sections" className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {[
          ["profile", "Profile"],
          ["calendar", "Calendar"],
          ["recording", "Recording"],
          ["summaries", "Summaries"],
          ["integrations", "Integrations"],
          ["notifications", "Notifications"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2 hover:border-line-strong hover:bg-subtle">
            {label}
          </a>
        ))}
      </nav>

      <Section id="profile" icon={<UserRound />} title="Profile" description="How you appear to your team">
        <div className="flex items-center gap-4">
          <Avatar personId={me.id} size="xl" />
          <div>
            <p className="text-[15px] font-semibold text-ink">{me.name}</p>
            <p className="text-[13px] text-muted">
              {me.role} · {me.company}
            </p>
            <p className="text-[13px] text-muted">{me.email}</p>
          </div>
        </div>
      </Section>

      <Section id="calendar" icon={<CalendarDays />} title="Calendar" description="Parley joins and records meetings from connected calendars">
        <div className="space-y-3">
          <CalendarCard id="google" settings={settings} />
          <CalendarCard id="outlook" settings={settings} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Demo workspace: OAuth is mocked behind the <code className="rounded bg-subtle px-1 font-mono">CalendarProvider</code> interface, so a real Google
          or Microsoft flow can be plugged in without UI changes.
        </p>
        <div className="mt-5">
          <h3 className="mb-2 text-[13px] font-semibold text-ink">Upcoming meetings</h3>
          {anyCalendar ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {upcomingMeetings
                .filter((u) => (u.calendar === "Outlook" ? settings.calendars.outlook : settings.calendars.google))
                .map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-ink">{u.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span className="tabular">
                          {formatDay(u.date)} · {formatTime(u.date)}
                        </span>
                        <PlatformLabel platform={u.platform} />
                        <span>{u.calendar}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden text-xs text-muted sm:inline">{autoRecord[u.id] ? "Recording" : "Skip"}</span>
                      <Switch
                        checked={autoRecord[u.id]}
                        onCheckedChange={(v) => {
                          setAutoRecord((a) => ({ ...a, [u.id]: v }));
                          toast(v ? `Parley will record “${u.title}”` : `Parley will skip “${u.title}”`);
                        }}
                        label={`Record ${u.title}`}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-muted">Connect a calendar to see upcoming meetings.</p>
          )}
        </div>
      </Section>

      <Section id="recording" icon={<Video />} title="Recording" description="When the notetaker joins your calls">
        <fieldset>
          <legend className="mb-2 text-[13.5px] font-medium text-ink">Auto-record</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["all", "All meetings", "Every meeting with a video link"],
                ["external", "External only", "Meetings with people outside Northstack"],
                ["none", "Manual", "Only when you start a recording"],
              ] as const
            ).map(([value, label, description]) => (
              <label
                key={value}
                className={cn(
                  "cursor-pointer rounded-xl border p-3 transition-colors",
                  settings.autoRecord === value ? "border-brand-400 bg-brand-50/50" : "border-line hover:border-line-strong",
                )}
              >
                <input
                  type="radio"
                  name="autoRecord"
                  value={value}
                  checked={settings.autoRecord === value}
                  onChange={() => {
                    updateSettings({ autoRecord: value });
                    toast.success("Recording preference saved");
                  }}
                  className="sr-only"
                />
                <span className="block text-[13px] font-semibold text-ink">{label}</span>
                <span className="text-xs text-muted">{description}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            const name = new FormData(e.currentTarget).get("joinAs")?.toString().trim();
            if (name) {
              updateSettings({ joinAs: name });
              toast.success("Notetaker name updated");
            }
          }}
        >
          <label htmlFor="joinAs" className="mb-1.5 block text-[13.5px] font-medium text-ink">
            Notetaker display name
          </label>
          <div className="flex gap-2">
            <Input id="joinAs" name="joinAs" defaultValue={settings.joinAs} key={settings.joinAs} className="max-w-xs" />
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Section>

      <Section id="summaries" icon={<Sparkles />} title="Summaries" description="Default template for new meetings">
        <div className="grid gap-2 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <label
              key={t.id}
              className={cn(
                "cursor-pointer rounded-xl border p-3 transition-colors",
                settings.defaultTemplate === t.id ? "border-brand-400 bg-brand-50/50" : "border-line hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="template"
                className="sr-only"
                checked={settings.defaultTemplate === t.id}
                onChange={() => {
                  updateSettings({ defaultTemplate: t.id as TemplateId });
                  toast.success(`Default template set to ${t.name}`);
                }}
              />
              <span className="block text-[13px] font-semibold text-ink">{t.name}</span>
              <span className="text-xs text-muted">{t.description}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section id="integrations" icon={<Plug />} title="Integrations" description="Send meeting intelligence where your team works">
        <div className="divide-y divide-line">
          {INTEGRATIONS.map((i) => (
            <Row
              key={i.id}
              title={i.name}
              description={i.description}
              control={
                <Switch
                  checked={settings.integrations[i.id]}
                  onCheckedChange={(v) => {
                    updateSettings({ integrations: { ...settings.integrations, [i.id]: v } });
                    toast(v ? `${i.name} enabled` : `${i.name} disabled`);
                  }}
                  label={`${i.name} integration`}
                />
              }
            />
          ))}
        </div>
      </Section>

      <Section id="notifications" icon={<Bell />} title="Notifications" description="What we email you">
        <div className="divide-y divide-line">
          {(
            [
              ["summaryEmail", "Meeting recap", "Summary and action items after every meeting"],
              ["actionReminders", "Action item reminders", "A nudge the day before something you own is due"],
              ["weeklyDigest", "Weekly digest", "Highlights and decisions from the week, every Friday"],
            ] as const
          ).map(([key, title, description]) => (
            <Row
              key={key}
              title={title}
              description={description}
              control={
                <Switch
                  checked={settings.notifications[key]}
                  onCheckedChange={(v) => updateSettings({ notifications: { ...settings.notifications, [key]: v } })}
                  label={title}
                />
              }
            />
          ))}
        </div>
      </Section>

      <Card className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-[14px] font-semibold text-ink">Reset demo workspace</p>
          <p className="text-[13px] text-muted">Clears your highlights, clips, completed items, and imported meetings.</p>
        </div>
        <Button
          variant="danger"
          onClick={() => {
            resetWorkspace();
            toast.success("Demo workspace reset");
          }}
        >
          <RotateCcw /> Reset
        </Button>
      </Card>
    </div>
  );
}
