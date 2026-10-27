import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { ActivityFeed } from "@/components/app/activity-feed";
import { DueLabel, KeyValue, SectionTitle } from "@/components/app/display";
import { DocumentsPanel } from "@/components/app/documents-panel";
import { NoteForm } from "@/components/app/note-form";
import { AddTaskDialog } from "@/components/app/opportunity-actions";
import { PageHeader } from "@/components/app/page-header";
import { ProgrammeGantt } from "@/components/app/programme-gantt";
import { ClientPoDialog, HandoverDialog, MilestoneDialog, ProjectDetailsDialog } from "@/components/app/project-actions";
import { StageTracker } from "@/components/app/stage-tracker";
import { TaskList } from "@/components/app/task-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  addProjectNoteAction,
  handoverAction,
  recordClientPoAction,
  rescheduleItemAction,
  updateMilestoneAction,
  updateProjectDetailsAction,
} from "@/lib/actions/projects";
import { createTaskAction } from "@/lib/actions/tasks";
import { listActivity } from "@/lib/dal/activity";
import { blobConfigured, documentsFor } from "@/lib/dal/documents";
import { getProject } from "@/lib/dal/projects";
import { listActiveUsers } from "@/lib/dal/reference";
import { requireUser } from "@/lib/dal/session";
import { tasksForSubject } from "@/lib/dal/tasks";
import { oid } from "@/lib/dal/util";
import { invoicedPercent, isMilestoneOverdue, releaseAtRisk } from "@/lib/domain/billing";
import { PROJECT_STATUS_LABELS } from "@/lib/domain/constants";
import { addDays, formatDay, formatDayInput, today as todayFn } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { can } from "@/lib/domain/permissions";
import { currentTrackerStage } from "@/lib/domain/programme";

export async function generateMetadata({ params }: PageProps<"/projects/[ref]">): Promise<Metadata> {
  return { title: (await params).ref };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[ref]">) {
  const user = await requireUser();
  const { ref } = await params;
  const p = await getProject(ref);
  if (!p) notFound();

  const today = todayFn();
  const [tasks, activity, documents, users] = await Promise.all([
    tasksForSubject(oid(p._id)),
    listActivity({ subjectId: oid(p._id) }),
    documentsFor(oid(p._id)),
    listActiveUsers(),
  ]);
  const canEdit = can(user.role, "project:write");
  const canBill = can(user.role, "billing:write");
  const userOptions = users.filter((u) => u.role !== "engineer").map((u) => ({ value: u.id, label: u.name }));
  const pct = invoicedPercent(p.milestones, p.contractValuePence);
  const risk = releaseAtRisk(p.milestones, p.programme, today);
  const release = p.programme.find((i) => i.key === "release");
  const handover = p.programme.find((i) => i.key === "handover");

  return (
    <>
      <PageHeader
        eyebrow={
          <span>
            <Link href="/projects" className="hover:underline">
              Projects
            </Link>{" "}
            / {p.ref} · from{" "}
            <Link className="hover:underline" href={`/opportunities/${p.opportunityRef}`}>
              {p.opportunityRef}
            </Link>
          </span>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Link href={`/clients/${p.clientId}`} className="hover:underline">
              {p.clientName}
            </Link>
            <Badge variant={p.status === "live" ? "success" : "secondary"}>{PROJECT_STATUS_LABELS[p.status]}</Badge>
          </span>
        }
        description={`${p.productName}${p.quantity > 1 ? ` ×${p.quantity}` : ""}${p.siteName ? ` · ${p.siteName}` : ""}`}
        actions={
          <>
            {canEdit && p.status === "awaiting_po" && (
              <ClientPoDialog
                action={recordClientPoAction.bind(null, p.ref)}
                defaults={{ clientPoOn: formatDayInput(today), manufacturer: p.manufacturer, leadTimeWeeks: p.leadTimeWeeks, installDays: p.installDays }}
              />
            )}
            {canEdit && p.status === "live" && <HandoverDialog action={handoverAction.bind(null, p.ref)} defaultDate={formatDayInput(handover?.end ?? today)} />}
          </>
        }
      >
        {p.programme.length > 0 && <StageTracker current={currentTrackerStage(p.programme)} />}
      </PageHeader>

      {risk && (
        <div className="border-brand/40 bg-brand/5 mb-5 flex items-start gap-3 rounded-lg border p-4 text-sm">
          <AlertTriangle className="text-brand mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-medium">Manufacturer release on {formatDay(release?.end, true)} is at risk</div>
            <div className="text-muted-foreground">The manufacturer releases the lift only once paid. The 60% deposit and 20% mid invoice must both be received first.</div>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="grid min-w-0 content-start gap-5">
          <Card>
            <CardContent>
              <SectionTitle
                action={
                  canEdit && (
                    <ProjectDetailsDialog
                      action={updateProjectDetailsAction.bind(null, p.ref)}
                      users={userOptions}
                      values={{ pmId: p.pmId, manufacturer: p.manufacturer, manufacturerPoRef: p.manufacturerPoRef, clientPoRef: p.clientPoRef, notes: p.notes }}
                    />
                  )
                }
              >
                Project
              </SectionTitle>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KeyValue label="Contract value">{formatMoney(p.contractValuePence)}</KeyValue>
                <KeyValue label="Invoiced">{pct}%</KeyValue>
                <KeyValue label="Project manager">{p.pmName}</KeyValue>
                <KeyValue label="Manufacturer">{p.manufacturer ?? "—"}</KeyValue>
                <KeyValue label="Client PO">{p.clientPoRef ? `${p.clientPoRef} · ${formatDay(p.clientPoOn)}` : formatDay(p.clientPoOn)}</KeyValue>
                <KeyValue label="Manufacturer PO">{p.manufacturerPoRef ?? "—"}</KeyValue>
                <KeyValue label="Lead time">{p.leadTimeWeeks} weeks</KeyValue>
                <KeyValue label="Warranty">{p.warrantyEndsOn ? `to ${formatDay(p.warrantyEndsOn, true)}` : "From handover"}</KeyValue>
              </div>
              {p.surveyCreditPence > 0 && (
                <p className="bg-muted/60 mt-4 rounded-md p-3 text-sm">Survey fee of {formatMoney(p.surveyCreditPence)} to be credited against this order.</p>
              )}
              {p.notes && <p className="bg-muted/50 mt-4 rounded-md p-3 text-sm whitespace-pre-line">{p.notes}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <SectionTitle>Programme</SectionTitle>
              {p.programme.length ? (
                <ProgrammeGantt
                  projectRef={p.ref}
                  items={p.programme}
                  today={today}
                  canEdit={canEdit}
                  rescheduleAction={rescheduleItemAction.bind(null, p.ref)}
                  dueMarkers={p.milestones.filter((m) => m.dueOn).map((m) => ({ label: m.label, on: m.dueOn!, paid: m.status === "paid" }))}
                />
              ) : (
                <p className="text-muted-foreground text-sm">The programme is generated from the template when the client purchase order is recorded.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <SectionTitle>Billing schedule · 60 / 20 / 20</SectionTitle>
              {p.milestones.length === 0 ? (
                <p className="text-muted-foreground text-sm">Created with the programme.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {p.milestones.map((m) => {
                    const overdue = isMilestoneOverdue(m, today);
                    return (
                      <li key={m._id} className="flex flex-wrap items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{m.label}</div>
                          <div className="text-muted-foreground text-xs">
                            {m.kind === "deposit" ? "On client PO, before the manufacturer order" : m.kind === "mid" ? "One month before manufacturer release" : "30 days after handover"}
                            {m.invoiceRef && ` · ${m.invoiceRef}`}
                            {m.paidOn && ` · paid ${formatDay(m.paidOn)}`}
                          </div>
                        </div>
                        {m.dueOn ? <DueLabel dueOn={m.dueOn} today={today} done={m.status === "paid"} /> : <span className="text-muted-foreground text-xs">Date from programme</span>}
                        <Badge variant={m.status === "paid" ? "success" : overdue ? "destructive" : m.status === "raised" ? "outline" : "secondary"}>
                          {overdue ? "overdue" : m.status}
                        </Badge>
                        <span className="w-24 text-right font-medium tabular-nums">{formatMoney(m.amountPence)}</span>
                        {canBill && (
                          <MilestoneDialog
                            action={updateMilestoneAction.bind(null, p.ref, m._id)}
                            label={m.label}
                            status={m.status}
                            invoiceRef={m.invoiceRef}
                            today={formatDayInput(today)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <SectionTitle>Drawings and documents</SectionTitle>
              <DocumentsPanel subjectType="project" subjectId={p._id} documents={documents} enabled={blobConfigured()} defaultCategory="drawing" canUpload={canEdit || canBill} />
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card className="gap-0 pb-0">
            <CardContent className="pb-2">
              <SectionTitle
                action={
                  (canEdit || canBill) && (
                    <AddTaskDialog action={createTaskAction.bind(null, "project", p._id)} users={userOptions} defaultOwner={p.pmId} defaultDue={formatDayInput(addDays(today, 1))} />
                  )
                }
              >
                Tasks
              </SectionTitle>
            </CardContent>
            <TaskList tasks={tasks} today={today} showOwner showSubject={false} empty="No open tasks." />
          </Card>
          <Card>
            <CardContent className="grid gap-4">
              <SectionTitle>Activity</SectionTitle>
              {(canEdit || canBill) && <NoteForm action={addProjectNoteAction.bind(null, p.ref)} allowCall={false} />}
              <ActivityFeed items={activity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
