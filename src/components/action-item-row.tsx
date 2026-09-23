"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getPerson } from "@/data/people";
import { formatDueDate } from "@/lib/format";
import { setActionCompleted } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ActionItem } from "@/types";
import { Avatar } from "./ui/avatar";

export function toggleActionItem(item: ActionItem, completed: boolean) {
  setActionCompleted(item.id, completed);
  toast.success(completed ? "Action item completed" : "Marked as open", {
    description: item.title,
    action: { label: "Undo", onClick: () => setActionCompleted(item.id, !completed) },
  });
}

export function ActionItemRow({
  item,
  completed,
  meeting,
  compact,
}: {
  item: ActionItem;
  completed: boolean;
  meeting?: { id: string; title: string };
  compact?: boolean;
}) {
  const owner = getPerson(item.ownerId);
  const due = formatDueDate(item.dueDate);
  return (
    <li className={cn("group flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-subtle/70", compact && "py-2")}>
      <button
        role="checkbox"
        aria-checked={completed}
        aria-label={`${completed ? "Mark as open" : "Mark complete"}: ${item.title}`}
        onClick={() => toggleActionItem(item, !completed)}
        className={cn(
          "mt-0.5 grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-md border transition-all",
          completed ? "border-brand-600 bg-brand-600 text-white" : "border-line-strong bg-surface hover:border-brand-500",
        )}
      >
        {completed ? <Check className="size-3" strokeWidth={3} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13.5px] leading-snug text-ink transition-colors", completed && "text-faint line-through decoration-line-strong")}>
          {item.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Avatar personId={owner.id} size="xs" />
            {owner.name}
          </span>
          <span
            className={cn(
              "tabular",
              !completed && due.overdue && "font-medium text-red-600",
              !completed && due.soon && "font-medium text-mark-700",
            )}
          >
            {completed ? "Done" : due.overdue ? `Overdue · ${due.label.replace("Due ", "")}` : due.label}
          </span>
          {meeting ? (
            <Link href={`/meetings/${meeting.id}`} className="truncate text-muted underline-offset-2 hover:text-ink hover:underline">
              {meeting.title}
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}
