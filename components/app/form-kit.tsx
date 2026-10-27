"use client";

import * as React from "react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { initialState, type ActionState } from "@/lib/actions/types";
import { cn } from "@/lib/utils";

type FormAction = (state: ActionState, form: FormData) => Promise<ActionState>;

const FormStateContext = React.createContext<ActionState>(initialState);

export function useFormState() {
  return React.useContext(FormStateContext);
}

/** A form bound to a Server Action, with toasts and field errors. */
export function ActionForm({
  action,
  children,
  className,
  onSuccess,
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  onSuccess?: (state: ActionState) => void;
}) {
  // Toasts fire from the action itself rather than an effect: a successful save often
  // re-renders the page without the component that submitted it.
  const [state, formAction] = useActionState(async (prev: ActionState, form: FormData) => {
    const next = await action(prev, form);
    if (next.ok) {
      if (next.message) toast.success(next.message);
      onSuccess?.(next);
    } else if (next.error) {
      toast.error(next.error);
    }
    return next;
  }, initialState);

  return (
    <FormStateContext.Provider value={state}>
      <form action={formAction} className={cn("grid gap-4", className)} noValidate>
        {children}
      </form>
    </FormStateContext.Provider>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

function FieldShell({
  name,
  label,
  hint,
  children,
  className,
}: {
  name: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const state = useFormState();
  const error = state.fieldErrors?.[name]?.[0];
  return (
    <div className={cn("grid gap-1.5", className)} data-invalid={!!error || undefined}>
      {label && <Label htmlFor={name}>{label}</Label>}
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

function useValue(name: string, defaultValue?: string | number | null) {
  const state = useFormState();
  return state.values?.[name] ?? (defaultValue == null ? undefined : String(defaultValue));
}

export function TextField({
  name,
  label,
  hint,
  defaultValue,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "defaultValue"> & {
  name: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  defaultValue?: string | number | null;
}) {
  const state = useFormState();
  const value = useValue(name, defaultValue);
  return (
    <FieldShell name={name} label={label} hint={hint} className={className}>
      <Input
        id={name}
        name={name}
        key={`${name}:${value ?? ""}`}
        defaultValue={value}
        aria-invalid={!!state.fieldErrors?.[name] || undefined}
        {...props}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  defaultValue,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Textarea>, "defaultValue"> & {
  name: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  defaultValue?: string | null;
}) {
  const value = useValue(name, defaultValue);
  return (
    <FieldShell name={name} label={label} hint={hint} className={className}>
      <Textarea id={name} name={name} key={`${name}:${value ?? ""}`} defaultValue={value} {...props} />
    </FieldShell>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function SelectField({
  name,
  label,
  hint,
  options,
  defaultValue,
  placeholder = "Select…",
  className,
  onValueChange,
  value: controlled,
  disabled,
}: {
  name: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  options: Option[];
  defaultValue?: string | null;
  placeholder?: string;
  className?: string;
  onValueChange?: (value: string) => void;
  value?: string;
  disabled?: boolean;
}) {
  const state = useFormState();
  const value = useValue(name, defaultValue);
  return (
    <FieldShell name={name} label={label} hint={hint} className={className}>
      <Select
        name={name}
        key={controlled === undefined ? `${name}:${value ?? ""}` : name}
        defaultValue={controlled === undefined ? value : undefined}
        value={controlled}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger id={name} className="w-full" aria-invalid={!!state.fieldErrors?.[name] || undefined}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: React.ReactNode;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={name} name={name} defaultChecked={defaultChecked} />
      <Label htmlFor={name} className="font-normal">
        {label}
      </Label>
    </div>
  );
}

export function FormError() {
  const state = useFormState();
  if (!state.error) return null;
  return <p className="text-destructive bg-destructive/5 rounded-md px-3 py-2 text-sm">{state.error}</p>;
}

/** A button that opens a dialog containing a Server Action form; closes on success. */
export function FormDialog({
  trigger,
  title,
  description,
  action,
  children,
  submitLabel = "Save",
  submitVariant,
  wide,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: FormAction;
  children: React.ReactNode;
  submitLabel?: string;
  submitVariant?: React.ComponentProps<typeof Button>["variant"];
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={wide ? "sm:max-w-2xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <ActionForm action={action} onSuccess={() => setOpen(false)}>
          {children}
          <FormError />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant={submitVariant}>{submitLabel}</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

/** Runs a no-form Server Action from a button, with a toast on failure. */
export function ActionButton({
  action,
  children,
  successMessage,
  confirm,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "action" | "onClick"> & {
  action: () => Promise<ActionState>;
  successMessage?: string;
  confirm?: string;
}) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
          const res = await action();
          if (res.error) toast.error(res.error);
          else if (res.message || successMessage) toast.success(res.message ?? successMessage!);
        });
      }}
    >
      {children}
    </Button>
  );
}
