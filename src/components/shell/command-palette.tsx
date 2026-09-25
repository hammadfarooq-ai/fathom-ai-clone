"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { ArrowRight, CornerDownLeft, FileText, Highlighter, Library, Loader2, MessageCircleQuestion, Mic, Quote, Search, Settings, Sunrise } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MarkedText } from "@/components/ui/primitives";
import { MATCH_LABELS, useSearch } from "@/lib/api";
import { formatRelativeDay, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  group: string;
  icon: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  run: () => void;
}

export function CommandPalette({ open, onOpenChange, onCapture }: { open: boolean; onOpenChange: (o: boolean) => void; onCapture: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q);
  const { data, isLoading } = useSearch(open ? deferred : "");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const rows = useMemo<Row[]>(() => {
    const query = q.trim();
    if (!query) {
      return [
        { id: "today", group: "Go to", icon: <Sunrise />, label: "Today", run: () => go("/") },
        { id: "library", group: "Go to", icon: <Library />, label: "Library", run: () => go("/library") },
        { id: "moments", group: "Go to", icon: <Highlighter />, label: "Moments", run: () => go("/moments") },
        { id: "ask", group: "Go to", icon: <MessageCircleQuestion />, label: "Ask your meetings", run: () => go("/ask") },
        { id: "settings", group: "Go to", icon: <Settings />, label: "Settings", run: () => go("/settings") },
        {
          id: "capture",
          group: "Actions",
          icon: <Mic />,
          label: "Capture a meeting or import a transcript",
          run: () => {
            onOpenChange(false);
            onCapture();
          },
        },
      ];
    }
    const out: Row[] = [
      {
        id: "ask-q",
        group: "Ask",
        icon: <MessageCircleQuestion />,
        label: (
          <>
            Ask: <span className="text-ink">“{query}”</span>
          </>
        ),
        hint: "Answer with sources",
        run: () => go(`/ask?q=${encodeURIComponent(query)}`),
      },
    ];
    for (const r of data?.results.slice(0, 6) ?? []) {
      const best = r.matches.find((m) => m.type === "transcript" || m.type === "highlight") ?? r.matches[0];
      const href = best?.start !== undefined ? `/meetings/${r.meetingId}?t=${best.start}&q=${encodeURIComponent(query)}` : `/meetings/${r.meetingId}?q=${encodeURIComponent(query)}`;
      out.push({
        id: `m-${r.meetingId}`,
        group: "Meetings",
        icon: best?.type === "transcript" ? <Quote /> : <FileText />,
        label: (
          <span className="block min-w-0">
            <span className="block truncate text-ink">{r.title}</span>
            {best && best.type !== "title" ? (
              <span className="block truncate text-[12px] text-muted">
                {MATCH_LABELS[best.type]}
                {best.start !== undefined ? ` · ${formatTimestamp(best.start)}` : ""} — <MarkedText text={best.text} />
              </span>
            ) : null}
          </span>
        ),
        hint: formatRelativeDay(r.date),
        run: () => go(href),
      });
    }
    out.push({
      id: "search-all",
      group: "Search",
      icon: <Search />,
      label: (
        <>
          All results for <span className="text-ink">“{query}”</span>
        </>
      ),
      run: () => go(`/search?q=${encodeURIComponent(query)}`),
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, data]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      rows[active]?.run();
    }
  };

  let lastGroup = "";
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[#0e0d0b]/40 data-[state=open]:animate-fade-in" />
        <RadixDialog.Content
          className="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-rule bg-card shadow-pop outline-none data-[state=open]:animate-rise"
          onKeyDown={onKeyDown}
        >
          <RadixDialog.Title className="sr-only">Search or ask</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">Search meetings and transcripts, ask a question, or jump to a page.</RadixDialog.Description>
          <div className="flex items-center gap-3 border-b border-rule px-4">
            {isLoading && q ? <Loader2 className="size-4 animate-spin text-faint" /> : <Search className="size-4 text-faint" />}
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              placeholder="Search meetings, transcripts, decisions… or ask a question"
              className="h-13 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
              aria-label="Search or ask"
              role="combobox"
              aria-expanded
              aria-controls="palette-list"
              aria-activedescendant={rows[active] ? `palette-${rows[active].id}` : undefined}
            />
          </div>
          <div ref={listRef} id="palette-list" role="listbox" className="scrollbar-thin max-h-[min(60vh,440px)] overflow-y-auto p-1.5">
            {rows.map((row, i) => {
              const header = row.group !== lastGroup ? row.group : null;
              lastGroup = row.group;
              return (
                <div key={row.id}>
                  {header ? <p className="eyebrow px-2.5 pt-2.5 pb-1">{header}</p> : null}
                  <button
                    id={`palette-${row.id}`}
                    role="option"
                    aria-selected={i === active}
                    data-index={i}
                    onMouseMove={() => setActive(i)}
                    onClick={row.run}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[13.5px] text-ink-2 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-faint",
                      i === active && "bg-sunken",
                    )}
                  >
                    {row.icon}
                    <span className="min-w-0 flex-1">{row.label}</span>
                    {row.hint ? <span className="shrink-0 text-[12px] text-faint">{row.hint}</span> : null}
                    {i === active ? <CornerDownLeft className="size-3.5 shrink-0 text-faint" /> : <ArrowRight className="size-3.5 shrink-0 text-transparent" />}
                  </button>
                </div>
              );
            })}
            {q.trim() && data && data.results.length === 0 ? <p className="px-3 py-3 text-[13px] text-muted">No meetings match “{q.trim()}”. Try asking instead.</p> : null}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
