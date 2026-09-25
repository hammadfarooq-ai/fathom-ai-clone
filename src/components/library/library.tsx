"use client";

import { Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { PLATFORM_LABEL, ProcessingSteps } from "@/components/meeting-bits";
import { AvatarStack, TalkStrip } from "@/components/people";
import { useShell } from "@/components/shell/shell-context";
import { Empty, Eyebrow, Segmented, Tag } from "@/components/ui/primitives";
import { useMeetings } from "@/lib/api";
import { dateGroup, formatDuration, formatTime } from "@/lib/format";
import { cn, truncate } from "@/lib/utils";
import type { MeetingListItem, MeetingType } from "@/types";

const TYPES: MeetingType[] = ["Sales", "Product", "Engineering", "Research", "Investor", "1:1", "Interview", "Onboarding", "Marketing"];
const dayNum = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric" });
const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", weekday: "short" });

function Row({ m }: { m: MeetingListItem }) {
  const d = new Date(m.date);
  return (
    <li>
      <Link
        href={`/meetings/${m.id}`}
        className="group grid grid-cols-[52px_1fr] gap-x-4 gap-y-2 py-4 sm:grid-cols-[64px_minmax(0,1fr)_200px_72px] sm:items-center"
      >
        <div className="row-span-2 self-start sm:row-span-1 sm:self-center">
          <p className="tabular font-display text-[32px] leading-none text-ink">{dayNum.format(d)}</p>
          <p className="mt-1 text-[11px] tracking-wide text-muted uppercase">{monthDay.format(d)}</p>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15.5px] font-semibold text-ink group-hover:underline group-hover:underline-offset-4">{m.title}</h3>
            {m.source !== "seed" ? <Tag tone="accent">{m.source === "import" ? "Imported" : "Captured"}</Tag> : null}
          </div>
          {m.status === "processing" && m.processing ? (
            <ProcessingSteps state={m.processing} className="mt-1.5" />
          ) : (
            <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-2">{truncate(m.summary, 180)}</p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
            <span>{formatTime(m.date)}</span>
            <span>·</span>
            <span>{m.meetingType}</span>
            <span>·</span>
            <span>{PLATFORM_LABEL[m.platform]}</span>
            {m.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-faint">
                #{t}
              </span>
            ))}
          </p>
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-stretch sm:gap-2">
          <AvatarStack ids={m.participants} size="xs" max={5} />
          <TalkStrip talk={m.talkTime} className="w-28 sm:w-full" />
        </div>
        <div className="col-start-2 flex items-center gap-3 text-[12px] text-muted sm:col-start-auto sm:flex-col sm:items-end sm:gap-1">
          <span className="tabular">{formatDuration(m.durationSec)}</span>
          {m.openActions > 0 ? <span className="text-ink-2">{m.openActions} open</span> : m.totalActions > 0 ? <span className="text-ok">All done</span> : null}
        </div>
      </Link>
    </li>
  );
}

export function LibraryView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { openCapture } = useShell();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [scope, setScope] = useState<"all" | "external" | "internal">((params.get("scope") as "external" | "internal") ?? "all");
  const [type, setType] = useState<MeetingType | "">((params.get("type") as MeetingType) ?? "");
  const deferredQ = useDeferredValue(q.trim());
  const { data = [], isValidating } = useMeetings({ q: deferredQ, type: type || undefined, scope });

  // Keep the URL shareable.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (deferredQ) sp.set("q", deferredQ);
    if (scope !== "all") sp.set("scope", scope);
    if (type) sp.set("type", type);
    const next = `${pathname}${sp.size ? `?${sp}` : ""}`;
    router.replace(next, { scroll: false });
  }, [deferredQ, scope, type, pathname, router]);

  const groups = useMemo(() => {
    const map = new Map<string, MeetingListItem[]>();
    for (const m of data) map.set(dateGroup(m.date), [...(map.get(dateGroup(m.date)) ?? []), m]);
    return [...map.entries()];
  }, [data]);

  const hours = (data.reduce((a, m) => a + m.durationSec, 0) / 3600).toFixed(1);
  const filtered = Boolean(deferredQ || type || scope !== "all");

  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-8 sm:px-6 sm:pt-12">
      <header className="grid gap-6 border-b border-ink pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Eyebrow>Library</Eyebrow>
          <h1 className="mt-2 font-display text-[40px] leading-[1.02] tracking-tight text-ink sm:text-[52px]">Every meeting, on the record.</h1>
          <p className="mt-2 text-[14px] text-muted">
            {data.length} meeting{data.length === 1 ? "" : "s"} · {hours} hours{filtered ? " matching" : ""}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex h-9 items-center gap-2 rounded-md border border-rule-strong bg-card px-3 focus-within:border-ink sm:w-72">
            {isValidating && deferredQ ? <Loader2 className="size-4 animate-spin text-faint" /> : <Search className="size-4 text-faint" />}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by anything said…"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint"
              aria-label="Filter meetings"
            />
            {q ? (
              <button onClick={() => setQ("")} aria-label="Clear filter" className="text-faint hover:text-ink">
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <Segmented
            label="Who was there"
            value={scope}
            onChange={setScope}
            options={[
              { value: "all", label: "All" },
              { value: "external", label: "With customers" },
              { value: "internal", label: "Internal" },
            ]}
          />
        </div>
      </header>

      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-3 sm:mx-0 sm:flex-wrap sm:px-0">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(type === t ? "" : t)}
            aria-pressed={type === t}
            className={cn(
              "h-7 shrink-0 rounded-full border px-3 text-[12.5px] transition-colors",
              type === t ? "border-ink bg-ink text-paper" : "border-rule text-ink-2 hover:border-ink hover:text-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        filtered ? (
          <Empty title="Nothing matches">
            No meeting mentions that with these filters.{" "}
            <button
              className="underline"
              onClick={() => {
                setQ("");
                setType("");
                setScope("all");
              }}
            >
              Clear filters
            </button>
          </Empty>
        ) : (
          <Empty title="Your library is empty">
            <button className="underline" onClick={openCapture}>
              Capture a meeting
            </button>{" "}
            or import a transcript to get started.
          </Empty>
        )
      ) : (
        <div className={cn("transition-opacity", isValidating && "opacity-70")}>
          {groups.map(([label, list]) => (
            <section key={label} className="mt-6">
              <h2 className="eyebrow border-b border-rule pb-2">{label}</h2>
              <ul className="divide-y divide-rule">
                {list.map((m) => (
                  <Row key={m.id} m={m} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
