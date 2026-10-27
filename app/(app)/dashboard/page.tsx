import type { Metadata } from "next";
import Link from "next/link";

import { WonLostChart } from "@/components/app/charts";
import { SectionTitle, StageBadge, StatCard } from "@/components/app/display";
import { HBars } from "@/components/app/hbars";
import { LinkTabs, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { followUpDiscipline } from "@/lib/dal/tasks";
import { dashboard, type Period } from "@/lib/dal/reports";
import { requirePageCapability } from "@/lib/dal/session";
import { SOURCE_LABELS, STAGE_LABELS } from "@/lib/domain/constants";
import { formatMoney } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Sales dashboard" };

const PERIODS: { key: Period; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "Quarter" },
  { key: "ytd", label: "Year to date" },
  { key: "12m", label: "Last 12 months" },
];

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  await requirePageCapability("reports:view");
  const sp = await searchParams;
  const period = (PERIODS.find((p) => p.key === sp.period)?.key ?? "month") as Period;
  const [d, discipline] = await Promise.all([dashboard(period), followUpDiscipline()]);
  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase();
  const winPct = d.winRate.decided ? Math.round((d.winRate.won / d.winRate.decided) * 100) : null;

  return (
    <>
      <PageHeader
        eyebrow="Sales / Dashboard"
        title="Sales dashboard"
        actions={
          <Button asChild variant="outline">
            <Link href="/pipeline/monday">Monday review</Link>
          </Button>
        }
      >
        <LinkTabs active={period} tabs={PERIODS.map((p) => ({ key: p.key, label: p.label, href: `/dashboard?period=${p.key}` }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pipeline value" value={formatMoney(d.pipeline.value)} sub={`${d.pipeline.count} open`} tone="brand" />
        <StatCard label="Weighted pipeline" value={formatMoney(d.pipeline.weighted)} sub="by stage likelihood" />
        <StatCard
          label="Win rate, 12 months"
          value={winPct == null ? "—" : `${winPct}%`}
          sub={`${d.winRate.won} of ${d.winRate.decided} decided`}
        />
        <StatCard label={`Won ${periodLabel}`} value={formatMoney(d.wonInPeriod.value)} sub={`${d.wonInPeriod.count} project${d.wonInPeriod.count === 1 ? "" : "s"}`} tone="success" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardContent>
            <SectionTitle>Pipeline by stage</SectionTitle>
            <HBars
              rows={d.byStage.map((s) => ({
                key: s.stage,
                label: STAGE_LABELS[s.stage],
                sub: `${s.count} open`,
                value: s.value,
                note: `${formatMoney(s.weighted)} weighted`,
              }))}
              highlight="follow_up"
            />
            <div className="text-muted-foreground mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <span>Avg days enquiry to decision: {d.avgDaysToDecision ?? "—"}</span>
              <span>Quotes awaiting decision: {d.quotesAwaiting}</span>
              <span>Follow-ups overdue: {d.followUpsOverdue}</span>
              <span>
                Follow-up discipline (30 days): {discipline.due ? `${Math.round((discipline.onTime / discipline.due) * 100)}%` : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <SectionTitle>Open pipeline by source</SectionTitle>
            {d.bySource.length ? (
              <HBars rows={d.bySource.map((s) => ({ key: s.source, label: SOURCE_LABELS[s.source], value: s.value, note: `${s.count} open` }))} />
            ) : (
              <p className="text-muted-foreground text-sm">No open opportunities.</p>
            )}
            {d.conversionBySource.length > 0 && (
              <>
                <div className="text-muted-foreground mt-5 mb-2 text-xs font-semibold tracking-wider uppercase">Conversion by source, 12 months</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {d.conversionBySource.map((c) => (
                    <span key={c.source} className="bg-muted rounded px-2 py-1">
                      {SOURCE_LABELS[c.source]}: {Math.round((c.won / c.decided) * 100)}% ({c.won}/{c.decided})
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <SectionTitle>Largest open opportunities</SectionTitle>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.top.map((o) => (
                  <TableRow key={o._id}>
                    <TableCell className="max-w-56">
                      <Link className="hover:underline" href={`/opportunities/${o.ref}`}>
                        <div className="truncate font-medium">{o.clientName}</div>
                        <div className="text-muted-foreground truncate text-xs">{o.productName}</div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StageBadge stage={o.stage} />
                    </TableCell>
                    <TableCell>{SOURCE_LABELS[o.source]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(o.valuePence)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <SectionTitle>Won and lost value by month</SectionTitle>
            <WonLostChart data={d.byMonth} />
            {d.lostReasons.length > 0 && (
              <div className="text-muted-foreground mt-3 flex flex-wrap gap-2 text-xs">
                Lost reasons, 12 months:
                {d.lostReasons.map((r) => (
                  <span key={r._id} className="bg-muted rounded px-2 py-0.5">
                    {r._id} ({r.count})
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
