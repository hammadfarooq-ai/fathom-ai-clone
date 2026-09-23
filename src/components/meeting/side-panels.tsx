"use client";

import { Highlighter, ListChecks, Play, Scissors, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getPerson } from "@/data/people";
import { formatTimestamp } from "@/lib/format";
import { removeHighlight, restoreHighlight, useActionOverrides } from "@/lib/store";
import { cn, truncate } from "@/lib/utils";
import { ActionItemRow } from "../action-item-row";
import { usePlayer } from "../player/player-context";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/primitives";
import { useMeeting } from "./meeting-context";

type Filter = "all" | "open" | "done";

export function ActionItemsPanel() {
  const { meeting } = useMeeting();
  const overrides = useActionOverrides();
  const [filter, setFilter] = useState<Filter>("all");
  const items = meeting.actionItems.map((item) => ({ item, completed: overrides[item.id] ?? item.completed }));
  const done = items.filter((i) => i.completed).length;
  const visible = items.filter((i) => (filter === "all" ? true : filter === "open" ? !i.completed : i.completed));
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: items.length },
    { id: "open", label: "Open", count: items.length - done },
    { id: "done", label: "Completed", count: done },
  ];

  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Action items completed">
            <div className="h-full rounded-full bg-brand-600 transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-muted tabular">
            {done} of {items.length} complete
          </span>
        </div>
        <div role="tablist" aria-label="Filter action items" className="flex rounded-lg bg-subtle p-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f.id ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              {f.label} <span className="text-faint tabular">{f.count}</span>
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title={filter === "open" ? "Everything's done" : "Nothing completed yet"}
          description={filter === "open" ? "All action items from this meeting are complete." : "Check off an action item to see it here."}
        />
      ) : (
        <ul className="-mx-2">
          {visible.map(({ item, completed }) => (
            <ActionItemRow key={item.id} item={item} completed={completed} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function HighlightsPanel() {
  const { meeting, highlights, openClip } = useMeeting();
  const { seek } = usePlayer();
  const sorted = [...highlights].sort((a, b) => a.start - b.start);

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={<Highlighter />}
        title="No highlights yet"
        description="Hover over any line in the transcript and click Highlight to save the moment here."
      />
    );
  }

  return (
    <ul className="space-y-2.5 p-5">
      {sorted.map((h) => {
        const entry = meeting.transcript.find((e) => e.id === h.transcriptEntryId);
        return (
          <li key={h.id} className="group rounded-xl border border-line p-3.5 transition-colors hover:border-mark-200 hover:bg-mark-50/40">
            <div className="flex items-start gap-3">
              <button
                onClick={() => seek(h.start, { play: true })}
                className="mt-0.5 cursor-pointer rounded-md bg-mark-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-mark-700 tabular hover:bg-mark-200"
                aria-label={`Play highlight from ${formatTimestamp(h.start)}`}
              >
                {formatTimestamp(h.start)}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-ink">{h.title}</p>
                {h.description ? <p className="mt-0.5 text-[13px] text-muted">{h.description}</p> : null}
                {entry ? (
                  <p className="mt-2 border-l-2 border-mark-200 pl-2.5 text-[13px] leading-relaxed text-ink-2">
                    <span className="font-medium text-ink">{getPerson(entry.speakerId).name.split(" ")[0]}:</span> “{truncate(entry.text, 220)}”
                  </p>
                ) : null}
                <div className="mt-2.5 flex flex-wrap items-center gap-1">
                  <span className="mr-auto flex items-center gap-1.5 text-xs text-muted">
                    <Avatar personId={h.createdBy} size="xs" /> {getPerson(h.createdBy).name}
                  </span>
                  <Button size="xs" variant="ghost" onClick={() => seek(h.start, { play: true })}>
                    <Play /> Play
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => openClip({ start: h.start, end: h.end, title: h.title })}>
                    <Scissors /> Share clip
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    aria-label={`Remove highlight ${h.title}`}
                    onClick={() => {
                      removeHighlight(h.id);
                      toast("Highlight removed", { action: { label: "Undo", onClick: () => restoreHighlight(h) } });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
