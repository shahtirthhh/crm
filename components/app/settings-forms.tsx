"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions/types";
import { ROLES, ROLE_LABELS } from "@/lib/domain/constants";
import { ActionForm, CheckboxField, FormDialog, FormError, SelectField, SubmitButton, TextField, type Option } from "./form-kit";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;
const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

export function ProductDialog({
  action,
  values,
}: {
  action: Action;
  values?: { name: string; category: string; manufacturer?: string; leadTimeWeeks: number; installDays: number; active: boolean };
}) {
  return (
    <FormDialog
      trigger={
        values ? (
          <Button size="sm" variant="ghost">Edit</Button>
        ) : (
          <Button size="sm" variant="outline"><Plus /> Product</Button>
        )
      }
      title={values ? `Edit ${values.name}` : "Add product"}
      description="Lead time and install days seed the programme template for this product."
      action={action}
    >
      <TextField name="name" label="Name *" defaultValue={values?.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="category" label="Category *" defaultValue={values?.category} />
        <TextField name="manufacturer" label="Default manufacturer" defaultValue={values?.manufacturer} />
        <TextField name="leadTimeWeeks" label="Lead time (weeks)" type="number" min={1} defaultValue={values?.leadTimeWeeks ?? 11} />
        <TextField name="installDays" label="Install (working days)" type="number" min={1} defaultValue={values?.installDays ?? 5} />
      </div>
      <CheckboxField name="active" label="Available on new opportunities" defaultChecked={values?.active ?? true} />
    </FormDialog>
  );
}

export function NewUserDialog({ action }: { action: Action }) {
  return (
    <FormDialog trigger={<Button size="sm" variant="outline"><Plus /> User</Button>} title="Add user" description="Share the temporary password securely; they can sign in with Microsoft too once SSO is configured." action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Name *" />
        <TextField name="email" label="Email *" type="email" />
        <SelectField name="role" label="Role *" options={roleOptions} defaultValue="sales_admin" />
        <TextField name="password" label="Temporary password *" type="password" autoComplete="new-password" hint="At least 10 characters" />
      </div>
    </FormDialog>
  );
}

export function EditUserDialog({ action, values }: { action: Action; values: { name: string; role: string; active: boolean } }) {
  return (
    <FormDialog trigger={<Button size="sm" variant="ghost">Edit</Button>} title={`Edit ${values.name}`} description="Deactivating a user signs them out everywhere." action={action}>
      <SelectField name="role" label="Role" options={roleOptions} defaultValue={values.role} />
      <TextField name="password" label="Reset password" type="password" autoComplete="new-password" hint="Leave blank to keep the current password" />
      <CheckboxField name="active" label="Active" defaultChecked={values.active} />
    </FormDialog>
  );
}

export function PipelineSettingsForm({
  action,
  probabilities,
  users,
  triageOwnerId,
}: {
  action: Action;
  probabilities: { stage: string; label: string; pct: number }[];
  users: Option[];
  triageOwnerId?: string;
}) {
  return (
    <ActionForm action={action}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {probabilities.map((p) => (
          <TextField key={p.stage} name={`p_${p.stage}`} label={`${p.label} (%)`} type="number" min={0} max={100} defaultValue={p.pct} />
        ))}
      </div>
      <SelectField name="triageOwnerId" label="Website enquiries are assigned to" options={users} defaultValue={triageOwnerId} placeholder="First sales administrator" />
      <FormError />
      <div className="flex justify-end">
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </ActionForm>
  );
}
