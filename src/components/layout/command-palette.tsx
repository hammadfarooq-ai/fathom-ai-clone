"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { ArrowRight, CornerDownLeft, FileText, Search, Sparkles, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { formatRelativeDay, formatTimestamp } from "@/lib/format";
import { MATCH_LABELS, searchMeetings, SEARCH_SUGGESTIONS } from "@/lib/search";
import { useMeetings } from "@/lib/store";
import { highlightTerms } from "@/lib/text";
import { cn } from "@/lib/utils";
import { HighlightText } from "../ui/highlight-text";
import { Kbd } from "../ui/primitives";

interface PaletteItem {
  id: string;
  href: string;
  icon: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  group: string;
}

function PaletteBody({ initialQuery, onClose }: { initialQuery: string; onClose: () => void }) {
  const router = useRouter();
  const meetings = useMeetings();
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const deferred = useDeferredValue(query);
  const terms = useMemo(() => highlightTerms(deferred), [deferred]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = deferred.trim();
    if (!q) {
      return meetings.slice(0, 6).map((m) => ({
        id: m.id,
        href: `/meetings/${m.id}`,
        icon: <Video />,
        title: m.title,
        meta: formatRelativeDay(m.date),
        group: "Recent meetings",
      }));
    }
    const results = searchMeetings(meetings, q);
    const out: PaletteItem[] = [];
    for (const r of results.slice(0, 6)) {
      const best = r.matches[0];
      const href = best.start !== undefined ? `/meetings/${r.meeting.id}?t=${best.start}&q=${encodeURIComponent(q)}` : `/meetings/${r.meeting.id}`;
      out.push({
        id: `${r.meeting.id}-${best.type}-${best.start ?? 0}`,
        href,
        icon: best.type === "transcript" ? <FileText /> : <Video />,
        title: (
          <span className="block min-w-0">
            <span className="block truncate font-medium text-ink">{r.meeting.title}</span>
            <span className="block truncate text-xs text-muted">
              <span className="font-medium text-ink-2">{MATCH_LABELS[best.type]}</span>
              {best.start !== undefined ? ` · ${formatTimestamp(best.start)}` : ""} ·{" "}
              <HighlightText text={best.snippet} terms={terms} />
            </span>
          </span>
        ),
        meta: `${r.matches.length} match${r.matches.length === 1 ? "" : "es"}`,
        group: "Meetings",
      });
    }
    out.push({
      id: "all",
      href: `/search?q=${encodeURIComponent(q)}`,
      icon: <Search />,
      title: (
        <span>
          See all results for <span className="font-medium text-ink">“{q}”</span>
        </span>
      ),
      group: "Actions",
    });
    out.push({
      id: "ask",
      href: `/search?q=${encodeURIComponent(q)}&mode=ask`,
      icon: <Sparkles />,
      title: (
        <span>
          Ask across meetings: <span className="font-medium text-ink">“{q}”</span>
        </span>
      ),
      group: "Actions",
    });
    return out;
  }, [deferred, meetings, terms]);

  const go = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    router.push(item.href);
  };

  const groups = [...new Set(items.map((i) => i.group))];
  const activeIndex = Math.min(active, Math.max(0, items.length - 1));

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive((a) => Math.min(items.length - 1, a + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive((a) => Math.max(0, a - 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          go(items[activeIndex]);
        }
      }}
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search className="size-4 shrink-0 text-faint" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder="Search meetings, transcripts, decisions…"
          aria-label="Search"
          role="combobox"
          aria-expanded
          aria-controls="palette-results"
          aria-activedescendant={items[activeIndex] ? `palette-${items[activeIndex].id}` : undefined}
          className="h-13 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint focus-visible:outline-none"
        />
        <Kbd>Esc</Kbd>
      </div>

      <div id="palette-results" role="listbox" className="scrollbar-thin max-h-[min(60vh,440px)] overflow-y-auto p-2">
        {!query.trim() ? (
          <div className="flex flex-wrap gap-1.5 px-2 pt-1 pb-3">
            {SEARCH_SUGGESTIONS.slice(0, 6).map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="cursor-pointer rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-line-strong hover:bg-subtle"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {query.trim() && items.length <= 2 ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted">No meetings match “{query.trim()}”.</p>
        ) : null}
        {groups.map((group) => (
          <div key={group} className="mb-1">
            <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-faint uppercase">{group}</p>
            {items
              .filter((i) => i.group === group)
              .map((item) => {
                const index = items.indexOf(item);
                const isActive = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    id={`palette-${item.id}`}
                    role="option"
                    aria-selected={isActive}
                    onMouseMove={() => setActive(index)}
                    onClick={() => go(item)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-2 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-faint",
                      isActive && "bg-subtle text-ink",
                    )}
                  >
                    {item.icon}
                    <span className="min-w-0 flex-1">{item.title}</span>
                    {item.meta ? <span className="shrink-0 text-xs text-faint">{item.meta}</span> : null}
                    {isActive ? <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden /> : null}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
      <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-faint sm:flex">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navigate
        </span>
        <span className="flex items-center gap-1">
          <Kbd>
            <CornerDownLeft className="size-3" />
          </Kbd>
          open
        </span>
      </div>
    </div>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  initialQuery,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <RadixDialog.Content className="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop outline-none data-[state=open]:animate-slide-up">
          <RadixDialog.Title className="sr-only">Search</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">Search across all meetings</RadixDialog.Description>
          {open ? <PaletteBody initialQuery={initialQuery} onClose={() => onOpenChange(false)} /> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
