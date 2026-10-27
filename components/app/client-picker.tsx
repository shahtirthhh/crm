"use client";

import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ClientOption {
  _id: string;
  name: string;
  segment: string;
  contacts: { _id: string; name: string; role?: string }[];
  sites: { _id: string; name: string }[];
}

/** Type-ahead over existing clients with a "new client" escape hatch. */
export function ClientPicker({
  clients,
  value,
  onChange,
  invalid,
}: {
  clients: ClientOption[];
  value: { clientId?: string; newName?: string };
  onChange: (v: { clientId?: string; newName?: string }) => void;
  invalid?: boolean;
}) {
  const selected = clients.find((c) => c._id === value.clientId);
  const [query, setQuery] = useState(selected?.name ?? value.newName ?? "");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [clients, query]);
  const exact = clients.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="relative">
      <Input
        value={query}
        aria-invalid={invalid || undefined}
        placeholder="Search existing clients or type a new name"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onChange({ newName: e.target.value.trim() || undefined });
        }}
      />
      <div className="text-muted-foreground mt-1 text-xs">
        {selected ? "Existing client" : value.newName ? "A new client will be created" : " "}
      </div>
      {open && (matches.length > 0 || (query.trim() && !exact)) && (
        <ul className="bg-popover absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border p-1 shadow-md">
          {matches.map((c) => (
            <li key={c._id}>
              <button
                type="button"
                className={cn("hover:bg-accent flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm", c._id === value.clientId && "bg-accent")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery(c.name);
                  setOpen(false);
                  onChange({ clientId: c._id });
                }}
              >
                <span className="truncate">{c.name}</span>
                {c._id === value.clientId && <Check className="size-4" />}
              </button>
            </li>
          ))}
          {query.trim() && !exact && (
            <li>
              <button
                type="button"
                className="hover:bg-accent text-brand flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onChange({ newName: query.trim() });
                }}
              >
                <Plus className="size-4" /> New client “{query.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
