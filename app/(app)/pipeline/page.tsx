import type { Metadata } from "next";

import { StatCard } from "@/components/app/display";
import { PipelineBoard } from "@/components/app/pipeline-board";
import { boardData } from "@/lib/dal/opportunities";
import { getSettings } from "@/lib/dal/reference";
import { requireUser } from "@/lib/dal/session";
import { db } from "@/lib/db/collections";
import { addDays, today as todayFn } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { isOpenStage } from "@/lib/domain/stages";
import { PipelineHeader, parseFilters } from "./shared";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: PageProps<"/pipeline">) {
  await requireUser();
  const filters = parseFilters(await searchParams);
  const today = todayFn();
  const [cards, settings, newThisWeek, followUpsDue] = await Promise.all([
    boardData(filters),
    getSettings(),
    db.opportunities().countDocuments({ createdAt: { $gte: addDays(today, -7) } }),
    db.tasks().countDocuments({ status: "open", "subject.type": "opportunity", dueOn: { $lte: today } }),
  ]);
  const open = cards.filter((c) => isOpenStage(c.stage));
  const value = open.reduce((s, c) => s + c.valuePence, 0);
  const weighted = open.reduce((s, c) => s + c.valuePence * settings.stageProbability[c.stage as keyof typeof settings.stageProbability], 0);
  const awaiting = open.filter((c) => c.stage === "quote_sent" || c.stage === "follow_up");
  const avgAge = awaiting.length
    ? Math.round(awaiting.reduce((s, c) => s + (c.quoteSentOn ? (today.getTime() - c.quoteSentOn.getTime()) / 86_400_000 : 0), 0) / awaiting.length)
    : 0;

  return (
    <>
      <PipelineHeader active="board" title="Projects pipeline" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Open enquiries" value={open.length} sub={`+${newThisWeek} this week`} tone="brand" />
        <StatCard label="Pipeline value" value={formatMoney(value)} sub={`${formatMoney(Math.round(weighted))} weighted`} />
        <StatCard label="Follow-ups due" value={followUpsDue} href="/follow-ups?view=team" tone={followUpsDue ? "brand" : undefined} sub="today or overdue" />
        <StatCard label="Quotes awaiting" value={awaiting.length} sub={`avg ${avgAge} days`} href="/quotes" />
      </div>
      <PipelineBoard cards={cards} today={today} />
    </>
  );
}
