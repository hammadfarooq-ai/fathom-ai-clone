"use client";

import { ChevronDown, Copy, Highlighter, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ActionRow } from "@/components/action-row";
import { PersonName, speakerStyle, usePerson } from "@/components/people";
import { usePlayer } from "@/components/player/player-context";
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/menu";
import { Button, Eyebrow } from "@/components/ui/primitives";
import { addActionItem, addHighlight, removeActionItem, removeHighlight, setMeetingTemplate } from "@/lib/api";
import { CURRENT_USER_ID } from "@/lib/constants";
import { formatTimestamp, todayIso } from "@/lib/format";
import { tokenize } from "@/lib/text";
import { buildSummary, getTemplate, summaryToText, TEMPLATES } from "@/lib/templates";
import { cn } from "@/lib/utils";
import type { ActionItem, Highlight, Meeting, SummarySection, TemplateId } from "@/types";

function Timestamp({ start }: { start: number }) {
  const player = usePlayer();
  return (
    <button onClick={() => player.seek(start, { play: true })} className="tabular font-mono text-[11px] text-faint hover:text-accent" aria-label={`Play from ${formatTimestamp(start)}`}>
      {formatTimestamp(start)}
    </button>
  );
}

function Quote({ text, start, speakerId }: { text: string; start?: number; speakerId?: string }) {
  const p = usePerson(speakerId ?? "");
  return (
    <blockquote className="border-l-2 py-0.5 pl-4" style={{ ...speakerStyle(p.color), borderColor: "var(--c)" }}>
      <p className="text-[14.5px] leading-relaxed text-ink">“{text}”</p>
      <footer className="mt-1 flex items-center gap-2 text-[12px]">
        {speakerId ? <PersonName id={speakerId} /> : null}
        {start !== undefined ? <Timestamp start={start} /> : null}
      </footer>
    </blockquote>
  );
}

/** Finds the transcript line that best matches an action item, for "find in transcript". */
function supportingStart(meeting: Meeting, text: string): number | undefined {
  const words = new Set(tokenize(text));
  let best: { start: number; score: number } | undefined;
  for (const e of meeting.transcript) {
    const score = tokenize(e.text).filter((w) => words.has(w)).length;
    if (score >= 2 && (!best || score > best.score)) best = { start: e.start, score };
  }
  return best?.start;
}

function AddAction({ meeting, onDone }: { meeting: Meeting; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState(meeting.participants.includes(CURRENT_USER_ID) ? CURRENT_USER_ID : meeting.participants[0]);
  const [due, setDue] = useState(() => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-2 space-y-2 rounded-md border border-rule bg-paper p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await addActionItem(meeting.id, { title: title.trim(), ownerId: owner, dueDate: due });
          toast.success("Action item added");
          onDone();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't add the action item");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to happen?"
        className="h-9 w-full rounded-md border border-rule-strong bg-card px-2.5 text-[14px] outline-none focus:border-ink"
        aria-label="Action item"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select value={owner} onChange={(e) => setOwner(e.target.value)} className="h-8 rounded-md border border-rule-strong bg-card px-2 text-[13px]" aria-label="Owner">
          {meeting.participants.map((id) => (
            <option key={id} value={id}>
              {meeting.people[id]?.name ?? id}
            </option>
          ))}
        </select>
        <input type="date" value={due} min={todayIso()} onChange={(e) => setDue(e.target.value)} className="h-8 rounded-md border border-rule-strong bg-card px-2 text-[13px]" aria-label="Due date" />
        <span className="flex-1" />
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" variant="primary" disabled={busy || title.trim().length < 2}>
          Add
        </Button>
      </div>
    </form>
  );
}

function ActionItems({ meeting, title }: { meeting: Meeting; title: string }) {
  const player = usePlayer();
  const [adding, setAdding] = useState(false);
  const open = meeting.actionItems.filter((a) => !a.completed).length;
  const remove = async (a: ActionItem) => {
    try {
      await removeActionItem(meeting.id, a.id);
      toast("Action item deleted", { description: a.title });
    } catch {
      toast.error("Couldn't delete that action item");
    }
  };
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <Eyebrow as="h3">
          {title} <span className="text-faint">· {open} open</span>
        </Eyebrow>
        {!adding ? (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink">
            <Plus className="size-3.5" /> Add
          </button>
        ) : null}
      </div>
      {meeting.actionItems.length === 0 && !adding ? <p className="mt-2 text-[13.5px] text-muted">No commitments were captured.</p> : null}
      <ul className="mt-1 divide-y divide-rule/70">
        {meeting.actionItems.map((a) => {
          const at = supportingStart(meeting, a.title);
          return (
            <div key={a.id} className="group/act relative">
              <ActionRow item={a} meetingId={meeting.id} onSeek={at !== undefined ? () => player.seek(at, { play: true }) : undefined} />
              <button
                onClick={() => void remove(a)}
                className="absolute top-2.5 right-0 grid size-7 place-items-center rounded-md text-faint opacity-0 group-hover/act:opacity-100 hover:bg-sunken hover:text-danger focus-visible:opacity-100"
                aria-label={`Delete “${a.title}”`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
      </ul>
      {adding ? <AddAction meeting={meeting} onDone={() => setAdding(false)} /> : null}
    </section>
  );
}

function Section({ section, meeting }: { section: SummarySection; meeting: Meeting }) {
  if (section.kind === "checklist") return <ActionItems meeting={meeting} title={section.title} />;
  return (
    <section>
      <Eyebrow as="h3">{section.title}</Eyebrow>
      {section.description ? <p className="mt-0.5 text-[12px] text-faint">{section.description}</p> : null}
      <div className="mt-2.5">
        {section.items.length === 0 ? (
          <p className="text-[13.5px] text-muted">{section.empty ?? "Nothing here."}</p>
        ) : section.kind === "paragraph" ? (
          <p className="text-[16px] leading-[1.7] text-ink">{section.items[0].text}</p>
        ) : section.kind === "quotes" ? (
          <div className="space-y-4">
            {section.items.map((item, i) => (
              <Quote key={i} {...item} />
            ))}
          </div>
        ) : section.kind === "topics" ? (
          <ol className="divide-y divide-rule/70">
            {section.items.map((item, i) => (
              <li key={i} className="flex items-baseline gap-3 py-1.5">
                <span className="tabular w-5 text-[12px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 text-[14.5px] text-ink">{item.text}</span>
                {item.start !== undefined ? <Timestamp start={item.start} /> : null}
              </li>
            ))}
          </ol>
        ) : (
          <ul className="space-y-2">
            {section.items.map((item, i) => (
              <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed text-ink">
                <span className="mt-[11px] h-px w-3 shrink-0 bg-ink-2" aria-hidden />
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function TemplatePicker({ meeting }: { meeting: Meeting }) {
  const current = getTemplate(meeting.template);
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="flex h-8 items-center gap-1.5 rounded-md border border-rule bg-card px-2.5 text-[12.5px] text-ink-2 hover:border-rule-strong">
          <span className="text-muted">Template</span>
          <span className="font-medium text-ink">{current.name}</span>
          <ChevronDown className="size-3.5 text-muted" />
        </button>
      </MenuTrigger>
      <MenuContent className="w-72">
        <MenuRadioGroup
          value={meeting.template}
          onValueChange={async (v) => {
            try {
              await setMeetingTemplate(meeting.id, v as TemplateId);
            } catch {
              toast.error("Couldn't switch the template");
            }
          }}
        >
          {TEMPLATES.map((t) => (
            <MenuRadioItem key={t.id} value={t.id} description={t.description}>
              {t.name}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

export function copyNotes(meeting: Meeting) {
  const text = summaryToText(meeting, buildSummary(meeting, meeting.template));
  void navigator.clipboard?.writeText(text);
  toast.success("Notes copied", { description: "Paste them into Slack, email, or your doc." });
}

function Moments({ meeting, highlights }: { meeting: Meeting; highlights: Highlight[] }) {
  const player = usePlayer();
  if (highlights.length === 0) {
    return (
      <section>
        <Eyebrow as="h3">Highlights</Eyebrow>
        <p className="mt-2 text-[13.5px] text-muted">
          Hover a transcript line and choose <span className="marker">Highlight</span>, or press H while playing, to save a moment.
        </p>
      </section>
    );
  }
  return (
    <section>
      <Eyebrow as="h3">
        Highlights <span className="text-faint">· {highlights.length}</span>
      </Eyebrow>
      <ul className="mt-2 space-y-2">
        {highlights.map((h) => (
          <li key={h.id} className="group/h flex items-start gap-3 rounded-md bg-mark-soft/40 px-3 py-2">
            <Highlighter className="mt-0.5 size-4 shrink-0 text-mark" />
            <button className="min-w-0 flex-1 text-left" onClick={() => player.seek(h.start, { play: true })}>
              <span className="block text-[14px] font-medium text-ink">{h.title}</span>
              {h.description ? <span className="block text-[13px] text-ink-2">{h.description}</span> : null}
              <span className="tabular mt-0.5 block font-mono text-[11px] text-muted">
                {formatTimestamp(h.start)} · {meeting.people[h.createdBy]?.name.split(" ")[0] ?? "Someone"}
              </span>
            </button>
            <button
              onClick={async () => {
                try {
                  const removed = await removeHighlight(meeting.id, h.id);
                  toast("Highlight removed", {
                    description: h.title,
                    action: {
                      label: "Undo",
                      onClick: () =>
                        void addHighlight(meeting.id, {
                          id: removed.id,
                          transcriptEntryId: removed.transcriptEntryId || undefined,
                          start: removed.start,
                          end: removed.end,
                          title: removed.title,
                          description: removed.description,
                        }),
                    },
                  });
                } catch {
                  toast.error("Couldn't remove that highlight");
                }
              }}
              className="grid size-7 place-items-center rounded-md text-faint opacity-0 group-hover/h:opacity-100 hover:text-danger focus-visible:opacity-100"
              aria-label={`Remove highlight “${h.title}”`}
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Notes({ meeting, className }: { meeting: Meeting; className?: string }) {
  const sections = useMemo(() => buildSummary(meeting, meeting.template), [meeting]);
  return (
    <div className={cn("space-y-9", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <TemplatePicker meeting={meeting} />
        <Button size="sm" variant="ghost" onClick={() => copyNotes(meeting)}>
          <Copy /> Copy notes
        </Button>
      </div>
      {sections.map((s) => (
        <Section key={s.id} section={s} meeting={meeting} />
      ))}
      <Moments meeting={meeting} highlights={meeting.highlights} />
    </div>
  );
}
