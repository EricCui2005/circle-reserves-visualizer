"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CompositionTimeseries } from "@/components/CompositionTimeseries";
import { ReportPicker } from "@/components/ReportPicker";
import type { Kind, Report } from "@/data/reports";

const TOKEN_META: Record<Kind, { label: string; logo: string; isSvg: boolean }> = {
  usdc: { label: "USDC", logo: "/logos/usdc.svg", isSvg: true },
  eurc: { label: "EURC", logo: "/logos/eurc.png", isSvg: false },
};

const hasComposition = (r: Report) =>
  r.series.some((s) => s.composition !== null);

type Props = {
  usdcReports: Report[];
  eurcReports: Report[];
};

export function ReportExplorer({ usdcReports, eurcReports }: Props) {
  const sources: Record<Kind, Report[]> = useMemo(
    () => ({
      usdc: [...usdcReports]
        .filter(hasComposition)
        .sort((a, b) => b.year - a.year || b.month - a.month),
      eurc: [...eurcReports]
        .filter(hasComposition)
        .sort((a, b) => b.year - a.year || b.month - a.month),
    }),
    [usdcReports, eurcReports],
  );

  const [kind, setKind] = useState<Kind>("usdc");
  const reports = sources[kind];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Token
        </span>
        <div
          role="tablist"
          aria-label="Token"
          className="inline-flex w-fit rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800"
        >
          {(["usdc", "eurc"] as const).map((k) => {
            const active = k === kind;
            const meta = TOKEN_META[k];
            return (
              <button
                key={k}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setKind(k)}
                className={`inline-flex min-w-[88px] items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                <Image
                  src={meta.logo}
                  alt=""
                  width={18}
                  height={18}
                  className={`h-[18px] w-[18px] ${
                    active ? "" : "opacity-70"
                  }`}
                  unoptimized={meta.isSvg}
                />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <CompositionTimeseries kind={kind} reports={reports} />

      <ReportPicker kind={kind} reports={reports} />
    </div>
  );
}
