"use client";

import { ArrowLeft, Download, Link2, MessageCircleQuestion, MoreHorizontal, Pencil, Scissors, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AskThread } from "@/components/ask/ask-thread";
import { PLATFORM_LABEL, ProcessingSteps } from "@/components/meeting-bits";
import { Avatar, PersonName } from "@/components/people";
import { PlayerProvider, usePlayer } from "@/components/player/player-context";
import { Dialog, DialogContent, SheetContent } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Button, Eyebrow, Segmented, Skeleton, Tag } from "@/components/ui/primitives";
import { addHighlight, deleteMeeting, renameMeeting, useMeeting, type MeetingWithProcessing } from "@/lib/api";
import { formatDuration, formatLongDate, formatTime, formatTimestamp } from "@/lib/format";
import { activeIndex } from "@/lib/timeline";
import { cn, truncate } from "@/lib/utils";
import type { Meeting, TranscriptEntry } from "@/types";
import { ClipDialog, type ClipDraft } from "./clip-dialog";
import { Notes } from "./notes";
import { TapeDeck } from "./tape-deck";
import { Transcript } from "./transcript";

function downloadTranscript(meeting: Meeting) {
  const lines = meeting.transcript.map((e) => `[${formatTimestamp(e.start)}] ${meeting.people[e.speakerId]?.name ?? e.speakerId}: ${e.text}`);
  const blob = new Blob([`${meeting.title}\n${formatLongDate(meeting.date)}\n\n${lines.join("\n")}\n`], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${meeting.id}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function RenameDialog({ meeting, open, onOpenChange }: { meeting: Meeting; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [title, setTitle] = useState(meeting.title);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Rename meeting">
        <form
          className="space-y-4 px-6 pb-6"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await renameMeeting(meeting.id, title.trim());
              onOpenChange(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Couldn't rename");
            }
          }}
        >
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 w-full rounded-md border border-rule-strong bg-paper px-3 text-[14px] outline-none focus:border-ink" aria-label="Title" />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={!title.trim()}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Processing({ meeting }: { meeting: MeetingWithProcessing }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-16">
      <Link href="/library" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Library
      </Link>
      <Eyebrow className="mt-6">{meeting.source === "import" ? "Imported transcript" : `${PLATFORM_LABEL[meeting.recording.platform]} · Live capture`}</Eyebrow>
      <h1 className="mt-2 font-display text-[40px] leading-tight text-ink">{meeting.title}</h1>
      {meeting.processing ? <ProcessingSteps state={meeting.processing} className="mt-6 text-[13px]" /> : null}
      <p className="mt-4 max-w-xl text-[14px] text-ink-2">
        {meeting.source === "import"
          ? "The transcript is saved. Parley is writing the summary, decisions, chapters, and action items; this page updates by itself."
          : "The notetaker is in the call. When it ends, the recording is transcribed and notes are written. This page updates by itself."}
      </p>
      <div className="mt-10 space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="mt-6 h-4 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

/** Keyboard: Space play/pause, ←/→ 5s, J/L 10s, H highlight the current line. */
function Shortcuts({ onHighlight }: { onHighlight: () => void }) {
  const player = usePlayer();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (k === " ") {
        e.preventDefault();
        player.toggle();
      } else if (k === "arrowleft") player.skip(-5);
      else if (k === "arrowright") player.skip(5);
      else if (k === "j") player.skip(-10);
      else if (k === "l") player.skip(10);
      else if (k === "h") onHighlight();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, onHighlight]);
  return null;
}

/** Everything inside the player context (needs current time). */
function Workspace({ meeting, initialQuery }: { meeting: Meeting; initialQuery?: string }) {
  const router = useRouter();
  const player = usePlayer();
  const [tab, setTab] = useState<"notes" | "transcript">(initialQuery ? "transcript" : "notes");
  const [askOpen, setAskOpen] = useState(false);
  const [clipDraft, setClipDraft] = useState<ClipDraft | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);

  const highlightEntry = useCallback(
    async (entry: TranscriptEntry) => {
      const existing = meeting.highlights.find((h) => h.transcriptEntryId === entry.id);
      if (existing) {
        toast("Already highlighted", { description: existing.title });
        return;
      }
      const i = meeting.transcript.findIndex((e) => e.id === entry.id);
      const end = meeting.transcript[i + 1]?.start ?? meeting.durationSec;
      try {
        await addHighlight(meeting.id, {
          transcriptEntryId: entry.id,
          start: entry.start,
          end,
          title: truncate(entry.text, 70),
          description: `${meeting.people[entry.speakerId]?.name ?? "Someone"} at ${formatTimestamp(entry.start)}`,
        });
        toast.success("Moment highlighted", { description: "Saved to this meeting and to Moments." });
      } catch {
        toast.error("Couldn't save the highlight");
      }
    },
    [meeting],
  );

  const highlightNow = useCallback(() => {
    const entry = meeting.transcript[Math.max(0, activeIndex(meeting.transcript, player.currentTime()))];
    if (entry) void highlightEntry(entry);
  }, [meeting, highlightEntry, player]);

  const clipFrom = (entry: TranscriptEntry) => {
    const i = meeting.transcript.findIndex((e) => e.id === entry.id);
    const end = meeting.transcript[Math.min(i + 2, meeting.transcript.length - 1)]?.start ?? meeting.durationSec;
    setClipDraft({ start: entry.start, end: end > entry.start + 3 ? end : Math.min(meeting.durationSec, entry.start + 30), title: truncate(entry.text, 60) });
  };

  const speakers = meeting.participants;

  return (
    <>
      <Shortcuts onHighlight={highlightNow} />
      <div className="mx-auto max-w-[1320px] px-4 pt-6 sm:px-6">
        <Link href="/library" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
          <ArrowLeft className="size-3.5" /> Library
        </Link>

        <header className="mt-4 grid gap-4 border-b border-ink pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow>{meeting.meetingType}</Eyebrow>
              {meeting.source !== "seed" ? <Tag tone="accent">{meeting.source === "import" ? "Imported" : "Captured"}</Tag> : null}
            </div>
            <h1 className="mt-1.5 font-display text-[34px] leading-[1.05] tracking-tight text-ink sm:text-[46px]">{meeting.title}</h1>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
              <span>{formatLongDate(meeting.date)}</span>
              <span>·</span>
              <span>{formatTime(meeting.date)}</span>
              <span>·</span>
              <span>{formatDuration(meeting.durationSec)}</span>
              <span>·</span>
              <span>{PLATFORM_LABEL[meeting.recording.platform]}</span>
              {meeting.tone ? (
                <>
                  <span>·</span>
                  <span className="italic">{meeting.tone}</span>
                </>
              ) : null}
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {speakers.map((id) => (
                <li key={id} className="flex items-center gap-1.5 text-[13px]">
                  <Avatar personId={id} size="xs" />
                  <PersonName id={id} />
                  {meeting.people[id]?.external ? <span className="text-[11px] text-faint">{meeting.people[id].company}</span> : null}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setAskOpen(true)}>
              <MessageCircleQuestion /> Ask
            </Button>
            <Button variant="outline" onClick={() => {
                const at = Math.floor(player.currentTime());
                setClipDraft({ start: at, end: Math.min(meeting.durationSec, at + 30), title: `Clip from ${meeting.title}` });
              }}>
              <Scissors /> Clip
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem
                  onSelect={() => {
                    void navigator.clipboard?.writeText(`${window.location.origin}/meetings/${meeting.id}`);
                    toast.success("Meeting link copied");
                  }}
                >
                  <Link2 /> Copy meeting link
                </MenuItem>
                <MenuItem onSelect={() => downloadTranscript(meeting)}>
                  <Download /> Download transcript
                </MenuItem>
                <MenuItem onSelect={() => setRenameOpen(true)}>
                  <Pencil /> Rename
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  className="text-danger data-[highlighted]:text-danger"
                  onSelect={async () => {
                    if (!window.confirm(`Delete “${meeting.title}”? Its transcript, notes, highlights, and clips are removed.`)) return;
                    try {
                      await deleteMeeting(meeting.id);
                      toast.success("Meeting deleted");
                      router.push("/library");
                    } catch {
                      toast.error("Couldn't delete the meeting");
                    }
                  }}
                >
                  <Trash2 /> Delete meeting
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </header>

        <div className="mt-4 lg:hidden">
          <Segmented
            label="View"
            value={tab}
            onChange={setTab}
            options={[
              { value: "notes", label: "Notes" },
              { value: "transcript", label: "Transcript", count: meeting.transcript.length },
            ]}
          />
        </div>

        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] xl:gap-14">
          <Notes meeting={meeting} className={cn("pb-72 lg:pb-64", tab !== "notes" && "max-lg:hidden")} />
          <aside className={cn("lg:sticky lg:top-[72px] lg:self-start", tab !== "transcript" && "max-lg:hidden")}>
            <div className="flex items-baseline justify-between pb-2">
              <Eyebrow as="h2" className="text-ink">
                Transcript
              </Eyebrow>
              <span className="text-[11.5px] text-faint">
                <kbd className="font-mono">H</kbd> highlight · <kbd className="font-mono">Space</kbd> play
              </span>
            </div>
            <Transcript
              meeting={meeting}
              highlights={meeting.highlights}
              initialQuery={initialQuery}
              onHighlight={(e) => void highlightEntry(e)}
              onClip={clipFrom}
              className="h-[calc(100dvh-72px-var(--deck-h,210px)-3rem)] min-h-[420px]"
            />
          </aside>
        </div>
      </div>

      <TapeDeck meeting={meeting} highlights={meeting.highlights} onHighlightNow={highlightNow} />

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <SheetContent title="Ask this meeting" description="Answers cite the transcript. Click a source to jump there.">
          <AskThread
            compact
            meetingId={meeting.id}
            suggestions={meeting.suggestedQuestions}
            onSource={(s) => {
              player.seek(s.start, { play: true });
              setTab("transcript");
              setAskOpen(false);
            }}
          />
        </SheetContent>
      </Dialog>
      <ClipDialog key={clipDraft ? `${clipDraft.start}-${clipDraft.end}` : "closed"} meeting={meeting} draft={clipDraft} onOpenChange={(o) => !o && setClipDraft(null)} />
      {renameOpen ? <RenameDialog meeting={meeting} open={renameOpen} onOpenChange={setRenameOpen} /> : null}
    </>
  );
}

export function MeetingView({ id, initialTime, initialQuery }: { id: string; initialTime?: number; initialQuery?: string }) {
  const { data: meeting } = useMeeting(id);
  if (!meeting) return null;
  if (meeting.status === "processing") return <Processing meeting={meeting} />;
  return (
    <PlayerProvider key={meeting.id} duration={meeting.durationSec} src={meeting.recording.url} initialTime={initialTime}>
      <Workspace meeting={meeting} initialQuery={initialQuery} />
    </PlayerProvider>
  );
}
