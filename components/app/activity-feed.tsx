import Link from "next/link";

import { formatDateTime } from "@/lib/domain/dates";

export interface ActivityRow {
  _id: string;
  type: string;
  summary: string;
  actorName: string;
  at: Date;
  subject: { type: string; ref: string; id: string; label: string };
}

function href(s: ActivityRow["subject"]) {
  if (s.type === "opportunity") return `/opportunities/${s.ref}`;
  if (s.type === "project") return `/projects/${s.ref}`;
  return `/clients/${s.id}`;
}

export function ActivityFeed({ items, showSubject }: { items: ActivityRow[]; showSubject?: boolean }) {
  if (!items.length) return <p className="text-muted-foreground py-4 text-sm">No activity yet.</p>;
  return (
    <ol className="grid gap-3">
      {items.map((a) => (
        <li key={a._id} className="grid grid-cols-[auto_1fr] gap-3 text-sm">
          <span
            className={
              a.type.startsWith("opportunity.won") || a.type === "billing.paid"
                ? "bg-success mt-1.5 size-2 rounded-full"
                : a.type === "note" || a.type === "call"
                  ? "bg-foreground/60 mt-1.5 size-2 rounded-full"
                  : "bg-brand mt-1.5 size-2 rounded-full"
            }
          />
          <div className="min-w-0">
            <div className="break-words whitespace-pre-line">{a.summary}</div>
            <div className="text-muted-foreground text-xs">
              {formatDateTime(a.at)} · {a.actorName}
              {showSubject && (
                <>
                  {" · "}
                  <Link className="hover:underline" href={href(a.subject)}>
                    {a.subject.ref}
                  </Link>
                </>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
