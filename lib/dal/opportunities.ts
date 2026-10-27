import "server-only";

import { ObjectId, type Filter } from "mongodb";
import type { z } from "zod";

import { db, nextRef } from "@/lib/db/collections";
import { mongoClient } from "@/lib/db/mongo";
import type { OpportunityDoc, ProjectDoc, Quote, Subject } from "@/lib/db/types";
import {
  OPEN_STAGES,
  SOURCE_LABELS,
  STAGE_LABELS,
  TRADE_SURVEY_FEE_PENCE,
  type OpenStage,
  type Segment,
  type Source,
  type Stage,
} from "@/lib/domain/constants";
import { addDays, today as todayFn, toDay } from "@/lib/domain/dates";
import { quoteFollowUpTasks } from "@/lib/domain/followups";
import { formatMoney } from "@/lib/domain/money";
import { canTransition, pipelineValue } from "@/lib/domain/stages";
import type {
  lostSchema,
  opportunitySchema,
  opportunityUpdateSchema,
  quoteSchema,
  surveyResultSchema,
  surveySchema,
  wonSchema,
} from "@/lib/validation";
import { logActivity } from "./activity";
import { resolveClientContactSite } from "./clients";
import { listProducts } from "./reference";
import type { CurrentUser } from "./session";
import { cancelOpenTasks, insertTask, nextTaskBySubject, userName } from "./tasks";
import { DomainError, NotFoundError, escapeRegex, plain } from "./util";

export function opportunitySubject(o: Pick<OpportunityDoc, "_id" | "ref" | "clientName">): Subject {
  return { type: "opportunity", id: o._id, ref: o.ref, label: o.clientName };
}

function currentQuote(o: Pick<OpportunityDoc, "quotes">): Quote | undefined {
  return o.quotes.filter((q) => q.status !== "superseded" && q.status !== "draft").at(-1) ?? o.quotes.at(-1);
}

async function product(productId: string) {
  const p = (await listProducts()).find((x) => x.id === productId);
  if (!p) throw new DomainError("Unknown product");
  return p;
}

async function load(ref: string): Promise<OpportunityDoc> {
  const o = await db.opportunities().findOne({ ref });
  if (!o) throw new NotFoundError("Opportunity");
  return o;
}

// ---------- Queries ----------

export interface OpportunityFilters {
  q?: string;
  ownerId?: string;
  source?: Source;
  segment?: Segment;
  stage?: Stage;
}

function buildFilter(f: OpportunityFilters): Filter<OpportunityDoc> {
  const filter: Filter<OpportunityDoc> = {};
  if (f.ownerId) filter.ownerId = f.ownerId;
  if (f.source) filter.source = f.source;
  if (f.segment) filter.segment = f.segment;
  if (f.stage) filter.stage = f.stage;
  if (f.q) {
    const rx = new RegExp(escapeRegex(f.q.trim()), "i");
    filter.$or = [{ clientName: rx }, { ref: rx }, { productName: rx }, { siteName: rx }];
  }
  return filter;
}

const CARD_PROJECTION = { survey: 0, description: 0, tracking: 0, "quotes.options": 0, "quotes.notes": 0 } as const;

/** Open opportunities plus those won in the last 30 days, with each card's next task. */
export async function boardData(f: OpportunityFilters) {
  const since = addDays(todayFn(), -30);
  const filter = buildFilter(f);
  const rows = await db
    .opportunities()
    .find(
      { ...filter, $or: [{ stage: { $in: [...OPEN_STAGES] } }, { stage: "won", closedAt: { $gte: since } }], ...(filter.$or ? { $and: [{ $or: filter.$or }] } : {}) },
      { projection: CARD_PROJECTION },
    )
    .sort({ valuePence: -1 })
    .limit(500)
    .toArray();
  const next = await nextTaskBySubject(rows.map((r) => r._id));
  return rows.map((r) => ({ ...plain(r), nextTask: next.get(r._id.toHexString()) ?? null }));
}

export async function listOpportunities(f: OpportunityFilters & { page?: number }) {
  const pageSize = 50;
  const page = Math.max(1, f.page ?? 1);
  const filter = buildFilter(f);
  const [rows, total] = await Promise.all([
    db.opportunities().find(filter, { projection: CARD_PROJECTION }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    db.opportunities().countDocuments(filter),
  ]);
  const next = await nextTaskBySubject(rows.map((r) => r._id));
  return { rows: rows.map((r) => ({ ...plain(r), nextTask: next.get(r._id.toHexString()) ?? null })), total, page, pageSize };
}

export async function getOpportunity(ref: string) {
  const o = await db.opportunities().findOne({ ref });
  return o ? plain(o) : null;
}

/** Enquiries waiting for sales admin triage (e.g. from the website form). */
export async function triageQueue() {
  return plain(await db.opportunities().find({ needsTriage: true, stage: "enquiry" }, { projection: CARD_PROJECTION }).sort({ createdAt: 1 }).toArray());
}

export async function quotesAwaitingDecision() {
  return plain(
    await db
      .opportunities()
      .find({ stage: { $in: ["quote_sent", "follow_up"] } }, { projection: CARD_PROJECTION })
      .sort({ quoteSentOn: 1 })
      .toArray(),
  );
}

// ---------- Mutations ----------

export async function createOpportunity(input: z.infer<typeof opportunitySchema>, user: CurrentUser) {
  const [prod, ownerName] = await Promise.all([product(input.productId), userName(input.ownerId)]);
  const { client, contact, site } = await resolveClientContactSite(input, user);
  const now = new Date();
  const ref = await nextRef("opportunity");
  const doc: OpportunityDoc = {
    _id: new ObjectId(),
    ref,
    clientId: client._id,
    clientName: client.name,
    contactId: contact?._id,
    contactName: contact?.name,
    siteId: site?._id,
    siteName: site?.name,
    segment: input.segment,
    productId: new ObjectId(prod.id),
    productName: prod.name,
    quantity: input.quantity,
    source: input.source,
    campaign: input.campaign,
    valueLowPence: input.valueLow,
    valueHighPence: input.valueHigh,
    valuePence: pipelineValue({ valueLow: input.valueLow, valueHigh: input.valueHigh }),
    ownerId: input.ownerId,
    ownerName,
    stage: "enquiry",
    stageChangedAt: now,
    description: input.description,
    installWindow: input.installWindow,
    quotes: [],
    createdAt: now,
    updatedAt: now,
    createdBy: user.id,
  };
  await db.opportunities().insertOne(doc);
  const subject = opportunitySubject(doc);
  await insertTask(
    { title: input.nextActionTitle, kind: "general", subject, ownerId: input.ownerId, ownerName, dueOn: input.nextActionDue! },
    user.id,
  );
  await logActivity(user, subject, "opportunity.created", `Enquiry ${ref} logged from ${SOURCE_LABELS[input.source]}`, {
    clientId: client._id,
  });
  return doc;
}

export async function updateOpportunity(ref: string, input: z.infer<typeof opportunityUpdateSchema>, user: CurrentUser) {
  const o = await load(ref);
  const [prod, ownerName] = await Promise.all([product(input.productId), userName(input.ownerId)]);
  const client = await db.clients().findOne({ _id: o.clientId }, { projection: { contacts: 1, sites: 1 } });
  const site = input.siteId ? client?.sites.find((s) => s._id.equals(input.siteId!)) : undefined;
  const contact = input.contactId ? client?.contacts.find((c) => c._id.equals(input.contactId!)) : undefined;
  const quote = currentQuote(o);
  await db.opportunities().updateOne(
    { _id: o._id },
    {
      $set: {
        productId: new ObjectId(prod.id),
        productName: prod.name,
        quantity: input.quantity,
        source: input.source,
        campaign: input.campaign,
        valueLowPence: input.valueLow,
        valueHighPence: input.valueHigh,
        valuePence: pipelineValue({ valueLow: input.valueLow, valueHigh: input.valueHigh, currentQuoteTotal: quote?.totalPence }),
        ownerId: input.ownerId,
        ownerName,
        description: input.description,
        installWindow: input.installWindow,
        decisionOn: input.decisionOn,
        siteId: site?._id,
        siteName: site?.name,
        contactId: contact?._id ?? o.contactId,
        contactName: contact?.name ?? o.contactName,
        needsTriage: false,
        updatedAt: new Date(),
      },
    },
  );
  if (o.ownerId !== input.ownerId) {
    await logActivity(user, opportunitySubject(o), "opportunity.reassigned", `Owner changed to ${ownerName}`, { clientId: o.clientId });
  }
}

export async function changeStage(ref: string, to: OpenStage, user: CurrentUser) {
  const o = await load(ref);
  if (o.stage === to) return;
  if (!canTransition(o.stage, to)) {
    throw new DomainError(`Cannot move from ${STAGE_LABELS[o.stage]} to ${STAGE_LABELS[to]}`);
  }
  if ((to === "quote_sent" || to === "follow_up") && !o.quotes.some((q) => q.status === "sent")) {
    throw new DomainError("Record and send a quote before moving to this stage");
  }
  await db.opportunities().updateOne(
    { _id: o._id, stage: o.stage },
    { $set: { stage: to, stageChangedAt: new Date(), updatedAt: new Date() }, $unset: { closedAt: "", lostReason: "", lostTo: "" } },
  );
  await logActivity(user, opportunitySubject(o), "opportunity.stage", `Moved from ${STAGE_LABELS[o.stage]} to ${STAGE_LABELS[to]}`, {
    clientId: o.clientId,
    meta: { from: o.stage, to },
  });
}

export async function bookSurvey(ref: string, input: z.infer<typeof surveySchema>, user: CurrentUser) {
  const o = await load(ref);
  if (o.stage === "won" || o.stage === "lost") throw new DomainError("This opportunity is closed");
  const surveyorName = await userName(input.surveyorId);
  const feePence = input.fee ?? (o.segment === "lift_company" ? TRADE_SURVEY_FEE_PENCE : 0);
  const now = new Date();
  await db.opportunities().updateOne(
    { _id: o._id },
    {
      $set: {
        survey: {
          ...(o.survey ?? {}),
          scheduledAt: input.scheduledAt,
          attendees: input.attendees,
          surveyorId: input.surveyorId,
          surveyorName,
          feePence,
          feeStatus: o.survey?.feeStatus ?? (feePence ? "invoiced" : "none"),
        },
        ...(o.stage === "enquiry" ? { stage: "survey_booked" as const, stageChangedAt: now } : {}),
        needsTriage: false,
        updatedAt: now,
      },
    },
  );
  const subject = opportunitySubject(o);
  await insertTask(
    {
      title: `Survey${o.siteName ? ` · ${o.siteName}` : ""}`,
      kind: "survey",
      subject,
      ownerId: input.surveyorId,
      ownerName: surveyorName,
      dueOn: toDay(input.scheduledAt),
      ruleKey: `survey:${o.ref}:${input.scheduledAt.toISOString()}`,
    },
    user.id,
  );
  await logActivity(
    user,
    subject,
    "survey.booked",
    `Survey booked with ${surveyorName}${feePence ? `, ${formatMoney(feePence)} fee recorded` : ""}`,
    { clientId: o.clientId },
  );
}

export async function recordSurveyResult(ref: string, input: z.infer<typeof surveyResultSchema>, user: CurrentUser) {
  const o = await load(ref);
  if (!o.survey) throw new DomainError("Book the survey first");
  await db.opportunities().updateOne(
    { _id: o._id },
    {
      $set: {
        "survey.measurements": input.measurements,
        "survey.civilWorks": input.civilWorks,
        "survey.feeStatus": input.feeStatus,
        "survey.completedAt": o.survey.completedAt ?? new Date(),
        updatedAt: new Date(),
      },
    },
  );
  await logActivity(user, opportunitySubject(o), "survey.completed", "Survey notes recorded", { clientId: o.clientId });
}

/**
 * Records a quote. When sent, earlier quotes are superseded, follow-up tasks for earlier
 * revisions are cancelled, and day 4 and day 10 tasks are created for the owner.
 */
export async function addQuote(ref: string, input: z.infer<typeof quoteSchema>, user: CurrentUser, documentId?: ObjectId) {
  const o = await load(ref);
  if (o.stage === "won" || o.stage === "lost") throw new DomainError("This opportunity is closed");
  const quote: Quote = {
    _id: new ObjectId(),
    ref: await nextRef("quote"),
    revision: o.quotes.length + 1,
    totalPence: input.total!,
    options: input.options,
    notes: input.notes,
    documentId,
    status: "draft",
    createdAt: new Date(),
  };
  await db.opportunities().updateOne({ _id: o._id }, { $push: { quotes: quote }, $set: { updatedAt: new Date() } });
  await logActivity(user, opportunitySubject(o), "quote.created", `Quote ${quote.ref} recorded at ${formatMoney(quote.totalPence)}`, {
    clientId: o.clientId,
  });
  if (input.sendNow) await markQuoteSent(ref, quote._id, input.sentOn ?? todayFn(), user);
  return quote;
}

export async function markQuoteSent(ref: string, quoteId: ObjectId, sentOn: Date, user: CurrentUser) {
  const o = await load(ref);
  const quote = o.quotes.find((q) => q._id.equals(quoteId));
  if (!quote) throw new NotFoundError("Quote");
  if (quote.status !== "draft") throw new DomainError("This quote has already been sent");
  const subject = opportunitySubject(o);
  const tasks = quoteFollowUpTasks(quote.ref, sentOn);

  await mongoClient.withSession((session) =>
    session.withTransaction(async () => {
      await db.opportunities().updateOne(
        { _id: o._id },
        {
          $set: {
            "quotes.$[q].status": "sent",
            "quotes.$[q].sentOn": sentOn,
            "quotes.$[old].status": "superseded",
            quoteSentOn: sentOn,
            valuePence: quote.totalPence,
            stage: "quote_sent",
            stageChangedAt: new Date(),
            needsTriage: false,
            updatedAt: new Date(),
          },
        },
        {
          arrayFilters: [{ "q._id": quote._id }, { "old.status": "sent", "old._id": { $ne: quote._id } }],
          session,
        },
      );
      await cancelOpenTasks(o._id, { rulePrefix: "quote.followup.", session });
      for (const t of tasks) {
        await insertTask({ ...t, subject, ownerId: o.ownerId, ownerName: o.ownerName }, user.id, session);
      }
    }),
  );

  await logActivity(user, subject, "quote.sent", `Quote ${quote.ref} issued at ${formatMoney(quote.totalPence)}; day 4 and day 10 follow-ups set`, {
    clientId: o.clientId,
  });
}

/** Marks the opportunity won and opens a project awaiting the client's purchase order. */
export async function markWon(ref: string, input: z.infer<typeof wonSchema>, user: CurrentUser) {
  const o = await load(ref);
  if (!canTransition(o.stage, "won")) throw new DomainError("Send a quote before marking this opportunity won");
  const pmName = await userName(input.pmId);
  const prod = o.productId ? (await listProducts()).find((p) => p.id === o.productId!.toHexString()) : undefined;
  const now = new Date();
  const projectRef = await nextRef("project");
  const quote = currentQuote(o);
  const surveyCreditPence = o.survey?.feeStatus === "paid" || o.survey?.feeStatus === "invoiced" ? o.survey.feePence : 0;

  const project: ProjectDoc = {
    _id: new ObjectId(),
    ref: projectRef,
    opportunityId: o._id,
    opportunityRef: o.ref,
    clientId: o.clientId,
    clientName: o.clientName,
    siteId: o.siteId,
    siteName: o.siteName,
    productName: o.productName,
    quantity: o.quantity,
    pmId: input.pmId,
    pmName,
    contractValuePence: input.contractValue!,
    surveyCreditPence,
    manufacturer: prod?.manufacturer,
    leadTimeWeeks: prod?.leadTimeWeeks ?? 11,
    installDays: prod?.installDays ?? 5,
    status: "awaiting_po",
    programme: [],
    milestones: [],
    createdAt: now,
    updatedAt: now,
    createdBy: user.id,
  };
  const subject = opportunitySubject(o);
  const projectSubject: Subject = { type: "project", id: project._id, ref: projectRef, label: o.clientName };

  await mongoClient.withSession((session) =>
    session.withTransaction(async () => {
      const res = await db.opportunities().updateOne(
        { _id: o._id, stage: o.stage },
        {
          $set: {
            stage: "won",
            stageChangedAt: now,
            closedAt: now,
            projectId: project._id,
            valuePence: input.contractValue!,
            updatedAt: now,
            ...(quote ? { "quotes.$[q].status": "accepted" } : {}),
            ...(surveyCreditPence ? { "survey.feeStatus": "credited" } : {}),
          },
        },
        { session, ...(quote ? { arrayFilters: [{ "q._id": quote._id }] } : {}) },
      );
      if (!res.modifiedCount) throw new DomainError("The opportunity changed while saving. Reload and try again.");
      await db.projects().insertOne(project, { session });
      await cancelOpenTasks(o._id, { session });
      await insertTask(
        {
          title: "Record client PO and raise 60% deposit",
          kind: "doc",
          subject: projectSubject,
          ownerId: input.pmId,
          ownerName: pmName,
          dueOn: addDays(todayFn(), 2),
          ruleKey: `project.po:${projectRef}`,
        },
        user.id,
        session,
      );
    }),
  );

  await logActivity(user, subject, "opportunity.won", `Won at ${formatMoney(input.contractValue)}; project ${projectRef} opened`, {
    clientId: o.clientId,
  });
  await logActivity(user, projectSubject, "project.created", `Project created from ${o.ref}, PM ${pmName}`, { clientId: o.clientId });
  return project;
}

export async function markLost(ref: string, input: z.infer<typeof lostSchema>, user: CurrentUser) {
  const o = await load(ref);
  if (!canTransition(o.stage, "lost")) throw new DomainError("This opportunity cannot be marked lost");
  const now = new Date();
  await db.opportunities().updateOne(
    { _id: o._id },
    {
      $set: {
        stage: "lost",
        stageChangedAt: now,
        closedAt: now,
        lostReason: input.lostReason,
        lostTo: input.lostTo,
        updatedAt: now,
        ...(o.quotes.length ? { "quotes.$[q].status": "declined" } : {}),
      },
    },
    o.quotes.length ? { arrayFilters: [{ "q.status": "sent" }] } : {},
  );
  await cancelOpenTasks(o._id);
  await logActivity(user, opportunitySubject(o), "opportunity.lost", `Lost: ${input.lostReason}${input.lostTo ? ` (to ${input.lostTo})` : ""}${input.notes ? `. ${input.notes}` : ""}`, {
    clientId: o.clientId,
    meta: { reason: input.lostReason },
  });
}

export async function reopen(ref: string, user: CurrentUser) {
  const o = await load(ref);
  if (o.stage !== "lost") throw new DomainError("Only lost opportunities can be reopened");
  await db.opportunities().updateOne(
    { _id: o._id },
    { $set: { stage: "enquiry", stageChangedAt: new Date(), updatedAt: new Date() }, $unset: { closedAt: "", lostReason: "", lostTo: "" } },
  );
  await logActivity(user, opportunitySubject(o), "opportunity.reopened", "Reopened", { clientId: o.clientId });
}

export async function addNote(subject: Subject, note: string, user: CurrentUser, clientId?: ObjectId) {
  await logActivity(user, subject, "note", note, { clientId });
}

export async function logCall(ref: string, summary: string, user: CurrentUser) {
  const o = await load(ref);
  await logActivity(user, opportunitySubject(o), "call", summary, { clientId: o.clientId });
}
