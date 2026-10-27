"use client";

import { useState } from "react";

import type { ActionState } from "@/lib/actions/types";
import { cn } from "@/lib/utils";
import { ActionForm, SubmitButton, TextAreaField } from "./form-kit";

/** Inline note / call log. Resets after a successful save. */
export function NoteForm({ action, allowCall = true }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; allowCall?: boolean }) {
  const [kind, setKind] = useState<"note" | "call">("note");
  return (
    <ActionForm action={action} className="gap-2">
      <input type="hidden" name="kind" value={kind} />
      {allowCall && (
        <div className="flex gap-1 text-xs">
          {(["note", "call"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn("rounded px-2 py-1", kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            >
              {k === "note" ? "Add note" : "Log call"}
            </button>
          ))}
        </div>
      )}
      <TextAreaField name="note" rows={2} placeholder={kind === "call" ? "Who you spoke to and the outcome" : "Write a note"} />
      <div className="flex justify-end">
        <SubmitButton size="sm">{kind === "call" ? "Log call" : "Add note"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
