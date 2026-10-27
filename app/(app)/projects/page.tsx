import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, StatCard } from "@/components/app/display";
import { LinkTabs, PageHeader } from "@/components/app/page-header";
import { StageTracker } from "@/components/app/stage-tracker";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listProjects } from "@/lib/dal/projects";
import { requireUser } from "@/lib/dal/session";
import { invoicedPercent, isMilestoneOverdue, releaseAtRisk } from "@/lib/domain/billing";
import { PROJECT_STATUS_LABELS } from "@/lib/domain/constants";
import { addDays, diffDays, formatDay, today as todayFn } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { currentTrackerStage, nextOpenItem } from "@/lib/domain/programme";

export const metadata: Metadata = { title: "Projects" };

const TABS = [
  { key: "live", label: "Live" },
  { key: "awaiting_po", label: "Awaiting PO" },
  { key: "complete", label: "Complete" },
  { key: "all", label: "All" },
] as const;

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  await requireUser();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "live";
  const today = todayFn();
  const [projects, live] = await Promise.all([listProjects(tab), tab === "live" ? null : listProjects("live")]);
  const liveProjects = live ?? projects;

  const contract = liveProjects.reduce((s, p) => s + p.contractValuePence, 0);
  const invoiced = liveProjects.reduce(
    (s, p) => s + p.milestones.filter((m) => m.status !== "scheduled").reduce((a, m) => a + m.amountPence, 0),
    0,
  );
  const in30 = addDays(today, 30);
  const dueSoon = liveProjects.flatMap((p) => p.milestones.filter((m) => m.status !== "paid" && m.dueOn && m.dueOn <= in30));
  const inManufacture = liveProjects.filter((p) => currentTrackerStage(p.programme) === 2).length;

  return (
    <>
      <PageHeader eyebrow="Delivery / Projects" title="Work in progress">
        <LinkTabs active={tab} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/projects?tab=${t.key}` }))} />
      </PageHeader>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Live projects" value={liveProjects.length} sub={`${inManufacture} in manufacture`} />
        <StatCard label="Contract value" value={formatMoney(contract)} />
        <StatCard label="Invoiced to date" value={formatMoney(invoiced)} sub={contract ? `${Math.round((invoiced / contract) * 100)}%` : undefined} tone="success" />
        <StatCard
          label="Due next 30 days"
          value={formatMoney(dueSoon.reduce((s, m) => s + m.amountPence, 0))}
          sub={`${dueSoon.length} stage payments`}
          href="/billing"
          tone={dueSoon.length ? "brand" : undefined}
        />
      </div>

      {projects.length === 0 ? (
        <EmptyState title="No projects here" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Project</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Contract</TableHead>
                <TableHead className="w-40">Invoiced</TableHead>
                <TableHead>Next milestone</TableHead>
                <TableHead>Install</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const next = nextOpenItem(p.programme);
                const install = p.programme.find((i) => i.key === "install");
                const pct = invoicedPercent(p.milestones, p.contractValuePence);
                const overdue = p.milestones.some((m) => isMilestoneOverdue(m, today));
                const risk = releaseAtRisk(p.milestones, p.programme, today);
                const days = next ? diffDays(next.end, today) : null;
                const health =
                  p.status !== "live"
                    ? { label: PROJECT_STATUS_LABELS[p.status], variant: "secondary" as const }
                    : risk || overdue
                      ? { label: risk ? "Release at risk" : "Payment overdue", variant: "destructive" as const }
                      : days !== null && days < 0
                        ? { label: "Behind", variant: "destructive" as const }
                        : days !== null && days <= 7
                          ? { label: "This week", variant: "warning" as const }
                          : { label: "On track", variant: "success" as const };
                return (
                  <TableRow key={p._id}>
                    <TableCell className="pl-4">
                      <Link href={`/projects/${p.ref}`} className="font-medium hover:underline">
                        {p.clientName}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {p.ref} · {p.productName}
                        {p.quantity > 1 ? ` ×${p.quantity}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>{p.programme.length ? <StageTracker current={currentTrackerStage(p.programme)} compact /> : <span className="text-muted-foreground text-xs">Awaiting PO</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.contractValuePence)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-1.5" />
                        <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {next ? (
                        <>
                          <div className="max-w-48 truncate text-sm">{next.label}</div>
                          <div className={days! < 0 ? "text-brand text-xs" : "text-muted-foreground text-xs"}>{formatDay(next.end)}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs">{p.nextTask?.title ?? "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{install ? `w/c ${formatDay(install.start)}` : "—"}</TableCell>
                    <TableCell className="pr-4">
                      <Badge variant={health.variant}>{health.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
