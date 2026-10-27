"use client";

import { ActionForm, FormError, SubmitButton, TextField } from "@/components/app/form-kit";
import { setupAction } from "@/lib/actions/setup";

export function SetupForm() {
  return (
    <ActionForm action={setupAction}>
      <TextField name="name" label="Your name" autoComplete="name" />
      <TextField name="email" label="Email" type="email" autoComplete="username" />
      <TextField name="password" label="Password" type="password" autoComplete="new-password" hint="At least 10 characters" />
      <TextField name="setupCode" label="Setup code" type="password" hint="The CRON_SECRET value you set in Vercel" />
      <FormError />
      <SubmitButton pendingLabel="Setting up…">Create administrator</SubmitButton>
    </ActionForm>
  );
}
