"use client";

import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { createClip } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";
import { parseClock } from "@/lib/timeline";
import type { Clip, Meeting } from "@/types";

export interface ClipDraft {
  start: number;
  end: number;
  title: string;
}

/** Pick a range, name it, get a public link that plays only that part. */
export function ClipDialog({ meeting, draft, onOpenChange }: { meeting: Meeting; draft: ClipDraft | null; onOpenChange: (open: boolean) => void }) {
  // The parent remounts this dialog (key) for every new draft, so state starts fresh.
  const [start, setStart] = useState(draft ? formatTimestamp(draft.start) : "");
  const [end, setEnd] = useState(draft ? formatTimestamp(draft.end) : "");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [busy, setBusy] = useState(false);
  const [clip, setClip] = useState<Clip | null>(null);
  const [copied, setCopied] = useState(false);

  const s = parseClock(start);
  const e = parseClock(end);
  const invalid = Number.isNaN(s) || Number.isNaN(e) || e - s < 3 || e > meeting.durationSec;
  const url = clip ? `${typeof window === "undefined" ? "" : window.location.origin}/c/${clip.id}` : "";

  return (
    <Dialog open={draft !== null} onOpenChange={onOpenChange}>
      <DialogContent title={clip ? "Clip ready to share" : "Share a clip"} description={clip ? "Anyone with the link can watch this part, no account needed." : `From ${meeting.title}`}>
        {clip ? (
          <div className="space-y-4 px-6 pb-6">
            <div className="flex items-center gap-2 rounded-md border border-rule-strong bg-paper p-1.5 pl-3">
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">{url}</span>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  void navigator.clipboard?.writeText(url);
                  setCopied(true);
                  toast.success("Link copied");
                }}
              >
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-[13px] text-muted">
              {clip.title} · {formatTimestamp(clip.start)}–{formatTimestamp(clip.end)} ({clip.end - clip.start}s). Views are counted in Moments.
            </p>
            <div className="flex justify-end">
              <Button asChild variant="ghost" size="sm">
                <a href={`/c/${clip.id}`} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open as a guest
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4 px-6 pb-6"
            onSubmit={async (ev) => {
              ev.preventDefault();
              if (invalid) return;
              setBusy(true);
              try {
                setClip(await createClip({ meetingId: meeting.id, start: s, end: e, title: title.trim() || `Clip from ${meeting.title}` }));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Couldn't create the clip");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block">
              <span className="eyebrow">Title</span>
              <input
                value={title}
                onChange={(ev) => setTitle(ev.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-rule-strong bg-paper px-3 text-[14px] outline-none focus:border-ink"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="eyebrow">Start</span>
                <input value={start} onChange={(ev) => setStart(ev.target.value)} className="tabular mt-1.5 h-10 w-full rounded-md border border-rule-strong bg-paper px-3 font-mono text-[14px] outline-none focus:border-ink" />
              </label>
              <label className="block">
                <span className="eyebrow">End</span>
                <input value={end} onChange={(ev) => setEnd(ev.target.value)} className="tabular mt-1.5 h-10 w-full rounded-md border border-rule-strong bg-paper px-3 font-mono text-[14px] outline-none focus:border-ink" />
              </label>
            </div>
            <p className="text-[12.5px] text-muted">
              {invalid ? `Use mm:ss, at least 3 seconds long, and within ${formatTimestamp(meeting.durationSec)}.` : `${e - s} seconds. The link only plays this range.`}
            </p>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={invalid || busy}>
                {busy ? <Loader2 className="animate-spin" /> : null} Create link
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
