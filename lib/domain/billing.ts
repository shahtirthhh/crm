import { DEFAULT_BILLING_SPLIT, MILESTONE_KINDS, MILESTONE_LABELS, type MilestoneKind, type MilestoneStatus } from "./constants";
import { addDays, addMonths, diffDays } from "./dates";
import { splitByPercent } from "./money";
import { programmeDate, type ProgrammeItem } from "./programme";

export interface MilestonePlan {
  kind: MilestoneKind;
  label: string;
  percent: number;
  amountPence: number;
  dueOn: Date | null;
}

export interface MilestoneState {
  kind: MilestoneKind;
  status: MilestoneStatus;
  dueOn?: Date | null;
  amountPence: number;
}

/**
 * Due dates come from the programme:
 * - deposit on the client PO
 * - mid one month before manufacturer release, so 80% is received before the lift leaves the factory
 * - final 30 days after handover
 */
export function milestoneDueDates(programme: ProgrammeItem[] | null): Record<MilestoneKind, Date | null> {
  if (!programme?.length) return { deposit: null, mid: null, final: null };
  const po = programmeDate(programme, "client_po") ?? null;
  const release = programmeDate(programme, "release");
  const handover = programmeDate(programme, "handover");
  return {
    deposit: po,
    mid: release ? addMonths(release, -1) : null,
    final: handover ? addDays(handover, 30) : null,
  };
}

export function planMilestones(
  contractValuePence: number,
  programme: ProgrammeItem[] | null,
  split: Record<MilestoneKind, number> = DEFAULT_BILLING_SPLIT,
): MilestonePlan[] {
  const percents = MILESTONE_KINDS.map((k) => split[k]);
  if (percents.reduce((a, b) => a + b, 0) !== 100) throw new Error("Billing split must total 100%");
  const amounts = splitByPercent(contractValuePence, percents);
  const due = milestoneDueDates(programme);
  return MILESTONE_KINDS.map((kind, i) => ({
    kind,
    label: MILESTONE_LABELS[kind],
    percent: percents[i],
    amountPence: amounts[i],
    dueOn: due[kind],
  }));
}

export function isMilestoneOverdue(m: MilestoneState, today: Date): boolean {
  return m.status !== "paid" && !!m.dueOn && m.dueOn.getTime() < today.getTime();
}

export function invoicedPercent(milestones: MilestoneState[], contractValuePence: number): number {
  if (!contractValuePence) return 0;
  const raised = milestones
    .filter((m) => m.status === "raised" || m.status === "paid")
    .reduce((sum, m) => sum + m.amountPence, 0);
  return Math.round((raised / contractValuePence) * 100);
}

/**
 * Manufacturers release a lift only once it is paid for. Warn when release is close and the
 * deposit and mid invoice are not both paid.
 */
export function releaseAtRisk(
  milestones: MilestoneState[],
  programme: ProgrammeItem[] | null,
  today: Date,
  windowDays = 14,
): boolean {
  const release = programme ? programmeDate(programme, "release") : undefined;
  if (!release) return false;
  const releaseItem = programme!.find((i) => i.key === "release");
  if (releaseItem?.done) return false;
  if (diffDays(release, today) > windowDays) return false;
  return milestones.filter((m) => m.kind === "deposit" || m.kind === "mid").some((m) => m.status !== "paid");
}
