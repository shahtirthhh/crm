"use server";

import { refresh, updateTag } from "next/cache";
import { ObjectId } from "mongodb";

import { db } from "@/lib/db/collections";
import { TAGS } from "@/lib/dal/reference";
import { requireCapability } from "@/lib/dal/session";
import * as users from "@/lib/dal/users";
import { DomainError, oid } from "@/lib/dal/util";
import { OPEN_STAGES } from "@/lib/domain/constants";
import { formToObject, productSchema, userSchema, userUpdateSchema } from "@/lib/validation";
import { handle, type ActionState } from "./state";

export async function saveProductAction(productId: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const user = await requireCapability("settings:manage");
    const input = productSchema.parse(values);
    const now = new Date();
    try {
      if (productId) {
        await db.products().updateOne({ _id: oid(productId) }, { $set: { ...input, updatedAt: now } });
      } else {
        await db.products().insertOne({ _id: new ObjectId(), ...input, active: true, createdAt: now, updatedAt: now, createdBy: user.id });
      }
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new DomainError("A product with that name already exists");
      throw e;
    }
    updateTag(TAGS.products);
    return { ok: true, message: "Product saved" };
  }, values);
}

export async function saveSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    await requireCapability("settings:manage");
    const stageProbability: Record<string, number> = {};
    for (const stage of OPEN_STAGES) {
      const pct = Number(values[`p_${stage}`]);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new DomainError("Probabilities must be between 0 and 100");
      stageProbability[stage] = pct / 100;
    }
    await db.settings().updateOne(
      { _id: "settings" },
      { $set: { stageProbability, triageOwnerId: values.triageOwnerId || undefined, updatedAt: new Date() } },
      { upsert: true },
    );
    updateTag(TAGS.settings);
    return { ok: true, message: "Settings saved" };
  }, values);
}

export async function createUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    await requireCapability("users:manage");
    await users.createUser(userSchema.parse(values));
    updateTag(TAGS.users);
    return { ok: true, message: "User created" };
  }, { ...values, password: "" });
}

export async function updateUserAction(userId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  return handle(async () => {
    const actor = await requireCapability("users:manage");
    await users.updateUser(userId, userUpdateSchema.parse(values), actor.id);
    if (values.password) await users.setPassword(userId, values.password);
    updateTag(TAGS.users);
    refresh();
    return { ok: true, message: "User updated" };
  }, { ...values, password: "" });
}
