"use server";

import { refresh } from "next/cache";

import { db } from "@/lib/db/collections";
import { requireCapability, requireUser } from "@/lib/dal/session";
import * as tasks from "@/lib/dal/tasks";
import { DomainError, oid } from "@/lib/dal/util";
import { parseDay } from "@/lib/domain/dates";
import { can } from "@/lib/domain/permissions";
import { completeTaskSchema, formToObject, taskSchema } from "@/lib/validation";
import { handle, type ActionState } from "./state";

/** Anyone can complete their own tasks; completing others' needs write access. */
async function assertCanActOn(taskId: string) {
  const user = await requireUser();
  const task = await db.tasks().findOne({ _id: oid(taskId) }, { projection: { ownerId: 1 } });
  if (!task) throw new DomainError("Task not found");
  if (task.ownerId !== user.id && !can(user.role, "opportunity:write") && !can(user.role, "project:write") && !can(user.role, "billing:write")) {
    throw new DomainError("You can only update your own tasks");
  }
  return user;
}

export async function completeTaskAction(taskId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await assertCanActOn(taskId);
    await tasks.completeTask(oid(taskId), completeTaskSchema.parse(values).outcome, user);
    refresh();
    return { ok: true, message: "Task completed" };
  }, values);
}

export async function quickCompleteTaskAction(taskId: string): Promise<ActionState> {
  return handle(async () => {
    const user = await assertCanActOn(taskId);
    await tasks.completeTask(oid(taskId), undefined, user);
    refresh();
  });
}

export async function reopenTaskAction(taskId: string): Promise<ActionState> {
  return handle(async () => {
    await assertCanActOn(taskId);
    await tasks.reopenTask(oid(taskId));
    refresh();
  });
}

export async function rescheduleTaskAction(taskId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    await assertCanActOn(taskId);
    if (!values.dueOn || !values.ownerId) throw new DomainError("Choose a date and owner");
    await tasks.rescheduleTask(oid(taskId), parseDay(values.dueOn), values.ownerId);
    refresh();
    return { ok: true, message: "Task updated" };
  }, values);
}

export async function createTaskAction(
  subjectType: "opportunity" | "project",
  subjectId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability(subjectType === "project" ? "project:write" : "opportunity:write").catch(async (e) => {
      // Accounts may set chase tasks on projects.
      if (subjectType === "project") return requireCapability("billing:write");
      throw e;
    });
    const input = taskSchema.parse(values);
    const id = oid(subjectId);
    if (subjectType === "opportunity") {
      const o = await db.opportunities().findOne({ _id: id }, { projection: { ref: 1, clientName: 1, clientId: 1 } });
      if (!o) throw new DomainError("Opportunity not found");
      await tasks.createTask({ type: "opportunity", id, ref: o.ref, label: o.clientName }, input, user, o.clientId);
    } else {
      const p = await db.projects().findOne({ _id: id }, { projection: { ref: 1, clientName: 1, clientId: 1 } });
      if (!p) throw new DomainError("Project not found");
      await tasks.createTask({ type: "project", id, ref: p.ref, label: p.clientName }, input, user, p.clientId);
    }
    refresh();
    return { ok: true, message: "Task added" };
  }, values);
}
