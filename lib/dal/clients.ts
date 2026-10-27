import "server-only";

import { ObjectId } from "mongodb";
import type { z } from "zod";

import { db } from "@/lib/db/collections";
import type { ClientDoc, Contact, Site, Subject } from "@/lib/db/types";
import type { Segment } from "@/lib/domain/constants";
import type { clientSchema, contactSchema, siteSchema } from "@/lib/validation";
import { logActivity } from "./activity";
import type { CurrentUser } from "./session";
import { DomainError, NotFoundError, escapeRegex, plain } from "./util";

export function clientSubject(c: Pick<ClientDoc, "_id" | "name">): Subject {
  return { type: "client", id: c._id, ref: c.name, label: c.name };
}

export async function searchClients(opts: { q?: string; segment?: Segment; page?: number; pageSize?: number }) {
  const pageSize = opts.pageSize ?? 50;
  const page = Math.max(1, opts.page ?? 1);
  const filter: Record<string, unknown> = {};
  if (opts.segment) filter.segment = opts.segment;
  if (opts.q) {
    const rx = new RegExp(escapeRegex(opts.q.trim()), "i");
    filter.$or = [{ name: rx }, { "sites.name": rx }, { "sites.postcode": rx }, { "contacts.name": rx }];
  }
  const [rows, total] = await Promise.all([
    db
      .clients()
      .find(filter, {
        projection: { name: 1, segment: 1, clientType: 1, sites: 1, contacts: { $slice: 1 }, updatedAt: 1 },
      })
      .sort({ nameLower: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    db.clients().countDocuments(filter),
  ]);
  return { rows: plain(rows), total, page, pageSize };
}

/** Lightweight list for pickers: id, name, segment, contacts and sites. */
export async function clientOptions() {
  const rows = await db
    .clients()
    .find({}, { projection: { name: 1, segment: 1, contacts: { _id: 1, name: 1, role: 1 }, sites: { _id: 1, name: 1 } } })
    .sort({ nameLower: 1 })
    .limit(2000)
    .toArray();
  return plain(rows);
}

export async function getClient(id: ObjectId) {
  const client = await db.clients().findOne({ _id: id });
  if (!client) return null;

  const [opportunities, projects] = await Promise.all([
    db
      .opportunities()
      .find({ clientId: id }, { projection: { survey: 0, quotes: 0, description: 0 } })
      .sort({ createdAt: -1 })
      .toArray(),
    db
      .projects()
      .find({ clientId: id }, { projection: { programme: 0 } })
      .sort({ createdAt: -1 })
      .toArray(),
  ]);

  const won = opportunities.filter((o) => o.stage === "won").length;
  const lost = opportunities.filter((o) => o.stage === "lost").length;
  const lifts = client.sites.flatMap((s) => s.lifts);
  const stats = {
    lifetimeValuePence: projects.filter((p) => p.status !== "cancelled").reduce((s, p) => s + p.contractValuePence, 0),
    projectCount: projects.length,
    openPipelinePence: opportunities
      .filter((o) => o.stage !== "won" && o.stage !== "lost")
      .reduce((s, o) => s + o.valuePence, 0),
    openCount: opportunities.filter((o) => o.stage !== "won" && o.stage !== "lost").length,
    won,
    decided: won + lost,
    liftCount: lifts.length,
    onMaintenance: lifts.filter((l) => l.onMaintenance).length,
  };

  return { client: plain(client), opportunities: plain(opportunities), projects: plain(projects), stats };
}

export async function findDuplicateClients(name: string, excludeId?: ObjectId) {
  const words = name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return [];
  const rx = new RegExp(escapeRegex(words.slice(0, 2).join(" ")), "i");
  const rows = await db
    .clients()
    .find({ nameLower: rx, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }, { projection: { name: 1 } })
    .limit(5)
    .toArray();
  return plain(rows);
}

export async function createClient(input: z.infer<typeof clientSchema>, user: CurrentUser) {
  const now = new Date();
  const doc: ClientDoc = {
    _id: new ObjectId(),
    name: input.name,
    nameLower: input.name.toLowerCase(),
    segment: input.segment,
    clientType: input.clientType,
    accountOwnerId: input.accountOwnerId ?? user.id,
    notes: input.notes,
    contacts: [],
    sites: [],
    createdAt: now,
    updatedAt: now,
    createdBy: user.id,
  };
  await db.clients().insertOne(doc);
  await logActivity(user, clientSubject(doc), "client.created", `Client ${doc.name} created`, { clientId: doc._id });
  return doc;
}

export async function updateClient(id: ObjectId, input: z.infer<typeof clientSchema>, user: CurrentUser) {
  const existing = await db.clients().findOne({ _id: id }, { projection: { name: 1 } });
  if (!existing) throw new NotFoundError("Client");
  await db.clients().updateOne(
    { _id: id },
    {
      $set: {
        name: input.name,
        nameLower: input.name.toLowerCase(),
        segment: input.segment,
        clientType: input.clientType,
        accountOwnerId: input.accountOwnerId,
        notes: input.notes,
        updatedAt: new Date(),
      },
    },
  );
  if (existing.name !== input.name) {
    // Keep denormalised names in step.
    await Promise.all([
      db.opportunities().updateMany({ clientId: id }, { $set: { clientName: input.name } }),
      db.projects().updateMany({ clientId: id }, { $set: { clientName: input.name } }),
    ]);
  }
  await logActivity(user, { type: "client", id, ref: input.name, label: input.name }, "client.updated", "Client details updated", {
    clientId: id,
  });
}

export async function addContact(clientId: ObjectId, input: z.infer<typeof contactSchema>, user: CurrentUser) {
  const contact: Contact = { _id: new ObjectId(), ...input };
  const res = await db
    .clients()
    .findOneAndUpdate({ _id: clientId }, { $push: { contacts: contact }, $set: { updatedAt: new Date() } }, { projection: { name: 1 } });
  if (!res) throw new NotFoundError("Client");
  await logActivity(user, clientSubject(res), "contact.added", `Contact ${contact.name} added`, { clientId });
  return contact;
}

export async function addSite(clientId: ObjectId, input: z.infer<typeof siteSchema>, user: CurrentUser) {
  const site: Site = { _id: new ObjectId(), ...input, lifts: [] };
  const res = await db
    .clients()
    .findOneAndUpdate({ _id: clientId }, { $push: { sites: site }, $set: { updatedAt: new Date() } }, { projection: { name: 1 } });
  if (!res) throw new NotFoundError("Client");
  await logActivity(user, clientSubject(res), "site.added", `Site ${site.name} added`, { clientId });
  return site;
}

export async function addLiftOnSite(
  clientId: ObjectId,
  siteId: ObjectId,
  input: { productName: string; servicedBy: "dk" | "other"; onMaintenance: boolean; notes?: string },
  user: CurrentUser,
) {
  const res = await db.clients().findOneAndUpdate(
    { _id: clientId, "sites._id": siteId },
    { $push: { "sites.$.lifts": { _id: new ObjectId(), ...input } }, $set: { updatedAt: new Date() } },
    { projection: { name: 1 } },
  );
  if (!res) throw new NotFoundError("Site");
  await logActivity(user, clientSubject(res), "lift.added", `${input.productName} recorded on site`, { clientId });
}

/** Resolves or creates the client, contact and site chosen on the opportunity form. */
export async function resolveClientContactSite(
  input: {
    clientId?: string;
    newClientName?: string;
    segment: Segment;
    contactId?: string;
    newContactName?: string;
    newContactPhone?: string;
    newContactEmail?: string;
    siteId?: string;
    newSiteName?: string;
  },
  user: CurrentUser,
) {
  let client: ClientDoc | null;
  if (input.clientId) {
    client = await db.clients().findOne({ _id: new ObjectId(input.clientId) });
    if (!client) throw new NotFoundError("Client");
  } else {
    client = await createClient({ name: input.newClientName!, segment: input.segment } as z.infer<typeof clientSchema>, user);
  }

  let contact: Contact | undefined;
  if (input.contactId) {
    contact = client.contacts.find((c) => c._id.equals(input.contactId!));
    if (!contact) throw new DomainError("That contact does not belong to the client");
  } else if (input.newContactName) {
    contact = await addContact(
      client._id,
      { name: input.newContactName, phone: input.newContactPhone, email: input.newContactEmail, role: undefined },
      user,
    );
  }

  let site: Site | undefined;
  if (input.siteId) {
    site = client.sites.find((s) => s._id.equals(input.siteId!));
    if (!site) throw new DomainError("That site does not belong to the client");
  } else if (input.newSiteName) {
    site = await addSite(client._id, { name: input.newSiteName } as z.infer<typeof siteSchema>, user);
  }

  return { client, contact, site };
}
