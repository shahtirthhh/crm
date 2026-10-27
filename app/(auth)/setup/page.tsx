import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { hasAnyUser } from "@/lib/db/bootstrap";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Set up" };

async function SetupGate() {
  await connection();
  if (await hasAnyUser()) redirect("/login");
  return <SetupForm />;
}

export default function SetupPage() {
  return (
    <div className="bg-sidebar grid min-h-dvh place-items-center px-4">
      <div className="bg-card w-full max-w-sm rounded-xl p-8 shadow-xl">
        <div className="mb-6">
          <div className="font-semibold">Set up D.K Projects CRM</div>
          <p className="text-muted-foreground mt-1 text-sm">
            Create the first administrator. This page stops working once a user exists.
          </p>
        </div>
        <Suspense fallback={<p className="text-muted-foreground text-sm">Checking the database…</p>}>
          <SetupGate />
        </Suspense>
      </div>
    </div>
  );
}
