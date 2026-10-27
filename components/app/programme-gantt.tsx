import { addDays, diffDays, formatDay, formatDayInput, startOfWeek } from "@/lib/domain/dates";
import type { ProgrammeItem } from "@/lib/domain/programme";
import type { ActionState } from "@/lib/actions/types";
import { cn } from "@/lib/utils";
import { ProgrammeItemControls } from "./project-actions";

/** Weekly Gantt of the programme. Warranty services sit outside the timeline and are listed beneath. */
export function ProgrammeGantt({
  projectRef,
  items,
  today,
  rescheduleAction,
  canEdit,
  dueMarkers,
}: {
  projectRef: string;
  items: ProgrammeItem[];
  today: Date;
  rescheduleAction: (s: ActionState, f: FormData) => Promise<ActionState>;
  canEdit: boolean;
  dueMarkers: { label: string; on: Date; paid: boolean }[];
}) {
  const timeline = items.filter((i) => !i.key.startsWith("service_"));
  const services = items.filter((i) => i.key.startsWith("service_"));
  const start = startOfWeek(timeline.reduce((m, i) => (i.start < m ? i.start : m), timeline[0].start));
  const lastEnd = timeline.reduce((m, i) => (i.end > m ? i.end : m), timeline[0].end);
  const weeks = Math.max(8, Math.ceil((diffDays(lastEnd, start) + 1) / 7));
  const span = weeks * 7;
  const pos = (d: Date) => (diffDays(d, start) / span) * 100;
  const todayPos = pos(today);

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[15rem_1fr] border-b pb-1 text-[10px] text-muted-foreground uppercase">
            <div>Task</div>
            <div className="relative h-4">
              {Array.from({ length: weeks }).map((_, w) => (
                <span key={w} className="absolute" style={{ left: `${(w / weeks) * 100}%` }}>
                  W{w + 1}
                </span>
              ))}
            </div>
          </div>
          {timeline.map((item) => {
            const late = !item.done && item.end < today;
            return (
              <div key={item.key} className="grid grid-cols-[15rem_1fr] items-center border-b py-1.5">
                <div className="flex items-center justify-between gap-2 pr-3">
                  <div className="min-w-0">
                    <div className={cn("truncate text-sm", item.done && "text-muted-foreground line-through")}>{item.label}</div>
                    <div className={cn("text-xs", late ? "text-brand" : "text-muted-foreground")}>
                      {item.milestone ? formatDay(item.end) : `${formatDay(item.start)} – ${formatDay(item.end)}`}
                    </div>
                  </div>
                  <ProgrammeItemControls
                    projectRef={projectRef}
                    itemKey={item.key}
                    label={item.label}
                    done={item.done}
                    start={formatDayInput(item.start)}
                    end={formatDayInput(item.end)}
                    rescheduleAction={rescheduleAction}
                    canEdit={canEdit}
                  />
                </div>
                <div className="relative h-6">
                  {Array.from({ length: weeks }).map((_, w) => (
                    <span key={w} className="bg-border absolute top-0 h-full w-px" style={{ left: `${(w / weeks) * 100}%` }} />
                  ))}
                  {todayPos >= 0 && todayPos <= 100 && <span className="bg-brand absolute top-0 z-10 h-full w-0.5" style={{ left: `${todayPos}%` }} />}
                  {item.milestone ? (
                    <span
                      title={`${item.label}: ${formatDay(item.end)}`}
                      className={cn("absolute top-1 size-4 -translate-x-1/2 rotate-45 border-2", item.done ? "bg-success border-success" : late ? "bg-brand border-brand" : "bg-background border-foreground")}
                      style={{ left: `${pos(item.end) + 100 / span / 2}%` }}
                    />
                  ) : (
                    <span
                      title={`${item.label}: ${formatDay(item.start)} – ${formatDay(item.end)}`}
                      className={cn("absolute top-1 h-4 rounded", item.done ? "bg-foreground/80" : late ? "bg-brand" : item.key === "manufacture" ? "bg-foreground/25" : "bg-foreground/60")}
                      style={{ left: `${pos(item.start)}%`, width: `${Math.max(((diffDays(item.end, item.start) + 1) / span) * 100, 0.8)}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
          {dueMarkers.length > 0 && (
            <div className="grid grid-cols-[15rem_1fr] items-center py-1.5">
              <div className="text-muted-foreground text-xs">Stage payments due</div>
              <div className="relative h-6">
                {dueMarkers.map((m) => (
                  <span
                    key={m.label}
                    title={`${m.label}: ${formatDay(m.on)}`}
                    className={cn("absolute top-0.5 -translate-x-1/2 rounded px-1 text-[10px] whitespace-nowrap", m.paid ? "bg-success/15 text-success" : "bg-brand/10 text-brand")}
                    style={{ left: `${Math.min(97, Math.max(3, pos(m.on)))}%` }}
                  >
                    {m.label.split(" ")[0]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
        {services.map((s) => (
          <span key={s.key}>
            {s.label}: {formatDay(s.end, true)}
            {s.done ? " · done" : ""}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="bg-brand inline-block h-3 w-0.5" /> today ({formatDay(addDays(today, 0))})
        </span>
      </div>
    </div>
  );
}
