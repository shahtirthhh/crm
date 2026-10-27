import type { FieldErrors } from "@/lib/validation";

export interface ActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: FieldErrors;
  /** Echoed back so forms keep their values after a failed submit. */
  values?: Record<string, string>;
}

export const initialState: ActionState = {};
