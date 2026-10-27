import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ActivityFeed } from "@/components/app/activity-feed";
import { DueLabel, SectionTitle, StatCard } from "@/components/app/display";
import { PageHeader } from "@/components/app/page-header";
import { TaskList } from "@/components/app/task-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { recentActivity } from "@/lib/dal/activity";
import { headline } from "@/lib/dal/reports";
import { requireUser } from "@/lib/dal/session";
import { plain } from "@/lib/dal/util";
import { db } from "@/lib/db/collections";
import { addDays, startOfWeek, today as todayFn } from "@/lib/domain/dates";
import { formatMoneyShort } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const user = await requireUser();
  const today = todayFn();
  const weekEnd = addDays(startOfWeek(today), 6);

  const [myTasks, head, siteVisits, installs, activity] = await Promise.all([
    db.tasks().find({ status: "open", ownerId: user.id, dueOn: { $lte: addDays(today, 7) } }).sort({ dueOn: 1 }).limit(50).toArray(),
    headline(),
    db.tasks().find({ status: "open", kind: "survey", dueOn: { $gte: today, $lte: weekEnd } }).sort({ dueOn: 1 }).toArray(),
    db
      .projects()
      .aggregate<{ ref: string; clientName: string; siteName?: string; start: Date }>([
        { $match: { status: "live" } },
        { $unwind: "$programme" },
        { $match: { "programme.key": "install", "programme.done": false, "programme.start": { $lte: addDays(weekEnd, 7) }, "programme.end": { $gte: today } } },
        { $project: { ref: 1, clientName: 1, siteName: 1, start: "$programme.start" } },
        { $sort: { start: 1 } },
      ])
      .toArray(),
    recentActivity(10),
  ]);

  const overdue = myTasks.filter((t) => t.dueOn < today).length;
  const dueToday = myTasks.filter((t) => t.dueOn <= today).length;
  const firstName = user.name.split(" ")[0];
  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(today);

  return (
    <>
      <PageHeader
        eyebrow={dateLabel}
        title={`Today, ${firstName}`}
        actions={
          <Button asChild variant="brand" className="hidden sm:inline-flex">
            <Link href="/opportunities/new">
              <Plus /> New opportunity
            </Link>
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pipeline" value={formatMoneyShort(head.pipelineValue)} sub={`${head.openCount} open`} href="/pipeline" />
        <StatCard
          label="My follow-ups due"
          value={dueToday}
          sub={overdue ? `${overdue} overdue` : "none overdue"}
          tone={overdue ? "brand" : undefined}
          href="/follow-ups"
        />
        <StatCard label="Site visits this week" value={siteVisits.length} />
        <StatCard label="Installs next 2 weeks" value={installs.length} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">My tasks</h2>
            <Link href="/follow-ups" className="text-muted-foreground text-xs hover:underline">
              All follow-ups
            </Link>
          </div>
          <TaskList tasks={plain(myTasks)} today={today} empty="You are clear for the next 7 days." />
        </Card>

        <div className="grid content-start gap-5">
          <Card>
            <CardContent>
              <SectionTitle>On site this week</SectionTitle>
              {siteVisits.length + installs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No surveys or installs scheduled.</p>
              ) : (
                <ul className="grid gap-3 text-sm">
                  {siteVisits.map((t) => (
                    <li key={t._id.toHexString()} className="flex items-start justify-between gap-2">
                      <Link href={`/opportunities/${t.subject.ref}`} className="min-w-0 hover:underline">
                        <div className="truncate font-medium">{t.title}</div>
                        <div className="text-muted-foreground truncate text-xs">
                          {t.subject.label} · {t.ownerName}
                        </div>
                      </Link>
                      <DueLabel dueOn={t.dueOn} today={today} />
                    </li>
                  ))}
                  {installs.map((p) => (
                    <li key={p.ref} className="flex items-start justify-between gap-2">
                      <Link href={`/projects/${p.ref}`} className="min-w-0 hover:underline">
                        <div className="truncate font-medium">Install · {p.clientName}</div>
                        <div className="text-muted-foreground truncate text-xs">
                          {p.ref}
                          {p.siteName ? ` · ${p.siteName}` : ""}
                        </div>
                      </Link>
                      <DueLabel dueOn={p.start} today={today} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <SectionTitle>Recent activity</SectionTitle>
              <ActivityFeed items={activity} showSubject />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
