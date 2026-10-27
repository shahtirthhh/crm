import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db/collections";
import { DEFAULT_STAGE_PROBABILITY, type OpenStage, type Role } from "@/lib/domain/constants";

// Reference data changes rarely and is read on most forms, so it is cached across requests
// and invalidated with updateTag() by the Server Actions that change it.

export const TAGS = { users: "users", products: "products", settings: "settings" } as const;

export interface UserOption {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export async function listUsers(): Promise<UserOption[]> {
  "use cache";
  cacheTag(TAGS.users);
  cacheLife("hours");
  const rows = await db.users().find({}).sort({ name: 1 }).toArray();
  return rows.map((u) => ({
    id: u._id.toHexString(),
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active !== false,
  }));
}

export async function listActiveUsers(): Promise<UserOption[]> {
  return (await listUsers()).filter((u) => u.active);
}

export interface ProductOption {
  id: string;
  name: string;
  category: string;
  manufacturer?: string;
  leadTimeWeeks: number;
  installDays: number;
  active: boolean;
}

export async function listProducts(): Promise<ProductOption[]> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("hours");
  const rows = await db.products().find({}).sort({ category: 1, name: 1 }).toArray();
  return rows.map((p) => ({
    id: p._id.toHexString(),
    name: p.name,
    category: p.category,
    manufacturer: p.manufacturer,
    leadTimeWeeks: p.leadTimeWeeks,
    installDays: p.installDays,
    active: p.active,
  }));
}

export interface AppSettings {
  stageProbability: Record<OpenStage, number>;
  triageOwnerId?: string;
}

export async function getSettings(): Promise<AppSettings> {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("hours");
  const doc = await db.settings().findOne({ _id: "settings" });
  return {
    stageProbability: { ...DEFAULT_STAGE_PROBABILITY, ...(doc?.stageProbability ?? {}) },
    triageOwnerId: doc?.triageOwnerId,
  };
}
