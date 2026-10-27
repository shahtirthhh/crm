import "server-only";

import { db } from "@/lib/db/collections";
import { addDays, today as todayFn } from "@/lib/domain/dates";
import { FOLLOW_UP_RULES } from "@/lib/domain/constants";
import { formatMoney } from "@/lib/domain/money";
import { logActivity } from "./activity";
import { opportunitySubject } from "./opportunities";
import { projectSubject } from "./projects";
import { insertTask } from "./tasks";

const SYSTEM = { id: "system", name: "System" };

/**
 * Daily, idempotent sweep run by Vercel Cron:
 * 1. quotes past the first follow-up move to the Follow-up stage;
 * 2. stage payments due within 7 days get a "raise" task for accounts;
 * 3. overdue stage payments get a chase task for accounts.
 */
export async function runDailySweep(now = new Date()) {
  const today = todayFn(now);
  const firstFollowUp = FOLLOW_UP_RULES[0].offsetDays;

  const toFollowUp = await db
    .opportunities()
    .find({ stage: "quote_sent", quoteSentOn: { $lte: addDays(today, -firstFollowUp) } }, { projection: { ref: 1, clientName: 1, clientId: 1 } })
    .toArray();
  for (const o of toFollowUp) {
    const res = await db
      .opportunities()
      .updateOne({ _id: o._id, stage: "quote_sent" }, { $set: { stage: "follow_up", stageChangedAt: now, updatedAt: now } });
    if (res.modifiedCount) {
      await logActivity(SYSTEM, opportunitySubject(o), "opportunity.stage", "Moved to Follow-up: day 4 reached", { clientId: o.clientId });
    }
  }

  const accounts = await db.users().find({ role: "accounts", active: { $ne: false } }).limit(1).toArray();
  const md = await db.users().find({ role: "md", active: { $ne: false } }).limit(1).toArray();
  const owner = accounts[0] ?? md[0];

  let raise = 0;
  let chase = 0;
  if (owner) {
    const ownerId = owner._id.toHexString();
    const projects = await db.projects().find({ status: { $in: ["live", "complete"] }, "milestones.status": { $ne: "paid" } }).toArray();
    for (const p of projects) {
      for (const m of p.milestones) {
        if (!m.dueOn || m.status === "paid") continue;
        if (m.status === "scheduled" && m.dueOn <= addDays(today, 7)) {
          await insertTask(
            {
              title: `Raise ${m.label} · ${formatMoney(m.amountPence)}`,
              kind: "doc",
              subject: projectSubject(p),
              ownerId,
              ownerName: owner.name,
              dueOn: m.dueOn,
              ruleKey: `billing.raise:${m._id}`,
            },
            SYSTEM.id,
          );
          raise++;
        }
        if (m.dueOn < today) {
          await insertTask(
            {
              title: `Chase ${m.label} · ${formatMoney(m.amountPence)} overdue`,
              kind: "chase",
              subject: projectSubject(p),
              ownerId,
              ownerName: owner.name,
              dueOn: today,
              ruleKey: `billing.chase:${m._id}`,
            },
            SYSTEM.id,
          );
          chase++;
        }
      }
    }
  }

  return { movedToFollowUp: toFollowUp.length, raiseTasks: raise, chaseTasks: chase };
}
