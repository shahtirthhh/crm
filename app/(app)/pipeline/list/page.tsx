import type { Metadata } from "next";
import Link from "next/link";

import { DueLabel, EmptyState, StageBadge } from "@/components/app/display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listOpportunities } from "@/lib/dal/opportunities";
import { requireUser } from "@/lib/dal/session";
import { SOURCE_LABELS } from "@/lib/domain/constants";
import { formatDay, today as todayFn } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { PipelineHeader, parseFilters } from "../shared";

export const metadata: Metadata = { title: "Pipeline list" };

export default async function PipelineListPage({ searchParams }: PageProps<"/pipeline/list">) {
  await requireUser();
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const { rows, total, page, pageSize } = await listOpportunities(filters);
  const today = todayFn();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const qs = (p: number) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    next.set("page", String(p));
    return `?${next.toString()}`;
  };

  return (
    <>
      <PipelineHeader active="list" title="All opportunities" />
      {rows.length === 0 ? (
        <EmptyState title="No opportunities match these filters" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Reference</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Next action</TableHead>
                <TableHead className="pr-4 text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o._id}>
                  <TableCell className="pl-4">
                    <Link className="font-medium hover:underline" href={`/opportunities/${o.ref}`}>
                      {o.ref}
                    </Link>
                    <div className="text-muted-foreground text-xs">Logged {formatDay(o.createdAt)}</div>
                  </TableCell>
                  <TableCell className="max-w-56 truncate">{o.clientName}</TableCell>
                  <TableCell className="max-w-48 truncate">{o.productName}</TableCell>
                  <TableCell>{SOURCE_LABELS[o.source]}</TableCell>
                  <TableCell>{o.ownerName}</TableCell>
                  <TableCell>
                    <StageBadge stage={o.stage} />
                  </TableCell>
                  <TableCell className="max-w-56">
                    {o.nextTask ? (
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs">{o.nextTask.title}</span>
                        <DueLabel dueOn={o.nextTask.dueOn} today={today} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{formatMoney(o.valuePence)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            Page {page} of {pages} · {total} opportunities
          </span>
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={qs(Math.max(1, page - 1))}>Previous</Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={page >= pages}>
            <Link href={qs(Math.min(pages, page + 1))}>Next</Link>
          </Button>
        </div>
      )}
    </>
  );
}
