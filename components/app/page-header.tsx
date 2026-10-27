import Link from "next/link";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="text-muted-foreground mb-1 text-xs">{eyebrow}</div>}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** Underlined link tabs driven by the URL, so views are shareable and server-rendered. */
export function LinkTabs({ tabs, active }: { tabs: { href: string; label: string; key: string; count?: number }[]; active: string }) {
  return (
    <div className="flex gap-4 overflow-x-auto border-b text-sm">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 border-transparent pb-2 whitespace-nowrap text-muted-foreground hover:text-foreground",
            t.key === active && "border-brand text-foreground font-medium",
          )}
        >
          {t.label}
          {t.count != null && <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}
