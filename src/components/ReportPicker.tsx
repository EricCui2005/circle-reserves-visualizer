"use client";

import { useMemo, useState } from "react";
import { ReservePanel } from "@/components/ReservePanel";
import type { Kind, Report } from "@/data/reports";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const reportLabel = (r: Report) => `${MONTHS[r.month - 1]} ${r.year}`;

const hasComposition = (r: Report) =>
  r.series.some((s) => s.composition !== null);

type Props = {
  usdcReports: Report[];
  eurcReports: Report[];
};

export function ReportPicker({ usdcReports, eurcReports }: Props) {
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
  const [reportKey, setReportKey] = useState<string>(() =>
    reports[0] ? `${reports[0].year}-${reports[0].month}` : "",
  );

  const handleKindChange = (next: Kind) => {
    setKind(next);
    const first = sources[next][0];
    setReportKey(first ? `${first.year}-${first.month}` : "");
  };

  const selected =
    reports.find((r) => `${r.year}-${r.month}` === reportKey) ?? reports[0];

  const seriesWithComp = selected
    ? selected.series.filter((s) => s.composition !== null)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-end sm:gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Token
          </span>
          <div
            role="tablist"
            aria-label="Token"
            className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {(["usdc", "eurc"] as const).map((k) => {
              const active = k === kind;
              return (
                <button
                  key={k}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => handleKindChange(k)}
                  className={`min-w-[72px] rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {k.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="report-select"
            className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400"
          >
            Report
          </label>
          <select
            id="report-select"
            value={reportKey}
            onChange={(e) => setReportKey(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
          >
            {reports.map((r) => (
              <option key={`${r.year}-${r.month}`} value={`${r.year}-${r.month}`}>
                {reportLabel(r)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected ? (
        <>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Source:{" "}
            <a
              href={selected.localPdf}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {selected.format === "deloitte" ? "Deloitte" : "Grant Thornton"} examination report (PDF)
            </a>
            {" · "}
            <a
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              original on circle.com
            </a>
            {selected.overrideNote ? (
              <span className="ml-2 italic">· {selected.overrideNote}</span>
            ) : null}
          </p>

          <div
            className={`grid grid-cols-1 gap-6 ${
              seriesWithComp.length > 1 ? "lg:grid-cols-2" : ""
            }`}
          >
            {seriesWithComp.map((s) => (
              <ReservePanel
                key={s.date}
                kind={selected.kind}
                date={s.date}
                circulation={s.circulation}
                reserveTotal={s.reserveTotal}
                composition={s.composition!}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No reports with detailed composition for {kind.toUpperCase()}.
        </p>
      )}
    </div>
  );
}
