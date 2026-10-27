import type { Metadata } from "next";
import { Suspense } from "react";

import { microsoftSignInEnabled } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="bg-sidebar grid min-h-dvh place-items-center px-4">
      <div className="bg-card w-full max-w-sm rounded-xl p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="bg-brand text-brand-foreground grid size-10 place-items-center rounded-md text-sm font-bold">DK</span>
          <div>
            <div className="font-semibold">D.K Projects CRM</div>
            <div className="text-muted-foreground text-xs">D.K Lift Services Ltd</div>
          </div>
        </div>
        <Suspense>
          <LoginForm microsoft={microsoftSignInEnabled} />
        </Suspense>
      </div>
    </div>
  );
}
