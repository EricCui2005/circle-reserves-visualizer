"use client";

import { useEffect, useState } from "react";
import { ReservePanel } from "@/components/ReservePanel";
import type { Kind, Report } from "@/data/reports";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const reportLabel = (r: Report) => `${MONTHS[r.month - 1]} ${r.year}`;
const keyOf = (r: Report) => `${r.year}-${r.month}`;

type Props = {
  kind: Kind;
  reports: Report[];
};

export function ReportPicker({ kind, reports }: Props) {
  const [reportKey, setReportKey] = useState<string>(() =>
    reports[0] ? keyOf(reports[0]) : "",
  );

  useEffect(() => {
    if (!reports.some((r) => keyOf(r) === reportKey)) {
      setReportKey(reports[0] ? keyOf(reports[0]) : "");
    }
  }, [reports, reportKey]);

  const selected =
    reports.find((r) => keyOf(r) === reportKey) ?? reports[0];

  const seriesWithComp = selected
    ? selected.series.filter((s) => s.composition !== null)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none dark:ring-1 dark:ring-white/5">
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
            <option key={keyOf(r)} value={keyOf(r)}>
              {reportLabel(r)}
            </option>
          ))}
        </select>
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
