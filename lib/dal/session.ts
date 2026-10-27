import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { Role } from "@/lib/domain/constants";
import { can, type Capability } from "@/lib/domain/permissions";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Reads the session once per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = session.user as typeof session.user & { role?: Role; active?: boolean };
  if (user.active === false) return null;
  return { id: user.id, name: user.name, email: user.email, role: (user.role ?? "engineer") as Role };
});

/** For pages: redirects to the login page when there is no session. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For Server Actions and mutations: throws when the user lacks the capability. */
export async function requireCapability(capability: Capability): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Your session has expired. Sign in again.");
  if (!can(user.role, capability)) throw new AuthorizationError();
  return user;
}

/** For pages that need a capability: redirects home instead of rendering. */
export async function requirePageCapability(capability: Capability): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, capability)) redirect("/");
  return user;
}
