import "server-only";

import { ObjectId } from "mongodb";

import { db } from "@/lib/db/collections";
import type { DocumentDoc, Subject } from "@/lib/db/types";
import { logActivity } from "./activity";
import type { CurrentUser } from "./session";
import { DomainError, plain } from "./util";

export const DOCUMENT_PREFIX = "documents/";
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/msword",
];

export async function subjectFor(type: "opportunity" | "project" | "client", id: ObjectId): Promise<{ subject: Subject; clientId: ObjectId }> {
  if (type === "opportunity") {
    const o = await db.opportunities().findOne({ _id: id }, { projection: { ref: 1, clientName: 1, clientId: 1 } });
    if (o) return { subject: { type, id, ref: o.ref, label: o.clientName }, clientId: o.clientId };
  } else if (type === "project") {
    const p = await db.projects().findOne({ _id: id }, { projection: { ref: 1, clientName: 1, clientId: 1 } });
    if (p) return { subject: { type, id, ref: p.ref, label: p.clientName }, clientId: p.clientId };
  } else {
    const c = await db.clients().findOne({ _id: id }, { projection: { name: 1 } });
    if (c) return { subject: { type, id, ref: c.name, label: c.name }, clientId: c._id };
  }
  throw new DomainError("Record not found");
}

export async function registerDocument(
  input: {
    subjectType: "opportunity" | "project" | "client";
    subjectId: ObjectId;
    category: DocumentDoc["category"];
    name: string;
    pathname: string;
    contentType?: string;
    size?: number;
    revision?: string;
  },
  user: CurrentUser,
) {
  if (!input.pathname.startsWith(`${DOCUMENT_PREFIX}${input.subjectType}/${input.subjectId.toHexString()}/`)) {
    throw new DomainError("Upload path does not match the record");
  }
  const { subject, clientId } = await subjectFor(input.subjectType, input.subjectId);
  const doc: DocumentDoc = {
    _id: new ObjectId(),
    subject,
    category: input.category,
    name: input.name,
    pathname: input.pathname,
    contentType: input.contentType,
    size: input.size,
    revision: input.revision,
    uploadedBy: user.id,
    uploadedByName: user.name,
    uploadedAt: new Date(),
  };
  await db.documents().insertOne(doc);
  await logActivity(user, subject, "document.added", `${input.name} attached${input.revision ? ` (rev ${input.revision})` : ""}`, { clientId });
  return doc;
}

export async function documentsFor(subjectId: ObjectId) {
  return plain(await db.documents().find({ "subject.id": subjectId }).sort({ uploadedAt: -1 }).toArray());
}

export async function documentsForClient(clientId: ObjectId, subjectIds: ObjectId[]) {
  return plain(
    await db
      .documents()
      .find({ "subject.id": { $in: [clientId, ...subjectIds] } })
      .sort({ uploadedAt: -1 })
      .limit(100)
      .toArray(),
  );
}

export async function getDocument(id: ObjectId) {
  return db.documents().findOne({ _id: id });
}

export function blobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}
