import "server-only";

import { ObjectId, type Filter } from "mongodb";
import type { z } from "zod";

import { db } from "@/lib/db/collections";
import type { Milestone, ProjectDoc, Subject } from "@/lib/db/types";
import { MILESTONE_LABELS, type MilestoneKind, type ProjectStatus } from "@/lib/domain/constants";
import { addDays, addMonths, formatDay, today as todayFn } from "@/lib/domain/dates";
import { isMilestoneOverdue, milestoneDueDates, planMilestones } from "@/lib/domain/billing";
import { formatMoney } from "@/lib/domain/money";
import { buildProgramme, PROGRAMME_LABELS, rescheduleItem, type ProgrammeKey } from "@/lib/domain/programme";
import type { clientPoSchema, handoverSchema, milestoneSchema, programmeItemSchema, projectDetailsSchema } from "@/lib/validation";
import { logActivity } from "./activity";
import type { CurrentUser } from "./session";
import { insertTask, nextTaskBySubject, userName } from "./tasks";
import { DomainError, NotFoundError, plain } from "./util";

export function projectSubject(p: Pick<ProjectDoc, "_id" | "ref" | "clientName">): Subject {
  return { type: "project", id: p._id, ref: p.ref, label: p.clientName };
}

async function load(ref: string): Promise<ProjectDoc> {
  const p = await db.projects().findOne({ ref });
  if (!p) throw new NotFoundError("Project");
  return p;
}

/** Re-derives due dates for milestones not yet raised, after the programme changes. */
function refreshMilestoneDates(p: Pick<ProjectDoc, "milestones" | "programme">): Milestone[] {
  const due = milestoneDueDates(p.programme);
  return p.milestones.map((m) => (m.status === "scheduled" ? { ...m, dueOn: due[m.kind] } : m));
}

// ---------- Queries ----------

export async function listProjects(tab: "live" | "awaiting_po" | "complete" | "all") {
  const filter: Filter<ProjectDoc> =
    tab === "all" ? {} : tab === "complete" ? { status: { $in: ["complete", "cancelled"] } } : { status: tab };
  const rows = await db.projects().find(filter).sort({ updatedAt: -1 }).limit(300).toArray();
  const next = await nextTaskBySubject(rows.map((r) => r._id));
  return rows.map((r) => ({ ...plain(r), nextTask: next.get(r._id.toHexString()) ?? null }));
}

export async function getProject(ref: string) {
  const p = await db.projects().findOne({ ref });
  return p ? plain(p) : null;
}

export interface BillingRow {
  projectRef: string;
  projectId: string;
  clientName: string;
  milestone: ReturnType<typeof plain<Milestone>>;
  overdue: boolean;
}

/** Every stage payment across projects, for accounts. */
export async function billingSchedule(filter: "due30" | "overdue" | "raised" | "all") {
  const today = todayFn();
  const rows = await db
    .projects()
    .aggregate<{ ref: string; _id: ObjectId; clientName: string; milestone: Milestone }>([
      { $match: { status: { $ne: "cancelled" } } },
      { $unwind: "$milestones" },
      { $project: { ref: 1, clientName: 1, milestone: "$milestones" } },
      { $sort: { "milestone.dueOn": 1 } },
    ])
    .toArray();
  const mapped: BillingRow[] = rows.map((r) => ({
    projectRef: r.ref,
    projectId: r._id.toHexString(),
    clientName: r.clientName,
    milestone: plain(r.milestone),
    overdue: isMilestoneOverdue(r.milestone, today),
  }));
  const in30 = addDays(today, 30);
  switch (filter) {
    case "due30":
      return mapped.filter((r) => r.milestone.status !== "paid" && r.milestone.dueOn && r.milestone.dueOn <= in30);
    case "overdue":
      return mapped.filter((r) => r.overdue);
    case "raised":
      return mapped.filter((r) => r.milestone.status === "raised");
    default:
      return mapped;
  }
}

// ---------- Mutations ----------

/** Records the client PO, generates the programme from the template and the 60/20/20 schedule. */
export async function recordClientPo(ref: string, input: z.infer<typeof clientPoSchema>, user: CurrentUser) {
  const p = await load(ref);
  if (p.status !== "awaiting_po") throw new DomainError("The client PO is already recorded");
  const programme = buildProgramme({
    clientPoOn: input.clientPoOn!,
    leadTimeWeeks: input.leadTimeWeeks,
    installDays: input.installDays,
  });
  programme[0] = { ...programme[0], done: true, completedOn: input.clientPoOn! };
  const milestones: Milestone[] = planMilestones(p.contractValuePence, programme).map((m) => ({
    _id: new ObjectId(),
    ...m,
    status: "scheduled",
  }));
  await db.projects().updateOne(
    { _id: p._id, status: "awaiting_po" },
    {
      $set: {
        clientPoRef: input.clientPoRef,
        clientPoOn: input.clientPoOn,
        manufacturer: input.manufacturer ?? p.manufacturer,
        leadTimeWeeks: input.leadTimeWeeks,
        installDays: input.installDays,
        programme,
        milestones,
        status: "live",
        updatedAt: new Date(),
      },
    },
  );
  const subject = projectSubject(p);
  await db.tasks().updateMany(
    { ruleKey: `project.po:${p.ref}`, status: "open" },
    { $set: { status: "done", completedAt: new Date(), completedBy: user.id, onTime: true, updatedAt: new Date() } },
  );
  const accounts = await db.users().find({ role: "accounts", active: { $ne: false } }).limit(1).toArray();
  const deposit = milestones[0];
  const owner = accounts[0] ? { id: accounts[0]._id.toHexString(), name: accounts[0].name } : { id: p.pmId, name: p.pmName };
  await insertTask(
    {
      title: `Raise ${deposit.label} · ${formatMoney(deposit.amountPence)}`,
      kind: "doc",
      subject,
      ownerId: owner.id,
      ownerName: owner.name,
      dueOn: input.clientPoOn!,
      ruleKey: `billing.raise:${deposit._id.toHexString()}`,
    },
    user.id,
  );
  await insertTask(
    {
      title: "Place manufacturer PO",
      kind: "doc",
      subject,
      ownerId: p.pmId,
      ownerName: p.pmName,
      dueOn: programme[1].end,
      ruleKey: `project.mfrpo:${p.ref}`,
    },
    user.id,
  );
  await logActivity(user, subject, "project.po", `Client PO recorded${input.clientPoRef ? ` (${input.clientPoRef})` : ""}; programme and billing schedule generated`, {
    clientId: p.clientId,
  });
}

export async function updateProjectDetails(ref: string, input: z.infer<typeof projectDetailsSchema>, user: CurrentUser) {
  const p = await load(ref);
  const pmName = await userName(input.pmId);
  await db.projects().updateOne(
    { _id: p._id },
    {
      $set: {
        pmId: input.pmId,
        pmName,
        manufacturer: input.manufacturer,
        manufacturerPoRef: input.manufacturerPoRef,
        clientPoRef: input.clientPoRef,
        notes: input.notes,
        updatedAt: new Date(),
      },
    },
  );
  await logActivity(user, projectSubject(p), "project.updated", "Project details updated", { clientId: p.clientId });
}

export async function rescheduleProgrammeItem(ref: string, input: z.infer<typeof programmeItemSchema>, user: CurrentUser) {
  const p = await load(ref);
  if (!p.programme.length) throw new DomainError("Record the client PO to generate the programme");
  const programme = rescheduleItem(p.programme, input.key, input.start!, input.end!, input.cascade);
  const milestones = refreshMilestoneDates({ programme, milestones: p.milestones });
  await db.projects().updateOne({ _id: p._id }, { $set: { programme, milestones, updatedAt: new Date() } });
  await logActivity(
    user,
    projectSubject(p),
    "programme.rescheduled",
    `${PROGRAMME_LABELS[input.key]} moved to ${formatDay(input.start)}–${formatDay(input.end)}${input.cascade ? ", later items shifted" : ""}`,
    { clientId: p.clientId },
  );
}

export async function setProgrammeItemDone(ref: string, key: ProgrammeKey, done: boolean, user: CurrentUser) {
  const p = await load(ref);
  const res = await db.projects().updateOne(
    { _id: p._id, "programme.key": key },
    { $set: { "programme.$.done": done, "programme.$.completedOn": done ? todayFn() : null, updatedAt: new Date() } },
  );
  if (!res.matchedCount) throw new NotFoundError("Programme item");
  await logActivity(user, projectSubject(p), "programme.progress", `${PROGRAMME_LABELS[key]} ${done ? "completed" : "reopened"}`, {
    clientId: p.clientId,
  });
}

export async function updateMilestone(ref: string, milestoneId: ObjectId, input: z.infer<typeof milestoneSchema>, user: CurrentUser) {
  const p = await load(ref);
  const m = p.milestones.find((x) => x._id.equals(milestoneId));
  if (!m) throw new NotFoundError("Milestone");
  const on = input.on ?? todayFn();
  const set: Record<string, unknown> = { "milestones.$.status": input.status, updatedAt: new Date() };
  if (input.invoiceRef !== undefined) set["milestones.$.invoiceRef"] = input.invoiceRef;
  if (input.status === "raised") set["milestones.$.raisedOn"] = on;
  if (input.status === "paid") {
    set["milestones.$.paidOn"] = on;
    if (!m.raisedOn) set["milestones.$.raisedOn"] = on;
  }
  await db.projects().updateOne({ _id: p._id, "milestones._id": milestoneId }, { $set: set });

  // Raising or paying closes the matching raise / chase tasks.
  const keys = input.status === "paid" ? [`billing.raise:${m._id}`, `billing.chase:${m._id}`] : [`billing.raise:${m._id}`];
  await db.tasks().updateMany(
    { ruleKey: { $in: keys }, status: "open" },
    { $set: { status: "done", completedAt: new Date(), completedBy: user.id, onTime: true, updatedAt: new Date() } },
  );
  await logActivity(
    user,
    projectSubject(p),
    `billing.${input.status}`,
    `${m.label} ${input.status === "scheduled" ? "reset to scheduled" : input.status}${input.invoiceRef ? ` (${input.invoiceRef})` : ""} · ${formatMoney(m.amountPence)}`,
    { clientId: p.clientId },
  );
}

/** Completes the project: records the lift on the client's site and the warranty services. */
export async function recordHandover(ref: string, input: z.infer<typeof handoverSchema>, user: CurrentUser) {
  const p = await load(ref);
  if (p.status !== "live") throw new DomainError("Only live projects can be handed over");
  const handoverOn = input.handoverOn!;
  let programme = p.programme;
  const handoverItem = programme.find((i) => i.key === "handover");
  if (handoverItem) {
    programme = rescheduleItem(programme, "handover", handoverOn, handoverOn, false).map((i) => {
      if (i.key === "handover" || i.key === "install") return { ...i, done: true, completedOn: handoverOn };
      if (i.key === "service_3m") return { ...i, start: addMonths(handoverOn, 3), end: addMonths(handoverOn, 3) };
      if (i.key === "service_9m") return { ...i, start: addMonths(handoverOn, 9), end: addMonths(handoverOn, 9) };
      return i;
    });
  }
  const milestones = refreshMilestoneDates({ programme, milestones: p.milestones });
  const warrantyEndsOn = addMonths(handoverOn, 12);

  await db.projects().updateOne(
    { _id: p._id },
    { $set: { status: "complete", handoverOn, warrantyEndsOn, programme, milestones, updatedAt: new Date() } },
  );

  if (p.siteId) {
    const lifts = Array.from({ length: p.quantity }, () => ({
      _id: new ObjectId(),
      productName: p.productName,
      servicedBy: "dk" as const,
      onMaintenance: input.onMaintenance,
      projectId: p._id,
      handoverOn,
      warrantyEndsOn,
    }));
    await db.clients().updateOne({ _id: p.clientId, "sites._id": p.siteId }, { $push: { "sites.$.lifts": { $each: lifts } } });
  }

  const subject = projectSubject(p);
  const maintenance = await db.users().find({ role: "maintenance_manager", active: { $ne: false } }).limit(1).toArray();
  const mm = maintenance[0] ? { id: maintenance[0]._id.toHexString(), name: maintenance[0].name } : { id: p.pmId, name: p.pmName };
  const final = milestones.find((m) => m.kind === "final");
  const accounts = await db.users().find({ role: "accounts", active: { $ne: false } }).limit(1).toArray();
  const acc = accounts[0] ? { id: accounts[0]._id.toHexString(), name: accounts[0].name } : { id: p.pmId, name: p.pmName };

  const tasks = [
    { title: "Add lift to Mainteny and offer a service plan", kind: "general" as const, owner: mm, dueOn: addDays(handoverOn, 2), key: `handover.mainteny:${p.ref}` },
    { title: "3-month warranty service visit", kind: "general" as const, owner: mm, dueOn: addMonths(handoverOn, 3), key: `handover.s3:${p.ref}` },
    { title: "9-month warranty service visit", kind: "general" as const, owner: mm, dueOn: addMonths(handoverOn, 9), key: `handover.s9:${p.ref}` },
    ...(final && final.status === "scheduled"
      ? [{ title: `Raise final 20% · ${formatMoney(final.amountPence)}`, kind: "doc" as const, owner: acc, dueOn: handoverOn, key: `billing.raise:${final._id}` }]
      : []),
  ];
  for (const t of tasks) {
    await insertTask({ title: t.title, kind: t.kind, subject, ownerId: t.owner.id, ownerName: t.owner.name, dueOn: t.dueOn, ruleKey: t.key }, user.id);
  }
  await logActivity(user, subject, "project.handover", `Handed over ${formatDay(handoverOn, true)}; warranty to ${formatDay(warrantyEndsOn, true)}`, {
    clientId: p.clientId,
  });
}

export async function setProjectStatus(ref: string, status: ProjectStatus, user: CurrentUser) {
  const p = await load(ref);
  await db.projects().updateOne({ _id: p._id }, { $set: { status, updatedAt: new Date() } });
  await logActivity(user, projectSubject(p), "project.status", `Status set to ${status}`, { clientId: p.clientId });
}

export function milestoneLabel(kind: MilestoneKind) {
  return MILESTONE_LABELS[kind];
}
