"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

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
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <RadixDialog.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface shadow-pop outline-none data-[state=open]:animate-slide-up",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <RadixDialog.Title className="text-[15px] font-semibold tracking-tight text-ink">{title}</RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-0.5 text-[13px] text-muted">{description}</RadixDialog.Description>
            ) : (
              <RadixDialog.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</RadixDialog.Description>
            )}
          </div>
          {!hideClose ? (
            <RadixDialog.Close
              className="-mr-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink"
              aria-label="Close"
            >
              <X className="size-4" />
            </RadixDialog.Close>
          ) : null}
        </div>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
