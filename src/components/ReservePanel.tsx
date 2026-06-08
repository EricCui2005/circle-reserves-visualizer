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

// Mix a hex color toward white (positive pct) or toward black (negative pct).
function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) =>
    pct >= 0
      ? Math.round(c + (255 - c) * (pct / 100))
      : Math.round(c * (1 + pct / 100));
  const out =
    (Math.min(255, Math.max(0, mix(r))) << 16) |
    (Math.min(255, Math.max(0, mix(g))) << 8) |
    Math.min(255, Math.max(0, mix(b)));
  return `#${out.toString(16).padStart(6, "0")}`;
}

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
  const uid = `${kind}-${date}`;
  const shadowId = `pie-shadow-${uid}`;

  return (
    <section className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none dark:ring-1 dark:ring-white/5">
      <header className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {longDate.format(new Date(`${date}T00:00:00Z`))}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Total reserve assets {money.format(reserveTotal)}
        </p>
      </header>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {slices.map((s) => {
                const id = `grad-${uid}-${s.key}`;
                return (
                  <radialGradient
                    key={id}
                    id={id}
                    cx="50%"
                    cy="50%"
                    r="65%"
                    fx="50%"
                    fy="35%"
                  >
                    <stop offset="0%" stopColor={shade(s.color, 22)} />
                    <stop offset="100%" stopColor={shade(s.color, -8)} />
                  </radialGradient>
                );
              })}
              <filter
                id={shadowId}
                x="-25%"
                y="-25%"
                width="150%"
                height="150%"
              >
                <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
                <feOffset dx="0" dy="4" result="off" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.25" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
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
              filter={`url(#${shadowId})`}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell
                  key={s.key}
                  fill={`url(#grad-${uid}-${s.key})`}
                />
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
            <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
            <span className="font-mono text-zinc-500 dark:text-zinc-400">
              {pct(s.value, sliceTotal)} · {money.format(s.value)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">
            {tokenLabel} in circulation
          </dt>
          <dd className="font-mono text-zinc-900 dark:text-zinc-50">
            {money.format(circulation)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Excess collateral</dt>
          <dd
            className={`font-mono ${
              excess >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {money.format(excess)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
