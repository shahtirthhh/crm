import { TRACKER_STAGES } from "@/lib/domain/programme";
import { cn } from "@/lib/utils";

/** PO → Drawings → Manufacture → Delivery → Install → Handover, current stage in red. */
export function StageTracker({ current, compact }: { current: number; compact?: boolean }) {
  return (
    <ol className="flex items-center" aria-label={`Stage ${Math.min(current + 1, TRACKER_STAGES.length)} of ${TRACKER_STAGES.length}`}>
      {TRACKER_STAGES.map((s, i) => (
        <li key={s.key} className="flex items-center">
          <span className="flex flex-col items-center gap-1">
            <span
              title={s.label}
              className={cn(
                "block rounded-full border-2",
                compact ? "size-3" : "size-4",
                i < current && "bg-foreground border-foreground",
                i === current && "bg-brand border-brand",
                i > current && "bg-background border-foreground/30",
              )}
            />
            {!compact && <span className={cn("text-[10px] uppercase", i === current ? "text-brand font-semibold" : "text-muted-foreground")}>{s.label}</span>}
          </span>
          {i < TRACKER_STAGES.length - 1 && (
            <span className={cn("h-0.5", compact ? "w-4" : "mb-4 w-8 sm:w-12", i < current ? "bg-foreground" : "bg-foreground/20")} />
          )}
        </li>
      ))}
    </ol>
  );
}
