"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions/types";
import { LOST_REASONS, SOURCES, SOURCE_LABELS, TASK_KINDS, TASK_KIND_LABELS } from "@/lib/domain/constants";
import { CheckboxField, FormDialog, SelectField, TextAreaField, TextField, type Option } from "./form-kit";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

export function EditOpportunityDialog({
  action,
  products,
  users,
  contacts,
  sites,
  values,
}: {
  action: Action;
  products: Option[];
  users: Option[];
  contacts: Option[];
  sites: Option[];
  values: {
    productId?: string;
    quantity: number;
    source: string;
    campaign?: string;
    valueLow?: string;
    valueHigh?: string;
    ownerId: string;
    description?: string;
    installWindow?: string;
    decisionOn?: string;
    siteId?: string;
    contactId?: string;
  };
}) {
  return (
    <FormDialog trigger={<Button variant="outline" size="sm">Edit</Button>} title="Edit opportunity" action={action} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="productId" label="Product" options={products} defaultValue={values.productId} />
        <TextField name="quantity" label="Quantity" type="number" min={1} defaultValue={values.quantity} />
        <SelectField name="contactId" label="Contact" options={contacts} defaultValue={values.contactId} />
        <SelectField name="siteId" label="Site" options={sites} defaultValue={values.siteId} placeholder="No site" />
        <SelectField name="source" label="Source" options={SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))} defaultValue={values.source} />
        <TextField name="campaign" label="Campaign" defaultValue={values.campaign} />
        <TextField name="valueLow" label="Estimate from (£)" inputMode="decimal" defaultValue={values.valueLow} />
        <TextField name="valueHigh" label="Estimate to (£)" inputMode="decimal" defaultValue={values.valueHigh} />
        <SelectField name="ownerId" label="Owner" options={users} defaultValue={values.ownerId} />
        <TextField name="decisionOn" label="Decision date" type="date" defaultValue={values.decisionOn} />
        <TextField name="installWindow" label="Install window" defaultValue={values.installWindow} className="sm:col-span-2" />
        <TextAreaField name="description" label="Notes" rows={3} defaultValue={values.description} className="sm:col-span-2" />
      </div>
    </FormDialog>
  );
}

export function BookSurveyDialog({
  action,
  users,
  defaultSurveyor,
  defaultFee,
  defaultWhen,
  label = "Book survey",
}: {
  action: Action;
  users: Option[];
  defaultSurveyor: string;
  defaultFee?: string;
  defaultWhen: string;
  label?: string;
}) {
  return (
    <FormDialog
      trigger={<Button size="sm" variant="outline">{label}</Button>}
      title={label}
      description="Creates a survey task for the surveyor and moves the enquiry to Survey booked."
      action={action}
      submitLabel="Book survey"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="scheduledAt" label="Date and time" type="datetime-local" defaultValue={defaultWhen} />
        <SelectField name="surveyorId" label="Surveyor" options={users} defaultValue={defaultSurveyor} />
        <TextField name="attendees" label="Attendees" placeholder="e.g. PM, School Business Manager" className="sm:col-span-2" />
        <TextField name="fee" label="Survey fee (£)" inputMode="decimal" defaultValue={defaultFee} hint="£350 for trade; credited when won" />
      </div>
    </FormDialog>
  );
}

export function SurveyResultDialog({ action, values }: { action: Action; values: { measurements?: string; civilWorks?: string; feeStatus: string } }) {
  return (
    <FormDialog trigger={<Button size="sm" variant="outline">Record survey</Button>} title="Survey record" action={action} wide>
      <TextAreaField name="measurements" label="Measurements" rows={4} defaultValue={values.measurements} />
      <TextAreaField name="civilWorks" label="Builders and civil works" rows={3} defaultValue={values.civilWorks} />
      <SelectField
        name="feeStatus"
        label="Survey fee"
        defaultValue={values.feeStatus}
        options={[
          { value: "none", label: "No fee" },
          { value: "invoiced", label: "Invoiced" },
          { value: "paid", label: "Paid" },
          { value: "credited", label: "Credited against order" },
        ]}
      />
    </FormDialog>
  );
}

export function AddQuoteDialog({ action, defaultTotal, revision }: { action: Action; defaultTotal?: string; revision: number }) {
  return (
    <FormDialog
      trigger={
        <Button size="sm" variant={revision > 1 ? "outline" : "brand"}>
          <Plus /> {revision > 1 ? "New revision" : "Add quote"}
        </Button>
      }
      title={revision > 1 ? `Quote revision ${revision}` : "Add quote"}
      description="Quotes are written in D.K's existing format and attached here. Marking it sent schedules the day 4 email and day 10 call."
      action={action}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="total" label="Quote total (£) *" inputMode="decimal" defaultValue={defaultTotal} />
        <TextField name="sentOn" label="Sent on" type="date" hint="Defaults to today" />
      </div>
      <TextAreaField name="options" label="Options" rows={3} placeholder={"Automatic doors | 3200\nExtended warranty | 1300"} hint="One per line: label | amount" />
      <TextAreaField name="notes" label="Notes" rows={2} />
      <CheckboxField name="sendNow" label="Quote has been sent to the client" defaultChecked />
    </FormDialog>
  );
}

export function WonDialog({ action, users, defaultValue, defaultPm }: { action: Action; users: Option[]; defaultValue?: string; defaultPm?: string }) {
  return (
    <FormDialog
      trigger={<Button size="sm" className="bg-success hover:bg-success/90 text-white">Mark won</Button>}
      title="Mark won"
      description="Creates a live project awaiting the client purchase order. Open follow-ups are closed."
      action={action}
      submitLabel="Mark won"
    >
      <TextField name="contractValue" label="Contract value (£) *" inputMode="decimal" defaultValue={defaultValue} />
      <SelectField name="pmId" label="Project manager *" options={users} defaultValue={defaultPm} />
    </FormDialog>
  );
}

export function LostDialog({ action }: { action: Action }) {
  return (
    <FormDialog
      trigger={<Button size="sm" variant="outline">Mark lost</Button>}
      title="Mark lost"
      description="The reason is reported on the dashboard so we can see where and why quotes don't convert."
      action={action}
      submitLabel="Mark lost"
      submitVariant="destructive"
    >
      <SelectField name="lostReason" label="Reason *" options={LOST_REASONS.map((r) => ({ value: r, label: r }))} />
      <TextField name="lostTo" label="Lost to (competitor)" />
      <TextAreaField name="notes" label="Notes" rows={2} />
    </FormDialog>
  );
}

export function AddTaskDialog({ action, users, defaultOwner, defaultDue }: { action: Action; users: Option[]; defaultOwner: string; defaultDue: string }) {
  return (
    <FormDialog trigger={<Button size="sm" variant="ghost"><Plus /> Task</Button>} title="Add task" action={action} submitLabel="Add task">
      <TextField name="title" label="Task *" placeholder="e.g. Send drawing to governors" />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField name="kind" label="Type" defaultValue="general" options={TASK_KINDS.map((k) => ({ value: k, label: TASK_KIND_LABELS[k] }))} />
        <SelectField name="ownerId" label="Owner" options={users} defaultValue={defaultOwner} />
        <TextField name="dueOn" label="Due" type="date" defaultValue={defaultDue} />
      </div>
    </FormDialog>
  );
}
