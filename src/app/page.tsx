import { ReportExplorer } from "@/components/ReportExplorer";
import { usdcReports, eurcReports } from "@/data/reports";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 font-sans dark:bg-black">
      <main className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Circle Reserve Composition
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            USDC & EURC reserve attestations
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Pick any monthly examination report to see the breakdown of reserve
            assets backing the token on each attestation date.
          </p>
        </header>

        <ReportExplorer
          usdcReports={usdcReports}
          eurcReports={eurcReports}
        />
      </main>
    </div>
  );
}
