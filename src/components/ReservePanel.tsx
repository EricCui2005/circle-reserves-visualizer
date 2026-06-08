"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { Composition, Kind } from "@/data/reports";

export type SliceKey =
  | "treasuries"
  | "repos"
  | "cashInFund"
  | "cashAtBanks";

const sliceMeta: Record<
  SliceKey,
  { label: (kind: Kind) => string; color: string }
> = {
  treasuries: {
    label: () => "Short-term U.S. Treasuries",
    color: "#1f6feb",
  },
  repos: {
    label: () => "U.S. Treasury Repurchase Agreements",
    color: "#3fb950",
  },
  cashInFund: {
    label: () => "Cash in Circle Reserve Fund",
    color: "#d29922",
  },
  cashAtBanks: {
    label: (kind) =>
      kind === "eurc"
        ? "Cash at Euro-area Regulated FIs"
        : "Cash at U.S. Regulated FIs",
    color: "#bc8cff",
  },
};

const sliceOrder: SliceKey[] = [
  "treasuries",
  "repos",
  "cashInFund",
  "cashAtBanks",
];

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const eur = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const pct = (value: number, total: number) =>
  total > 0 ? `${((value / total) * 100).toFixed(2)}%` : "—";

const longDate = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

type Props = {
  kind: Kind;
  date: string;
  circulation: number;
  reserveTotal: number;
  composition: Composition;
};

export function ReservePanel({
  kind,
  date,
  circulation,
  reserveTotal,
  composition,
}: Props) {
  const money = kind === "eurc" ? eur : usd;
  const slices = sliceOrder
    .map((key) => ({
      key,
      label: sliceMeta[key].label(kind),
      color: sliceMeta[key].color,
      value: composition[key],
    }))
    .filter((s) => s.value > 0);

  const sliceTotal = slices.reduce((sum, s) => sum + s.value, 0);
  const excess = reserveTotal - circulation;
  const tokenLabel = kind === "eurc" ? "EURC" : "USDC";

  return (
    <section className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
          {longDate.format(new Date(`${date}T00:00:00Z`))}
        </h2>
        <p className="text-sm text-zinc-500">
          Total reserve assets {money.format(reserveTotal)}
        </p>
      </header>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={110}
              paddingAngle={0}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => {
                const n = Number(value);
                return [
                  `${money.format(n)} (${pct(n, sliceTotal)})`,
                  String(name),
                ];
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
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-4 space-y-2">
        {slices.map((s) => (
          <li
            key={s.key}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="flex items-center gap-2 text-zinc-700">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
            <span className="font-mono text-zinc-500">
              {pct(s.value, sliceTotal)} · {money.format(s.value)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-4 text-sm">
        <div>
          <dt className="text-zinc-500">
            {tokenLabel} in circulation
          </dt>
          <dd className="font-mono text-zinc-900">
            {money.format(circulation)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Excess collateral</dt>
          <dd
            className={`font-mono ${
              excess >= 0
                ? "text-emerald-600"
                : "text-rose-600"
            }`}
          >
            {money.format(excess)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
