"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { z } from "zod";

import { TAGS } from "@/lib/dal/reference";
import { createUser } from "@/lib/dal/users";
import { DomainError } from "@/lib/dal/util";
import { ensureDatabase, hasAnyUser } from "@/lib/db/bootstrap";
import { formToObject } from "@/lib/validation";
import { handle } from "./state";
import type { ActionState } from "./types";

const setupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.email("Enter a valid email").transform((v) => v.toLowerCase()),
  password: z.string().min(10, "Password must be at least 10 characters"),
  setupCode: z.string().min(1, "Setup code is required"),
});

function codeMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Creates the first administrator. Only works while the database has no users. */
export async function setupAction(_: ActionState, form: FormData): Promise<ActionState> {
  const values = formToObject(form);
  let done = false;
  const state = await handle(async () => {
    const expected = process.env.CRON_SECRET;
    if (!expected) throw new DomainError("Set CRON_SECRET in the Vercel environment variables and redeploy first.");
    const input = setupSchema.parse(values);
    if (!codeMatches(input.setupCode, expected)) throw new DomainError("The setup code does not match CRON_SECRET.");
    await ensureDatabase();
    if (await hasAnyUser()) throw new DomainError("Setup has already been completed. Sign in instead.");
    await createUser({ name: input.name, email: input.email, password: input.password, role: "md" });
    updateTag(TAGS.users);
    done = true;
  }, { ...values, password: "", setupCode: "" });
  if (done) redirect("/login?setup=1");
  return state;
}
