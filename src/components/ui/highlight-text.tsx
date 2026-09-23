import { Fragment } from "react";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wraps occurrences of any of `terms` (prefix match, case-insensitive) in <mark>. */
export function HighlightText({ text, terms, className }: { text: string; terms: string[]; className?: string }) {
  const clean = terms.filter((t) => t.trim().length > 1);
  if (clean.length === 0) return <>{text}</>;
  const re = new RegExp(`(${clean.map((t) => `${escapeRegExp(t)}[\\w’'-]*`).join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className={className ?? "rounded-sm bg-mark-100 px-0.5 text-ink"}>
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
