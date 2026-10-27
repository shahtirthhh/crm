import "server-only";

import { db } from "@/lib/db/collections";
import type { Milestone, OpportunityDoc } from "@/lib/db/types";
import { OPEN_STAGES, SOURCES, type OpenStage, type Source, type Stage } from "@/lib/domain/constants";
import { addDays, addMonths, startOfWeek, today as todayFn } from "@/lib/domain/dates";
import { releaseAtRisk } from "@/lib/domain/billing";
import { quoteAgeBucket, type QuoteAgeBucket } from "@/lib/domain/followups";
import { getSettings } from "./reference";
import { plain } from "./util";

export type Period = "month" | "quarter" | "ytd" | "12m";

function periodStart(period: Period, today: Date): Date {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  switch (period) {
    case "month":
      return new Date(Date.UTC(y, m, 1));
    case "quarter":
      return new Date(Date.UTC(y, m - (m % 3), 1));
    case "ytd":
      return new Date(Date.UTC(y, 0, 1));
    case "12m":
      return addMonths(today, -12);
  }
}

interface Bucket {
  _id: string;
  value: number;
  count: number;
}

export async function dashboard(period: Period) {
  const today = todayFn();
  const from = periodStart(period, today);
  const yearAgo = addMonths(today, -12);
  const sixMonthsAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
  const settings = await getSettings();

  const [facets] = await db
    .opportunities()
    .aggregate<{
      byStage: Bucket[];
      bySource: Bucket[];
      wonInPeriod: { value: number; count: number }[];
      decided12m: { _id: Stage; count: number; avgDays: number }[];
      bySourceDecided: { _id: { source: Source; stage: Stage }; count: number }[];
      byMonth: { _id: { month: string; stage: Stage }; value: number; count: number }[];
      top: OpportunityDoc[];
      lostReasons: { _id: string; count: number }[];
    }>([
      {
        $facet: {
          byStage: [
            { $match: { stage: { $in: [...OPEN_STAGES] } } },
            { $group: { _id: "$stage", value: { $sum: "$valuePence" }, count: { $sum: 1 } } },
          ],
          bySource: [
            { $match: { stage: { $in: [...OPEN_STAGES] } } },
            { $group: { _id: "$source", value: { $sum: "$valuePence" }, count: { $sum: 1 } } },
            { $sort: { value: -1 } },
          ],
          wonInPeriod: [
            { $match: { stage: "won", closedAt: { $gte: from } } },
            { $group: { _id: null, value: { $sum: "$valuePence" }, count: { $sum: 1 } } },
          ],
          decided12m: [
            { $match: { stage: { $in: ["won", "lost"] }, closedAt: { $gte: yearAgo } } },
            {
              $group: {
                _id: "$stage",
                count: { $sum: 1 },
                avgDays: { $avg: { $divide: [{ $subtract: ["$closedAt", "$createdAt"] }, 86_400_000] } },
              },
            },
          ],
          bySourceDecided: [
            { $match: { stage: { $in: ["won", "lost"] }, closedAt: { $gte: yearAgo } } },
            { $group: { _id: { source: "$source", stage: "$stage" }, count: { $sum: 1 } } },
          ],
          byMonth: [
            { $match: { stage: { $in: ["won", "lost"] }, closedAt: { $gte: sixMonthsAgo } } },
            {
              $group: {
                _id: { month: { $dateToString: { format: "%Y-%m", date: "$closedAt", timezone: "Europe/London" } }, stage: "$stage" },
                value: { $sum: "$valuePence" },
                count: { $sum: 1 },
              },
            },
          ],
          top: [
            { $match: { stage: { $in: [...OPEN_STAGES] } } },
            { $sort: { valuePence: -1 } },
            { $limit: 5 },
            { $project: { ref: 1, clientName: 1, productName: 1, stage: 1, source: 1, valuePence: 1 } },
          ],
          lostReasons: [
            { $match: { stage: "lost", closedAt: { $gte: yearAgo } } },
            { $group: { _id: { $ifNull: ["$lostReason", "Not recorded"] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
        },
      },
    ])
    .toArray();

  const stageRows = OPEN_STAGES.map((stage) => {
    const b = facets.byStage.find((x) => x._id === stage);
    const value = b?.value ?? 0;
    return { stage, value, count: b?.count ?? 0, weighted: Math.round(value * settings.stageProbability[stage]) };
  });
  const won = facets.decided12m.find((d) => d._id === "won");
  const lost = facets.decided12m.find((d) => d._id === "lost");
  const decided = (won?.count ?? 0) + (lost?.count ?? 0);
  const avgDaysToDecision = decided
    ? Math.round(((won?.avgDays ?? 0) * (won?.count ?? 0) + (lost?.avgDays ?? 0) * (lost?.count ?? 0)) / decided)
    : null;

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const byMonth = months.map((month) => {
    const w = facets.byMonth.find((x) => x._id.month === month && x._id.stage === "won");
    const l = facets.byMonth.find((x) => x._id.month === month && x._id.stage === "lost");
    return { month, won: w?.value ?? 0, wonCount: w?.count ?? 0, lost: l?.value ?? 0, lostCount: l?.count ?? 0 };
  });

  const conversionBySource = SOURCES.map((source) => {
    const w = facets.bySourceDecided.find((x) => x._id.source === source && x._id.stage === "won")?.count ?? 0;
    const l = facets.bySourceDecided.find((x) => x._id.source === source && x._id.stage === "lost")?.count ?? 0;
    return { source, won: w, decided: w + l };
  }).filter((r) => r.decided > 0);

  const [quotesAwaiting, followUpsOverdue] = await Promise.all([
    db.opportunities().countDocuments({ stage: { $in: ["quote_sent", "follow_up"] } }),
    db.tasks().countDocuments({ status: "open", dueOn: { $lt: today } }),
  ]);

  return {
    pipeline: {
      value: stageRows.reduce((s, r) => s + r.value, 0),
      weighted: stageRows.reduce((s, r) => s + r.weighted, 0),
      count: stageRows.reduce((s, r) => s + r.count, 0),
    },
    byStage: stageRows,
    bySource: facets.bySource.map((b) => ({ source: b._id as Source, value: b.value, count: b.count })),
    wonInPeriod: facets.wonInPeriod[0] ?? { value: 0, count: 0 },
    winRate: { won: won?.count ?? 0, decided },
    avgDaysToDecision,
    byMonth,
    conversionBySource,
    top: plain(facets.top),
    lostReasons: facets.lostReasons,
    quotesAwaiting,
    followUpsOverdue,
  };
}

export async function mondayReview() {
  const today = todayFn();
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const lookahead = addDays(weekStart, 13);

  const [newEnquiries, awaiting, overdueTasks, projects, triage] = await Promise.all([
    db
      .opportunities()
      .find({ createdAt: { $gte: addDays(weekStart, -7) } }, { projection: { ref: 1, clientName: 1, productName: 1, source: 1, valuePence: 1, ownerName: 1, stage: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .toArray(),
    db
      .opportunities()
      .find({ stage: { $in: ["quote_sent", "follow_up"] } }, { projection: { ref: 1, clientName: 1, productName: 1, valuePence: 1, ownerName: 1, quoteSentOn: 1, stage: 1 } })
      .sort({ quoteSentOn: 1 })
      .toArray(),
    db.tasks().find({ status: "open", dueOn: { $lt: today } }).sort({ dueOn: 1 }).limit(100).toArray(),
    db.projects().find({ status: "live" }).toArray(),
    db.opportunities().countDocuments({ needsTriage: true, stage: "enquiry" }),
  ]);

  const buckets: Record<QuoteAgeBucket, typeof awaiting> = { "0-7": [], "8-14": [], "15+": [] };
  for (const o of awaiting) buckets[o.quoteSentOn ? quoteAgeBucket(o.quoteSentOn, today) : "0-7"].push(o);

  const milestonesThisWeek = projects.flatMap((p) =>
    p.programme
      .filter((i) => !i.done && i.end <= lookahead && !i.key.startsWith("service_"))
      .map((i) => ({ projectRef: p.ref, clientName: p.clientName, label: i.label, end: i.end, overdue: i.end < today })),
  );
  milestonesThisWeek.sort((a, b) => a.end.getTime() - b.end.getTime());

  const billing: { projectRef: string; clientName: string; milestone: Milestone; overdue: boolean }[] = [];
  for (const p of projects) {
    for (const m of p.milestones) {
      if (m.status !== "paid" && m.dueOn && m.dueOn <= lookahead) {
        billing.push({ projectRef: p.ref, clientName: p.clientName, milestone: m, overdue: m.dueOn < today });
      }
    }
  }
  billing.sort((a, b) => a.milestone.dueOn!.getTime() - b.milestone.dueOn!.getTime());

  const releaseRisks = projects
    .filter((p) => releaseAtRisk(p.milestones, p.programme, today))
    .map((p) => ({ ref: p.ref, clientName: p.clientName, release: p.programme.find((i) => i.key === "release")?.end }));

  return {
    weekStart,
    weekEnd,
    newEnquiries: plain(newEnquiries),
    quoteBuckets: { "0-7": plain(buckets["0-7"]), "8-14": plain(buckets["8-14"]), "15+": plain(buckets["15+"]) },
    overdueTasks: plain(overdueTasks),
    milestonesThisWeek,
    billing: plain(billing),
    releaseRisks,
    triage,
  };
}

/** Headline numbers for the mobile Today screen and sidebar badges. */
export async function headline() {
  const [pipeline] = await db
    .opportunities()
    .aggregate<{ value: number; count: number }>([
      { $match: { stage: { $in: [...OPEN_STAGES] } } },
      { $group: { _id: null, value: { $sum: "$valuePence" }, count: { $sum: 1 } } },
    ])
    .toArray();
  return { pipelineValue: pipeline?.value ?? 0, openCount: pipeline?.count ?? 0 };
}

export type StageCounts = Record<OpenStage, number>;
