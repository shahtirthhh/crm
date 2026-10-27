"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import * as clients from "@/lib/dal/clients";
import { logActivity } from "@/lib/dal/activity";
import { requireCapability } from "@/lib/dal/session";
import { oid } from "@/lib/dal/util";
import { db } from "@/lib/db/collections";
import { clientSchema, contactSchema, formToObject, noteSchema, siteSchema } from "@/lib/validation";
import { handle, type ActionState } from "./state";

export async function createClientAction(_: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  let id: string | undefined;
  const state = await handle(async () => {
    const user = await requireCapability("client:write");
    id = (await clients.createClient(clientSchema.parse(values), user))._id.toHexString();
  }, values);
  if (id) redirect(`/clients/${id}`);
  return state;
}

export async function updateClientAction(clientId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("client:write");
    await clients.updateClient(oid(clientId), clientSchema.parse(values), user);
    refresh();
    return { ok: true, message: "Client updated" };
  }, values);
}

export async function addContactAction(clientId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("client:write");
    await clients.addContact(oid(clientId), contactSchema.parse(values), user);
    refresh();
    return { ok: true, message: "Contact added" };
  }, values);
}

export async function addSiteAction(clientId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("client:write");
    await clients.addSite(oid(clientId), siteSchema.parse(values), user);
    refresh();
    return { ok: true, message: "Site added" };
  }, values);
}

export async function addLiftAction(clientId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("client:write");
    if (!values.siteId || !values.productName) return { ok: false, error: "Choose a site and enter the lift type", values };
    await clients.addLiftOnSite(
      oid(clientId),
      oid(values.siteId),
      {
        productName: values.productName.trim().slice(0, 200),
        servicedBy: values.servicedBy === "other" ? "other" : "dk",
        onMaintenance: values.onMaintenance === "on",
        notes: values.notes?.trim() || undefined,
      },
      user,
    );
    refresh();
    return { ok: true, message: "Lift recorded" };
  }, values);
}

export async function addClientNoteAction(clientId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("client:write");
    const { note } = noteSchema.parse(values);
    const c = await db.clients().findOne({ _id: oid(clientId) }, { projection: { name: 1 } });
    if (!c) throw new Error("Client not found");
    await logActivity(user, clients.clientSubject(c), values.kind === "call" ? "call" : "note", note, { clientId: c._id });
    refresh();
    return { ok: true, message: values.kind === "call" ? "Call logged" : "Note added" };
  }, values);
}
