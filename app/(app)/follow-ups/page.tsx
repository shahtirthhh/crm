import type { Metadata } from "next";

import { SectionTitle } from "@/components/app/display";
import { LinkTabs, PageHeader } from "@/components/app/page-header";
import { TaskList } from "@/components/app/task-list";
import { Card, CardContent } from "@/components/ui/card";
import { quotesAwaitingDecision } from "@/lib/dal/opportunities";
import { requireUser } from "@/lib/dal/session";
import { followUpDiscipline, listTasks, openTasksByOwner, type TaskView } from "@/lib/dal/tasks";
import { addDays, startOfWeek, today as todayFn } from "@/lib/domain/dates";
import { quoteAgeBucket } from "@/lib/domain/followups";

export const metadata: Metadata = { title: "Follow-ups" };

const VIEWS: { key: TaskView; label: string }[] = [
  { key: "mine", label: "My tasks" },
  { key: "team", label: "Team" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

export default async function FollowUpsPage({ searchParams }: PageProps<"/follow-ups">) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = (VIEWS.find((v) => v.key === sp.view)?.key ?? "mine") as TaskView;
  const today = todayFn();
  const [tasks, discipline, byOwner, quotes] = await Promise.all([
    listTasks(view, user),
    followUpDiscipline(),
    openTasksByOwner(),
    quotesAwaitingDecision(),
  ]);
  const pct = discipline.due ? Math.round((discipline.onTime / discipline.due) * 100) : null;
  const maxOpen = Math.max(1, ...byOwner.map((o) => o.open));
  const buckets = { "0-7": 0, "8-14": 0, "15+": 0 };
  for (const q of quotes) if (q.quoteSentOn) buckets[quoteAgeBucket(q.quoteSentOn, today)]++;

  const weekEnd = addDays(startOfWeek(today), 6);
  const groups =
    view === "completed"
      ? [{ label: "Completed in the last 30 days", items: tasks }]
      : [
          { label: "Overdue", items: tasks.filter((t) => t.dueOn < today) },
          { label: "Today", items: tasks.filter((t) => t.dueOn.getTime() === today.getTime()) },
          { label: "This week", items: tasks.filter((t) => t.dueOn > today && t.dueOn <= weekEnd) },
          { label: "Later", items: tasks.filter((t) => t.dueOn > weekEnd) },
        ].filter((g) => g.items.length);

  return (
    <>
      <PageHeader eyebrow="Sales" title="Follow-ups and tasks" description="Every follow-up is a dated task with an owner. A quote marked as sent creates a day 4 email and a day 10 call.">
        <LinkTabs active={view} tabs={VIEWS.map((v) => ({ key: v.key, label: v.label, href: `/follow-ups?view=${v.key}` }))} />
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-5">
          {groups.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-muted-foreground py-6 text-center text-sm">Nothing here.</p>
              </CardContent>
            </Card>
          ) : (
            groups.map((g) => (
              <Card key={g.label} className="gap-0 py-0">
                <div className={`border-b px-4 py-2.5 text-xs font-semibold tracking-wider uppercase ${g.label === "Overdue" ? "text-brand" : "text-muted-foreground"}`}>
                  {g.label} · {g.items.length}
                </div>
                <TaskList tasks={g.items} today={today} showOwner={view !== "mine"} />
              </Card>
            ))
          )}
        </div>
        <div className="grid content-start gap-5">
          <Card>
            <CardContent>
              <SectionTitle>Follow-up discipline · 30 days</SectionTitle>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-semibold tabular-nums">{pct == null ? "—" : `${pct}%`}</span>
                <span className="text-muted-foreground text-sm">
                  {discipline.onTime} of {discipline.due} completed on the day they fell due
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <SectionTitle>Open by owner</SectionTitle>
              <ul className="grid gap-2 text-sm">
                {byOwner.map((o) => (
                  <li key={o._id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2">
                    <span className="truncate">{o.name}</span>
                    <span className="bg-muted h-2 rounded">
                      <span className="bg-foreground/80 block h-2 rounded" style={{ width: `${(o.open / maxOpen) * 100}%` }} />
                    </span>
                    <span className="tabular-nums">
                      {o.open}
                      {o.overdue > 0 && <span className="text-brand"> · {o.overdue} late</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <SectionTitle>Quotes awaiting decision</SectionTitle>
              <ul className="grid gap-1.5 text-sm">
                <li className="flex justify-between">
                  <span>0 to 7 days</span>
                  <span className="tabular-nums">{buckets["0-7"]}</span>
                </li>
                <li className="flex justify-between">
                  <span>8 to 14 days</span>
                  <span className="tabular-nums">{buckets["8-14"]}</span>
                </li>
                <li className="text-brand flex justify-between">
                  <span>Over 14 days</span>
                  <span className="tabular-nums">{buckets["15+"]}</span>
                </li>
              </ul>
            </CardContent>
          </Card>
          <p className="text-muted-foreground text-xs">
            Rule: a quote marked as sent creates a day 4 email and day 10 call task for the owner. Overdue tasks are raised in the Monday review.
          </p>
        </div>
      </div>
    </>
  );
}
