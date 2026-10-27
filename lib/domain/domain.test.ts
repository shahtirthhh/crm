import { describe, expect, it } from "vitest";

import { addMonths, parseDay, toDay } from "./dates";
import { parseMoney, splitByPercent } from "./money";
import { canTransition, pipelineValue, weightedValue } from "./stages";
import { isEscalated, quoteAgeBucket, quoteFollowUpTasks } from "./followups";
import { buildProgramme, currentTrackerStage, rescheduleItem } from "./programme";
import { invoicedPercent, isMilestoneOverdue, planMilestones, releaseAtRisk } from "./billing";
import { can } from "./permissions";

const d = parseDay;

describe("dates", () => {
  it("converts instants to London calendar days", () => {
    // 23:30 UTC on 30 June is 00:30 BST on 1 July
    expect(toDay(new Date("2026-06-30T23:30:00Z"))).toEqual(d("2026-07-01"));
    expect(toDay(new Date("2026-12-31T23:30:00Z"))).toEqual(d("2026-12-31"));
  });

  it("clamps month arithmetic to the end of month", () => {
    expect(addMonths(d("2026-03-31"), -1)).toEqual(d("2026-02-28"));
    expect(addMonths(d("2026-01-15"), 3)).toEqual(d("2026-04-15"));
  });
});

describe("money", () => {
  it("parses pounds into pence", () => {
    expect(parseMoney("£35,000")).toBe(3_500_000);
    expect(parseMoney("12.5")).toBe(1250);
    expect(parseMoney("")).toBeUndefined();
    expect(() => parseMoney("abc")).toThrow();
  });

  it("puts rounding remainders on the last part", () => {
    expect(splitByPercent(3_845_001, [60, 20, 20])).toEqual([2_307_000, 769_000, 769_001]);
  });
});

describe("stages", () => {
  it("allows only defined moves", () => {
    expect(canTransition("enquiry", "survey_booked")).toBe(true);
    expect(canTransition("enquiry", "won")).toBe(false);
    expect(canTransition("won", "lost")).toBe(false);
  });

  it("uses the quote once one exists", () => {
    expect(pipelineValue({ valueLow: 3_500_000, valueHigh: 4_000_000 })).toBe(3_750_000);
    expect(pipelineValue({ valueLow: 3_500_000, currentQuoteTotal: 3_845_000 })).toBe(3_845_000);
    expect(weightedValue("quote_sent", 1_000_000)).toBe(400_000);
    expect(weightedValue("won", 1_000_000)).toBe(0);
  });
});

describe("follow-ups", () => {
  it("creates day 4 and day 10 tasks keyed by quote", () => {
    const tasks = quoteFollowUpTasks("Q-1187", d("2026-10-03"));
    expect(tasks.map((t) => [t.ruleKey, t.kind, t.dueOn])).toEqual([
      ["quote.followup.d4:Q-1187", "email", d("2026-10-07")],
      ["quote.followup.d10:Q-1187", "call", d("2026-10-13")],
    ]);
  });

  it("buckets quote age and escalates at day 14", () => {
    expect(quoteAgeBucket(d("2026-10-01"), d("2026-10-08"))).toBe("0-7");
    expect(quoteAgeBucket(d("2026-10-01"), d("2026-10-15"))).toBe("8-14");
    expect(isEscalated(d("2026-10-01"), d("2026-10-14"))).toBe(false);
    expect(isEscalated(d("2026-10-01"), d("2026-10-15"))).toBe(true);
  });
});

describe("programme and billing", () => {
  const programme = buildProgramme({ clientPoOn: d("2026-10-05"), leadTimeWeeks: 11, installDays: 5 });

  it("orders the template and keeps install to working days", () => {
    const install = programme.find((i) => i.key === "install")!;
    expect(install.start.getUTCDay()).not.toBe(0);
    expect(install.start.getUTCDay()).not.toBe(6);
    const release = programme.find((i) => i.key === "release")!;
    expect(release.end.getTime()).toBeLessThan(install.start.getTime());
    expect(currentTrackerStage(programme)).toBe(0);
  });

  it("derives 60/20/20 due dates from the programme", () => {
    const plan = planMilestones(3_845_000, programme);
    const release = programme.find((i) => i.key === "release")!.end;
    const handover = programme.find((i) => i.key === "handover")!.end;
    expect(plan.map((m) => m.amountPence)).toEqual([2_307_000, 769_000, 769_000]);
    expect(plan[0].dueOn).toEqual(d("2026-10-05"));
    expect(plan[1].dueOn).toEqual(addMonths(release, -1));
    expect(plan[2].dueOn!.getTime() - handover.getTime()).toBe(30 * 86_400_000);
  });

  it("cascades a delay to later items but not completed ones", () => {
    const withDone = programme.map((i) => (i.key === "client_po" ? { ...i, done: true } : i));
    const manufacture = withDone.find((i) => i.key === "manufacture")!;
    const moved = rescheduleItem(withDone, "manufacture", manufacture.start, new Date(manufacture.end.getTime() + 7 * 86_400_000), true);
    const before = withDone.find((i) => i.key === "handover")!.end.getTime();
    expect(moved.find((i) => i.key === "handover")!.end.getTime() - before).toBe(7 * 86_400_000);
    expect(moved.find((i) => i.key === "client_po")).toEqual(withDone.find((i) => i.key === "client_po"));
  });

  it("flags release risk and overdue milestones", () => {
    const release = programme.find((i) => i.key === "release")!.end;
    const milestones = [
      { kind: "deposit" as const, status: "paid" as const, amountPence: 60, dueOn: d("2026-10-05") },
      { kind: "mid" as const, status: "raised" as const, amountPence: 20, dueOn: addMonths(release, -1) },
      { kind: "final" as const, status: "scheduled" as const, amountPence: 20, dueOn: null },
    ];
    expect(releaseAtRisk(milestones, programme, new Date(release.getTime() - 7 * 86_400_000))).toBe(true);
    expect(releaseAtRisk(milestones, programme, d("2026-10-06"))).toBe(false);
    expect(isMilestoneOverdue(milestones[1], release)).toBe(true);
    expect(invoicedPercent(milestones, 100)).toBe(80);
  });
});

describe("permissions", () => {
  it("restricts billing to accounts and directors", () => {
    expect(can("accounts", "billing:write")).toBe(true);
    expect(can("sales_admin", "billing:write")).toBe(false);
    expect(can("md", "users:manage")).toBe(true);
    expect(can(undefined, "reports:view")).toBe(false);
  });
});
