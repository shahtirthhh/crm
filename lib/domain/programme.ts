import { addDays, addMonths, addWorkingDays } from "./dates";

export const PROGRAMME_KEYS = [
  "client_po",
  "manufacturer_po",
  "drawings",
  "drawings_signoff",
  "manufacture",
  "release",
  "labour_rams",
  "collection",
  "install",
  "handover",
  "service_3m",
  "service_9m",
] as const;
export type ProgrammeKey = (typeof PROGRAMME_KEYS)[number];

export interface ProgrammeItem {
  key: ProgrammeKey;
  label: string;
  start: Date;
  end: Date;
  milestone: boolean;
  done: boolean;
  completedOn?: Date | null;
}

export const PROGRAMME_LABELS: Record<ProgrammeKey, string> = {
  client_po: "Client PO and 60% deposit",
  manufacturer_po: "Manufacturer PO",
  drawings: "Drawings issued and rebadged",
  drawings_signoff: "Site sign-off of drawings",
  manufacture: "Manufacture",
  release: "Manufacturer release",
  labour_rams: "Labour and RAMS confirmed",
  collection: "Collection, customs, storage",
  install: "Installation",
  handover: "Handover",
  service_3m: "3-month warranty service",
  service_9m: "9-month warranty service",
};

/** Stage tracker shown on work in progress, mapped to the programme items that complete it. */
export const TRACKER_STAGES = [
  { key: "po", label: "PO", items: ["client_po", "manufacturer_po"] },
  { key: "drawings", label: "Drawings", items: ["drawings", "drawings_signoff"] },
  { key: "manufacture", label: "Manufacture", items: ["manufacture", "release"] },
  { key: "delivery", label: "Delivery", items: ["labour_rams", "collection"] },
  { key: "install", label: "Install", items: ["install"] },
  { key: "handover", label: "Handover", items: ["handover"] },
] as const satisfies readonly { key: string; label: string; items: readonly ProgrammeKey[] }[];

export interface ProgrammeInputs {
  clientPoOn: Date;
  leadTimeWeeks: number;
  installDays: number;
}

/**
 * Builds a programme from the client PO date. This replaces the 3–4 hours a programme
 * takes to build by hand; the PM then adjusts individual dates.
 */
export function buildProgramme({ clientPoOn, leadTimeWeeks, installDays }: ProgrammeInputs): ProgrammeItem[] {
  const po = clientPoOn;
  const mfrPoEnd = addWorkingDays(po, 3);
  const drawingsEnd = addWorkingDays(mfrPoEnd, 7);
  const signoffEnd = addWorkingDays(drawingsEnd, 3);
  const manufactureEnd = addDays(signoffEnd, leadTimeWeeks * 7);
  const collectionEnd = addWorkingDays(manufactureEnd, 5);
  const installStart = addWorkingDays(collectionEnd, 1);
  const installEnd = addWorkingDays(installStart, Math.max(installDays - 1, 0));
  const handover = installEnd;

  const item = (key: ProgrammeKey, start: Date, end: Date, milestone = false): ProgrammeItem => ({
    key,
    label: PROGRAMME_LABELS[key],
    start,
    end,
    milestone,
    done: false,
    completedOn: null,
  });

  return [
    item("client_po", po, po, true),
    item("manufacturer_po", po, mfrPoEnd),
    item("drawings", mfrPoEnd, drawingsEnd),
    item("drawings_signoff", drawingsEnd, signoffEnd),
    item("manufacture", signoffEnd, manufactureEnd),
    item("release", manufactureEnd, manufactureEnd, true),
    item("labour_rams", addDays(manufactureEnd, -14), manufactureEnd),
    item("collection", manufactureEnd, collectionEnd),
    item("install", installStart, installEnd),
    item("handover", handover, handover, true),
    item("service_3m", addMonths(handover, 3), addMonths(handover, 3), true),
    item("service_9m", addMonths(handover, 9), addMonths(handover, 9), true),
  ];
}

/**
 * Moves one item and, when `cascade` is set, every item that starts on or after its old start
 * by the same number of days. Completed items are never moved.
 */
export function rescheduleItem(
  items: ProgrammeItem[],
  key: ProgrammeKey,
  start: Date,
  end: Date,
  cascade: boolean,
): ProgrammeItem[] {
  const target = items.find((i) => i.key === key);
  if (!target) throw new Error(`Unknown programme item ${key}`);
  if (end.getTime() < start.getTime()) throw new Error("End date is before start date");
  const delta = end.getTime() - target.end.getTime();
  const oldStart = target.start.getTime();

  return items.map((i) => {
    if (i.key === key) return { ...i, start, end };
    if (cascade && !i.done && delta !== 0 && i.start.getTime() >= oldStart) {
      return { ...i, start: new Date(i.start.getTime() + delta), end: new Date(i.end.getTime() + delta) };
    }
    return i;
  });
}

export function programmeDate(items: ProgrammeItem[], key: ProgrammeKey): Date | undefined {
  return items.find((i) => i.key === key)?.end;
}

export function currentTrackerStage(items: ProgrammeItem[]): number {
  const done = new Set(items.filter((i) => i.done).map((i) => i.key));
  const idx = TRACKER_STAGES.findIndex((s) => !s.items.every((k) => done.has(k)));
  return idx === -1 ? TRACKER_STAGES.length : idx;
}

export function nextOpenItem(items: ProgrammeItem[]): ProgrammeItem | undefined {
  return items
    .filter((i) => !i.done && !i.key.startsWith("service_"))
    .sort((a, b) => a.end.getTime() - b.end.getTime())[0];
}
