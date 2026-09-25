"use client";

import { Loader2, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { PersonName } from "@/components/people";
import { Empty, Eyebrow, MarkedText } from "@/components/ui/primitives";
import { MATCH_LABELS, useSearch, type MatchType } from "@/lib/api";
import { formatRelativeDay, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

const SUGGESTIONS = ["pricing", "SSO", "October launch", "discount", "Helix", "BAA", "SCIM"];

export function SearchView({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initialQuery);
  const deferred = useDeferredValue(q.trim());
  const { data, isValidating } = useSearch(deferred);
  const [type, setType] = useState<MatchType | "all">("all");

  useEffect(() => {
    router.replace(deferred ? `${pathname}?q=${encodeURIComponent(deferred)}` : pathname, { scroll: false });
  }, [deferred, pathname, router]);

  const counts = useMemo(() => {
    const c = new Map<MatchType, number>();
    for (const r of data?.results ?? []) for (const m of r.matches) c.set(m.type, (c.get(m.type) ?? 0) + 1);
    return c;
  }, [data]);

  const results = (data?.results ?? [])
    .map((r) => ({ ...r, matches: type === "all" ? r.matches : r.matches.filter((m) => m.type === type) }))
    .filter((r) => r.matches.length > 0);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 sm:pt-12">
      <Eyebrow>Search</Eyebrow>
      <div className="mt-3 flex items-center gap-3 border-b border-ink pb-3">
        {isValidating && deferred ? <Loader2 className="size-6 animate-spin text-faint" /> : <Search className="size-6 text-faint" />}
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search every meeting"
          className="min-w-0 flex-1 bg-transparent font-display text-[34px] leading-tight text-ink outline-none placeholder:text-faint sm:text-[44px]"
          aria-label="Search every meeting"
        />
      </div>

      {!deferred ? (
        <div className="mt-6">
          <p className="eyebrow">Try</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => setQ(s)} className="rounded-full border border-rule px-3 py-1 text-[13px] text-ink-2 hover:border-ink hover:text-ink">
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {(["all", ...([...counts.keys()] as MatchType[])] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn("h-7 shrink-0 rounded-full border px-3 text-[12.5px]", type === t ? "border-ink bg-ink text-paper" : "border-rule text-ink-2 hover:border-ink")}
              >
                {t === "all" ? `All · ${data?.results.length ?? 0} meetings` : `${MATCH_LABELS[t]} · ${counts.get(t)}`}
              </button>
            ))}
          </div>
          {data && results.length === 0 ? (
            <Empty title="No matches">
              Nothing in the titles, notes, or transcripts mentions “{deferred}”.{" "}
              <Link className="underline" href={`/ask?q=${encodeURIComponent(deferred)}`}>
                Ask instead
              </Link>
              .
            </Empty>
          ) : (
            <ol className={cn("mt-4 divide-y divide-rule transition-opacity", isValidating && "opacity-70")}>
              {results.map((r) => (
                <li key={r.meetingId} className="py-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <Link href={`/meetings/${r.meetingId}?q=${encodeURIComponent(deferred)}`} className="font-display text-[24px] leading-tight text-ink hover:underline">
                      {r.title}
                    </Link>
                    <span className="shrink-0 text-[12px] text-muted">
                      {r.meetingType} · {formatRelativeDay(r.date)}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {r.matches.map((m, i) => (
                      <li key={i}>
                        <Link
                          href={m.start !== undefined ? `/meetings/${r.meetingId}?t=${m.start}&q=${encodeURIComponent(deferred)}` : `/meetings/${r.meetingId}`}
                          className="grid grid-cols-[92px_1fr] gap-3 rounded-md px-2 py-1.5 text-[14px] hover:bg-sunken"
                        >
                          <span className="pt-0.5 text-[11.5px] text-muted">
                            {MATCH_LABELS[m.type]}
                            {m.start !== undefined ? <span className="tabular block font-mono text-faint">{formatTimestamp(m.start)}</span> : null}
                          </span>
                          <span className="leading-relaxed text-ink-2">
                            {m.speakerId ? <PersonName id={m.speakerId} first className="mr-1.5" /> : null}
                            <MarkedText text={m.text} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
