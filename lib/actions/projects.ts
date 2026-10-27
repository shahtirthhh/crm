"use server";

import { refresh } from "next/cache";

import { db } from "@/lib/db/collections";
import { logActivity } from "@/lib/dal/activity";
import * as projects from "@/lib/dal/projects";
import { requireCapability } from "@/lib/dal/session";
import { oid } from "@/lib/dal/util";
import { PROGRAMME_KEYS, type ProgrammeKey } from "@/lib/domain/programme";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/domain/constants";
import {
  clientPoSchema,
  formToObject,
  handoverSchema,
  milestoneSchema,
  noteSchema,
  programmeItemSchema,
  projectDetailsSchema,
} from "@/lib/validation";
import { handle, type ActionState } from "./state";

export async function recordClientPoAction(ref: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("project:write");
    await projects.recordClientPo(ref, clientPoSchema.parse(values), user);
    refresh();
    return { ok: true, message: "Programme and billing schedule generated" };
  }, values);
}

export async function updateProjectDetailsAction(ref: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("project:write");
    await projects.updateProjectDetails(ref, projectDetailsSchema.parse(values), user);
    refresh();
    return { ok: true, message: "Project updated" };
  }, values);
}

export async function rescheduleItemAction(ref: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("project:write");
    await projects.rescheduleProgrammeItem(ref, programmeItemSchema.parse(values), user);
    refresh();
    return { ok: true, message: "Programme updated" };
  }, values);
}

export async function setItemDoneAction(ref: string, key: string, done: boolean): Promise<ActionState> {
  return handle(async () => {
    const user = await requireCapability("project:write");
    if (!(PROGRAMME_KEYS as readonly string[]).includes(key)) throw new Error("Unknown item");
    await projects.setProgrammeItemDone(ref, key as ProgrammeKey, done, user);
    refresh();
  });
}

export async function updateMilestoneAction(ref: string, milestoneId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("billing:write");
    await projects.updateMilestone(ref, oid(milestoneId), milestoneSchema.parse(values), user);
    refresh();
    return { ok: true, message: "Billing status updated" };
  }, values);
}

export async function handoverAction(ref: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("project:write");
    await projects.recordHandover(ref, handoverSchema.parse(values), user);
    refresh();
    return { ok: true, message: "Handover recorded; warranty services scheduled" };
  }, values);
}

export async function setProjectStatusAction(ref: string, status: string): Promise<ActionState> {
  return handle(async () => {
    const user = await requireCapability("project:write");
    if (!(PROJECT_STATUSES as readonly string[]).includes(status)) throw new Error("Unknown status");
    await projects.setProjectStatus(ref, status as ProjectStatus, user);
    refresh();
  });
}

export async function addProjectNoteAction(ref: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("project:write").catch(() => requireCapability("billing:write"));
    const { note } = noteSchema.parse(values);
    const p = await db.projects().findOne({ ref }, { projection: { ref: 1, clientName: 1, clientId: 1 } });
    if (!p) throw new Error("Project not found");
    await logActivity(user, projects.projectSubject(p), "note", note, { clientId: p.clientId });
    refresh();
    return { ok: true, message: "Note added" };
  }, values);
}
