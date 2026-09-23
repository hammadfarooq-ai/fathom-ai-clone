"use client";

import { Check, FileAudio, Info, Link2, Loader2, Presentation, Upload, Users, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sampleRecordings } from "@/data";
import { formatDuration, nowAsWallClockIso } from "@/lib/format";
import { PROCESSING_STEPS, processingStep, startImport, useImport } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import type { Platform } from "@/types";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { Input } from "../ui/primitives";

const SOURCES: { id: Platform; label: string; description: string; icon: typeof Video }[] = [
  { id: "zoom", label: "Zoom", description: "Send the notetaker to a live call", icon: Video },
  { id: "google-meet", label: "Google Meet", description: "Join with a meeting link", icon: Users },
  { id: "teams", label: "Microsoft Teams", description: "Join with a meeting link", icon: Presentation },
  { id: "upload", label: "Upload recording", description: "MP4, M4A, MP3, or WAV", icon: Upload },
];

const LINK_PLACEHOLDER: Record<Platform, string> = {
  zoom: "https://zoom.us/j/81234567890",
  "google-meet": "https://meet.google.com/abc-defg-hij",
  teams: "https://teams.microsoft.com/l/meetup-join/…",
  upload: "",
};

export function ProcessingSteps({ importId }: { importId: string }) {
  const imp = useImport(importId);
  const now = useNow(200, Boolean(imp));
  if (!imp) return null;
  const current = now === 0 ? 0 : processingStep(imp, now);
  const pct = now === 0 ? 0 : Math.min(100, Math.round(((now - imp.startedAt) / (imp.readyAt - imp.startedAt)) * 100));
  return (
    <div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Processing progress">
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      <ol className="space-y-3" aria-live="polite">
        {PROCESSING_STEPS.map((step, i) => {
          const done = i < current || (i === current && step.id === "ready");
          const active = i === current && step.id !== "ready";
          return (
            <li key={step.id} className="flex items-center gap-3">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs transition-colors",
                  done && "border-brand-600 bg-brand-600 text-white",
                  active && "border-brand-300 bg-brand-50 text-brand-700",
                  !done && !active && "border-line text-faint",
                )}
              >
                {done ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : i + 1}
              </span>
              <div>
                <p className={cn("text-[13px] font-medium", done || active ? "text-ink" : "text-faint")}>{step.label}</p>
                <p className="text-xs text-muted">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ImportFlow({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"source" | "details" | "processing">("source");
  const [platform, setPlatform] = useState<Platform>("zoom");
  const [link, setLink] = useState("");
  const [fileName, setFileName] = useState("");
  const [sampleId, setSampleId] = useState(sampleRecordings[0].id);
  const sample = sampleRecordings.find((s) => s.id === sampleId)!;
  const [title, setTitle] = useState(sample.title);
  const [importId, setImportId] = useState<string | null>(null);
  const imp = useImport(importId ?? "");
  const now = useNow(250, Boolean(imp));
  const ready = imp ? now >= imp.readyAt : false;

  const canStart = platform === "upload" ? fileName.length > 0 : link.trim().length > 0;

  if (step === "source") {
    return (
      <div className="p-5">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setPlatform(s.id);
                setStep("details");
              }}
              className="group flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5 text-left transition-all hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-subtle text-ink-2 transition-colors group-hover:bg-brand-100 group-hover:text-brand-700">
                <s.icon className="size-4" />
              </span>
              <span>
                <span className="block text-[13px] font-semibold text-ink">{s.label}</span>
                <span className="block text-xs text-muted">{s.description}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-subtle px-3 py-2.5 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Demo mode: meeting capture is simulated. A sample recording is processed through the same pipeline a real
          bot or upload would use.
        </p>
      </div>
    );
  }

  if (step === "details") {
    return (
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canStart) return;
          const created = startImport({ baseId: sample.id, title: title.trim() || sample.title, platform, date: nowAsWallClockIso() });
          setImportId(created.id);
          setStep("processing");
        }}
      >
        {platform === "upload" ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-subtle/60 px-4 py-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40">
            <FileAudio className="size-6 text-muted" />
            <span className="text-[13px] font-medium text-ink">{fileName || "Choose a recording"}</span>
            <span className="text-xs text-muted">The file stays on your device in demo mode.</span>
            <input
              type="file"
              accept="audio/*,video/*"
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
          </label>
        ) : (
          <div>
            <label htmlFor="meeting-link" className="mb-1.5 block text-[13px] font-medium text-ink">
              Meeting link
            </label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <Input id="meeting-link" autoFocus value={link} onChange={(e) => setLink(e.target.value)} placeholder={LINK_PLACEHOLDER[platform]} className="pl-9" />
            </div>
          </div>
        )}
        <div>
          <label htmlFor="meeting-title" className="mb-1.5 block text-[13px] font-medium text-ink">
            Meeting title
          </label>
          <Input id="meeting-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink">Sample recording</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {sampleRecordings.map((s) => (
              <label
                key={s.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors",
                  sampleId === s.id ? "border-brand-400 bg-brand-50/50" : "border-line hover:border-line-strong",
                )}
              >
                <input
                  type="radio"
                  name="sample"
                  value={s.id}
                  checked={sampleId === s.id}
                  onChange={() => {
                    setSampleId(s.id);
                    setTitle(s.title);
                  }}
                  className="mt-0.5 accent-brand-600"
                />
                <span>
                  <span className="block text-[13px] font-medium text-ink">{s.title}</span>
                  <span className="text-xs text-muted">
                    {formatDuration(s.durationSec)} · {s.participants.length} speakers
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-between gap-2 pt-1">
          <Button variant="ghost" onClick={() => setStep("source")}>
            Back
          </Button>
          <Button type="submit" variant="primary" disabled={!canStart}>
            {platform === "upload" ? "Upload & process" : "Start recording"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="p-5">
      <p className="mb-4 text-[13px] text-muted">
        <span className="font-medium text-ink">{imp?.title}</span>{" "}
        {ready ? "is ready." : "is being processed. You can close this window — it will keep going in the background."}
      </p>
      {importId ? <ProcessingSteps importId={importId} /> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {ready ? "Close" : "Continue in background"}
        </Button>
        <Button
          variant="primary"
          disabled={!ready}
          onClick={() => {
            onClose();
            router.push(`/meetings/${importId}`);
          }}
        >
          Open meeting
        </Button>
      </div>
    </div>
  );
}

export function NewMeetingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New meeting" description="Record a live call or import a recording." className="max-w-xl">
        {open ? <ImportFlow onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
