"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMoney, formatMoneyShort } from "@/lib/domain/money";

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

export function WonLostChart({ data }: { data: { month: string; won: number; lost: number; wonCount: number; lostCount: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: MONTH.format(new Date(`${d.month}-01T00:00:00Z`)) }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Won and lost value by month">
      <ResponsiveContainer>
        <BarChart data={rows} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
          <YAxis tickFormatter={(v) => formatMoneyShort(v)} tickLine={false} axisLine={false} fontSize={12} width={52} stroke="var(--muted-foreground)" />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
            formatter={(value, name, item) => {
              const count = name === "Won" ? item.payload.wonCount : item.payload.lostCount;
              return [`${formatMoney(Number(value))} (${count})`, name];
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="won" name="Won" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="lost" name="Lost" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
