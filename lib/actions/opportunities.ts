"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import * as opps from "@/lib/dal/opportunities";
import { requireCapability } from "@/lib/dal/session";
import { db } from "@/lib/db/collections";
import { oid } from "@/lib/dal/util";
import { today } from "@/lib/domain/dates";
import {
  formToObject,
  lostSchema,
  noteSchema,
  opportunitySchema,
  opportunityUpdateSchema,
  quoteSchema,
  stageSchema,
  surveyResultSchema,
  surveySchema,
  wonSchema,
} from "@/lib/validation";
import { handle, type ActionState } from "./state";

export async function createOpportunityAction(_: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  let ref: string | undefined;
  const state = await handle(async () => {
    const user = await requireCapability("opportunity:write");
    const input = opportunitySchema.parse(values);
    ref = (await opps.createOpportunity(input, user)).ref;
  }, values);
  if (ref) redirect(values.returnTo === "today" ? "/today" : `/opportunities/${ref}`);
  return state;
}

export async function updateOpportunityAction(ref: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("opportunity:write");
    await opps.updateOpportunity(ref, opportunityUpdateSchema.parse(values), user);
    refresh();
    return { ok: true, message: "Opportunity updated" };
  }, values);
}

export async function changeStageAction(ref: string, stage: string): Promise<ActionState> {
  return handle(async () => {
    const user = await requireCapability("opportunity:write");
    await opps.changeStage(ref, stageSchema.parse({ stage }).stage, user);
    refresh();
  });
}

export async function bookSurveyAction(ref: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("opportunity:write");
    await opps.bookSurvey(ref, surveySchema.parse(values), user);
    refresh();
    return { ok: true, message: "Survey booked" };
  }, values);
}

export async function surveyResultAction(ref: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("opportunity:write");
    await opps.recordSurveyResult(ref, surveyResultSchema.parse(values), user);
    refresh();
    return { ok: true, message: "Survey notes saved" };
  }, values);
}

export async function addQuoteAction(ref: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("opportunity:write");
    const input = quoteSchema.parse(values);
    const documentId = values.documentId ? oid(values.documentId) : undefined;
    await opps.addQuote(ref, input, user, documentId);
    refresh();
    return { ok: true, message: input.sendNow ? "Quote sent; follow-ups scheduled" : "Quote saved as draft" };
  }, values);
}

export async function markQuoteSentAction(ref: string, quoteId: string): Promise<ActionState> {
  return handle(async () => {
    const user = await requireCapability("opportunity:write");
    await opps.markQuoteSent(ref, oid(quoteId), today(), user);
    refresh();
    return { ok: true, message: "Quote sent; day 4 and day 10 follow-ups scheduled" };
  });
}

export async function markWonAction(ref: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  let projectRef: string | undefined;
  const state = await handle(async () => {
    const user = await requireCapability("opportunity:close");
    projectRef = (await opps.markWon(ref, wonSchema.parse(values), user)).ref;
  }, values);
  if (projectRef) redirect(`/projects/${projectRef}`);
  return state;
}

export async function markLostAction(ref: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("opportunity:close");
    await opps.markLost(ref, lostSchema.parse(values), user);
    refresh();
    return { ok: true, message: "Marked lost" };
  }, values);
}

export async function reopenAction(ref: string): Promise<ActionState> {
  return handle(async () => {
    const user = await requireCapability("opportunity:close");
    await opps.reopen(ref, user);
    refresh();
  });
}

export async function addOpportunityNoteAction(ref: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("opportunity:write");
    const { note } = noteSchema.parse(values);
    const o = await db.opportunities().findOne({ ref }, { projection: { ref: 1, clientName: 1, clientId: 1 } });
    if (!o) throw new Error("Opportunity not found");
    if (values.kind === "call") await opps.logCall(ref, note, user);
    else await opps.addNote(opps.opportunitySubject(o), note, user, o.clientId);
    refresh();
    return { ok: true, message: values.kind === "call" ? "Call logged" : "Note added" };
  }, values);
}
