import "server-only";

import { ObjectId } from "mongodb";

import { db, ensureIndexes } from "./collections";
import type { ProductDoc } from "./types";

export const PRODUCTS: Omit<ProductDoc, "_id" | "createdAt" | "updatedAt" | "createdBy" | "active">[] = [
  { name: "Platform lift", category: "Platform lifts", leadTimeWeeks: 11, installDays: 5 },
  { name: "Platform lift (external)", category: "Platform lifts", leadTimeWeeks: 12, installDays: 5 },
  { name: "Inclined platform lift", category: "Platform lifts", leadTimeWeeks: 12, installDays: 4 },
  { name: "Step lift", category: "Platform lifts", leadTimeWeeks: 10, installDays: 3 },
  { name: "Wheelchair platform stairlift", category: "Platform lifts", leadTimeWeeks: 10, installDays: 3 },
  { name: "Home lift", category: "Home lifts", leadTimeWeeks: 11, installDays: 5 },
  { name: "Through-floor home lift", category: "Home lifts", leadTimeWeeks: 10, installDays: 4 },
  { name: "Cabin home lift", category: "Home lifts", leadTimeWeeks: 12, installDays: 5 },
  { name: "Stairlift (straight)", category: "Stairlifts", leadTimeWeeks: 2, installDays: 1 },
  { name: "Stairlift (curved)", category: "Stairlifts", leadTimeWeeks: 6, installDays: 1 },
  { name: "Dumbwaiter", category: "Service lifts", leadTimeWeeks: 10, installDays: 3 },
  { name: "Service lift", category: "Service lifts", leadTimeWeeks: 11, installDays: 4 },
  { name: "Goods lift", category: "Service lifts", leadTimeWeeks: 12, installDays: 5 },
  { name: "Passenger lift (MRL)", category: "Passenger lifts", leadTimeWeeks: 14, installDays: 10 },
];

/** Bump when indexes or seeded reference data change, so existing databases are brought up to date. */
const SETUP_VERSION = 1;

const globalForSetup = globalThis as unknown as { __dbReady?: Promise<void> };

/**
 * Creates indexes, the product catalogue and the settings document. Idempotent, so it runs
 * on first use in each server instance (and from the daily cron) with no manual step.
 */
export function ensureDatabase(): Promise<void> {
  globalForSetup.__dbReady ??= (async () => {
    const settings = await db.settings().findOne({ _id: "settings" }, { projection: { setupVersion: 1 } });
    if ((settings?.setupVersion ?? 0) >= SETUP_VERSION) return;
    await ensureIndexes();
    const now = new Date();
    for (const p of PRODUCTS) {
      await db
        .products()
        .updateOne(
          { name: p.name },
          { $setOnInsert: { _id: new ObjectId(), ...p, active: true, createdAt: now, updatedAt: now, createdBy: "setup" } },
          { upsert: true },
        );
    }
    await db
      .settings()
      .updateOne(
        { _id: "settings" },
        { $set: { setupVersion: SETUP_VERSION }, $setOnInsert: { stageProbability: {}, updatedAt: now } },
        { upsert: true },
      );
  })().catch((e) => {
    globalForSetup.__dbReady = undefined;
    throw e;
  });
  return globalForSetup.__dbReady;
}

export async function hasAnyUser(): Promise<boolean> {
  return (await db.users().countDocuments({}, { limit: 1 })) > 0;
}
