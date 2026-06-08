"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Kind, Report } from "@/data/reports";

const SLICES = [
  { key: "treasuries", label: "Short-term U.S. Treasuries", color: "#1f6feb" },
  { key: "repos", label: "U.S. Treasury Repurchase Agreements", color: "#3fb950" },
  { key: "cashInFund", label: "Cash in Circle Reserve Fund", color: "#d29922" },
  { key: "cashAtBanks", label: "Cash at Regulated FIs", color: "#bc8cff" },
] as const;

type Mode = "absolute" | "percent";

type Props = {
  kind: Kind;
  reports: Report[];
};

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const fullDate = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const abbreviate = (n: number, symbol: string) => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${symbol}${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${symbol}${(n / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${symbol}${(n / 1e3).toFixed(0)}K`;
  return `${symbol}${n.toFixed(0)}`;
};

export function CompositionTimeseries({ kind, reports }: Props) {
  const [mode, setMode] = useState<Mode>("absolute");

  const symbol = kind === "eurc" ? "€" : "$";
  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: kind === "eurc" ? "EUR" : "USD",
        maximumFractionDigits: 0,
      }),
    [kind],
  );

  const points = useMemo(() => {
    const rows: Array<{
      date: string;
      treasuries: number;
      repos: number;
      cashInFund: number;
      cashAtBanks: number;
      total: number;
    }> = [];
    for (const r of reports) {
      for (const s of r.series) {
        if (!s.composition) continue;
        const c = s.composition;
        const total = c.treasuries + c.repos + c.cashInFund + c.cashAtBanks;
        if (total <= 0) continue;
        rows.push({
          date: s.date,
          treasuries: c.treasuries,
          repos: c.repos,
          cashInFund: c.cashInFund,
          cashAtBanks: c.cashAtBanks,
          total,
        });
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  }, [reports]);

  if (points.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-500">
          No composition data available for {kind.toUpperCase()}.
        </p>
      </section>
    );
  }

  const firstDate = points[0].date;
  const lastDate = points[points.length - 1].date;
  const isPercent = mode === "percent";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
            Reserve composition over time
          </h2>
          <p className="text-sm text-zinc-500">
            {points.length} attestation dates · {fullDate.format(new Date(`${firstDate}T00:00:00Z`))} → {fullDate.format(new Date(`${lastDate}T00:00:00Z`))}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Scale"
          className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1"
        >
          {(["absolute", "percent"] as const).map((m) => {
            const active = m === mode;
            return (
              <button
                key={m}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setMode(m)}
                className={`min-w-[88px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {m === "absolute" ? "Absolute" : "% of total"}
              </button>
            );
          })}
        </div>
      </header>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 10, right: 16, left: 8, bottom: 0 }}
            stackOffset={isPercent ? "expand" : "none"}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.2)" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => shortDate.format(new Date(`${d}T00:00:00Z`))}
              tick={{ fontSize: 11, fill: "currentColor" }}
              stroke="rgba(127,127,127,0.4)"
              minTickGap={32}
            />
            <YAxis
              tickFormatter={(v: number) =>
                isPercent ? `${Math.round(v * 100)}%` : abbreviate(v, symbol)
              }
              tick={{ fontSize: 11, fill: "currentColor" }}
              stroke="rgba(127,127,127,0.4)"
              width={56}
              domain={isPercent ? [0, 1] : ["auto", "auto"]}
            />
            <Tooltip
              labelFormatter={(d) =>
                fullDate.format(new Date(`${String(d)}T00:00:00Z`))
              }
              formatter={(value, name, item) => {
                const n = Number(value);
                const total = Number(item?.payload?.total ?? 0);
                const pct = total > 0 ? ((n / total) * 100).toFixed(1) : "0.0";
                return [`${money.format(n)} (${pct}%)`, String(name)];
              }}
              contentStyle={{
                background: "rgba(24,24,27,0.95)",
                border: "none",
                borderRadius: 8,
                color: "#fafafa",
                fontSize: 12,
              }}
              itemStyle={{ color: "#fafafa" }}
              labelStyle={{ color: "#a1a1aa" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              iconType="square"
            />
            {SLICES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stackId="1"
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.85}
                strokeWidth={0}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
