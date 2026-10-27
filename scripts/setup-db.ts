/**
 * Creates indexes, the product catalogue and the first administrator. Safe to re-run.
 *
 *   SEED_ADMIN_EMAIL=md@dkliftservices.co.uk SEED_ADMIN_PASSWORD='…' SEED_ADMIN_NAME='Managing Director' npm run db:setup
 */
import "./env";

import { auth } from "@/lib/auth";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { mongoClient } from "@/lib/db/mongo";

export async function setup() {
  await ensureDatabase();

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
