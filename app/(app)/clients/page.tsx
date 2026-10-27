import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/app/display";
import { UrlFilters } from "@/components/app/filters";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { searchClients } from "@/lib/dal/clients";
import { requireUser } from "@/lib/dal/session";
import { SEGMENTS, SEGMENT_LABELS, type Segment } from "@/lib/domain/constants";

export const metadata: Metadata = { title: "Clients and sites" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  await requireUser();
  const sp = await searchParams;
  const segment = SEGMENTS.includes(sp.segment as Segment) ? (sp.segment as Segment) : undefined;
  const page = Number(sp.page) || 1;
  const { rows, total, pageSize } = await searchClients({ q: typeof sp.q === "string" ? sp.q : undefined, segment, page });
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Clients and sites"
        actions={
          <Button asChild variant="brand">
            <Link href="/clients/new">
              <Plus /> New client
            </Link>
          </Button>
        }
      >
        <UrlFilters placeholder="Search client, site, postcode or contact" selects={[{ name: "segment", label: "Segment", options: SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABELS[s] })) }]} />
      </PageHeader>
      {rows.length === 0 ? (
        <EmptyState title="No clients found" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Client</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Sites</TableHead>
                <TableHead>Lifts</TableHead>
                <TableHead className="pr-4">Main contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const lifts = c.sites.reduce((s, x) => s + x.lifts.length, 0);
                return (
                  <TableRow key={c._id}>
                    <TableCell className="pl-4">
                      <Link href={`/clients/${c._id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.clientType && <div className="text-muted-foreground text-xs">{c.clientType}</div>}
                    </TableCell>
                    <TableCell>{SEGMENT_LABELS[c.segment]}</TableCell>
                    <TableCell className="max-w-64 truncate">{c.sites.map((s) => s.name).join(", ") || "—"}</TableCell>
                    <TableCell className="tabular-nums">{lifts || "—"}</TableCell>
                    <TableCell className="pr-4">{c.contacts[0]?.name ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      {pages > 1 && (
        <p className="text-muted-foreground mt-3 text-right text-sm">
          Page {page} of {pages} ·{" "}
          {page > 1 && (
            <Link className="underline" href={`?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(page - 1) })}`}>
              Previous
            </Link>
          )}{" "}
          {page < pages && (
            <Link className="underline" href={`?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(page + 1) })}`}>
              Next
            </Link>
          )}
        </p>
      )}
    </>
  );
}
