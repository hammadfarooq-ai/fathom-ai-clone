"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ className, align = "end", ...props }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-50 min-w-48 rounded-xl border border-line bg-surface p-1 shadow-pop data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

const itemClass =
  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-2 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-subtle data-[highlighted]:text-ink [&_svg]:size-4 [&_svg]:text-muted";

export function MenuItem({ className, ...props }: ComponentProps<typeof DropdownMenu.Item>) {
  return <DropdownMenu.Item className={cn(itemClass, className)} {...props} />;
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn("px-2.5 pt-1.5 pb-1 text-[11px] font-semibold text-faint uppercase", className)} {...props} />;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}

export function MenuRadioGroup(props: ComponentProps<typeof DropdownMenu.RadioGroup>) {
  return <DropdownMenu.RadioGroup {...props} />;
}

export function MenuRadioItem({
  children,
  description,
  className,
  ...props
}: ComponentProps<typeof DropdownMenu.RadioItem> & { description?: ReactNode }) {
  return (
    <DropdownMenu.RadioItem className={cn(itemClass, "relative items-start pr-8", className)} {...props}>
      <div className="min-w-0">
        <div className="font-medium text-ink">{children}</div>
        {description ? <div className="text-xs text-muted">{description}</div> : null}
      </div>
      <DropdownMenu.ItemIndicator className="absolute right-2.5 mt-0.5">
        <Check className="!text-brand-600" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}
