"use client";

import { Pencil } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { setItemDoneAction } from "@/lib/actions/projects";
import type { ActionState } from "@/lib/actions/types";
import { CheckboxField, FormDialog, SelectField, TextAreaField, TextField, type Option } from "./form-kit";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

export function ClientPoDialog({
  action,
  defaults,
}: {
  action: Action;
  defaults: { clientPoOn: string; manufacturer?: string; leadTimeWeeks: number; installDays: number };
}) {
  return (
    <FormDialog
      trigger={<Button variant="brand">Record client PO</Button>}
      title="Record client purchase order"
      description="Generates the programme from the template and the 60 / 20 / 20 billing schedule. The PM can then adjust any date."
      action={action}
      submitLabel="Generate programme"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="clientPoOn" label="PO date *" type="date" defaultValue={defaults.clientPoOn} />
        <TextField name="clientPoRef" label="PO reference" />
        <TextField name="manufacturer" label="Manufacturer" defaultValue={defaults.manufacturer} className="sm:col-span-2" />
        <TextField name="leadTimeWeeks" label="Manufacturing lead time (weeks)" type="number" min={1} max={52} defaultValue={defaults.leadTimeWeeks} />
        <TextField name="installDays" label="Install (working days)" type="number" min={1} max={30} defaultValue={defaults.installDays} />
      </div>
    </FormDialog>
  );
}

export function ProjectDetailsDialog({
  action,
  users,
  values,
}: {
  action: Action;
  users: Option[];
  values: { pmId: string; manufacturer?: string; manufacturerPoRef?: string; clientPoRef?: string; notes?: string };
}) {
  return (
    <FormDialog trigger={<Button variant="outline" size="sm">Edit</Button>} title="Project details" action={action}>
      <SelectField name="pmId" label="Project manager" options={users} defaultValue={values.pmId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="manufacturer" label="Manufacturer" defaultValue={values.manufacturer} />
        <TextField name="manufacturerPoRef" label="Manufacturer PO" defaultValue={values.manufacturerPoRef} />
        <TextField name="clientPoRef" label="Client PO" defaultValue={values.clientPoRef} />
      </div>
      <TextAreaField name="notes" label="Notes" rows={3} defaultValue={values.notes} />
    </FormDialog>
  );
}

export function ProgrammeItemControls({
  projectRef,
  itemKey,
  label,
  done,
  start,
  end,
  rescheduleAction,
  canEdit,
}: {
  projectRef: string;
  itemKey: string;
  label: string;
  done: boolean;
  start: string;
  end: string;
  rescheduleAction: Action;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useOptimistic(done);
  return (
    <div className="flex items-center gap-1.5">
      <Checkbox
        checked={checked}
        disabled={!canEdit || pending}
        aria-label={`Mark ${label} ${checked ? "not done" : "done"}`}
        onCheckedChange={(v) =>
          startTransition(async () => {
            setChecked(!!v);
            const res = await setItemDoneAction(projectRef, itemKey, !!v);
            if (res.error) toast.error(res.error);
          })
        }
      />
      {canEdit && (
        <FormDialog
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Reschedule ${label}`}>
              <Pencil className="size-3.5" />
            </Button>
          }
          title={`Reschedule: ${label}`}
          description="Stage payment due dates follow the programme automatically until they are raised."
          action={rescheduleAction}
        >
          <input type="hidden" name="key" value={itemKey} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="start" label="Start" type="date" defaultValue={start} />
            <TextField name="end" label="End" type="date" defaultValue={end} />
          </div>
          <CheckboxField name="cascade" label="Move every later item by the same amount" defaultChecked />
        </FormDialog>
      )}
    </div>
  );
}

export function MilestoneDialog({
  action,
  label,
  status,
  invoiceRef,
  today,
}: {
  action: Action;
  label: string;
  status: string;
  invoiceRef?: string;
  today: string;
}) {
  const next = status === "scheduled" ? "raised" : status === "raised" ? "paid" : "paid";
  return (
    <FormDialog
      trigger={
        <Button size="sm" variant={status === "paid" ? "ghost" : "outline"}>
          {status === "scheduled" ? "Mark raised" : status === "raised" ? "Mark paid" : "Edit"}
        </Button>
      }
      title={label}
      description="Status set by accounts. Raising and paying close the matching reminder and chase tasks."
      action={action}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          name="status"
          label="Status"
          defaultValue={next}
          options={[
            { value: "scheduled", label: "Scheduled" },
            { value: "raised", label: "Raised" },
            { value: "paid", label: "Paid" },
          ]}
        />
        <TextField name="invoiceRef" label="Xero invoice" placeholder="INV-2307" defaultValue={invoiceRef} />
        <TextField name="on" label="Date" type="date" defaultValue={today} />
      </div>
    </FormDialog>
  );
}

export function HandoverDialog({ action, defaultDate }: { action: Action; defaultDate: string }) {
  return (
    <FormDialog
      trigger={<Button>Record handover</Button>}
      title="Record handover"
      description="Completes the project, records the lift on the client's site, sets the warranty and schedules the 3- and 9-month services and the final 20% invoice."
      action={action}
      submitLabel="Record handover"
    >
      <TextField name="handoverOn" label="Handover date" type="date" defaultValue={defaultDate} />
      <CheckboxField name="onMaintenance" label="Client is taking a D.K maintenance contract" />
    </FormDialog>
  );
}
