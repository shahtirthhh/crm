"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { quickCompleteTaskAction, reopenTaskAction } from "@/lib/actions/tasks";
import { TASK_KIND_LABELS, type TaskKind } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import { DueLabel } from "./display";

export interface TaskRow {
  _id: string;
  title: string;
  kind: TaskKind;
  status: "open" | "done" | "cancelled";
  dueOn: Date;
  ownerName: string;
  outcome?: string;
  subject: { type: "opportunity" | "project" | "client"; id: string; ref: string; label: string };
}

export function subjectHref(subject: TaskRow["subject"]): string {
  if (subject.type === "opportunity") return `/opportunities/${subject.ref}`;
  if (subject.type === "project") return `/projects/${subject.ref}`;
  return `/clients/${subject.id}`;
}

function TaskItem({ task, today, showOwner, showSubject }: { task: TaskRow; today: Date; showOwner?: boolean; showSubject?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useOptimistic(task.status === "done");
  return (
    <li className={cn("flex items-start gap-3 px-3 py-2.5", pending && "opacity-60")}>
      <Checkbox
        className="mt-0.5"
        checked={done}
        aria-label={done ? "Reopen task" : "Complete task"}
        onCheckedChange={(value) =>
          startTransition(async () => {
            setDone(!!value);
            const res = value ? await quickCompleteTaskAction(task._id) : await reopenTaskAction(task._id);
            if (res.error) toast.error(res.error);
          })
        }
      />
      <div className="min-w-0 flex-1">
        <div className={cn("flex items-center gap-2 text-sm", done && "text-muted-foreground line-through")}>
          <span className="bg-muted text-muted-foreground rounded px-1 text-[10px] font-medium tracking-wide uppercase">
            {TASK_KIND_LABELS[task.kind]}
          </span>
          <span className="truncate">{task.title}</span>
        </div>
        <div className="text-muted-foreground mt-0.5 truncate text-xs">
          {showSubject !== false && (
            <Link href={subjectHref(task.subject)} className="hover:text-foreground hover:underline">
              {task.subject.label} · {task.subject.ref}
            </Link>
          )}
          {[showOwner ? task.ownerName : null, task.outcome]
            .filter(Boolean)
            .map((part, i) => (
              <span key={i}>
                {i > 0 || showSubject !== false ? " · " : ""}
                {part}
              </span>
            ))}
        </div>
      </div>
      <DueLabel dueOn={task.dueOn} today={today} done={done} />
    </li>
  );
}

export function TaskList({
  tasks,
  today,
  showOwner,
  showSubject,
  empty = "Nothing due.",
}: {
  tasks: TaskRow[];
  today: Date;
  showOwner?: boolean;
  showSubject?: boolean;
  empty?: string;
}) {
  if (!tasks.length) return <p className="text-muted-foreground px-3 py-6 text-center text-sm">{empty}</p>;
  return (
    <ul className="divide-y">
      {tasks.map((t) => (
        <TaskItem key={t._id} task={t} today={today} showOwner={showOwner} showSubject={showSubject} />
      ))}
    </ul>
  );
}
