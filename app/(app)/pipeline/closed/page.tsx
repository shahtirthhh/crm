import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, StageBadge } from "@/components/app/display";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/dal/session";
import { plain } from "@/lib/dal/util";
import { db } from "@/lib/db/collections";
import { SOURCE_LABELS } from "@/lib/domain/constants";
import { formatDay } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { PipelineHeader, parseFilters } from "../shared";

export const metadata: Metadata = { title: "Won and lost" };

export default async function ClosedPage({ searchParams }: PageProps<"/pipeline/closed">) {
  await requireUser();
  const f = parseFilters(await searchParams);
  const filter: Record<string, unknown> = { stage: { $in: ["won", "lost"] } };
  if (f.ownerId) filter.ownerId = f.ownerId;
  if (f.source) filter.source = f.source;
  if (f.segment) filter.segment = f.segment;
  if (f.q) filter.clientName = { $regex: f.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const rows = plain(
    await db
      .opportunities()
      .find(filter, { projection: { ref: 1, clientName: 1, productName: 1, source: 1, stage: 1, valuePence: 1, closedAt: 1, lostReason: 1, lostTo: 1, ownerName: 1, projectId: 1 } })
      .sort({ closedAt: -1 })
      .limit(200)
      .toArray(),
  );

  return (
    <>
      <PipelineHeader active="closed" title="Won and lost" />
      {rows.length === 0 ? (
        <EmptyState title="Nothing closed yet" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Closed</TableHead>
                <TableHead>Opportunity</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="pr-4 text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o._id}>
                  <TableCell className="pl-4">{formatDay(o.closedAt, true)}</TableCell>
                  <TableCell>
                    <Link className="hover:underline" href={`/opportunities/${o.ref}`}>
                      <span className="font-medium">{o.clientName}</span> <span className="text-muted-foreground text-xs">{o.ref}</span>
                    </Link>
                  </TableCell>
                  <TableCell>{o.productName}</TableCell>
                  <TableCell>{SOURCE_LABELS[o.source]}</TableCell>
                  <TableCell>
                    <StageBadge stage={o.stage} />
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-56 truncate text-xs">
                    {o.stage === "lost" ? `${o.lostReason ?? "Not recorded"}${o.lostTo ? ` · ${o.lostTo}` : ""}` : "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{formatMoney(o.valuePence)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
