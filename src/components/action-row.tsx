"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Avatar, PersonName } from "@/components/people";
import { setActionCompleted } from "@/lib/api";
import { formatDueDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActionItem } from "@/types";

export function ActionCheckbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[4px] border transition-colors",
        checked ? "border-ok bg-ok text-card" : "border-rule-strong bg-card hover:border-ink",
      )}
    >
      {checked ? <Check className="size-3" strokeWidth={3} /> : null}
    </button>
  );
}

export async function toggleAction(item: ActionItem & { meetingId?: string }, meetingId?: string) {
  const next = !item.completed;
  try {
    await setActionCompleted({ id: item.id, meetingId: meetingId ?? item.meetingId }, next);
    toast(next ? "Marked done" : "Reopened", {
      description: item.title,
      action: { label: "Undo", onClick: () => void setActionCompleted({ id: item.id, meetingId: meetingId ?? item.meetingId }, !next) },
    });
  } catch {
    toast.error("Couldn't update that action item");
  }
}

export function ActionRow({
  item,
  meetingId,
  meeting,
  onSeek,
  compact,
}: {
  item: ActionItem;
  meetingId?: string;
  /** Show the meeting it came from (cross-meeting lists). */
  meeting?: { id: string; title: string };
  onSeek?: () => void;
  compact?: boolean;
}) {
  const due = formatDueDate(item.dueDate);
  return (
    <li className={cn("group flex items-start gap-3", compact ? "py-2" : "py-2.5")}>
      <ActionCheckbox checked={item.completed} onToggle={() => void toggleAction(item, meetingId ?? meeting?.id)} label={`Mark “${item.title}” ${item.completed ? "not done" : "done"}`} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-[14px] leading-snug", item.completed ? "text-faint line-through decoration-rule-strong" : "text-ink")}>{item.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Avatar personId={item.ownerId} size="xs" />
            <PersonName id={item.ownerId} first />
          </span>
          <span className={cn(!item.completed && due.overdue && "font-medium text-danger", !item.completed && due.soon && "text-ink-2")}>{due.label}</span>
          {meeting ? (
            <Link href={`/meetings/${meeting.id}`} className="truncate hover:text-ink hover:underline">
              {meeting.title}
            </Link>
          ) : null}
          {onSeek ? (
            <button onClick={onSeek} className="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink focus-visible:opacity-100">
              Find in transcript
            </button>
          ) : null}
        </p>
      </div>
    </li>
  );
}
