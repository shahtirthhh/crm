import "server-only";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { nextCookies } from "better-auth/next-js";
import { ObjectId } from "mongodb";

import { getDb, mongoClient } from "@/lib/db/mongo";

const microsoftConfigured = !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);

export const auth = betterAuth({
  appName: "D.K Projects CRM",
  database: mongodbAdapter(getDb(), { client: mongoClient }),
  // Accounts are created by an administrator (Settings → Users) or the seed script.
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10 },
  socialProviders: microsoftConfigured
    ? {
        microsoft: {
          clientId: process.env.MICROSOFT_CLIENT_ID!,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
          tenantId: process.env.MICROSOFT_TENANT_ID || "common",
          // Only people already set up in the CRM can sign in with Microsoft.
          disableImplicitSignUp: true,
        },
      }
    : undefined,
  account: { accountLinking: { enabled: true, trustedProviders: ["microsoft"] } },
  user: {
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "engineer", input: false },
      active: { type: "boolean", required: true, defaultValue: true, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: { enabled: process.env.NODE_ENV === "production", storage: "database" },
  databaseHooks: {
    session: {
      create: {
        // Deactivated users cannot start a session.
        before: async (session) => {
          const user = await getDb()
            .collection("user")
            .findOne({ _id: new ObjectId(session.userId) }, { projection: { active: 1 } });
          if (!user || user.active === false) return false;
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export const microsoftSignInEnabled = microsoftConfigured;
