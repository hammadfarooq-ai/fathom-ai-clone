import { getPerson } from "@/data/people";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const sizes = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-[11px]",
  lg: "size-10 text-sm",
  xl: "size-16 text-lg",
};

export function Avatar({
  personId,
  size = "sm",
  className,
  ring = false,
}: {
  personId: string;
  size?: keyof typeof sizes;
  className?: string;
  ring?: boolean;
}) {
  const p = getPerson(personId);
  return (
    <span
      title={p.name}
      aria-label={p.name}
      role="img"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold text-white select-none",
        ring && "ring-2 ring-surface",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: p.color }}
    >
      {initials(p.name)}
    </span>
  );
}

export function AvatarStack({
  ids,
  max = 4,
  size = "sm",
  className,
}: {
  ids: string[];
  max?: number;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const shown = ids.slice(0, max);
  const rest = ids.length - shown.length;
  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {shown.map((id) => (
        <Avatar key={id} personId={id} size={size} ring />
      ))}
      {rest > 0 ? (
        <span
          className={cn(
            "inline-grid shrink-0 place-items-center rounded-full bg-subtle font-semibold text-muted ring-2 ring-surface",
            sizes[size],
          )}
          aria-label={`${rest} more participants`}
        >
          +{rest}
        </span>
      ) : null}
    </div>
  );
}
