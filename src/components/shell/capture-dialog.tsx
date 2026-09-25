"use client";

import { FileUp, Link2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button, Segmented } from "@/components/ui/primitives";
import { api, importTranscript, startCapture } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MeetingType, Platform } from "@/types";

const MEETING_TYPES: MeetingType[] = ["Product", "Sales", "Engineering", "Research", "1:1", "Interview", "Investor", "Onboarding", "Marketing"];

function detectPlatform(link: string): Platform | null {
  if (/zoom\.us\//i.test(link)) return "zoom";
  if (/meet\.google\.com\//i.test(link)) return "google-meet";
  if (/teams\.(microsoft|live)\.com\//i.test(link)) return "teams";
  return null;
}

const PLATFORM_NAME: Record<Platform, string> = { zoom: "Zoom", "google-meet": "Google Meet", teams: "Microsoft Teams", upload: "Upload" };

const SAMPLE_TRANSCRIPT = `[00:00] Hammad Farooq: Thanks for joining. We need to decide how to fix onboarding, because 42% of trials never invite a teammate.
[00:18] Priya Raman: The invite step is buried behind three settings screens. I think it belongs in the first-run checklist.
[00:41] Emily Novak: Support tickets say the same thing, and customers also find SSO setup scary on day one.
[01:02] Hammad Farooq: Okay, we decided to move invites into the checklist and defer SSO setup to day three.
[01:15] Priya Raman: I'll write the spec for the new checklist by Friday.
[01:24] Emily Novak: I'll pull the last 90 days of onboarding tickets and share them tomorrow.
[01:37] Hammad Farooq: The risk is the October 20 launch, so let's keep the scope tight.`;

interface Sample {
  id: string;
  title: string;
  durationSec: number;
  participants: number;
}

export function CaptureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"call" | "import">("call");
  const [busy, setBusy] = useState(false);

  // Join a call
  const [link, setLink] = useState("");
  const [callTitle, setCallTitle] = useState("");
  const { data: samples } = useSWR<Sample[]>(open ? "/api/samples" : null, (u: string) => api<Sample[]>(u));
  const [sampleId, setSampleId] = useState<string | null>(null);
  const platform = detectPlatform(link);
  const linkInvalid = link.trim().length > 0 && !platform;

  // Import
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MeetingType>("Product");
  const [transcript, setTranscript] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const done = (id: string) => {
    onOpenChange(false);
    setLink("");
    setCallTitle("");
    setTitle("");
    setTranscript("");
    setFileName(null);
    router.push(`/meetings/${id}`);
  };

  const submitCall = async () => {
    if (!platform) return;
    setBusy(true);
    try {
      const { id } = await startCapture({ sampleId: sampleId ?? samples?.[0]?.id ?? "", title: callTitle || undefined, platform });
      toast.success("Notetaker joined the call", { description: "Recording, then transcribing and writing notes." });
      done(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the capture");
    } finally {
      setBusy(false);
    }
  };

  const submitImport = async () => {
    setBusy(true);
    try {
      const { id } = await importTranscript({ title: title.trim(), meetingType: type, transcript });
      toast.success("Transcript imported", { description: "Writing notes now." });
      done(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't import the transcript");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("That file is over 2 MB. Paste the transcript text instead.");
      return;
    }
    setTranscript(await file.text());
    setFileName(file.name);
    if (!title) setTitle(file.name.replace(/\.(txt|vtt|srt|md)$/i, "").replace(/[-_]+/g, " "));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Capture a meeting" description="Send the notetaker to a live call, or bring a transcript you already have." className="max-w-xl">
        <div className="px-6">
          <Segmented
            label="Capture method"
            value={mode}
            onChange={setMode}
            options={[
              { value: "call", label: "Join a call" },
              { value: "import", label: "Import a transcript" },
            ]}
          />
        </div>

        {mode === "call" ? (
          <form
            className="space-y-4 px-6 pt-5 pb-6"
            onSubmit={(e) => {
              e.preventDefault();
              void submitCall();
            }}
          >
            <label className="block">
              <span className="eyebrow">Meeting link</span>
              <div className={cn("mt-1.5 flex h-10 items-center gap-2 rounded-md border bg-paper px-3", linkInvalid ? "border-danger" : "border-rule-strong focus-within:border-ink")}>
                <Link2 className="size-4 text-faint" />
                <input
                  autoFocus
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://zoom.us/j/… or meet.google.com/…"
                  className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
                  aria-invalid={linkInvalid}
                />
                {platform ? <span className="text-[12px] font-medium text-ok">{PLATFORM_NAME[platform]}</span> : null}
              </div>
              {linkInvalid ? <span className="mt-1 block text-[12px] text-danger">Paste a Zoom, Google Meet, or Teams link.</span> : null}
            </label>
            <label className="block">
              <span className="eyebrow">Title (optional)</span>
              <input
                value={callTitle}
                onChange={(e) => setCallTitle(e.target.value)}
                placeholder="Defaults to the calendar event name"
                className="mt-1.5 h-10 w-full rounded-md border border-rule-strong bg-paper px-3 text-[14px] outline-none placeholder:text-faint focus:border-ink"
              />
            </label>
            <fieldset>
              <legend className="eyebrow">Which call? (capture is simulated)</legend>
              <p className="mt-1 text-[12.5px] text-muted">
                A real bot needs Zoom/Meet/Teams approvals, so the notetaker “records” one of these sample calls. Everything after capture is real: rows in
                Postgres, the processing pipeline, notes, search, and Ask.
              </p>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {(samples ?? []).map((s) => {
                  const selected = (sampleId ?? samples?.[0]?.id) === s.id;
                  return (
                    <label
                      key={s.id}
                      className={cn("flex cursor-pointer flex-col rounded-md border p-3 text-[13px] transition-colors", selected ? "border-ink bg-paper" : "border-rule hover:border-rule-strong")}
                    >
                      <input type="radio" name="sample" className="sr-only" checked={selected} onChange={() => setSampleId(s.id)} />
                      <span className="font-medium text-ink">{s.title}</span>
                      <span className="text-[12px] text-muted">
                        {formatDuration(s.durationSec)} · {s.participants} people
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="flex justify-end pt-1">
              <Button type="submit" variant="accent" disabled={!platform || busy || !samples}>
                {busy ? <Loader2 className="animate-spin" /> : <span className="size-2 rounded-full bg-accent-ink" />}
                Send notetaker
              </Button>
            </div>
          </form>
        ) : (
          <form
            className="space-y-4 px-6 pt-5 pb-6"
            onSubmit={(e) => {
              e.preventDefault();
              void submitImport();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <label className="block">
                <span className="eyebrow">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Onboarding revamp sync"
                  className="mt-1.5 h-10 w-full rounded-md border border-rule-strong bg-paper px-3 text-[14px] outline-none placeholder:text-faint focus:border-ink"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Type</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as MeetingType)}
                  className="mt-1.5 h-10 w-full rounded-md border border-rule-strong bg-paper px-2.5 text-[14px] outline-none focus:border-ink"
                >
                  {MEETING_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="flex items-baseline justify-between">
                <span className="eyebrow">Transcript</span>
                <button type="button" className="text-[12px] text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => setTranscript(SAMPLE_TRANSCRIPT)}>
                  Use an example
                </button>
              </span>
              <textarea
                value={transcript}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  setFileName(null);
                }}
                required
                rows={8}
                placeholder={"[00:00] Name: what they said\n[00:12] Another Name: the reply\n\nWebVTT and SRT files work too."}
                className="scrollbar-thin mt-1.5 w-full resize-y rounded-md border border-rule-strong bg-paper px-3 py-2.5 font-mono text-[12.5px] leading-relaxed outline-none placeholder:text-faint focus:border-ink"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept=".txt,.vtt,.srt,.md,text/plain,text/vtt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                <Button type="button" size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
                  <FileUp /> {fileName ?? "Upload .txt, .vtt, or .srt"}
                </Button>
              </div>
              <Button type="submit" variant="primary" disabled={busy || !title.trim() || transcript.trim().length < 10}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                Import and write notes
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
