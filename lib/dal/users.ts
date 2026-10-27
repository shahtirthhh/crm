import "server-only";

import { ObjectId } from "mongodb";
import type { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/collections";
import { getDb } from "@/lib/db/mongo";
import type { Role } from "@/lib/domain/constants";
import type { userSchema, userUpdateSchema } from "@/lib/validation";
import { DomainError } from "./util";

/** Creates a user with an email/password credential. Sign-up is otherwise disabled. */
export async function createUser(input: z.infer<typeof userSchema>) {
  const ctx = await auth.$context;
  const existing = await ctx.internalAdapter.findUserByEmail(input.email);
  if (existing) throw new DomainError("A user with that email already exists");
  const user = await ctx.internalAdapter.createUser({
    email: input.email,
    name: input.name,
    emailVerified: true,
    role: input.role,
    active: true,
  }, { method: "admin" });
  const hash = await ctx.password.hash(input.password);
  await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: hash });
  return user;
}

export async function updateUser(id: string, input: z.infer<typeof userUpdateSchema>, actorId: string) {
  if (id === actorId && (!input.active || (input.role !== "md" && input.role !== "admin"))) {
    throw new DomainError("You cannot remove your own administrator access");
  }
  const _id = new ObjectId(id);
  await db.users().updateOne({ _id }, { $set: { role: input.role as Role, active: input.active, updatedAt: new Date() } });
  if (!input.active) await revokeSessions(_id);
}

export async function setPassword(id: string, password: string) {
  if (password.length < 10) throw new DomainError("Password must be at least 10 characters");
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  const accounts = await ctx.internalAdapter.findAccounts(id);
  const credential = accounts.find((a) => a.providerId === "credential");
  if (credential) await ctx.internalAdapter.updatePassword(id, hash);
  else await ctx.internalAdapter.linkAccount({ userId: id, providerId: "credential", accountId: id, password: hash });
}

async function revokeSessions(userId: ObjectId) {
  await getDb()
    .collection("session")
    .deleteMany({ userId: { $in: [userId, userId.toHexString()] } });
}
