import { FOLLOW_UP_RULES, QUOTE_ESCALATION_DAYS, type TaskKind } from "./constants";
import { addDays, diffDays } from "./dates";

export interface PlannedTask {
  ruleKey: string;
  title: string;
  kind: TaskKind;
  dueOn: Date;
}

/**
 * Tasks created when a quote is marked as sent. The rule key includes the quote reference so
 * a new revision gets its own tasks and re-running the rule is idempotent.
 */
export function quoteFollowUpTasks(quoteRef: string, sentOn: Date): PlannedTask[] {
  return FOLLOW_UP_RULES.map((rule) => ({
    ruleKey: `quote.followup.${rule.key}:${quoteRef}`,
    title: `${rule.title} · ${quoteRef}`,
    kind: rule.kind,
    dueOn: addDays(sentOn, rule.offsetDays),
  }));
}

export type QuoteAgeBucket = "0-7" | "8-14" | "15+";

export function quoteAgeBucket(sentOn: Date, today: Date): QuoteAgeBucket {
  const age = diffDays(today, sentOn);
  if (age <= 7) return "0-7";
  if (age <= QUOTE_ESCALATION_DAYS) return "8-14";
  return "15+";
}

export function isEscalated(sentOn: Date, today: Date): boolean {
  return diffDays(today, sentOn) >= QUOTE_ESCALATION_DAYS;
}

export function isOverdue(dueOn: Date, today: Date): boolean {
  return dueOn.getTime() < today.getTime();
}
