import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, StageBadge, StatCard } from "@/components/app/display";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { nextTaskBySubject } from "@/lib/dal/tasks";
import { quotesAwaitingDecision } from "@/lib/dal/opportunities";
import { requireUser } from "@/lib/dal/session";
import { oid } from "@/lib/dal/util";
import { diffDays, formatDay, today as todayFn } from "@/lib/domain/dates";
import { isEscalated, quoteAgeBucket } from "@/lib/domain/followups";
import { formatMoney } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Quotes" };

export default async function QuotesPage() {
  await requireUser();
  const today = todayFn();
  const rows = await quotesAwaitingDecision();
  const next = await nextTaskBySubject(rows.map((r) => oid(r._id)));
  const count = (b: string) => rows.filter((r) => r.quoteSentOn && quoteAgeBucket(r.quoteSentOn, today) === b).length;

  return (
    <>
      <PageHeader eyebrow="Sales" title="Quotes awaiting decision" description="Open quotes with their value, age and next follow-up. Quotes with no decision after 14 days are escalated in the Monday review." />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="0 to 7 days" value={count("0-7")} />
        <StatCard label="8 to 14 days" value={count("8-14")} tone="warning" sub="follow up" />
        <StatCard label="Over 14 days" value={count("15+")} tone="brand" sub="escalate" />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No quotes awaiting a decision" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Quote</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Next follow-up</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="pr-4 text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => {
                const q = o.quotes.filter((x) => x.status === "sent").at(-1);
                const task = next.get(o._id);
                const escalated = o.quoteSentOn && isEscalated(o.quoteSentOn, today);
                return (
                  <TableRow key={o._id}>
                    <TableCell className="pl-4 font-medium">{q?.ref ?? "—"}</TableCell>
                    <TableCell>
                      <Link className="hover:underline" href={`/opportunities/${o.ref}`}>
                        {o.clientName}
                      </Link>
                      <div className="text-muted-foreground text-xs">{o.productName}</div>
                    </TableCell>
                    <TableCell>
                      <StageBadge stage={o.stage} />
                    </TableCell>
                    <TableCell className={cn(escalated && "text-brand font-medium")}>
                      {formatDay(o.quoteSentOn)} · day {o.quoteSentOn ? diffDays(today, o.quoteSentOn) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{task ? `${task.title} · ${formatDay(task.dueOn)}` : escalated ? "Escalate in Monday review" : "—"}</TableCell>
                    <TableCell>{o.ownerName}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{formatMoney(o.valuePence)}</TableCell>
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
