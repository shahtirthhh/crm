import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/dal/session";
import { DomainError } from "@/lib/dal/util";
import { fieldErrors } from "@/lib/validation";
import type { ActionState } from "./types";

export type { ActionState } from "./types";

/** Runs an action body and maps expected failures to a form state; unexpected errors are logged. */
export async function handle(fn: () => Promise<ActionState | void>, values?: Record<string, string>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ZodError) {
      return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(e), values };
    }
    if (e instanceof DomainError || e instanceof AuthorizationError) {
      return { ok: false, error: e.message, values };
    }
    console.error(e);
    return { ok: false, error: "Something went wrong. Try again.", values };
  }
}
