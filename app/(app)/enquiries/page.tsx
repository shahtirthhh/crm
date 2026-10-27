import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { EmptyState, SectionTitle, StageBadge } from "@/components/app/display";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listOpportunities, triageQueue } from "@/lib/dal/opportunities";
import { requireUser } from "@/lib/dal/session";
import { SOURCE_LABELS } from "@/lib/domain/constants";
import { formatDateTime } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Enquiries" };

export default async function EnquiriesPage() {
  await requireUser();
  const [triage, open] = await Promise.all([triageQueue(), listOpportunities({ stage: "enquiry" })]);
  const rest = open.rows.filter((o) => !o.needsTriage);

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Enquiries"
        description="Every enquiry is logged once, with an owner and a dated next action. Website and Google Ads enquiries arrive here automatically."
        actions={
          <Button asChild variant="brand">
            <Link href="/opportunities/new">
              <Plus /> New enquiry
            </Link>
          </Button>
        }
      />
      <div className="grid gap-5">
        <Card>
          <CardContent>
            <SectionTitle>Awaiting triage ({triage.length})</SectionTitle>
            {triage.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing waiting. New web enquiries will appear here.</p>
            ) : (
              <ul className="divide-y text-sm">
                {triage.map((o) => (
                  <li key={o._id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/opportunities/${o.ref}`} className="font-medium hover:underline">
                        {o.clientName}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {o.ref} · {SOURCE_LABELS[o.source]} · {o.productName} · received {formatDateTime(o.createdAt)}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/opportunities/${o.ref}`}>Review and assign</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {rest.length === 0 ? (
          <EmptyState title="No open enquiries" />
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Enquiry</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Next action</TableHead>
                  <TableHead className="pr-4 text-right">Estimate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rest.map((o) => (
                  <TableRow key={o._id}>
                    <TableCell className="pl-4">
                      <Link className="font-medium hover:underline" href={`/opportunities/${o.ref}`}>
                        {o.clientName}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {o.ref} · <StageBadge stage={o.stage} />
                      </div>
                    </TableCell>
                    <TableCell>{o.productName}</TableCell>
                    <TableCell>{SOURCE_LABELS[o.source]}</TableCell>
                    <TableCell>{o.ownerName}</TableCell>
                    <TableCell className="text-xs">{o.nextTask?.title ?? <span className="text-brand">No next action</span>}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{formatMoney(o.valuePence)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
