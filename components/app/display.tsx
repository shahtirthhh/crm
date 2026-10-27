import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { STAGE_LABELS, type Stage } from "@/lib/domain/constants";
import { diffDays, formatDay } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "brand" | "warning" | "success";
  href?: string;
}) {
  const body = (
    <Card className={cn("gap-1 py-4", href && "hover:border-foreground/20 transition-colors")}>
      <CardContent className="px-4">
        <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {sub && (
          <div
            className={cn(
              "mt-0.5 text-xs",
              tone === "brand" ? "text-brand" : tone === "warning" ? "text-amber-600" : tone === "success" ? "text-success" : "text-muted-foreground",
            )}
          >
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const STAGE_VARIANT: Record<Stage, React.ComponentProps<typeof Badge>["variant"]> = {
  enquiry: "secondary",
  survey_booked: "secondary",
  quote_sent: "outline",
  follow_up: "warning",
  won: "success",
  lost: "destructive",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return <Badge variant={STAGE_VARIANT[stage]}>{STAGE_LABELS[stage]}</Badge>;
}

/** "Today", "Yesterday", "3d overdue", "Thu 23 Oct" relative to today. */
export function DueLabel({ dueOn, today, done }: { dueOn: Date; today: Date; done?: boolean }) {
  const days = diffDays(dueOn, today);
  let text = formatDay(dueOn);
  let cls = "text-muted-foreground";
  if (done) {
    cls = "text-muted-foreground";
  } else if (days < 0) {
    text = days === -1 ? "Yesterday" : `${-days}d overdue`;
    cls = "text-brand font-medium";
  } else if (days === 0) {
    text = "Today";
    cls = "text-foreground font-medium";
  } else if (days === 1) {
    text = "Tomorrow";
  }
  return <span className={cn("text-xs whitespace-nowrap tabular-nums", cls)}>{text}</span>;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-10 text-center text-sm">
      <div className="text-foreground font-medium">{title}</div>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</div>
      <div className="mt-0.5 truncate text-sm">{children ?? "—"}</div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{children}</h2>
      {action}
    </div>
  );
}
