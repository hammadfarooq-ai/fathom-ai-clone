"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import {
  CalendarCheck2,
  Highlighter,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CURRENT_USER_ID, getPerson } from "@/data/people";
import { resetWorkspace } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "../ui/menu";
import { Kbd } from "../ui/primitives";
import { CommandPalette } from "./command-palette";
import { Logo } from "./logo";
import { NewMeetingDialog } from "./new-meeting-dialog";
import { ShellContext } from "./shell-context";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: "/highlights", label: "Highlights", icon: Highlighter },
  { href: "/search", label: "Search", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors",
              active ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-ink-2 hover:bg-line/50 hover:text-ink",
            )}
          >
            <Icon className={cn("size-4", active ? "text-brand-600" : "text-faint group-hover:text-muted")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const me = getPerson(CURRENT_USER_ID);
  const router = useRouter();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-line/50">
          <Avatar personId={me.id} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-ink">{me.name}</span>
            <span className="block truncate text-xs text-muted">{me.role}</span>
          </span>
        </button>
      </MenuTrigger>
      <MenuContent align="start" side="top" className="w-56">
        <MenuLabel>{me.email}</MenuLabel>
        <MenuItem onSelect={() => router.push("/settings")}>
          <Settings /> Settings
        </MenuItem>
        <MenuItem
          onSelect={() => {
            resetWorkspace();
            toast.success("Demo workspace reset", { description: "Highlights, clips, and imports were cleared." });
          }}
        >
          <RotateCcw /> Reset demo data
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => toast("Signed-out state isn't part of this demo workspace.")}>
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-5 px-3 py-4">
      <div className="flex items-center justify-between px-1.5">
        <Link href="/" onClick={onNavigate} aria-label="Parley home">
          <Logo />
        </Link>
      </div>
      <NavLinks onNavigate={onNavigate} />
      <div className="mt-auto flex flex-col gap-3">
        <Link
          href="/settings#calendar"
          onClick={onNavigate}
          className="flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3 text-xs shadow-card transition-colors hover:border-line-strong"
        >
          <CalendarCheck2 className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
          <span>
            <span className="block font-medium text-ink">Calendar connected</span>
            <span className="text-muted">Auto-recording upcoming meetings</span>
          </span>
        </Link>
        <UserMenu />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openPalette = useCallback((query = "") => {
    setPaletteQuery(query);
    setPaletteOpen(true);
  }, []);
  const openNewMeeting = useCallback(() => setNewOpen(true), []);
  const api = useMemo(() => ({ openPalette, openNewMeeting }), [openPalette, openNewMeeting]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteQuery("");
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ShellContext.Provider value={api}>
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-3 py-2 text-sm font-medium shadow-pop focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-canvas lg:block">
        <SidebarBody />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line bg-canvas/90 px-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}>
            <MenuIcon />
          </Button>
          <Link href="/" aria-label="Parley home">
            <Logo />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Search" onClick={() => openPalette()}>
            <Search />
          </Button>
          <Button variant="primary" size="icon-sm" aria-label="New meeting" onClick={openNewMeeting}>
            <Plus />
          </Button>
        </div>
      </header>

      <RadixDialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink/30 data-[state=open]:animate-fade-in lg:hidden" />
          <RadixDialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-line bg-canvas shadow-pop outline-none data-[state=open]:animate-fade-in lg:hidden">
            <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
            <RadixDialog.Description className="sr-only">Main navigation</RadixDialog.Description>
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close navigation" className="absolute top-3.5 right-3">
                <X />
              </Button>
            </RadixDialog.Close>
            <SidebarBody onNavigate={() => setDrawerOpen(false)} />
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      <div className="lg:pl-60">
        {/* Desktop top bar */}
        <div className="sticky top-0 z-20 hidden h-14 items-center justify-between gap-4 border-b border-line bg-canvas/85 px-8 backdrop-blur lg:flex">
          <button
            onClick={() => openPalette()}
            className="flex h-9 w-full max-w-md cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] text-faint shadow-card transition-colors hover:border-line-strong"
          >
            <Search className="size-4" aria-hidden />
            <span className="flex-1 text-left">Search meetings, transcripts, action items…</span>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </button>
          <Button variant="primary" onClick={openNewMeeting}>
            <Plus /> New meeting
          </Button>
        </div>
        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} initialQuery={paletteQuery} />
      <NewMeetingDialog open={newOpen} onOpenChange={setNewOpen} />
    </ShellContext.Provider>
  );
}
