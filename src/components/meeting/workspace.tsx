"use client";

import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Copy,
  Download,
  FileText,
  Highlighter,
  ListChecks,
  MoreHorizontal,
  Scissors,
  Share2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getPerson } from "@/data/people";
import { formatDuration, formatLongDate, formatTime, formatTimestamp } from "@/lib/format";
import { addHighlight, meetingFromImport, removeHighlight, restoreHighlight, useActionOverrides, useHighlights, useImport, useTemplate } from "@/lib/store";
import { buildSummary, summaryToText } from "@/lib/templates";
import { useMediaQuery } from "@/lib/use-media-query";
import { useNow } from "@/lib/use-now";
import { cn, truncate } from "@/lib/utils";
import type { Meeting } from "@/types";
import { ProcessingSteps } from "../layout/new-meeting-dialog";
import { MeetingTypeBadge, PlatformLabel } from "../meeting-meta";
import { PlayerProvider, usePlayer, usePlayerTime } from "../player/player-context";
import { Avatar, AvatarStack } from "../ui/avatar";
import { Button } from "../ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "../ui/menu";
import { Card, Kbd } from "../ui/primitives";
import { AskPanel } from "./ask-panel";
import { ClipDialog } from "./clip-dialog";
import { MeetingContext, useMeeting, type WorkspaceTab } from "./meeting-context";
import { activeEntryIndex, MeetingPlayer } from "./player";
import { ShareDialog } from "./share-dialog";
import { ActionItemsPanel, HighlightsPanel } from "./side-panels";
import { SummaryPanel } from "./summary-panel";
import { TranscriptPanel } from "./transcript";

function downloadTranscript(meeting: Meeting) {
  const lines = [
    meeting.title,
    `${formatLongDate(meeting.date)} · ${formatDuration(meeting.durationSec)}`,
    "",
    ...meeting.transcript.map((e) => `[${formatTimestamp(e.start)}] ${getPerson(e.speakerId).name}: ${e.text}`),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${meeting.id}-transcript.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function Header({ onShare }: { onShare: () => void }) {
  const { meeting, openClip } = useMeeting();
  const time = usePlayerTime();
  const onClip = () => openClip(defaultClipRange(meeting, time));
  const overrides = useActionOverrides();
  const template = useTemplate(meeting);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryToText(meeting, buildSummary(meeting, template)));
      toast.success("Summary copied to clipboard");
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };
  const openCount = meeting.actionItems.filter((a) => !(overrides[a.id] ?? a.completed)).length;

  return (
    <header className="mb-5">
      <Link href="/meetings" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink">
        <ArrowLeft className="size-4" /> Meetings
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <MeetingTypeBadge type={meeting.meetingType} />
            <span className="text-xs text-muted">{openCount} open action items</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{meeting.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-faint" />
              {formatLongDate(meeting.date)} · {formatTime(meeting.date)}
            </span>
            <span className="inline-flex items-center gap-1.5 tabular">
              <Clock className="size-3.5 text-faint" />
              {formatDuration(meeting.durationSec)}
            </span>
            <PlatformLabel platform={meeting.recording.platform} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Menu>
            <MenuTrigger asChild>
              <button className="flex cursor-pointer items-center rounded-full py-0.5 pr-2.5 pl-0.5 transition-colors hover:bg-subtle" aria-label="Participants">
                <AvatarStack ids={meeting.participants} max={4} size="md" />
                <span className="ml-2 text-xs font-medium text-muted">{meeting.participants.length}</span>
              </button>
            </MenuTrigger>
            <MenuContent className="w-72">
              <MenuLabel>Participants</MenuLabel>
              {meeting.participants.map((id) => {
                const p = getPerson(id);
                return (
                  <div key={id} className="flex items-center gap-2.5 px-2.5 py-1.5">
                    <Avatar personId={id} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {p.name} {id === meeting.hostId ? <span className="text-[11px] font-normal text-faint">· Host</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {p.role}
                        {p.external ? ` · ${p.company}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </MenuContent>
          </Menu>
          <Button onClick={onClip} className="hidden sm:inline-flex">
            <Scissors /> Clip
          </Button>
          <Button variant="primary" onClick={onShare}>
            <Share2 /> Share
          </Button>
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent className="w-56">
              <MenuItem onSelect={onClip} className="sm:hidden">
                <Scissors /> Create clip
              </MenuItem>
              <MenuItem onSelect={copySummary}>
                <Copy /> Copy summary
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  downloadTranscript(meeting);
                  toast.success("Transcript downloaded");
                }}
              >
                <Download /> Download transcript
              </MenuItem>
              <MenuItem
                onSelect={async () => {
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}/meetings/${meeting.id}`);
                    toast.success("Meeting link copied");
                  } catch {
                    toast.error("Couldn't access the clipboard");
                  }
                }}
              >
                <FileText /> Copy meeting link
              </MenuItem>
              <MenuSeparator />
              <MenuLabel>Shortcuts</MenuLabel>
              <div className="space-y-1 px-2.5 pb-1.5 text-xs text-muted">
                <p className="flex items-center justify-between">
                  Play / pause <Kbd>Space</Kbd>
                </p>
                <p className="flex items-center justify-between">
                  Back / forward 5s
                  <span className="flex gap-1">
                    <Kbd>←</Kbd>
                    <Kbd>→</Kbd>
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  Highlight current moment <Kbd>H</Kbd>
                </p>
              </div>
            </MenuContent>
          </Menu>
        </div>
      </div>
    </header>
  );
}

function KeyboardShortcuts() {
  const { toggle, skip } = usePlayer();
  const time = usePlayerTime();
  const { meeting, toggleHighlight } = useMeeting();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable], [role=slider], [role=dialog], [role=menu]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " " || e.key === "k") {
        if (target.closest("button, a") && e.key === " ") return;
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowLeft" || e.key === "j") {
        e.preventDefault();
        skip(e.key === "j" ? -10 : -5);
      } else if (e.key === "ArrowRight" || e.key === "l") {
        e.preventDefault();
        skip(e.key === "l" ? 10 : 5);
      } else if (e.key === "h") {
        const idx = activeEntryIndex(meeting.transcript, time);
        if (idx >= 0) toggleHighlight(meeting.transcript[idx].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, skip, time, meeting, toggleHighlight]);

  return null;
}

const TABS: { id: WorkspaceTab; label: string; icon: typeof Sparkles; mobileOnly?: boolean }[] = [
  { id: "summary", label: "Summary", icon: Sparkles },
  { id: "transcript", label: "Transcript", icon: FileText, mobileOnly: true },
  { id: "actions", label: "Action items", icon: ListChecks },
  { id: "highlights", label: "Highlights", icon: Highlighter },
  { id: "ask", label: "Ask AI", icon: Sparkles },
];

function Workspace({
  tab,
  setTab,
  initialQuery,
  focusEntryId,
}: {
  tab: WorkspaceTab;
  setTab: (tab: WorkspaceTab) => void;
  initialQuery?: string;
  focusEntryId?: string;
}) {
  const { meeting, highlights } = useMeeting();
  const overrides = useActionOverrides();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const activeTab = isDesktop && tab === "transcript" ? "summary" : tab;
  const openCount = meeting.actionItems.filter((a) => !(overrides[a.id] ?? a.completed)).length;

  const counts: Partial<Record<WorkspaceTab, number>> = { actions: openCount, highlights: highlights.length };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] xl:gap-6">
      <div className="min-w-0 space-y-5">
        <MeetingPlayer meeting={meeting} highlights={highlights} />
        <Card className="overflow-hidden">
          <div role="tablist" aria-label="Meeting sections" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-3 pt-2">
            {TABS.filter((t) => !(t.mobileOnly && isDesktop)).map((t) => {
              const selected = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative flex shrink-0 cursor-pointer items-center gap-1.5 px-2.5 pt-1.5 pb-2.5 text-[13px] font-medium transition-colors",
                    selected ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  <t.icon className={cn("size-3.5", selected ? "text-brand-600" : "text-faint")} />
                  {t.label}
                  {counts[t.id] ? <span className="rounded-full bg-subtle px-1.5 text-[11px] text-muted tabular">{counts[t.id]}</span> : null}
                  {selected ? <span className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-brand-600" /> : null}
                </button>
              );
            })}
          </div>
          <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
            {activeTab === "summary" ? <SummaryPanel /> : null}
            {activeTab === "actions" ? <ActionItemsPanel /> : null}
            {activeTab === "highlights" ? <HighlightsPanel /> : null}
            {activeTab === "ask" ? <AskPanel /> : null}
            {activeTab === "transcript" ? <TranscriptPanel initialQuery={initialQuery} focusEntryId={focusEntryId} className="h-[70vh] rounded-none border-0 shadow-none" /> : null}
          </div>
        </Card>
      </div>
      {isDesktop ? (
        <div className="min-w-0">
          <TranscriptPanel initialQuery={initialQuery} focusEntryId={focusEntryId} className="sticky top-20 h-[calc(100dvh-6.5rem)]" />
        </div>
      ) : null}
    </div>
  );
}

function ReadyWorkspace({ meeting, initialTime, initialQuery }: { meeting: Meeting; initialTime?: number; initialQuery?: string }) {
  const meetings = useMemo(() => [meeting], [meeting]);
  const highlights = useHighlights(meetings);
  const [clipRange, setClipRange] = useState<{ start: number; end: number; title?: string } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>("summary");

  const focusEntryId = useMemo(() => {
    if (initialTime === undefined) return undefined;
    const idx = activeEntryIndex(meeting.transcript, initialTime);
    return idx >= 0 ? meeting.transcript[idx].id : undefined;
  }, [initialTime, meeting]);

  const toggleHighlight = useCallback(
    (entryId: string) => {
      const existing = highlights.find((h) => h.transcriptEntryId === entryId);
      if (existing) {
        removeHighlight(existing.id);
        toast("Highlight removed", { action: { label: "Undo", onClick: () => restoreHighlight(existing) } });
        return;
      }
      const idx = meeting.transcript.findIndex((e) => e.id === entryId);
      const entry = meeting.transcript[idx];
      const words = entry.text.split(" ");
      const h = addHighlight({
        meetingId: meeting.id,
        start: entry.start,
        end: meeting.transcript[idx + 1]?.start ?? meeting.durationSec,
        title: words.length > 9 ? `${words.slice(0, 9).join(" ").replace(/[,.;:—-]+$/, "")}…` : entry.text,
        description: `${getPerson(entry.speakerId).name} · ${formatTimestamp(entry.start)}`,
        transcriptEntryId: entry.id,
      });
      toast.success("Added to highlights", {
        description: truncate(entry.text, 90),
        action: { label: "Undo", onClick: () => removeHighlight(h.id) },
      });
    },
    [highlights, meeting],
  );

  const ctx = useMemo(
    () => ({
      meeting,
      highlights,
      toggleHighlight,
      openClip: (range?: { start: number; end: number; title?: string }) => setClipRange(range ?? null),
      showTab: setTab,
    }),
    [meeting, highlights, toggleHighlight],
  );

  return (
    <MeetingContext.Provider value={ctx}>
      <PlayerProvider duration={meeting.durationSec} src={meeting.recording.url} initialTime={initialTime}>
        <Header onShare={() => setShareOpen(true)} />
        <Workspace tab={tab} setTab={setTab} initialQuery={initialQuery} focusEntryId={focusEntryId} />
        <KeyboardShortcuts />
        <ClipDialog meeting={meeting} range={clipRange} onOpenChange={(o) => !o && setClipRange(null)} />
        <ShareDialog meeting={meeting} open={shareOpen} onOpenChange={setShareOpen} onCreateClip={() => setClipRange(defaultClipRange(meeting, 0))} />
      </PlayerProvider>
    </MeetingContext.Provider>
  );
}

function defaultClipRange(meeting: Meeting, time: number) {
  const idx = Math.max(0, activeEntryIndex(meeting.transcript, time));
  const start = meeting.transcript[idx].start;
  const end = meeting.transcript[Math.min(meeting.transcript.length - 1, idx + 2)].start;
  return { start, end: end > start ? end : meeting.durationSec };
}

export function MeetingWorkspace({ meeting: base, initialTime, initialQuery }: { meeting: Meeting; initialTime?: number; initialQuery?: string }) {
  const imp = useImport(base.id);
  const now = useNow(250, Boolean(imp));
  const meeting = useMemo(() => (imp ? (meetingFromImport(imp) ?? base) : base), [imp, base]);

  if (imp && (now === 0 || now < imp.readyAt)) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <Link href="/meetings" className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Meetings
        </Link>
        <Card className="p-6">
          <p className="text-xs font-medium tracking-wide text-brand-700 uppercase">Processing</p>
          <h1 className="mt-1 text-lg font-semibold text-ink">{imp.title}</h1>
          <p className="mt-1 mb-5 text-[13px] text-muted">
            We&apos;re transcribing the recording and generating your summary, decisions, and action items. This page updates automatically.
          </p>
          <ProcessingSteps importId={imp.id} />
        </Card>
      </div>
    );
  }

  return <ReadyWorkspace key={meeting.id} meeting={meeting} initialTime={initialTime} initialQuery={initialQuery} />;
}

