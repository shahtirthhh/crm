import type { Metadata } from "next";
import Link from "next/link";

import { DueLabel, EmptyState, StatCard } from "@/components/app/display";
import { LinkTabs, PageHeader } from "@/components/app/page-header";
import { MilestoneDialog } from "@/components/app/project-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { updateMilestoneAction } from "@/lib/actions/projects";
import { billingSchedule } from "@/lib/dal/projects";
import { requireUser } from "@/lib/dal/session";
import { addDays, formatDay, formatDayInput, today as todayFn } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { can } from "@/lib/domain/permissions";

export const metadata: Metadata = { title: "Milestone billing" };

const FILTERS = [
  { key: "due30", label: "Due next 30 days" },
  { key: "overdue", label: "Overdue" },
  { key: "raised", label: "Raised, awaiting payment" },
  { key: "all", label: "All" },
] as const;

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await requireUser();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.filter)?.key ?? "due30";
  const today = todayFn();
  const [rows, all] = await Promise.all([billingSchedule(filter), billingSchedule("all")]);
  const canBill = can(user.role, "billing:write");
  const unpaid = all.filter((r) => r.milestone.status !== "paid");
  const in30 = addDays(today, 30);
  const due30 = unpaid.filter((r) => r.milestone.dueOn && r.milestone.dueOn <= in30);
  const overdue = unpaid.filter((r) => r.overdue);
  const raised = unpaid.filter((r) => r.milestone.status === "raised");
  const sum = (xs: typeof rows) => xs.reduce((s, r) => s + r.milestone.amountPence, 0);

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Milestone billing"
        description="Every project carries its 60 / 20 / 20 schedule, with due dates set from the programme. Accounts set raised and paid; overdue payments get a chase task automatically."
      >
        <LinkTabs active={filter} tabs={FILTERS.map((f) => ({ key: f.key, label: f.label, href: `/billing?filter=${f.key}` }))} />
      </PageHeader>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Due next 30 days" value={formatMoney(sum(due30))} sub={`${due30.length} stage payments`} />
        <StatCard label="Overdue" value={formatMoney(sum(overdue))} sub={`${overdue.length} payments`} tone={overdue.length ? "brand" : undefined} />
        <StatCard label="Raised, unpaid" value={formatMoney(sum(raised))} sub={`${raised.length} invoices`} />
        <StatCard label="Received to date" value={formatMoney(sum(all.filter((r) => r.milestone.status === "paid")))} tone="success" />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No stage payments in this view" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Milestone</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.milestone._id}>
                  <TableCell className="pl-4 font-medium">{r.milestone.label}</TableCell>
                  <TableCell>
                    <Link href={`/projects/${r.projectRef}`} className="hover:underline">
                      {r.clientName}
                    </Link>
                    <div className="text-muted-foreground text-xs">{r.projectRef}</div>
                  </TableCell>
                  <TableCell>
                    {r.milestone.dueOn ? (
                      <div className="flex flex-col">
                        <span className="text-sm">{formatDay(r.milestone.dueOn, true)}</span>
                        <DueLabel dueOn={r.milestone.dueOn} today={today} done={r.milestone.status === "paid"} />
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{r.milestone.invoiceRef ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.milestone.status === "paid" ? "success" : r.overdue ? "destructive" : r.milestone.status === "raised" ? "outline" : "secondary"}>
                      {r.overdue ? "overdue" : r.milestone.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.milestone.amountPence)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    {canBill && (
                      <MilestoneDialog
                        action={updateMilestoneAction.bind(null, r.projectRef, r.milestone._id)}
                        label={`${r.milestone.label} · ${r.clientName}`}
                        status={r.milestone.status}
                        invoiceRef={r.milestone.invoiceRef}
                        today={formatDayInput(today)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
