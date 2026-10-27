import "server-only";

import { ObjectId, type ClientSession } from "mongodb";

import { db } from "@/lib/db/collections";
import type { Subject } from "@/lib/db/types";
import type { CurrentUser } from "./session";
import { plain } from "./util";

export async function logActivity(
  actor: Pick<CurrentUser, "id" | "name">,
  subject: Subject,
  type: string,
  summary: string,
  opts: { clientId?: ObjectId; meta?: Record<string, unknown>; session?: ClientSession } = {},
) {
  await db.activities().insertOne(
    {
      _id: new ObjectId(),
      subject,
      clientId: opts.clientId,
      type,
      summary,
      actorId: actor.id,
      actorName: actor.name,
      at: new Date(),
      meta: opts.meta,
    },
    { session: opts.session },
  );
}

export async function listActivity(filter: { subjectId?: ObjectId; clientId?: ObjectId }, limit = 30) {
  const query = filter.clientId
    ? { $or: [{ clientId: filter.clientId }, { "subject.id": filter.clientId }] }
    : { "subject.id": filter.subjectId };
  const rows = await db.activities().find(query).sort({ at: -1 }).limit(limit).toArray();
  return plain(rows);
}

export async function recentActivity(limit = 15) {
  return plain(await db.activities().find({}).sort({ at: -1 }).limit(limit).toArray());
}
