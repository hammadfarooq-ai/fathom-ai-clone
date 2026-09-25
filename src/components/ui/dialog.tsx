"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

function Header({ title, description, hideClose }: { title: ReactNode; description?: ReactNode; hideClose?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
      <div className="min-w-0">
        <RadixDialog.Title className="font-display text-[26px] leading-tight text-ink">{title}</RadixDialog.Title>
        {description ? (
          <RadixDialog.Description className="mt-1 text-[13px] text-muted">{description}</RadixDialog.Description>
        ) : (
          <RadixDialog.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</RadixDialog.Description>
        )}
      </div>
      {!hideClose ? (
        <RadixDialog.Close className="-mr-2 grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink" aria-label="Close">
          <X className="size-4" />
        </RadixDialog.Close>
      ) : null}
    </div>
  );
}

/** Centered modal. */
export function DialogContent({
  title,
  description,
  children,
  className,
  hideClose,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  hideClose?: boolean;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[#0e0d0b]/40 data-[state=open]:animate-fade-in" />
      <RadixDialog.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-rule bg-card shadow-pop outline-none data-[state=open]:animate-rise",
          className,
        )}
      >
        <Header title={title} description={description} hideClose={hideClose} />
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

/** Right-hand sheet (full screen on phones). */
export function SheetContent({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[#0e0d0b]/30 data-[state=open]:animate-fade-in" />
      <RadixDialog.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-rule bg-card shadow-pop outline-none data-[state=open]:animate-fade-in",
          className,
        )}
      >
        <Header title={title} description={description} />
        <div className="min-h-0 flex-1">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
