import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/app/display";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/dal/session";
import { plain } from "@/lib/dal/util";
import { db } from "@/lib/db/collections";
import { addDays, formatDateTime, today } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Surveys" };

export default async function SurveysPage() {
  await requireUser();
  const rows = plain(
    await db
      .opportunities()
      .find(
        { survey: { $type: "object" }, $or: [{ stage: { $nin: ["won", "lost"] } }, { "survey.scheduledAt": { $gte: addDays(today(), -60) } }] },
        { projection: { ref: 1, clientName: 1, siteName: 1, productName: 1, stage: 1, survey: 1 } },
      )
      .sort({ "survey.scheduledAt": -1 })
      .limit(200)
      .toArray(),
  );
  const now = new Date();
  return (
    <>
      <PageHeader eyebrow="Sales" title="Surveys" description="Booked and completed surveys, with the £350 trade survey fee and its status." />
      {rows.length === 0 ? (
        <EmptyState title="No surveys booked" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">When</TableHead>
                <TableHead>Client and site</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Surveyor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => {
                const s = o.survey!;
                const upcoming = s.scheduledAt && s.scheduledAt > now;
                return (
                  <TableRow key={o._id}>
                    <TableCell className="pl-4">{formatDateTime(s.scheduledAt)}</TableCell>
                    <TableCell>
                      <Link className="font-medium hover:underline" href={`/opportunities/${o.ref}`}>
                        {o.clientName}
                      </Link>
                      <div className="text-muted-foreground text-xs">{o.siteName ?? o.ref}</div>
                    </TableCell>
                    <TableCell>{o.productName}</TableCell>
                    <TableCell>{s.surveyorName}</TableCell>
                    <TableCell>
                      {s.completedAt || s.measurements ? (
                        <Badge variant="success">Recorded</Badge>
                      ) : upcoming ? (
                        <Badge variant="secondary">Booked</Badge>
                      ) : (
                        <Badge variant="warning">Notes due</Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {s.feePence ? (
                        <>
                          <span className="tabular-nums">{formatMoney(s.feePence)}</span>
                          <div className="text-muted-foreground text-xs">{s.feeStatus}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Free</span>
                      )}
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
