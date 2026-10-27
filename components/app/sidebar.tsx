"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MOBILE_TABS, NAV_GROUPS, isActive } from "./nav";

export interface NavBadges {
  followUps: number;
  triage: number;
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <span className="bg-brand text-brand-foreground grid size-8 place-items-center rounded-md text-xs font-bold">DK</span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-white">D.K Projects</span>
        <span className="block text-[10px] tracking-widest text-white/50 uppercase">Lift Services</span>
      </span>
    </Link>
  );
}

function NavList({ badges, onNavigate }: { badges?: NavBadges; onNavigate?: () => void }) {
  return <NavItems badges={badges} onNavigate={onNavigate} pathname={usePathname()} />;
}

/** Rendered in the static shell, before the URL is known, so it highlights nothing. */
function StaticNavList() {
  return <NavItems pathname="" />;
}

function NavItems({ badges, onNavigate, pathname }: { badges?: NavBadges; onNavigate?: () => void; pathname: string }) {
  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="mb-1.5 px-3 text-[10px] font-medium tracking-widest text-white/40 uppercase">{group.label}</div>
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const count = item.badge && badges ? badges[item.badge] : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-white/75 transition-colors hover:bg-white/5 hover:text-white",
                      active && "bg-sidebar-accent text-white",
                    )}
                  >
                    <item.icon className={cn("size-4", active && "text-brand")} />
                    <span className="flex-1">{item.label}</span>
                    {count > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 text-[11px] leading-5 tabular-nums",
                          item.badge === "followUps" ? "bg-brand text-white" : "bg-white/10 text-white/80",
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ badges, userMenu, placeholder }: { badges?: NavBadges; userMenu: React.ReactNode; placeholder?: boolean }) {
  return (
    <aside className="bg-sidebar sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto px-3 py-5 lg:flex">
      <Brand />
      {placeholder ? <StaticNavList /> : <NavList badges={badges} />}
      <div className="mt-auto">{userMenu}</div>
    </aside>
  );
}

export function MobileTopBar({ badges, userMenu }: { badges?: NavBadges; userMenu: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="bg-sidebar sticky top-0 z-40 flex h-14 items-center gap-2 px-3 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" aria-label="Open menu">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-sidebar w-72 gap-6 border-none px-3 py-5">
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Brand />
          </SheetHeader>
          <NavList badges={badges} onNavigate={() => setOpen(false)} />
          <div className="mt-auto">{userMenu}</div>
        </SheetContent>
      </Sheet>
      <Brand />
    </header>
  );
}

export function MobileTabBar() {
  return <TabBar pathname={usePathname()} />;
}

export function StaticMobileTabBar() {
  return <TabBar pathname="" />;
}

function TabBar({ pathname }: { pathname: string }) {
  return (
    <>
      {pathname !== "/opportunities/new" && (
        <Link
          href="/opportunities/new"
          aria-label="New opportunity"
          className="bg-brand fixed right-4 bottom-20 z-40 grid size-14 place-items-center rounded-full text-white shadow-lg lg:hidden"
        >
          <Plus className="size-6" />
        </Link>
      )}
      <nav className="bg-background fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-t pb-[env(safe-area-inset-bottom)] lg:hidden">
        {MOBILE_TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn("flex flex-col items-center justify-center gap-1 text-[11px]", active ? "text-brand" : "text-muted-foreground")}
            >
              <tab.icon className="size-5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
