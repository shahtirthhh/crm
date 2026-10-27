import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { DueLabel, SectionTitle, StageBadge, StatCard } from "@/components/app/display";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dashboard, mondayReview } from "@/lib/dal/reports";
import { requirePageCapability } from "@/lib/dal/session";
import { SOURCE_LABELS, STAGE_LABELS } from "@/lib/domain/constants";
import { diffDays, formatDay, today as todayFn } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { PipelineHeader } from "../shared";

export const metadata: Metadata = { title: "Monday review" };

export default async function MondayReviewPage() {
  await requirePageCapability("reports:view");
  const today = todayFn();
  const [review, dash] = await Promise.all([mondayReview(), dashboard("month")]);
  const escalated = review.quoteBuckets["15+"];

  return (
    <>
      <PipelineHeader active="monday" title={`Monday review · w/c ${formatDay(review.weekStart, true)}`} withFilters={false} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Pipeline" value={formatMoney(dash.pipeline.value)} sub={`${formatMoney(dash.pipeline.weighted)} weighted`} />
        <StatCard label="New enquiries" value={review.newEnquiries.length} sub="last 14 days" />
        <StatCard label="Awaiting triage" value={review.triage} href="/enquiries" tone={review.triage ? "brand" : undefined} sub={review.triage ? "needs an owner" : "all assigned"} />
        <StatCard label="Overdue follow-ups" value={review.overdueTasks.length} tone={review.overdueTasks.length ? "brand" : undefined} href="/follow-ups?view=overdue" />
        <StatCard label="Escalated quotes" value={escalated.length} sub="no decision after 14 days" tone={escalated.length ? "brand" : undefined} />
      </div>

      {review.releaseRisks.length > 0 && (
        <div className="border-brand/40 bg-brand/5 mb-5 flex items-start gap-3 rounded-lg border p-4 text-sm">
          <AlertTriangle className="text-brand mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-medium">Manufacturer release at risk</div>
            <div className="text-muted-foreground">
              80% is not yet received for{" "}
              {review.releaseRisks.map((r, i) => (
                <span key={r.ref}>
                  {i > 0 && ", "}
                  <Link className="text-foreground underline" href={`/projects/${r.ref}`}>
                    {r.ref} {r.clientName}
                  </Link>{" "}
                  (release {formatDay(r.release)})
                </span>
              ))}
              .
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardContent>
            <SectionTitle>Pipeline by stage</SectionTitle>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Weighted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dash.byStage.map((s) => (
                  <TableRow key={s.stage}>
                    <TableCell>{STAGE_LABELS[s.stage]}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(s.value)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(s.weighted)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <SectionTitle>Quotes awaiting decision</SectionTitle>
            <div className="grid gap-4">
              {(["0-7", "8-14", "15+"] as const).map((bucket) => (
                <div key={bucket}>
                  <div className={`mb-1 text-xs font-medium ${bucket === "15+" ? "text-brand" : "text-muted-foreground"}`}>
                    {bucket === "15+" ? "Over 14 days · escalate" : `${bucket} days`} ({review.quoteBuckets[bucket].length})
                  </div>
                  <ul className="divide-y text-sm">
                    {review.quoteBuckets[bucket].map((o) => (
                      <li key={o._id} className="flex items-center justify-between gap-3 py-1.5">
                        <Link className="min-w-0 truncate hover:underline" href={`/opportunities/${o.ref}`}>
                          {o.clientName} <span className="text-muted-foreground">· {o.ref} · {o.ownerName}</span>
                        </Link>
                        <span className="flex shrink-0 items-center gap-3 tabular-nums">
                          {formatMoney(o.valuePence)}
                          <span className="text-muted-foreground text-xs">day {o.quoteSentOn ? diffDays(today, o.quoteSentOn) : "—"}</span>
                        </span>
                      </li>
                    ))}
                    {review.quoteBuckets[bucket].length === 0 && <li className="text-muted-foreground py-1.5 text-xs">None</li>}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <SectionTitle>Overdue follow-ups</SectionTitle>
            {review.overdueTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">Every follow-up is on time.</p>
            ) : (
              <ul className="divide-y text-sm">
                {review.overdueTasks.map((t) => (
                  <li key={t._id} className="flex items-center justify-between gap-3 py-1.5">
                    <Link
                      className="min-w-0 truncate hover:underline"
                      href={t.subject.type === "project" ? `/projects/${t.subject.ref}` : `/opportunities/${t.subject.ref}`}
                    >
                      {t.title} <span className="text-muted-foreground">· {t.subject.label} · {t.ownerName}</span>
                    </Link>
                    <DueLabel dueOn={t.dueOn} today={today} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <SectionTitle>Stage payments due (next 2 weeks)</SectionTitle>
            {review.billing.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing due.</p>
            ) : (
              <ul className="divide-y text-sm">
                {review.billing.map((b) => (
                  <li key={b.milestone._id} className="flex items-center justify-between gap-3 py-1.5">
                    <Link className="min-w-0 truncate hover:underline" href={`/projects/${b.projectRef}`}>
                      {b.milestone.label} <span className="text-muted-foreground">· {b.clientName} · {b.milestone.status}</span>
                    </Link>
                    <span className="flex shrink-0 items-center gap-3 tabular-nums">
                      {formatMoney(b.milestone.amountPence)}
                      <DueLabel dueOn={b.milestone.dueOn!} today={today} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <SectionTitle>Project milestones (next 2 weeks)</SectionTitle>
            {review.milestonesThisWeek.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing scheduled.</p>
            ) : (
              <ul className="divide-y text-sm">
                {review.milestonesThisWeek.map((m) => (
                  <li key={`${m.projectRef}-${m.label}`} className="flex items-center justify-between gap-3 py-1.5">
                    <Link className="min-w-0 truncate hover:underline" href={`/projects/${m.projectRef}`}>
                      {m.label} <span className="text-muted-foreground">· {m.clientName} · {m.projectRef}</span>
                    </Link>
                    <DueLabel dueOn={m.end} today={today} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <SectionTitle>New enquiries (last 14 days)</SectionTitle>
            <ul className="divide-y text-sm">
              {review.newEnquiries.map((o) => (
                <li key={o._id} className="flex items-center justify-between gap-3 py-1.5">
                  <Link className="min-w-0 truncate hover:underline" href={`/opportunities/${o.ref}`}>
                    {o.clientName} <span className="text-muted-foreground">· {o.productName} · {SOURCE_LABELS[o.source]}</span>
                  </Link>
                  <StageBadge stage={o.stage} />
                </li>
              ))}
              {review.newEnquiries.length === 0 && <li className="text-muted-foreground py-1.5 text-xs">None</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
