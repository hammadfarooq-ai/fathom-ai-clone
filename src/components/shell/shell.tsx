"use client";

import { Highlighter, Library, LogOut, MessageCircleQuestion, Moon, RotateCcw, Search, Settings, Sun, Sunrise } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Avatar, usePerson } from "@/components/people";
import { Kbd } from "@/components/ui/primitives";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { resetWorkspace } from "@/lib/api";
import { CURRENT_USER_ID } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CaptureDialog } from "./capture-dialog";
import { CommandPalette } from "./command-palette";
import { Logo } from "./logo";
import { ShellContext } from "./shell-context";

const NAV = [
  { href: "/", label: "Today", icon: Sunrise },
  { href: "/library", label: "Library", icon: Library },
  { href: "/moments", label: "Moments", icon: Highlighter },
  { href: "/ask", label: "Ask", icon: MessageCircleQuestion },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/library") return pathname.startsWith("/library") || pathname.startsWith("/meetings");
  return pathname.startsWith(href);
}

function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const current = root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    document.cookie = `parley-theme=${next}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <button onClick={toggle} className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink" aria-label="Toggle dark mode">
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}

function UserMenu() {
  const me = usePerson(CURRENT_USER_ID);
  const router = useRouter();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="rounded-full" aria-label="Account menu">
          <Avatar personId={me.id} size="md" title={false} />
        </button>
      </MenuTrigger>
      <MenuContent className="w-60">
        <MenuLabel>
          <span className="block text-[13px] font-medium tracking-normal text-ink normal-case">{me.name}</span>
          <span className="block font-normal tracking-normal normal-case">{me.email}</span>
        </MenuLabel>
        <MenuSeparator />
        <MenuItem onSelect={() => router.push("/settings")}>
          <Settings /> Settings
        </MenuItem>
        <MenuItem
          onSelect={async () => {
            const id = toast.loading("Resetting the demo workspace…");
            try {
              await resetWorkspace();
              toast.success("Workspace reset", { id, description: "Meetings, notes, and calendar were reloaded for today." });
              router.refresh();
            } catch {
              toast.error("Couldn't reset the workspace", { id });
            }
          }}
        >
          <RotateCcw /> Reset demo workspace
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => toast("There's no sign-in in this demo, so there's nothing to sign out of.")}>
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openCapture = useCallback(() => setCaptureOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ShellContext.Provider value={{ openPalette, openCapture }}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Parley, today" className="mr-2 shrink-0">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden h-full items-stretch gap-1 md:flex">
            {NAV.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center px-3 text-[13.5px] font-medium transition-colors",
                    active ? "text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-[2px] after:bg-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={openPalette}
              className="hidden h-9 w-64 items-center gap-2 rounded-md border border-rule bg-card px-3 text-left text-[13px] text-faint transition-colors hover:border-rule-strong lg:flex"
            >
              <Search className="size-4" />
              <span className="flex-1">Search or ask…</span>
              <Kbd>⌘K</Kbd>
            </button>
            <button onClick={openPalette} className="grid size-9 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink lg:hidden" aria-label="Search">
              <Search className="size-4" />
            </button>
            <button
              onClick={openCapture}
              className="flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-[13.5px] font-medium text-accent-ink transition-colors hover:bg-accent-hover"
            >
              <span className="size-2 rounded-full bg-accent-ink" aria-hidden />
              <span className="hidden sm:inline">Capture</span>
              <span className="sr-only sm:hidden">Capture a meeting</span>
            </button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main id="main" className="pb-24 md:pb-10">
        {children}
      </main>

      {/* Phone navigation */}
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/95 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-4">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-ink" : "text-faint")}
              >
                <Icon className="size-[18px]" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Remounted per open so the query starts empty. */}
      <CommandPalette key={paletteOpen ? "open" : "closed"} open={paletteOpen} onOpenChange={setPaletteOpen} onCapture={openCapture} />
      <CaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />
    </ShellContext.Provider>
  );
}
