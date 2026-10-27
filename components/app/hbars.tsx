import { formatMoney } from "@/lib/domain/money";

/** Single-series horizontal bars with labels and values in text ink. */
export function HBars({
  rows,
  highlight,
}: {
  rows: { key: string; label: string; value: number; sub?: string; note?: string }[];
  highlight?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm" title={`${r.label}: ${formatMoney(r.value)}`}>
          <div className="min-w-0">
            <div className="truncate">{r.label}</div>
            {r.sub && <div className="text-muted-foreground text-xs">{r.sub}</div>}
          </div>
          <div className="bg-muted h-3 rounded">
            <div
              className={r.key === highlight ? "bg-brand h-3 rounded" : "bg-foreground/85 h-3 rounded"}
              style={{ width: `${Math.max(r.value ? 2 : 0, (r.value / max) * 100)}%` }}
            />
          </div>
          <div className="text-right tabular-nums">
            <div>{formatMoney(r.value)}</div>
            {r.note && <div className="text-muted-foreground text-xs">{r.note}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}
