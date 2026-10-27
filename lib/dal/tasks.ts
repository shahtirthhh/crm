import "server-only";

import { ObjectId, type ClientSession, type Filter } from "mongodb";
import type { z } from "zod";

import { db } from "@/lib/db/collections";
import type { Subject, TaskDoc } from "@/lib/db/types";
import type { TaskKind } from "@/lib/domain/constants";
import { addDays, today as todayFn } from "@/lib/domain/dates";
import type { taskSchema } from "@/lib/validation";
import { logActivity } from "./activity";
import { listUsers } from "./reference";
import type { CurrentUser } from "./session";
import { DomainError, NotFoundError, plain } from "./util";

export interface NewTask {
  title: string;
  kind: TaskKind;
  subject: Subject;
  ownerId: string;
  ownerName: string;
  dueOn: Date;
  notes?: string;
  ruleKey?: string;
}

export async function userName(id: string): Promise<string> {
  const user = (await listUsers()).find((u) => u.id === id);
  if (!user) throw new DomainError("Unknown user");
  return user.name;
}

/** Inserts a task. Tasks with a ruleKey are upserted, so automatic rules can safely re-run. */
export async function insertTask(task: NewTask, createdBy: string, session?: ClientSession) {
  const now = new Date();
  const doc = { ...task, status: "open" as const, createdAt: now, updatedAt: now, createdBy };
  if (task.ruleKey) {
    await db
      .tasks()
      .updateOne({ ruleKey: task.ruleKey }, { $setOnInsert: { _id: new ObjectId(), ...doc } }, { upsert: true, session });
  } else {
    await db.tasks().insertOne({ _id: new ObjectId(), ...doc }, { session });
  }
}

export async function createTask(subject: Subject, input: z.infer<typeof taskSchema>, user: CurrentUser, clientId?: ObjectId) {
  const ownerName = await userName(input.ownerId);
  await insertTask(
    { title: input.title, kind: input.kind, subject, ownerId: input.ownerId, ownerName, dueOn: input.dueOn!, notes: input.notes },
    user.id,
  );
  await logActivity(user, subject, "task.created", `Task set for ${ownerName}: ${input.title}`, { clientId });
}

/** Cancels open tasks on a subject, optionally only those created by a rule prefix. */
export async function cancelOpenTasks(subjectId: ObjectId, opts: { rulePrefix?: string; session?: ClientSession } = {}) {
  const filter: Filter<TaskDoc> = { "subject.id": subjectId, status: "open" };
  if (opts.rulePrefix) filter.ruleKey = { $regex: `^${opts.rulePrefix.replace(/\./g, "\\.")}` };
  await db.tasks().updateMany(filter, { $set: { status: "cancelled", updatedAt: new Date() } }, { session: opts.session });
}

export async function completeTask(id: ObjectId, outcome: string | undefined, user: CurrentUser) {
  const now = new Date();
  const task = await db.tasks().findOne({ _id: id });
  if (!task) throw new NotFoundError("Task");
  if (task.status !== "open") throw new DomainError("This task is already closed");
  const onTime = todayFn(now).getTime() <= task.dueOn.getTime();
  await db.tasks().updateOne(
    { _id: id, status: "open" },
    { $set: { status: "done", completedAt: now, completedBy: user.id, onTime, outcome, updatedAt: now } },
  );
  await logActivity(user, task.subject, "task.completed", `${task.title} completed${outcome ? `: ${outcome}` : ""}`, {
    meta: { taskId: id.toHexString(), onTime },
  });
  return task;
}

export async function reopenTask(id: ObjectId) {
  await db
    .tasks()
    .updateOne({ _id: id, status: "done" }, { $set: { status: "open", updatedAt: new Date() }, $unset: { completedAt: "", completedBy: "", onTime: "", outcome: "" } });
}

export async function rescheduleTask(id: ObjectId, dueOn: Date, ownerId: string) {
  const ownerName = await userName(ownerId);
  await db.tasks().updateOne({ _id: id, status: "open" }, { $set: { dueOn, ownerId, ownerName, updatedAt: new Date() } });
}

export type TaskView = "mine" | "team" | "overdue" | "completed";

export async function listTasks(view: TaskView, user: CurrentUser, opts: { ownerId?: string } = {}) {
  const today = todayFn();
  let filter: Filter<TaskDoc>;
  let sort: Record<string, 1 | -1> = { dueOn: 1 };
  switch (view) {
    case "mine":
      filter = { status: "open", ownerId: user.id };
      break;
    case "team":
      filter = { status: "open", ...(opts.ownerId ? { ownerId: opts.ownerId } : {}) };
      break;
    case "overdue":
      filter = { status: "open", dueOn: { $lt: today } };
      break;
    case "completed":
      filter = { status: "done", completedAt: { $gte: addDays(today, -30) } };
      sort = { completedAt: -1 };
      break;
  }
  return plain(await db.tasks().find(filter).sort(sort).limit(300).toArray());
}

export async function tasksForSubject(subjectId: ObjectId) {
  return plain(
    await db
      .tasks()
      .find({ "subject.id": subjectId, status: { $in: ["open", "done"] } })
      .sort({ status: -1, dueOn: 1 })
      .limit(100)
      .toArray(),
  );
}

/** Next open task per subject, for board cards and project lists. */
export async function nextTaskBySubject(subjectIds: ObjectId[]) {
  if (!subjectIds.length) return new Map<string, { title: string; dueOn: Date; kind: TaskKind }>();
  const rows = await db
    .tasks()
    .aggregate<{ _id: ObjectId; title: string; dueOn: Date; kind: TaskKind }>([
      { $match: { "subject.id": { $in: subjectIds }, status: "open" } },
      { $sort: { dueOn: 1 } },
      { $group: { _id: "$subject.id", title: { $first: "$title" }, dueOn: { $first: "$dueOn" }, kind: { $first: "$kind" } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id.toHexString(), { title: r.title, dueOn: r.dueOn, kind: r.kind }]));
}

/** Share of tasks that fell due in the last 30 days and were completed on or before the day. */
export async function followUpDiscipline(days = 30) {
  const today = todayFn();
  const from = addDays(today, -days);
  const [row] = await db
    .tasks()
    .aggregate<{ due: number; onTime: number }>([
      { $match: { dueOn: { $gte: from, $lte: today }, status: { $ne: "cancelled" } } },
      { $group: { _id: null, due: { $sum: 1 }, onTime: { $sum: { $cond: [{ $eq: ["$onTime", true] }, 1, 0] } } } },
    ])
    .toArray();
  return { due: row?.due ?? 0, onTime: row?.onTime ?? 0 };
}

export async function openTasksByOwner() {
  return db
    .tasks()
    .aggregate<{ _id: string; name: string; open: number; overdue: number }>([
      { $match: { status: "open" } },
      {
        $group: {
          _id: "$ownerId",
          name: { $first: "$ownerName" },
          open: { $sum: 1 },
          overdue: { $sum: { $cond: [{ $lt: ["$dueOn", todayFn()] }, 1, 0] } },
        },
      },
      { $sort: { open: -1 } },
    ])
    .toArray();
}

export async function taskCounts(userId: string) {
  const today = todayFn();
  const [mine, overdue] = await Promise.all([
    db.tasks().countDocuments({ status: "open", ownerId: userId, dueOn: { $lte: today } }),
    db.tasks().countDocuments({ status: "open", dueOn: { $lt: today } }),
  ]);
  return { mineDue: mine, overdue };
}
