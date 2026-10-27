"use client";

import { upload } from "@vercel/blob/client";
import { FileText, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { registerDocumentAction } from "@/lib/actions/documents";
import { formatDay } from "@/lib/domain/dates";

export interface DocumentRow {
  _id: string;
  name: string;
  category: string;
  revision?: string;
  uploadedAt: Date;
  uploadedByName: string;
  size?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  quote: "Quote",
  drawing: "Drawing",
  photo: "Photo",
  rams: "RAMS",
  contract: "Contract / PO",
  other: "Other",
};

function formatSize(bytes?: number) {
  if (!bytes) return "";
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.ceil(bytes / 1000)} KB`;
}

export function DocumentsPanel({
  subjectType,
  subjectId,
  documents,
  enabled,
  defaultCategory = "other",
  canUpload = true,
}: {
  subjectType: "opportunity" | "project" | "client";
  subjectId: string;
  documents: DocumentRow[];
  enabled: boolean;
  defaultCategory?: string;
  canUpload?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(defaultCategory);
  const [pending, startTransition] = useTransition();

  function onFiles(files: FileList | null) {
    if (!files?.length) return;
    startTransition(async () => {
      for (const file of Array.from(files)) {
        try {
          const blob = await upload(`documents/${subjectType}/${subjectId}/${file.name}`, file, {
            access: "private",
            handleUploadUrl: "/api/documents/upload",
            multipart: file.size > 8_000_000,
          });
          const res = await registerDocumentAction({
            subjectType,
            subjectId,
            category,
            name: file.name,
            pathname: blob.pathname,
            contentType: file.type,
            size: file.size,
          });
          if (res.error) toast.error(res.error);
          else toast.success(`${file.name} attached`);
        } catch (e) {
          toast.error(`Could not upload ${file.name}: ${(e as Error).message}`);
        }
      }
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="grid gap-3">
      {documents.length === 0 ? (
        <p className="text-muted-foreground text-sm">No documents attached.</p>
      ) : (
        <ul className="divide-y text-sm">
          {documents.map((d) => (
            <li key={d._id} className="flex items-center gap-3 py-2">
              <FileText className="text-muted-foreground size-4 shrink-0" />
              <a href={`/api/documents/${d._id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                {d.name}
              </a>
              <span className="text-muted-foreground shrink-0 text-xs">
                {CATEGORY_LABELS[d.category] ?? d.category}
                {d.revision ? ` · rev ${d.revision}` : ""} · {formatDay(d.uploadedAt)} {formatSize(d.size)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canUpload &&
        (enabled ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input ref={input} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.xlsx,.xls,.docx,.doc" />
            <Button size="sm" variant="outline" disabled={pending} onClick={() => input.current?.click()}>
              <Upload /> {pending ? "Uploading…" : "Upload"}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">Uploads are disabled until BLOB_READ_WRITE_TOKEN is configured.</p>
        ))}
    </div>
  );
}
