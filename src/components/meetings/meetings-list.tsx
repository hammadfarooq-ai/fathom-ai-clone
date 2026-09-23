"use client";

import { Filter, Plus, Search, VideoOff, X } from "lucide-react";
import { useMemo, useState } from "react";
import { getPerson } from "@/data/people";
import { dateGroup, formatHoursMinutes } from "@/lib/format";
import { useHighlights, useMeetings } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useActionItems, useProcessingIds } from "@/lib/workspace-hooks";
import type { MeetingType } from "@/types";
import { useShell } from "../layout/shell-context";
import { Button } from "../ui/button";
import { Card, EmptyState, Input } from "../ui/primitives";
import { MeetingRow } from "./meeting-row";

type Scope = "all" | "external" | "internal";

export function MeetingsList() {
  const meetings = useMeetings();
  const processing = useProcessingIds();
  const actions = useActionItems(meetings);
  const highlights = useHighlights(meetings);
  const { openNewMeeting } = useShell();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [type, setType] = useState<MeetingType | "all">("all");

  const types = useMemo(() => [...new Set(meetings.map((m) => m.meetingType))].sort(), [meetings]);

  const filtered = meetings.filter((m) => {
    const external = m.participants.some((p) => getPerson(p).external);
    if (scope === "external" && !external) return false;
    if (scope === "internal" && external) return false;
    if (type !== "all" && m.meetingType !== type) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = [m.title, m.meetingType, ...m.tags, ...m.participants.map((p) => `${getPerson(p).name} ${getPerson(p).company}`)].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const groups = filtered.reduce<Record<string, typeof filtered>>((acc, m) => {
    (acc[dateGroup(m.date)] ??= []).push(m);
    return acc;
  }, {});

  const openByMeeting = new Map<string, number>();
  actions.filter((a) => !a.completed).forEach((a) => openByMeeting.set(a.meeting.id, (openByMeeting.get(a.meeting.id) ?? 0) + 1));
  const filtersActive = query || scope !== "all" || type !== "all";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Meetings</h1>
          <p className="mt-1 text-sm text-muted">
            {meetings.length} recorded meetings · {formatHoursMinutes(meetings.reduce((a, m) => a + m.durationSec, 0))} of conversation
          </p>
        </div>
        <Button variant="primary" onClick={openNewMeeting} className="w-fit">
          <Plus /> New meeting
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by title, person, company…" aria-label="Filter meetings" className="pl-9" />
        </div>
        <div role="tablist" aria-label="Meeting scope" className="flex w-fit rounded-lg bg-line/50 p-0.5">
          {(["all", "external", "internal"] as Scope[]).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={scope === s}
              onClick={() => setScope(s)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium capitalize transition-colors",
                scope === s ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
          <Filter className="size-3.5 shrink-0 text-faint" aria-hidden />
          {(["all", ...types] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={cn(
                "shrink-0 cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                type === t ? "border-brand-300 bg-brand-50 text-brand-800" : "border-line bg-surface text-ink-2 hover:border-line-strong",
              )}
            >
              {t === "all" ? "All types" : t}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<VideoOff />}
            title="No meetings match these filters"
            description="Try a different name, company, or meeting type."
            action={
              filtersActive ? (
                <Button
                  onClick={() => {
                    setQuery("");
                    setScope("all");
                    setType("all");
                  }}
                >
                  <X /> Clear filters
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {Object.entries(groups).map(([group, items]) => (
            <section key={group} aria-label={group}>
              <h2 className="mb-2 px-1 text-[12px] font-semibold tracking-wide text-faint uppercase">
                {group} <span className="font-normal">· {items.length}</span>
              </h2>
              <Card className="p-1.5">
                {items.map((m) => (
                  <MeetingRow
                    key={m.id}
                    meeting={m}
                    processing={processing.has(m.id)}
                    openActions={openByMeeting.get(m.id)}
                    highlightCount={highlights.filter((h) => h.meetingId === m.id).length}
                  />
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
