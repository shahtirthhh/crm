import "server-only";

import type { Collection, Document } from "mongodb";

import { getDb } from "./mongo";
import type {
  ActivityDoc,
  ClientDoc,
  DocumentDoc,
  OpportunityDoc,
  ProductDoc,
  ProjectDoc,
  SettingsDoc,
  TaskDoc,
  UserDoc,
} from "./types";

function col<T extends Document>(name: string): Collection<T> {
  return getDb().collection<T>(name);
}

export const db = {
  users: () => col<UserDoc>("user"),
  clients: () => col<ClientDoc>("clients"),
  products: () => col<ProductDoc>("products"),
  opportunities: () => col<OpportunityDoc>("opportunities"),
  tasks: () => col<TaskDoc>("tasks"),
  activities: () => col<ActivityDoc>("activities"),
  projects: () => col<ProjectDoc>("projects"),
  documents: () => col<DocumentDoc>("documents"),
  settings: () => col<SettingsDoc>("settings"),
  counters: () => col<{ _id: string; seq: number }>("counters"),
  rateLimits: () => col<{ _id: string; count: number; expiresAt: Date }>("rate_limits"),
};

const REF_FORMATS = {
  opportunity: { prefix: "ENQ-", pad: 4, start: 2600 },
  quote: { prefix: "Q-", pad: 4, start: 1100 },
  project: { prefix: "P-", pad: 4, start: 400 },
} as const;

/** Atomic, gap-tolerant human reference numbers: ENQ-2631, Q-1187, P-0412. */
export async function nextRef(kind: keyof typeof REF_FORMATS): Promise<string> {
  const fmt = REF_FORMATS[kind];
  const res = await db.counters().findOneAndUpdate(
    { _id: kind },
    [{ $set: { seq: { $add: [{ $ifNull: ["$seq", fmt.start] }, 1] } } }],
    { upsert: true, returnDocument: "after" },
  );
  return `${fmt.prefix}${String(res!.seq).padStart(fmt.pad, "0")}`;
}

/** Idempotent. Run by `npm run db:setup` and on deploy. */
export async function ensureIndexes(): Promise<void> {
  await Promise.all([
    db.clients().createIndexes([
      { key: { nameLower: 1 } },
      { key: { "contacts.email": 1 }, sparse: true },
      { key: { name: "text", "sites.name": "text", "sites.postcode": "text", "contacts.name": "text" }, name: "client_text" },
    ]),
    db.opportunities().createIndexes([
      { key: { ref: 1 }, unique: true },
      { key: { stage: 1, stageChangedAt: -1 } },
      { key: { clientId: 1, createdAt: -1 } },
      { key: { ownerId: 1, stage: 1 } },
      { key: { createdAt: -1 } },
      { key: { closedAt: -1 } },
      { key: { "quotes.ref": 1 }, sparse: true },
      { key: { clientName: "text", productName: "text", siteName: "text", ref: "text" }, name: "opportunity_text" },
    ]),
    db.tasks().createIndexes([
      { key: { status: 1, ownerId: 1, dueOn: 1 } },
      { key: { status: 1, dueOn: 1 } },
      { key: { "subject.id": 1, status: 1 } },
      { key: { completedAt: -1 } },
      { key: { ruleKey: 1 }, unique: true, partialFilterExpression: { ruleKey: { $type: "string" } } },
    ]),
    db.activities().createIndexes([
      { key: { "subject.id": 1, at: -1 } },
      { key: { clientId: 1, at: -1 } },
      { key: { at: -1 } },
    ]),
    db.projects().createIndexes([
      { key: { ref: 1 }, unique: true },
      { key: { status: 1, updatedAt: -1 } },
      { key: { clientId: 1 } },
      { key: { opportunityId: 1 }, unique: true },
      { key: { "milestones.status": 1, "milestones.dueOn": 1 } },
    ]),
    db.documents().createIndexes([{ key: { "subject.id": 1, uploadedAt: -1 } }]),
    db.products().createIndexes([{ key: { name: 1 }, unique: true }]),
    db.rateLimits().createIndexes([{ key: { expiresAt: 1 }, expireAfterSeconds: 0 }]),
  ]);
}
