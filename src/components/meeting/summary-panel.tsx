"use client";

import { Check, ChevronDown, Copy, LayoutTemplate, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getPerson } from "@/data/people";
import { formatTimestamp } from "@/lib/format";
import { setTemplate, useActionOverrides, useTemplate } from "@/lib/store";
import { buildSummary, getTemplate, summaryToText, TEMPLATES } from "@/lib/templates";
import { cn } from "@/lib/utils";
import type { Meeting, SummarySection, TemplateId } from "@/types";
import { usePlayer } from "../player/player-context";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "../ui/menu";
import { Badge, SectionLabel, Skeleton } from "../ui/primitives";
import { useMeeting } from "./meeting-context";

function TimeChip({ start }: { start: number }) {
  const { seek } = usePlayer();
  return (
    <button
      onClick={() => seek(start, { play: true })}
      className="h-fit shrink-0 cursor-pointer rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] text-brand-700 tabular transition-colors hover:bg-brand-100"
      aria-label={`Play from ${formatTimestamp(start)}`}
    >
      {formatTimestamp(start)}
    </button>
  );
}

function Section({ section }: { section: SummarySection }) {
  const overrides = useActionOverrides();
  const { meeting, showTab } = useMeeting();

  return (
    <section className="animate-fade-in">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h3 className="text-[13.5px] font-semibold text-ink">{section.title}</h3>
        {section.description ? <span className="text-xs text-faint">{section.description}</span> : null}
      </div>
      {section.items.length === 0 ? (
        <p className="text-[13px] text-faint italic">{section.empty}</p>
      ) : section.kind === "paragraph" ? (
        <p className="text-[14px] leading-relaxed text-ink-2">{section.items[0].text}</p>
      ) : section.kind === "list" ? (
        <ul className="space-y-2">
          {section.items.map((item) => (
            <li key={item.text} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-2">
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
              {item.text}
            </li>
          ))}
        </ul>
      ) : section.kind === "topics" ? (
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {section.items.map((item, i) => (
            <li key={item.text} className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2">
              <span className="text-[11px] font-medium text-faint tabular">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.text}</span>
              {item.start !== undefined ? <TimeChip start={item.start} /> : null}
            </li>
          ))}
        </ol>
      ) : section.kind === "quotes" ? (
        <ul className="space-y-2.5">
          {section.items.map((item) => (
            <li key={`${item.start}-${item.text}`} className="flex gap-3 rounded-xl bg-subtle/60 px-3 py-2.5">
              {item.speakerId ? <Avatar personId={item.speakerId} size="sm" className="mt-0.5" /> : null}
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="text-xs font-semibold text-ink">{item.speakerId ? getPerson(item.speakerId).name : ""}</span>
                  {item.start !== undefined ? <TimeChip start={item.start} /> : null}
                </div>
                <p className="text-[13.5px] leading-relaxed text-ink-2">“{item.text}”</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-1.5">
          {section.items.map((item, i) => {
            const action = meeting.actionItems[i];
            const done = action ? (overrides[action.id] ?? action.completed) : false;
            return (
              <li key={`${item.text}-${i}`} className="flex items-start gap-2.5 text-[13.5px] text-ink-2">
                <span
                  className={cn(
                    "mt-0.5 grid size-4 shrink-0 place-items-center rounded border",
                    done ? "border-brand-600 bg-brand-600 text-white" : "border-line-strong",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-2.5" strokeWidth={3} /> : null}
                </span>
                <span className={cn("flex-1", done && "text-faint line-through")}>{item.text}</span>
                {item.speakerId ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                    <Avatar personId={item.speakerId} size="xs" />
                    <span className="hidden sm:inline">{getPerson(item.speakerId).name.split(" ")[0]}</span>
                  </span>
                ) : null}
              </li>
            );
          })}
          <li>
            <button onClick={() => showTab("actions")} className="mt-1 cursor-pointer text-xs font-medium text-brand-700 hover:underline">
              Manage action items →
            </button>
          </li>
        </ul>
      )}
    </section>
  );
}

function TalkTime({ meeting }: { meeting: Meeting }) {
  const shares = useMemo(() => {
    const totals = new Map<string, number>();
    meeting.transcript.forEach((e, i) => {
      const end = meeting.transcript[i + 1]?.start ?? meeting.durationSec;
      totals.set(e.speakerId, (totals.get(e.speakerId) ?? 0) + (end - e.start));
    });
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()].map(([id, s]) => ({ id, pct: Math.round((s / sum) * 100) })).sort((a, b) => b.pct - a.pct);
  }, [meeting]);

  return (
    <div>
      <SectionLabel className="mb-2">Talk time</SectionLabel>
      <div className="mb-3 flex h-2 overflow-hidden rounded-full">
        {shares.map((s) => (
          <span key={s.id} style={{ width: `${s.pct}%`, backgroundColor: getPerson(s.id).color }} title={`${getPerson(s.id).name} ${s.pct}%`} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {shares.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-xs text-ink-2">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: getPerson(s.id).color }} />
            <span className="min-w-0 flex-1 truncate">{getPerson(s.id).name}</span>
            <span className="text-muted tabular">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SummaryPanel() {
  const { meeting } = useMeeting();
  const template = useTemplate(meeting);
  const [regenerating, setRegenerating] = useState(false);
  const sections = useMemo(() => buildSummary(meeting, template), [meeting, template]);

  const changeTemplate = (id: TemplateId) => {
    if (id === template) return;
    setRegenerating(true);
    window.setTimeout(() => {
      setTemplate(meeting.id, id);
      setRegenerating(false);
      toast.success(`Summary regenerated with the ${getTemplate(id).name} template`);
    }, 650);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryToText(meeting, sections));
      toast.success("Summary copied to clipboard");
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Sparkles className="size-3.5 text-brand-600" />
          AI summary · generated from {meeting.transcript.length} transcript segments
        </div>
        <div className="flex items-center gap-1.5">
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" disabled={regenerating} aria-label={`Summary template: ${getTemplate(template).name}`}>
                <LayoutTemplate className="text-muted" />
                {getTemplate(template).name}
                <ChevronDown className="text-muted" />
              </Button>
            </MenuTrigger>
            <MenuContent className="w-72">
              <MenuLabel>Summary template</MenuLabel>
              <MenuRadioGroup value={template} onValueChange={(v) => changeTemplate(v as TemplateId)}>
                {TEMPLATES.map((t) => (
                  <MenuRadioItem key={t.id} value={t.id} description={t.description}>
                    {t.name}
                    {t.id === meeting.template ? <span className="ml-1.5 text-[10px] font-medium text-brand-700">Suggested</span> : null}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuContent>
          </Menu>
          <Button size="icon-sm" onClick={copy} aria-label="Copy summary">
            <Copy />
          </Button>
        </div>
      </div>

      {regenerating ? (
        <div className="space-y-6 p-5" aria-busy="true" aria-live="polite">
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Loader2 className="size-4 animate-spin text-brand-600" /> Regenerating summary…
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div key={template} className="space-y-7 p-5">
          {sections.map((s) => (
            <Section key={s.id} section={s} />
          ))}
          <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-[1fr_auto]">
            <TalkTime meeting={meeting} />
            <div className="space-y-3 sm:w-48">
              <div>
                <SectionLabel className="mb-1.5">Meeting tone</SectionLabel>
                <p className="text-[13px] text-ink-2">{meeting.tone}</p>
              </div>
              <div>
                <SectionLabel className="mb-1.5">Tags</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {meeting.tags.map((t) => (
                    <Badge key={t} tone="outline">
                      #{t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
