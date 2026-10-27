"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginForm({ microsoft }: { microsoft: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(params.get("error") ? "That account is not set up in the CRM." : null);
  const justSetUp = params.get("setup") === "1";
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-4">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const { error } = await authClient.signIn.email({
              email: String(form.get("email")),
              password: String(form.get("password")),
            });
            if (error) {
              setError(error.status === 403 ? "This account is inactive." : "Incorrect email or password.");
              return;
            }
            router.replace(next);
            router.refresh();
          });
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {justSetUp && !error && <p className="text-success text-sm">Administrator created. Sign in to continue.</p>}
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      {microsoft && (
        <>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <Separator className="flex-1" /> or <Separator className="flex-1" />
          </div>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await authClient.signIn.social({ provider: "microsoft", callbackURL: next, errorCallbackURL: "/login?error=1" });
              })
            }
          >
            Sign in with Microsoft
          </Button>
        </>
      )}
    </div>
  );
}
