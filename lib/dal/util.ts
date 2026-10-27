import "server-only";

import { ObjectId } from "mongodb";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

export function oid(id: string | ObjectId | undefined | null): ObjectId {
  if (id instanceof ObjectId) return id;
  if (!id || !ObjectId.isValid(id)) throw new NotFoundError("Record");
  return new ObjectId(id);
}

export function maybeOid(id: string | undefined | null): ObjectId | undefined {
  return id && ObjectId.isValid(id) ? new ObjectId(id) : undefined;
}

/** Converts ObjectIds to strings so documents can be passed to Client Components. */
export type Plain<T> = T extends ObjectId
  ? string
  : T extends Date
    ? Date
    : T extends (infer U)[]
      ? Plain<U>[]
      : T extends object
        ? { [K in keyof T]: Plain<T[K]> }
        : T;

export function plain<T>(value: T): Plain<T> {
  if (value instanceof ObjectId) return value.toHexString() as Plain<T>;
  if (value instanceof Date || value === null || typeof value !== "object") return value as Plain<T>;
  if (Array.isArray(value)) return value.map(plain) as Plain<T>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = plain(v);
  return out as Plain<T>;
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
