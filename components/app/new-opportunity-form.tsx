"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createOpportunityAction } from "@/lib/actions/opportunities";
import { SEGMENTS, SEGMENT_LABELS, SOURCES, SOURCE_LABELS, type Segment } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import { ClientPicker, type ClientOption } from "./client-picker";
import { ActionForm, FormError, SelectField, SubmitButton, TextAreaField, TextField, useFormState } from "./form-kit";

interface Props {
  clients: ClientOption[];
  products: { id: string; name: string; category: string }[];
  users: { id: string; name: string }[];
  currentUserId: string;
  defaultDue: string;
  preselectClientId?: string;
}

function ClientSection({ clients, preselectClientId }: { clients: ClientOption[]; preselectClientId?: string }) {
  const state = useFormState();
  const [client, setClient] = useState<{ clientId?: string; newName?: string }>(() => ({
    clientId: state.values?.clientId || preselectClientId || undefined,
    newName: state.values?.newClientName || undefined,
  }));
  const [segment, setSegment] = useState<Segment>(
    (state.values?.segment as Segment) || (clients.find((c) => c._id === preselectClientId)?.segment as Segment) || "end_user_contractor",
  );
  const selected = clients.find((c) => c._id === client.clientId);
  const [contactMode, setContactMode] = useState<"existing" | "new">("existing");
  const useNewContact = !selected || selected.contacts.length === 0 || contactMode === "new";
  const clientError = state.fieldErrors?.clientId?.[0];
  const contactError = state.fieldErrors?.contactId?.[0];

  return (
    <>
      <div className="grid gap-1.5">
        <Label>Client *</Label>
        <ClientPicker
          clients={clients}
          value={client}
          invalid={!!clientError}
          onChange={(v) => {
            setClient(v);
            setContactMode("existing");
            const c = clients.find((x) => x._id === v.clientId);
            if (c) setSegment(c.segment as Segment);
          }}
        />
        <input type="hidden" name="clientId" value={client.clientId ?? ""} />
        <input type="hidden" name="newClientName" value={client.clientId ? "" : client.newName ?? ""} />
        {clientError && <p className="text-destructive text-xs">{clientError}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label>Segment *</Label>
        <input type="hidden" name="segment" value={segment} />
        <div className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1">
          {SEGMENTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSegment(s)}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-medium sm:text-sm",
                segment === s ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {SEGMENT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {!useNewContact ? (
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="contactId">Contact *</Label>
              <button type="button" className="text-brand text-xs" onClick={() => setContactMode("new")}>
                + New contact
              </button>
            </div>
            <SelectField
              name="contactId"
              key={selected!._id}
              options={selected!.contacts.map((c) => ({ value: c._id, label: c.role ? `${c.name} · ${c.role}` : c.name }))}
              defaultValue={selected!.contacts[0]?._id}
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
            <TextField name="newContactName" label="Contact name *" placeholder="e.g. Practice Manager" />
            <TextField name="newContactPhone" label="Phone" type="tel" inputMode="tel" />
            <TextField name="newContactEmail" label="Email" type="email" inputMode="email" />
            {contactError && <p className="text-destructive text-xs sm:col-span-3">{contactError}</p>}
            {selected && selected.contacts.length > 0 && (
              <button type="button" className="text-brand justify-self-start text-xs" onClick={() => setContactMode("existing")}>
                Choose an existing contact
              </button>
            )}
          </div>
        )}
        {selected && selected.sites.length > 0 ? (
          <SelectField
            name="siteId"
            key={`site-${selected._id}`}
            label="Site"
            placeholder="Choose a site"
            options={selected.sites.map((s) => ({ value: s._id, label: s.name }))}
          />
        ) : (
          <TextField name="newSiteName" label="Site" placeholder="e.g. Main hall stage, Bexley" />
        )}
      </div>
    </>
  );
}

export function NewOpportunityForm({ clients, products, users, currentUserId, defaultDue, preselectClientId }: Props) {
  const [showMore, setShowMore] = useState(false);
  return (
    <ActionForm action={createOpportunityAction} className="gap-5">
      <ClientSection clients={clients} preselectClientId={preselectClientId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="productId" label="Product *" options={products.map((p) => ({ value: p.id, label: p.name }))} />
        <SelectField name="source" label="Source *" options={SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))} />
        <div className="grid grid-cols-2 gap-3">
          <TextField name="valueLow" label="Estimated value (£)" inputMode="decimal" placeholder="35,000" />
          <TextField name="valueHigh" label="to (£)" inputMode="decimal" placeholder="40,000" />
        </div>
        <SelectField name="ownerId" label="Owner *" defaultValue={currentUserId} options={users.map((u) => ({ value: u.id, label: u.name }))} />
        <TextField name="nextActionTitle" label="Next action *" defaultValue="Book survey" />
        <TextField name="nextActionDue" label="Due *" type="date" defaultValue={defaultDue} />
      </div>
      <TextAreaField name="description" label="Notes" rows={3} placeholder="Rise, access, decision process, timing…" />
      {showMore ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="quantity" label="Quantity" type="number" min={1} defaultValue={1} />
          <TextField name="campaign" label="Campaign" placeholder="Google Ads campaign" />
          <TextField name="installWindow" label="Install window" placeholder="e.g. February half term" />
        </div>
      ) : (
        <Button type="button" variant="link" className="justify-self-start px-0" onClick={() => setShowMore(true)}>
          More fields
        </Button>
      )}
      <FormError />
      <div className="flex justify-end gap-2">
        <SubmitButton variant="brand" size="lg" className="w-full sm:w-auto">
          Save opportunity
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
