"use client";

import { Check, Copy, ExternalLink, Scissors } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getPerson } from "@/data/people";
import { clipTranscript, encodeClipId } from "@/lib/clips";
import { formatDuration, formatTimestamp } from "@/lib/format";
import { saveClip } from "@/lib/store";
import { truncate } from "@/lib/utils";
import type { Meeting } from "@/types";
import { Button, buttonClass } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { Input } from "../ui/primitives";

function topicAt(meeting: Meeting, t: number) {
  let title = meeting.topics[0]?.title ?? meeting.title;
  for (const tp of meeting.topics) if (tp.start <= t) title = tp.title;
  return title;
}

const selectClass =
  "h-9 w-full cursor-pointer rounded-lg border border-line bg-surface px-2.5 text-sm text-ink shadow-card outline-none hover:border-line-strong focus:border-brand-400 focus:ring-3 focus:ring-brand-100 tabular";

function ClipForm({ meeting, range }: { meeting: Meeting; range: { start: number; end: number; title?: string } }) {
  const boundaries = useMemo(() => meeting.transcript.map((e) => e.start), [meeting]);
  const [start, setStart] = useState(range.start);
  const [end, setEnd] = useState(range.end);
  const [title, setTitle] = useState(range.title ?? topicAt(meeting, range.start));
  const [created, setCreated] = useState<{ id: string; url: string } | null>(null);

  const endOptions = [...boundaries.filter((b) => b > start), meeting.durationSec];
  const excerpt = clipTranscript(meeting, start, end);
  const valid = end > start && title.trim().length > 0;

  const create = () => {
    if (!valid) return;
    const clip = { meetingId: meeting.id, start, end, title: title.trim() };
    const id = encodeClipId(clip);
    saveClip({ id, ...clip });
    const url = `${window.location.origin}/clips/${id}`;
    setCreated({ id, url });
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Clip created — link copied", { description: title.trim() }),
      () => toast.success("Clip created", { description: title.trim() }),
    );
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  if (created) {
    return (
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3 rounded-xl bg-brand-50 p-3.5">
          <span className="grid size-8 place-items-center rounded-full bg-brand-600 text-white">
            <Check className="size-4" />
          </span>
          <div>
            <p className="text-[13.5px] font-semibold text-ink">{title}</p>
            <p className="text-xs text-muted tabular">
              {formatTimestamp(start)} – {formatTimestamp(end)} · {formatDuration(end - start)}
            </p>
          </div>
        </div>
        <div>
          <label htmlFor="clip-url" className="mb-1.5 block text-[13px] font-medium text-ink">
            Shareable link
          </label>
          <div className="flex gap-2">
            <Input id="clip-url" readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
            <Button onClick={copy} aria-label="Copy clip link">
              <Copy /> Copy
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted">Anyone with the link can watch this clip. The rest of the meeting stays private.</p>
        </div>
        <div className="flex justify-end">
          <Link href={`/clips/${created.id}`} target="_blank" className={buttonClass("primary")}>
            Open clip <ExternalLink />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        create();
      }}
    >
      <div>
        <label htmlFor="clip-title" className="mb-1.5 block text-[13px] font-medium text-ink">
          Clip title
        </label>
        <Input id="clip-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="clip-start" className="mb-1.5 block text-[13px] font-medium text-ink">
            Start
          </label>
          <select
            id="clip-start"
            className={selectClass}
            value={start}
            onChange={(e) => {
              const s = Number(e.target.value);
              setStart(s);
              if (end <= s) setEnd(boundaries.find((b) => b > s) ?? meeting.durationSec);
            }}
          >
            {boundaries.map((b) => (
              <option key={b} value={b}>
                {formatTimestamp(b)} — {getPerson(meeting.transcript.find((e) => e.start === b)!.speakerId).name.split(" ")[0]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="clip-end" className="mb-1.5 block text-[13px] font-medium text-ink">
            End
          </label>
          <select id="clip-end" className={selectClass} value={end} onChange={(e) => setEnd(Number(e.target.value))}>
            {endOptions.map((b) => (
              <option key={b} value={b}>
                {formatTimestamp(b)}
                {b === meeting.durationSec ? " — end of meeting" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div aria-hidden className="relative h-2 rounded-full bg-subtle">
        <div
          className="absolute h-2 rounded-full bg-brand-500"
          style={{ left: `${(start / meeting.durationSec) * 100}%`, width: `${((end - start) / meeting.durationSec) * 100}%` }}
        />
      </div>

      <div className="rounded-xl border border-line bg-subtle/50 p-3">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-faint uppercase">
          Preview · {formatDuration(end - start)}
        </p>
        <ul className="space-y-1.5">
          {excerpt.slice(0, 3).map((e) => (
            <li key={e.id} className="text-[12.5px] leading-relaxed text-ink-2">
              <span className="font-semibold text-ink">{getPerson(e.speakerId).name.split(" ")[0]}:</span> {truncate(e.text, 130)}
            </li>
          ))}
          {excerpt.length > 3 ? <li className="text-xs text-muted">+{excerpt.length - 3} more segments</li> : null}
        </ul>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!valid}>
          <Scissors /> Create clip
        </Button>
      </div>
    </form>
  );
}

export function ClipDialog({
  meeting,
  range,
  onOpenChange,
}: {
  meeting: Meeting;
  range: { start: number; end: number; title?: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={range !== null} onOpenChange={onOpenChange}>
      <DialogContent title="Create a clip" description={`Share a moment from ${meeting.title}`}>
        {range ? <ClipForm key={`${range.start}-${range.end}`} meeting={meeting} range={range} /> : null}
      </DialogContent>
    </Dialog>
  );
}
