/**
 * Creates indexes, the product catalogue and the first administrator. Safe to re-run.
 *
 *   SEED_ADMIN_EMAIL=md@dkliftservices.co.uk SEED_ADMIN_PASSWORD='…' SEED_ADMIN_NAME='Managing Director' npm run db:setup
 */
import "./env";
import { ObjectId } from "mongodb";

import { auth } from "@/lib/auth";
import { db, ensureIndexes } from "@/lib/db/collections";
import { mongoClient } from "@/lib/db/mongo";
import type { ProductDoc } from "@/lib/db/types";

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

export async function setup() {
  await ensureIndexes();

  const now = new Date();
  for (const p of PRODUCTS) {
    await db
      .products()
      .updateOne({ name: p.name }, { $setOnInsert: { _id: new ObjectId(), ...p, active: true, createdAt: now, updatedAt: now, createdBy: "setup" } }, { upsert: true });
  }
  await db.settings().updateOne({ _id: "settings" }, { $setOnInsert: { stageProbability: {}, updatedAt: now } }, { upsert: true });

  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    const ctx = await auth.$context;
    if (!(await ctx.internalAdapter.findUserByEmail(email))) {
      const user = await ctx.internalAdapter.createUser(
        { email, name: process.env.SEED_ADMIN_NAME ?? "Managing Director", emailVerified: true, role: "md", active: true },
        { method: "admin" },
      );
      await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: await ctx.password.hash(password) });
      console.log(`Created administrator ${email}`);
    } else {
      console.log(`Administrator ${email} already exists`);
    }
  } else {
    console.log("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set; no administrator created");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setup()
    .then(() => console.log("Database ready"))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => mongoClient.close());
}
