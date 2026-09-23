import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipView } from "@/components/clips/clip-view";
import { Logo } from "@/components/layout/logo";
import { buttonClass } from "@/components/ui/button";
import { getPerson } from "@/data/people";
import { clipTranscript, resolveClip } from "@/lib/clips";
import { formatDuration, formatLongDate, formatTimestamp } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/clips/[id]">): Promise<Metadata> {
  const { id } = await params;
  const resolved = resolveClip(id);
  if (!resolved) return { title: "Clip not found" };
  return {
    title: resolved.clip.title,
    description: `A ${formatDuration(resolved.clip.end - resolved.clip.start)} clip from ${resolved.meeting.title}, shared with Parley.`,
  };
}

export default async function ClipPage({ params }: PageProps<"/clips/[id]">) {
  const { id } = await params;
  const resolved = resolveClip(id);
  if (!resolved) notFound();
  const { clip, meeting } = resolved;
  const lines = clipTranscript(meeting, clip.start, clip.end);
  const speakers = [...new Set(lines.map((l) => l.speakerId))];

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" aria-label="Parley">
            <Logo />
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3.5" /> Read-only clip
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-xs font-medium tracking-wide text-brand-700 uppercase">Shared clip</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{clip.title}</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">
          From <span className="font-medium text-ink-2">{meeting.title}</span> · {formatLongDate(meeting.date)}
        </p>
        <p className="mt-1 text-[13px] text-muted tabular">
          {formatTimestamp(clip.start)} – {formatTimestamp(clip.end)} · {formatDuration(clip.end - clip.start)} ·{" "}
          {speakers.map((s) => getPerson(s).name).join(", ")}
        </p>
        <div className="mt-6">
          <ClipView clip={clip} meeting={meeting} lines={lines} />
        </div>
        <footer className="mt-10 flex flex-col items-center gap-3 border-t border-line pt-8 text-center">
          <p className="text-[13px] text-muted">
            Shared from <span className="font-semibold text-ink">Parley</span> — AI meeting notes that turn every conversation into
            searchable, actionable knowledge.
          </p>
          <Link href="/" className={buttonClass("secondary", "sm")}>
            Try Parley
          </Link>
        </footer>
      </main>
    </div>
  );
}
