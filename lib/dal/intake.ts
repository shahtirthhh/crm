import "server-only";

import { ObjectId } from "mongodb";
import type { z } from "zod";

import { db, nextRef } from "@/lib/db/collections";
import type { ClientDoc, OpportunityDoc } from "@/lib/db/types";
import { today as todayFn } from "@/lib/domain/dates";
import type { webEnquirySchema } from "@/lib/validation";
import { logActivity } from "./activity";
import { listProducts, getSettings } from "./reference";
import { opportunitySubject } from "./opportunities";
import { insertTask } from "./tasks";

const WEB = { id: "website", name: "Website form" };

/** Fixed-window limit per key, stored in Mongo so it holds across serverless instances. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds);
  const res = await db.rateLimits().findOneAndUpdate(
    { _id: `${key}:${windowStart}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((windowStart + 2) * windowSeconds * 1000) } },
    { upsert: true, returnDocument: "after" },
  );
  return (res?.count ?? 0) <= limit;
}

async function triageOwner() {
  const settings = await getSettings();
  if (settings.triageOwnerId) {
    const u = await db.users().findOne({ _id: new ObjectId(settings.triageOwnerId), active: { $ne: false } });
    if (u) return u;
  }
  return (
    (await db.users().findOne({ role: "sales_admin", active: { $ne: false } })) ??
    (await db.users().findOne({ role: "md", active: { $ne: false } })) ??
    (await db.users().findOne({ role: "admin", active: { $ne: false } }))
  );
}

/** Logs a website / Google Ads enquiry as an unassigned opportunity with a same-day triage task. */
export async function createWebEnquiry(input: z.infer<typeof webEnquirySchema>) {
  const owner = await triageOwner();
  if (!owner) throw new Error("No active user to own web enquiries");
  const ownerId = owner._id.toHexString();
  const now = new Date();

  let client: ClientDoc | null = input.email ? await db.clients().findOne({ "contacts.email": input.email }) : null;
  let contactId = client?.contacts.find((c) => c.email === input.email)?._id;
  if (!client) {
    const name = input.organisation || input.name;
    contactId = new ObjectId();
    client = {
      _id: new ObjectId(),
      name,
      nameLower: name.toLowerCase(),
      segment: input.segment ?? (input.organisation ? "end_user_contractor" : "domestic"),
      contacts: [{ _id: contactId, name: input.name, email: input.email, phone: input.phone }],
      sites: input.postcode ? [{ _id: new ObjectId(), name: input.postcode.toUpperCase(), postcode: input.postcode.toUpperCase(), lifts: [] }] : [],
      accountOwnerId: ownerId,
      createdAt: now,
      updatedAt: now,
      createdBy: WEB.id,
    };
    await db.clients().insertOne(client);
  }

  const products = await listProducts();
  const wanted = input.product?.toLowerCase();
  const product = wanted ? products.find((p) => p.name.toLowerCase().includes(wanted) || wanted.includes(p.name.toLowerCase())) : undefined;

  const opp: OpportunityDoc = {
    _id: new ObjectId(),
    ref: await nextRef("opportunity"),
    clientId: client._id,
    clientName: client.name,
    contactId,
    contactName: input.name,
    siteId: client.sites[0]?._id,
    siteName: client.sites[0]?.name,
    segment: client.segment,
    productId: product ? new ObjectId(product.id) : undefined,
    productName: product?.name ?? input.product ?? "Not specified",
    quantity: 1,
    source: input.gclid || input.utm_source?.toLowerCase().includes("google") ? "google_ads" : "website",
    campaign: input.utm_campaign,
    tracking: { gclid: input.gclid, utmSource: input.utm_source, utmMedium: input.utm_medium, utmCampaign: input.utm_campaign },
    valuePence: 0,
    ownerId,
    ownerName: owner.name,
    stage: "enquiry",
    stageChangedAt: now,
    description: input.message,
    quotes: [],
    needsTriage: true,
    createdAt: now,
    updatedAt: now,
    createdBy: WEB.id,
  };
  await db.opportunities().insertOne(opp);
  const subject = opportunitySubject(opp);
  await insertTask(
    {
      title: "Triage web enquiry: confirm details and set next action",
      kind: "call",
      subject,
      ownerId,
      ownerName: owner.name,
      dueOn: todayFn(now),
      ruleKey: `triage:${opp.ref}`,
    },
    WEB.id,
  );
  await logActivity(WEB, subject, "opportunity.created", `Enquiry ${opp.ref} received from the ${opp.source === "google_ads" ? "Google Ads" : "website"} form`, {
    clientId: client._id,
  });
  return opp.ref;
}
