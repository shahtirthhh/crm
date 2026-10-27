import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";

import { ActivityFeed } from "@/components/app/activity-feed";
import { KeyValue, SectionTitle, StageBadge } from "@/components/app/display";
import { DocumentsPanel } from "@/components/app/documents-panel";
import { ActionButton } from "@/components/app/form-kit";
import { NoteForm } from "@/components/app/note-form";
import {
  AddQuoteDialog,
  AddTaskDialog,
  BookSurveyDialog,
  EditOpportunityDialog,
  LostDialog,
  SurveyResultDialog,
  WonDialog,
} from "@/components/app/opportunity-actions";
import { PageHeader } from "@/components/app/page-header";
import { TaskList } from "@/components/app/task-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  addOpportunityNoteAction,
  addQuoteAction,
  bookSurveyAction,
  markLostAction,
  markQuoteSentAction,
  markWonAction,
  reopenAction,
  surveyResultAction,
  updateOpportunityAction,
} from "@/lib/actions/opportunities";
import { createTaskAction } from "@/lib/actions/tasks";
import { listActivity } from "@/lib/dal/activity";
import { blobConfigured, documentsFor } from "@/lib/dal/documents";
import { getOpportunity } from "@/lib/dal/opportunities";
import { listActiveUsers, listProducts } from "@/lib/dal/reference";
import { requireUser } from "@/lib/dal/session";
import { tasksForSubject } from "@/lib/dal/tasks";
import { oid } from "@/lib/dal/util";
import { db } from "@/lib/db/collections";
import { OPEN_STAGES, SEGMENT_LABELS, SOURCE_LABELS, STAGE_LABELS, TRADE_SURVEY_FEE_PENCE } from "@/lib/domain/constants";
import { addDays, diffDays, formatDay, formatDateTime, formatDayInput, today as todayFn } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { can } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/opportunities/[ref]">): Promise<Metadata> {
  return { title: (await params).ref };
}

function poundsInput(pence?: number) {
  return pence == null ? undefined : String(pence / 100);
}

function StageStepper({ stage }: { stage: (typeof OPEN_STAGES)[number] | "won" | "lost" }) {
  const steps = [...OPEN_STAGES, stage === "lost" ? "lost" : "won"] as const;
  const current = steps.indexOf(stage as (typeof steps)[number]);
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs">
      {steps.map((s, i) => {
        const done = i < current || stage === "won";
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-1">
            <span
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1",
                done && "bg-primary text-primary-foreground border-primary",
                active && stage !== "won" && "border-brand text-brand font-medium",
                active && stage === "lost" && "bg-destructive/10",
              )}
            >
              {done && <Check className="size-3" />}
              {STAGE_LABELS[s]}
            </span>
            {i < steps.length - 1 && <span className="bg-border h-px w-3" />}
          </li>
        );
      })}
    </ol>
  );
}

export default async function OpportunityPage({ params }: PageProps<"/opportunities/[ref]">) {
  const user = await requireUser();
  const { ref } = await params;
  const o = await getOpportunity(ref);
  if (!o) notFound();

  const today = todayFn();
  const [tasks, activity, documents, users, products, client] = await Promise.all([
    tasksForSubject(oid(o._id)),
    listActivity({ subjectId: oid(o._id) }),
    documentsFor(oid(o._id)),
    listActiveUsers(),
    listProducts(),
    db.clients().findOne({ _id: oid(o.clientId) }, { projection: { contacts: 1, sites: 1 } }),
  ]);
  const contact = client?.contacts.find((c) => c._id.toHexString() === o.contactId);
  const userOptions = users.filter((u) => u.role !== "engineer").map((u) => ({ value: u.id, label: u.name }));
  const canWrite = can(user.role, "opportunity:write");
  const canClose = can(user.role, "opportunity:close");
  const closed = o.stage === "won" || o.stage === "lost";
  const current = o.quotes.filter((q) => q.status !== "superseded" && q.status !== "draft").at(-1);
  const project = o.projectId ? await db.projects().findOne({ _id: oid(o.projectId) }, { projection: { ref: 1 } }) : null;
  const defaultSurvey = new Date(addDays(today, 3).getTime() + 10 * 3600_000).toISOString().slice(0, 16);

  return (
    <>
      <PageHeader
        eyebrow={
          <span>
            <Link href="/pipeline" className="hover:underline">
              Pipeline
            </Link>{" "}
            / {o.ref}
            {current ? ` · Quote ${current.ref}` : ""}
          </span>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Link href={`/clients/${o.clientId}`} className="hover:underline">
              {o.clientName}
            </Link>
            <StageBadge stage={o.stage} />
            {o.needsTriage && <Badge variant="brand">Needs triage</Badge>}
          </span>
        }
        description={`${o.productName}${o.quantity > 1 ? ` ×${o.quantity}` : ""}${o.siteName ? ` · ${o.siteName}` : ""} · ${SEGMENT_LABELS[o.segment]}`}
        actions={
          <>
            {canWrite && !closed && (
              <>
                {o.stage === "enquiry" && (
                  <BookSurveyDialog
                    action={bookSurveyAction.bind(null, o.ref)}
                    users={userOptions}
                    defaultSurveyor={users.find((u) => u.role === "project_manager")?.id ?? user.id}
                    defaultFee={o.segment === "lift_company" ? String(TRADE_SURVEY_FEE_PENCE / 100) : undefined}
                    defaultWhen={defaultSurvey}
                  />
                )}
                <AddQuoteDialog action={addQuoteAction.bind(null, o.ref)} revision={o.quotes.length + 1} defaultTotal={poundsInput(current?.totalPence)} />
              </>
            )}
            {canClose && !closed && current && (
              <WonDialog
                action={markWonAction.bind(null, o.ref)}
                users={users.filter((u) => u.role === "project_manager" || u.role === "md").map((u) => ({ value: u.id, label: u.name }))}
                defaultValue={poundsInput(current.totalPence)}
                defaultPm={users.find((u) => u.role === "project_manager")?.id}
              />
            )}
            {canClose && !closed && <LostDialog action={markLostAction.bind(null, o.ref)} />}
            {canClose && o.stage === "lost" && (
              <ActionButton size="sm" variant="outline" action={reopenAction.bind(null, o.ref)} successMessage="Reopened">
                Reopen
              </ActionButton>
            )}
            {project && (
              <Button asChild size="sm">
                <Link href={`/projects/${project.ref}`}>Open project {project.ref}</Link>
              </Button>
            )}
          </>
        }
      >
        <StageStepper stage={o.stage} />
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-5">
          <Card>
            <CardContent>
              <SectionTitle
                action={
                  canWrite && (
                    <EditOpportunityDialog
                      action={updateOpportunityAction.bind(null, o.ref)}
                      products={products.map((p) => ({ value: p.id, label: p.name }))}
                      users={userOptions}
                      contacts={(client?.contacts ?? []).map((c) => ({ value: c._id.toHexString(), label: c.name }))}
                      sites={(client?.sites ?? []).map((s) => ({ value: s._id.toHexString(), label: s.name }))}
                      values={{
                        productId: o.productId,
                        quantity: o.quantity,
                        source: o.source,
                        campaign: o.campaign,
                        valueLow: poundsInput(o.valueLowPence),
                        valueHigh: poundsInput(o.valueHighPence),
                        ownerId: o.ownerId,
                        description: o.description,
                        installWindow: o.installWindow,
                        decisionOn: formatDayInput(o.decisionOn),
                        siteId: o.siteId,
                        contactId: o.contactId,
                      }}
                    />
                  )
                }
              >
                Opportunity
              </SectionTitle>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KeyValue label="Contact">
                  {contact ? (
                    <>
                      {contact.name}
                      {contact.phone && (
                        <a className="text-brand block text-xs" href={`tel:${contact.phone}`}>
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a className="text-brand block truncate text-xs" href={`mailto:${contact.email}`}>
                          {contact.email}
                        </a>
                      )}
                    </>
                  ) : (
                    o.contactName
                  )}
                </KeyValue>
                <KeyValue label="Value">
                  <span className="tabular-nums">{formatMoney(o.valuePence)}</span>
                  {o.valueLowPence != null && !current && (
                    <span className="text-muted-foreground block text-xs">
                      est. {formatMoney(o.valueLowPence)}–{formatMoney(o.valueHighPence)}
                    </span>
                  )}
                </KeyValue>
                <KeyValue label="Owner">{o.ownerName}</KeyValue>
                <KeyValue label="Source">
                  {SOURCE_LABELS[o.source]}
                  {o.campaign && <span className="text-muted-foreground block text-xs">{o.campaign}</span>}
                  {o.tracking?.gclid && <span className="text-muted-foreground block truncate text-xs">gclid {o.tracking.gclid}</span>}
                </KeyValue>
                <KeyValue label="Decision">{o.decisionOn ? formatDay(o.decisionOn, true) : "—"}</KeyValue>
                <KeyValue label="Install window">{o.installWindow ?? "—"}</KeyValue>
                <KeyValue label="Logged">{formatDay(o.createdAt, true)}</KeyValue>
                <KeyValue label="In stage">{diffDays(today, o.stageChangedAt)} days</KeyValue>
              </div>
              {o.description && <p className="bg-muted/50 mt-4 rounded-md p-3 text-sm whitespace-pre-line">{o.description}</p>}
              {o.stage === "lost" && (
                <p className="bg-destructive/5 text-destructive mt-4 rounded-md p-3 text-sm">
                  Lost: {o.lostReason}
                  {o.lostTo ? ` to ${o.lostTo}` : ""} on {formatDay(o.closedAt, true)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <SectionTitle
                action={
                  canWrite &&
                  !closed &&
                  (o.survey ? (
                    <div className="flex gap-2">
                      <BookSurveyDialog
                        label="Reschedule"
                        action={bookSurveyAction.bind(null, o.ref)}
                        users={userOptions}
                        defaultSurveyor={o.survey.surveyorId ?? user.id}
                        defaultFee={poundsInput(o.survey.feePence)}
                        defaultWhen={o.survey.scheduledAt ? new Date(o.survey.scheduledAt).toISOString().slice(0, 16) : defaultSurvey}
                      />
                      <SurveyResultDialog
                        action={surveyResultAction.bind(null, o.ref)}
                        values={{ measurements: o.survey.measurements, civilWorks: o.survey.civilWorks, feeStatus: o.survey.feeStatus }}
                      />
                    </div>
                  ) : (
                    o.stage !== "enquiry" && (
                      <BookSurveyDialog
                        action={bookSurveyAction.bind(null, o.ref)}
                        users={userOptions}
                        defaultSurveyor={user.id}
                        defaultFee={o.segment === "lift_company" ? "350" : undefined}
                        defaultWhen={defaultSurvey}
                      />
                    )
                  ))
                }
              >
                Survey
              </SectionTitle>
              {o.survey ? (
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <KeyValue label="When">{formatDateTime(o.survey.scheduledAt)}</KeyValue>
                    <KeyValue label="Surveyor">{o.survey.surveyorName}</KeyValue>
                    <KeyValue label="Attendees">{o.survey.attendees ?? "—"}</KeyValue>
                    <KeyValue label="Fee">
                      {o.survey.feePence ? `${formatMoney(o.survey.feePence)} · ${o.survey.feeStatus}` : "No fee"}
                    </KeyValue>
                  </div>
                  {(o.survey.measurements || o.survey.civilWorks) && (
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <div className="text-muted-foreground mb-1 text-xs font-medium uppercase">Measurements</div>
                        <p className="whitespace-pre-line">{o.survey.measurements ?? "—"}</p>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1 text-xs font-medium uppercase">Builders and civil works</div>
                        <p className="whitespace-pre-line">{o.survey.civilWorks ?? "—"}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No survey booked.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <SectionTitle>Quote register</SectionTitle>
              {o.quotes.length === 0 ? (
                <p className="text-muted-foreground text-sm">No quotes yet. Add the quote once it has been written.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {[...o.quotes].reverse().map((q) => (
                    <li key={q._id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {q.ref} <span className="text-muted-foreground font-normal">· revision {q.revision}</span>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {q.sentOn ? `Sent ${formatDay(q.sentOn, true)} · day ${diffDays(today, q.sentOn)}` : `Recorded ${formatDay(q.createdAt)}`}
                          {q.options.length > 0 && ` · options: ${q.options.map((x) => `${x.label} ${formatMoney(x.pence)}`).join(", ")}`}
                        </div>
                      </div>
                      <Badge variant={q.status === "accepted" ? "success" : q.status === "declined" ? "destructive" : q.status === "sent" ? "outline" : "secondary"}>
                        {q.status}
                      </Badge>
                      <span className="w-24 text-right font-medium tabular-nums">{formatMoney(q.totalPence)}</span>
                      {q.status === "draft" && canWrite && !closed && (
                        <ActionButton size="sm" variant="brand" action={markQuoteSentAction.bind(null, o.ref, q._id)}>
                          Mark sent
                        </ActionButton>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <SectionTitle>Documents</SectionTitle>
              <DocumentsPanel
                subjectType="opportunity"
                subjectId={o._id}
                documents={documents}
                enabled={blobConfigured()}
                defaultCategory="quote"
                canUpload={canWrite}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card className="gap-0 pb-0">
            <CardContent className="pb-2">
              <SectionTitle
                action={
                  canWrite && (
                    <AddTaskDialog
                      action={createTaskAction.bind(null, "opportunity", o._id)}
                      users={userOptions}
                      defaultOwner={o.ownerId}
                      defaultDue={formatDayInput(addDays(today, 1))}
                    />
                  )
                }
              >
                Tasks
              </SectionTitle>
            </CardContent>
            <TaskList tasks={tasks} today={today} showOwner showSubject={false} empty="No tasks. Every open opportunity should have a next action." />
          </Card>
          <Card>
            <CardContent className="grid gap-4">
              <SectionTitle>Activity</SectionTitle>
              {canWrite && <NoteForm action={addOpportunityNoteAction.bind(null, o.ref)} />}
              <ActivityFeed items={activity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
