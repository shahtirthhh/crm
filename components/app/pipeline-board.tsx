"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { changeStageAction } from "@/lib/actions/opportunities";
import { SOURCE_LABELS, STAGE_LABELS, type Source, type Stage } from "@/lib/domain/constants";
import { diffDays, formatDay } from "@/lib/domain/dates";
import { formatMoney, formatMoneyShort } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

export interface BoardCard {
  _id: string;
  ref: string;
  clientName: string;
  productName: string;
  quantity: number;
  siteName?: string;
  valuePence: number;
  source: Source;
  stage: Stage;
  ownerName: string;
  createdAt: Date;
  quoteSentOn?: Date;
  needsTriage?: boolean;
  nextTask: { title: string; dueOn: Date } | null;
}

const COLUMNS: Stage[] = ["enquiry", "survey_booked", "quote_sent", "follow_up", "won"];
const DROPPABLE: Stage[] = ["enquiry", "survey_booked", "quote_sent", "follow_up"];

function badgeFor(card: BoardCard, today: Date): { text: string; tone: "brand" | "warn" | "muted" } | null {
  if (card.needsTriage) return { text: "New", tone: "brand" };
  if (card.nextTask) {
    const d = diffDays(card.nextTask.dueOn, today);
    if (d < 0) return { text: `${-d}d overdue`, tone: "brand" };
    if (d === 0) return { text: card.nextTask.title.toLowerCase().includes("call") ? "Call today" : "Due today", tone: "brand" };
    if (d <= 2) return { text: formatDay(card.nextTask.dueOn), tone: "warn" };
  }
  if (card.quoteSentOn && (card.stage === "quote_sent" || card.stage === "follow_up")) {
    return { text: `Day ${diffDays(today, card.quoteSentOn)}`, tone: "muted" };
  }
  return null;
}

function Card({ card, today }: { card: BoardCard; today: Date }) {
  const badge = badgeFor(card, today);
  const age = diffDays(today, card.createdAt);
  return (
    <Link
      href={`/opportunities/${card.ref}`}
      draggable={card.stage !== "won"}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ ref: card.ref, stage: card.stage }));
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "bg-card block rounded-lg border p-3 text-sm shadow-xs transition-shadow hover:shadow-md",
        badge?.tone === "brand" && "border-brand/60",
      )}
    >
      <div className="truncate font-medium">{card.clientName}</div>
      <div className="text-muted-foreground truncate text-xs">
        {card.productName}
        {card.quantity > 1 ? ` ×${card.quantity}` : ""}
        {card.siteName ? ` · ${card.siteName}` : ""}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-medium tabular-nums">{card.valuePence ? formatMoney(card.valuePence) : "—"}</span>
        {badge && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
              badge.tone === "brand" && "bg-brand/10 text-brand",
              badge.tone === "warn" && "bg-warning/20 text-amber-700",
              badge.tone === "muted" && "bg-muted text-muted-foreground",
            )}
          >
            {badge.text}
          </span>
        )}
      </div>
      <div className="text-muted-foreground mt-1 flex justify-between text-[11px]">
        <span>{SOURCE_LABELS[card.source]}</span>
        <span>{age === 0 ? "today" : `${age}d`}</span>
      </div>
    </Link>
  );
}

/** Kanban of open opportunities. Dragging a card between open stages calls changeStageAction. */
export function PipelineBoard({ cards, today }: { cards: BoardCard[]; today: Date }) {
  const [optimistic, move] = useOptimistic(cards, (state, { ref, stage }: { ref: string; stage: Stage }) =>
    state.map((c) => (c.ref === ref ? { ...c, stage } : c)),
  );
  const [over, setOver] = useState<Stage | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[1100px] grid-cols-5 gap-3">
        {COLUMNS.map((stage) => {
          const items = optimistic.filter((c) => c.stage === stage);
          const total = items.reduce((s, c) => s + c.valuePence, 0);
          const droppable = DROPPABLE.includes(stage);
          return (
            <section
              key={stage}
              onDragOver={(e) => {
                if (!droppable) return;
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                setOver(null);
                if (!droppable) return;
                const data = JSON.parse(e.dataTransfer.getData("text/plain") || "{}") as { ref?: string; stage?: Stage };
                if (!data.ref || data.stage === stage) return;
                startTransition(async () => {
                  move({ ref: data.ref!, stage });
                  const res = await changeStageAction(data.ref!, stage);
                  if (res.error) toast.error(res.error);
                  else toast.success(`${data.ref} moved to ${STAGE_LABELS[stage]}`);
                });
              }}
              className={cn("bg-muted/60 flex min-h-64 flex-col gap-2 rounded-xl p-2", over === stage && "ring-brand/50 ring-2")}
            >
              <header
                className={cn(
                  "flex items-baseline justify-between border-b-2 px-1 pb-1.5",
                  stage === "follow_up" ? "border-brand" : stage === "won" ? "border-success" : "border-foreground/15",
                )}
              >
                <span className="text-xs font-semibold tracking-wide uppercase">
                  {stage === "follow_up" ? "Follow-up due" : stage === "won" ? "Won (30 days)" : STAGE_LABELS[stage]}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {items.length} · {formatMoneyShort(total)}
                </span>
              </header>
              {items.map((c) => (
                <Card key={c._id} card={c} today={today} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
