"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, Eyebrow, Segmented, Switch } from "@/components/ui/primitives";
import { patchSettings, resetWorkspace, useSettings } from "@/lib/api";
import { TEMPLATES } from "@/lib/templates";
import type { TemplateId, WorkspaceSettings } from "@/types";

function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md">
        <p className="text-[14px] font-medium text-ink">{title}</p>
        {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="grid gap-x-10 border-t border-ink pt-4 lg:grid-cols-[220px_1fr]">
      <div className="pb-2">
        <Eyebrow as="h2" className="text-ink">
          {title}
        </Eyebrow>
        {note ? <p className="mt-1.5 text-[12.5px] text-muted">{note}</p> : null}
      </div>
      <div className="divide-y divide-rule">{children}</div>
    </section>
  );
}

async function save(patch: Parameters<typeof patchSettings>[0], message?: string) {
  try {
    await patchSettings(patch);
    if (message) toast.success(message);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Couldn't save that setting");
  }
}

export function SettingsView() {
  const router = useRouter();
  const { data: s } = useSettings();
  const [name, setName] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  if (!s) return null;

  const integration = (key: keyof WorkspaceSettings["integrations"], label: string, description: string) => (
    <Row title={label} description={description}>
      <Switch checked={s.integrations[key]} label={label} onChange={(v) => void save({ integrations: { [key]: v } }, `${label} ${v ? "connected" : "disconnected"}`)} />
    </Row>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
      <header className="pb-8">
        <Eyebrow>Settings</Eyebrow>
        <h1 className="mt-2 font-display text-[40px] leading-[1.02] tracking-tight text-ink sm:text-[52px]">How Parley works for you.</h1>
        <p className="mt-2 text-[14px] text-muted">Every change is saved to the workspace database right away.</p>
      </header>

      <div className="space-y-10">
        <Group title="Calendars" note="Sync is simulated: events live in Postgres and show on Today when a calendar is connected.">
          <Row title="Google Calendar" description="hammad@northstack.io">
            <Switch checked={s.calendars.google} label="Google Calendar" onChange={(v) => void save({ calendars: { google: v } }, v ? "Google Calendar connected" : "Google Calendar disconnected")} />
          </Row>
          <Row title="Outlook Calendar" description="hammad@northstack.onmicrosoft.com">
            <Switch checked={s.calendars.outlook} label="Outlook Calendar" onChange={(v) => void save({ calendars: { outlook: v } }, v ? "Outlook connected" : "Outlook disconnected")} />
          </Row>
        </Group>

        <Group title="Recording">
          <Row title="Join automatically" description="Which calendar events the notetaker joins by default. You can still switch any single event on Today.">
            <Segmented
              label="Auto-record"
              value={s.autoRecord}
              onChange={(v) => void save({ autoRecord: v }, "Recording rule saved")}
              options={[
                { value: "all", label: "All" },
                { value: "external", label: "With guests" },
                { value: "none", label: "None" },
              ]}
            />
          </Row>
          <Row title="Notetaker name" description="How the bot appears in the participant list.">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name?.trim()) void save({ joinAs: name.trim() }, "Name saved");
              }}
            >
              <input
                value={name ?? s.joinAs}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-52 rounded-md border border-rule-strong bg-card px-3 text-[13.5px] outline-none focus:border-ink"
                aria-label="Notetaker name"
              />
              <Button type="submit" size="md" variant="outline" disabled={!name || name.trim() === s.joinAs}>
                Save
              </Button>
            </form>
          </Row>
        </Group>

        <Group title="Notes">
          <Row title="Default template" description="Used for new meetings. Each meeting can still switch templates.">
            <select
              value={s.defaultTemplate}
              onChange={(e) => void save({ defaultTemplate: e.target.value as TemplateId }, "Default template saved")}
              className="h-9 rounded-md border border-rule-strong bg-card px-2.5 text-[13.5px]"
              aria-label="Default template"
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Row>
          <Row title="Email me the notes" description="A recap after every recorded meeting.">
            <Switch checked={s.notifications.summaryEmail} label="Email recap" onChange={(v) => void save({ notifications: { summaryEmail: v } })} />
          </Row>
          <Row title="Action item reminders" description="A nudge the day before something you own is due.">
            <Switch checked={s.notifications.actionReminders} label="Action reminders" onChange={(v) => void save({ notifications: { actionReminders: v } })} />
          </Row>
          <Row title="Weekly digest" description="Monday summary of decisions and open follow-ups.">
            <Switch checked={s.notifications.weeklyDigest} label="Weekly digest" onChange={(v) => void save({ notifications: { weeklyDigest: v } })} />
          </Row>
        </Group>

        <Group title="Integrations" note="Preferences are saved; no data leaves the demo.">
          {integration("slack", "Slack", "Post notes to the meeting's channel.")}
          {integration("hubspot", "HubSpot", "Log sales calls on the deal.")}
          {integration("notion", "Notion", "Save notes to a database.")}
          {integration("linear", "Linear", "Turn action items into issues.")}
        </Group>

        <Group title="Workspace">
          <Row title="Reset demo workspace" description="Reloads the seeded meetings, notes, and calendar with dates moved to today. Your imports, highlights, and clips are removed.">
            <Button
              variant="danger"
              disabled={resetting}
              onClick={async () => {
                if (!window.confirm("Reset the workspace? Imports, highlights, and clips you made are removed.")) return;
                setResetting(true);
                try {
                  await resetWorkspace();
                  toast.success("Workspace reset");
                  router.refresh();
                } catch {
                  toast.error("Couldn't reset the workspace");
                } finally {
                  setResetting(false);
                }
              }}
            >
              {resetting ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reset
            </Button>
          </Row>
        </Group>
      </div>
    </div>
  );
}
