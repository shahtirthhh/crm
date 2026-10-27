import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { ActivityFeed } from "@/components/app/activity-feed";
import { AddContactDialog, AddLiftDialog, AddSiteDialog, EditClientDialog } from "@/components/app/client-forms";
import { SectionTitle, StageBadge, StatCard } from "@/components/app/display";
import { DocumentsPanel } from "@/components/app/documents-panel";
import { NoteForm } from "@/components/app/note-form";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addClientNoteAction, addContactAction, addLiftAction, addSiteAction, updateClientAction } from "@/lib/actions/clients";
import { listActivity } from "@/lib/dal/activity";
import { getClient } from "@/lib/dal/clients";
import { blobConfigured, documentsForClient } from "@/lib/dal/documents";
import { listActiveUsers } from "@/lib/dal/reference";
import { requireUser } from "@/lib/dal/session";
import { maybeOid, oid } from "@/lib/dal/util";
import { PROJECT_STATUS_LABELS, SEGMENT_LABELS } from "@/lib/domain/constants";
import { formatDay } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { can } from "@/lib/domain/permissions";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const user = await requireUser();
  const id = maybeOid((await params).id);
  const data = id ? await getClient(id) : null;
  if (!data) notFound();
  const { client: c, opportunities, projects, stats } = data;
  const [activity, documents, users] = await Promise.all([
    listActivity({ clientId: id! }, 40),
    documentsForClient(id!, [...opportunities.map((o) => oid(o._id)), ...projects.map((p) => oid(p._id))]),
    listActiveUsers(),
  ]);
  const canWrite = can(user.role, "client:write");
  const owner = users.find((u) => u.id === c.accountOwnerId);
  const rows = [
    ...projects.map((p) => ({ key: p._id, ref: p.ref, href: `/projects/${p.ref}`, site: p.siteName, product: p.productName, status: <Badge variant="success">{PROJECT_STATUS_LABELS[p.status]}</Badge>, value: p.contractValuePence, when: p.createdAt })),
    ...opportunities
      .filter((o) => !o.projectId)
      .map((o) => ({ key: o._id, ref: o.ref, href: `/opportunities/${o.ref}`, site: o.siteName, product: o.productName, status: <StageBadge stage={o.stage} />, value: o.valuePence, when: o.createdAt })),
  ].sort((a, b) => b.when.getTime() - a.when.getTime());
  const initials = c.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/clients" className="hover:underline">
            Clients and sites
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <span className="bg-muted grid size-10 place-items-center rounded-lg text-sm font-semibold">{initials}</span>
            {c.name}
          </span>
        }
        description={`${c.clientType ? `${c.clientType} · ` : ""}${SEGMENT_LABELS[c.segment]} client since ${formatDay(c.createdAt, true)}${owner ? ` · Account owner: ${owner.name}` : ""}`}
        actions={
          canWrite && (
            <>
              <EditClientDialog
                action={updateClientAction.bind(null, c._id)}
                users={users.map((u) => ({ value: u.id, label: u.name }))}
                values={{ name: c.name, segment: c.segment, clientType: c.clientType, accountOwnerId: c.accountOwnerId, notes: c.notes }}
              />
              <AddSiteDialog action={addSiteAction.bind(null, c._id)} />
              <Button asChild variant="brand" size="sm">
                <Link href={`/opportunities/new?client=${c._id}`}>
                  <Plus /> New opportunity
                </Link>
              </Button>
            </>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Lifetime value" value={formatMoney(stats.lifetimeValuePence)} sub={`${stats.projectCount} projects`} tone="brand" />
        <StatCard label="Open pipeline" value={formatMoney(stats.openPipelinePence)} sub={`${stats.openCount} opportunities`} />
        <StatCard label="Win rate" value={stats.decided ? `${stats.won} of ${stats.decided}` : "—"} />
        <StatCard label="Lifts on site" value={stats.liftCount} sub={`${stats.onMaintenance} on maintenance`} tone="brand" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="grid min-w-0 content-start gap-5">
          <Card className="pb-0">
            <CardContent>
              <SectionTitle>Opportunities and projects</SectionTitle>
            </CardContent>
            {rows.length === 0 ? (
              <p className="text-muted-foreground px-5 pb-5 text-sm">No opportunities yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Reference</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="pr-5 text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="pl-5">
                        <Link className="font-medium hover:underline" href={r.href}>
                          {r.ref}
                        </Link>
                        <div className="text-muted-foreground text-xs">{formatDay(r.when, true)}</div>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">{r.site ?? "—"}</TableCell>
                      <TableCell className="max-w-48 truncate">{r.product}</TableCell>
                      <TableCell>{r.status}</TableCell>
                      <TableCell className="pr-5 text-right tabular-nums">{formatMoney(r.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardContent>
                <SectionTitle action={canWrite && c.sites.length > 0 && <AddLiftDialog action={addLiftAction.bind(null, c._id)} sites={c.sites.map((s) => ({ value: s._id, label: s.name }))} />}>
                  Sites · {c.sites.length}
                </SectionTitle>
                {c.sites.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No sites yet.</p>
                ) : (
                  <ul className="grid gap-3 text-sm">
                    {c.sites.map((s, i) => (
                      <li key={s._id} className="flex gap-3">
                        <span className="bg-muted text-muted-foreground grid size-7 shrink-0 place-items-center rounded-full text-xs">{String(i + 1).padStart(2, "0")}</span>
                        <div className="min-w-0">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-muted-foreground text-xs">
                            {[s.address, s.postcode].filter(Boolean).join(", ") || "No address"}
                            {s.lifts.length > 0 &&
                              ` · ${s.lifts.length} lift${s.lifts.length > 1 ? "s" : ""}${s.lifts.some((l) => l.onMaintenance) ? ` · ${s.lifts.filter((l) => l.onMaintenance).length} on maintenance` : ""}${s.lifts.some((l) => l.servicedBy === "other") ? " · some serviced by others" : ""}`}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <SectionTitle action={canWrite && <AddContactDialog action={addContactAction.bind(null, c._id)} />}>Contacts · {c.contacts.length}</SectionTitle>
                {c.contacts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No contacts yet.</p>
                ) : (
                  <ul className="grid gap-3 text-sm">
                    {c.contacts.map((p) => (
                      <li key={p._id} className="min-w-0">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-muted-foreground text-xs">{p.role ?? "—"}</div>
                        <div className="flex flex-wrap gap-x-3 text-xs">
                          {p.phone && (
                            <a className="text-brand" href={`tel:${p.phone}`}>
                              {p.phone}
                            </a>
                          )}
                          {p.email && (
                            <a className="text-brand truncate" href={`mailto:${p.email}`}>
                              {p.email}
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent>
              <SectionTitle>Documents</SectionTitle>
              <DocumentsPanel subjectType="client" subjectId={c._id} documents={documents} enabled={blobConfigured()} canUpload={canWrite} />
            </CardContent>
          </Card>
        </div>
        <Card className="content-start">
          <CardContent className="grid gap-4">
            <SectionTitle>Recent activity</SectionTitle>
            {c.notes && <p className="bg-muted/60 rounded-md p-3 text-sm whitespace-pre-line">{c.notes}</p>}
            {canWrite && <NoteForm action={addClientNoteAction.bind(null, c._id)} />}
            <ActivityFeed items={activity} showSubject />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
