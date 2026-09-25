"use client";

import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { initials } from "@/lib/format";
import { unknownPerson } from "@/lib/people";
import { cn } from "@/lib/utils";
import type { Person } from "@/types";

/**
 * People directory for the client. The workspace layout seeds it from the
 * database; it revalidates from /api/people so imported guests show up.
 * Standalone pages (public clips) can pass a fixed list instead.
 */

const DirectoryContext = createContext<Map<string, Person>>(new Map());

export function PeopleProvider({ people, live = true, children }: { people: Person[]; live?: boolean; children: ReactNode }) {
  const { data } = useSWR<Person[]>(live ? "/api/people" : null, (url: string) => api<Person[]>(url), { fallbackData: people });
  const map = useMemo(() => new Map((data ?? people).map((p) => [p.id, p])), [data, people]);
  return <DirectoryContext.Provider value={map}>{children}</DirectoryContext.Provider>;
}

export function usePerson(id: string): Person {
  return useContext(DirectoryContext).get(id) ?? unknownPerson(id);
}

export function useDirectory() {
  return useContext(DirectoryContext);
}

export function speakerStyle(color: string): CSSProperties {
  return { "--c": color } as CSSProperties;
}

const SIZE = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-[11.5px]",
  lg: "size-10 text-[13px]",
};

export function Avatar({ personId, size = "sm", className, title = true }: { personId: string; size?: keyof typeof SIZE; className?: string; title?: boolean }) {
  const p = usePerson(personId);
  return (
    <span
      style={speakerStyle(p.color)}
      title={title ? `${p.name}${p.role ? ` · ${p.role}` : ""}` : undefined}
      className={cn("speaker-bg inline-grid shrink-0 place-items-center rounded-full font-semibold tracking-tight text-white dark:text-[#141310]", SIZE[size], className)}
    >
      {initials(p.name)}
    </span>
  );
}

export function AvatarStack({ ids, max = 4, size = "sm" }: { ids: string[]; max?: number; size?: keyof typeof SIZE }) {
  const shown = ids.slice(0, max);
  const rest = ids.length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((id) => (
        <Avatar key={id} personId={id} size={size} className="ring-2 ring-card" />
      ))}
      {rest > 0 ? (
        <span className={cn("inline-grid place-items-center rounded-full bg-sunken font-medium text-muted ring-2 ring-card", SIZE[size])}>+{rest}</span>
      ) : null}
    </span>
  );
}

export function PersonName({ id, first, className }: { id: string; first?: boolean; className?: string }) {
  const p = usePerson(id);
  return (
    <span style={speakerStyle(p.color)} className={cn("speaker-color font-medium", className)}>
      {first ? p.name.split(" ")[0] : p.name}
    </span>
  );
}

/**
 * Talk-time strip: one bar split by who spoke, in speaker colours. Used in
 * lists so you can see the shape of a conversation at a glance.
 */
export function TalkStrip({ talk, className }: { talk: { personId: string; share: number }[]; className?: string }) {
  const dir = useDirectory();
  if (talk.length === 0) return <div className={cn("h-1.5 rounded-full bg-sunken", className)} />;
  return (
    <div
      className={cn("flex h-1.5 gap-px overflow-hidden rounded-full", className)}
      role="img"
      aria-label={`Talk time: ${talk.map((t) => `${(dir.get(t.personId) ?? unknownPerson(t.personId)).name.split(" ")[0]} ${Math.round(t.share * 100)}%`).join(", ")}`}
    >
      {talk.map((t) => (
        <span
          key={t.personId}
          className="speaker-bg h-full"
          style={{ ...speakerStyle((dir.get(t.personId) ?? unknownPerson(t.personId)).color), width: `${t.share * 100}%` }}
        />
      ))}
    </div>
  );
}
