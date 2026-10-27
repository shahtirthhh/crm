"use server";

import { refresh } from "next/cache";

import { registerDocument } from "@/lib/dal/documents";
import { requireUser } from "@/lib/dal/session";
import { DomainError, oid } from "@/lib/dal/util";
import type { DocumentDoc } from "@/lib/db/types";
import { handle, type ActionState } from "./state";

const CATEGORIES: DocumentDoc["category"][] = ["quote", "drawing", "photo", "rams", "contract", "other"];

export async function registerDocumentAction(input: {
  subjectType: "opportunity" | "project" | "client";
  subjectId: string;
  category: string;
  name: string;
  pathname: string;
  contentType?: string;
  size?: number;
  revision?: string;
}): Promise<ActionState & { documentId?: string }> {
  let documentId: string | undefined;
  const state = await handle(async () => {
    const user = await requireUser();
    if (user.role === "engineer") throw new DomainError("You do not have permission to upload documents");
    if (!CATEGORIES.includes(input.category as DocumentDoc["category"])) throw new DomainError("Unknown category");
    const doc = await registerDocument(
      {
        ...input,
        subjectId: oid(input.subjectId),
        category: input.category as DocumentDoc["category"],
        name: input.name.slice(0, 200),
        revision: input.revision?.slice(0, 20) || undefined,
      },
      user,
    );
    documentId = doc._id.toHexString();
    refresh();
  });
  return { ...state, documentId };
}
