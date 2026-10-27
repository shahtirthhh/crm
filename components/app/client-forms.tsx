"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions/types";
import { SEGMENTS, SEGMENT_LABELS } from "@/lib/domain/constants";
import { ActionForm, CheckboxField, FormDialog, FormError, SelectField, SubmitButton, TextAreaField, TextField, type Option } from "./form-kit";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

function ClientFields({ users, values }: { users: Option[]; values?: { name?: string; segment?: string; clientType?: string; accountOwnerId?: string; notes?: string } }) {
  return (
    <>
      <TextField name="name" label="Client name *" defaultValue={values?.name} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField name="segment" label="Segment *" options={SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABELS[s] }))} defaultValue={values?.segment} />
        <TextField name="clientType" label="Type" placeholder="School, care home, housing association…" defaultValue={values?.clientType} />
        <SelectField name="accountOwnerId" label="Account owner" options={users} defaultValue={values?.accountOwnerId} />
      </div>
      <TextAreaField name="notes" label="Notes" rows={3} defaultValue={values?.notes} />
    </>
  );
}

export function NewClientForm({ action, users }: { action: Action; users: Option[] }) {
  return (
    <ActionForm action={action}>
      <ClientFields users={users} />
      <FormError />
      <div className="flex justify-end">
        <SubmitButton variant="brand">Create client</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EditClientDialog({ action, users, values }: { action: Action; users: Option[]; values: { name: string; segment: string; clientType?: string; accountOwnerId?: string; notes?: string } }) {
  return (
    <FormDialog trigger={<Button variant="outline" size="sm">Edit</Button>} title="Edit client" action={action} wide>
      <ClientFields users={users} values={values} />
    </FormDialog>
  );
}

export function AddContactDialog({ action }: { action: Action }) {
  return (
    <FormDialog trigger={<Button variant="outline" size="sm"><Plus /> Contact</Button>} title="Add contact" action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Name *" />
        <TextField name="role" label="Role" placeholder="Decision maker, procurement…" />
        <TextField name="email" label="Email" type="email" />
        <TextField name="phone" label="Phone" type="tel" />
      </div>
    </FormDialog>
  );
}

export function AddSiteDialog({ action }: { action: Action }) {
  return (
    <FormDialog trigger={<Button variant="outline" size="sm"><Plus /> Site</Button>} title="Add site" action={action}>
      <TextField name="name" label="Site name *" />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <TextField name="address" label="Address" />
        <TextField name="postcode" label="Postcode" />
      </div>
      <TextAreaField name="notes" label="Access notes" rows={2} />
    </FormDialog>
  );
}

export function AddLiftDialog({ action, sites }: { action: Action; sites: Option[] }) {
  return (
    <FormDialog trigger={<Button variant="ghost" size="sm"><Plus /> Lift</Button>} title="Record a lift on site" description="Lifts installed by others are sales signals for future work." action={action}>
      <SelectField name="siteId" label="Site *" options={sites} defaultValue={sites[0]?.value} />
      <TextField name="productName" label="Lift type *" placeholder="e.g. Stairlift, platform lift" />
      <SelectField
        name="servicedBy"
        label="Serviced by"
        defaultValue="dk"
        options={[
          { value: "dk", label: "D.K Lift Services" },
          { value: "other", label: "Another company" },
        ]}
      />
      <CheckboxField name="onMaintenance" label="On a D.K maintenance contract" />
      <TextField name="notes" label="Notes" />
    </FormDialog>
  );
}
