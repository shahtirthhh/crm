import type { OpenStage, Stage } from "./constants";
import { DEFAULT_STAGE_PROBABILITY, OPEN_STAGES } from "./constants";

/** Moves a user may make by hand. won/lost go through dedicated actions with extra data. */
const ALLOWED: Record<Stage, readonly Stage[]> = {
  enquiry: ["survey_booked", "quote_sent", "lost"],
  survey_booked: ["enquiry", "quote_sent", "lost"],
  quote_sent: ["follow_up", "won", "lost"],
  follow_up: ["quote_sent", "won", "lost"],
  won: [],
  lost: ["enquiry"],
};

export function canTransition(from: Stage, to: Stage): boolean {
  return from === to || ALLOWED[from].includes(to);
}

export function isOpenStage(stage: Stage): stage is OpenStage {
  return (OPEN_STAGES as readonly string[]).includes(stage);
}

/** Value used for the pipeline: the current quote once one exists, else the midpoint of the estimate. */
export function pipelineValue(opts: {
  valueLow?: number | null;
  valueHigh?: number | null;
  currentQuoteTotal?: number | null;
}): number {
  if (opts.currentQuoteTotal != null) return opts.currentQuoteTotal;
  const lo = opts.valueLow ?? opts.valueHigh ?? 0;
  const hi = opts.valueHigh ?? opts.valueLow ?? 0;
  return Math.round((lo + hi) / 2);
}

export function weightedValue(
  stage: Stage,
  value: number,
  probabilities: Record<OpenStage, number> = DEFAULT_STAGE_PROBABILITY,
): number {
  return isOpenStage(stage) ? Math.round(value * probabilities[stage]) : 0;
}
