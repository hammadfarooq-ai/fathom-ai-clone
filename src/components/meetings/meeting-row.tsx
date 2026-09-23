"use client";

import { Clock, Highlighter, ListChecks, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { getPerson } from "@/data/people";
import { formatDuration, formatRelativeDay, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/types";
import { MeetingTypeBadge } from "../meeting-meta";
import { AvatarStack } from "../ui/avatar";
import { Badge } from "../ui/primitives";

export function MeetingThumb({ meeting, className }: { meeting: Meeting; className?: string }) {
  const host = getPerson(meeting.hostId);
  return (
    <div
      aria-hidden
      className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-lg", className)}
      style={{ background: `linear-gradient(135deg, ${host.color}22, ${host.color}0d)` }}
    >
      <div className="flex items-end gap-[3px]">
        {[0.45, 0.8, 0.6, 1, 0.55].map((h, i) => (
          <span key={i} className="w-[3px] rounded-full" style={{ height: `${h * 18}px`, backgroundColor: host.color, opacity: 0.75 }} />
        ))}
      </div>
      <span className="absolute right-1 bottom-1 rounded bg-ink/70 px-1 text-[9px] font-medium text-white tabular">
        {formatDuration(meeting.durationSec).replace(" min", "m")}
      </span>
    </div>
  );
}

export function MeetingRow({
  meeting,
  processing,
  openActions,
  highlightCount,
}: {
  meeting: Meeting;
  processing?: boolean;
  openActions?: number;
  highlightCount?: number;
}) {
  const externals = meeting.participants.filter((p) => getPerson(p).external);
  const company = externals.length ? getPerson(externals[0]).company : null;
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="group flex items-center gap-3.5 rounded-xl px-3 py-3 transition-colors hover:bg-subtle/80 focus-visible:bg-subtle sm:gap-4"
    >
      <MeetingThumb meeting={meeting} className="h-11 w-16 sm:h-12 sm:w-[76px]" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-[14px] font-medium text-ink group-hover:text-brand-800">{meeting.title}</h3>
          <span className="hidden sm:inline-flex">
            <MeetingTypeBadge type={meeting.meetingType} />
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="tabular">
            {formatRelativeDay(meeting.date)} · {formatTime(meeting.date)}
          </span>
          <span className="inline-flex items-center gap-1 tabular">
            <Clock className="size-3" aria-hidden />
            {formatDuration(meeting.durationSec)}
          </span>
          {company ? <span className="hidden md:inline">{company}</span> : null}
        </div>
      </div>
      <div className="hidden items-center gap-2 md:flex">
        {processing ? (
          <Badge tone="mark">
            <Loader2 className="animate-spin" /> Processing
          </Badge>
        ) : (
          <>
            <Badge tone="brand">
              <Sparkles /> Summary
            </Badge>
            {openActions !== undefined && openActions > 0 ? (
              <Badge tone="outline" title={`${openActions} open action items`}>
                <ListChecks /> {openActions}
              </Badge>
            ) : null}
            {highlightCount ? (
              <Badge tone="outline" title={`${highlightCount} highlights`}>
                <Highlighter /> {highlightCount}
              </Badge>
            ) : null}
          </>
        )}
      </div>
      <AvatarStack ids={meeting.participants} max={3} className="hidden sm:flex" />
    </Link>
  );
}
