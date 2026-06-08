import Image from "next/image";
import { ReportExplorer } from "@/components/ReportExplorer";
import { usdcReports, eurcReports } from "@/data/reports";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-100 px-6 py-12 font-sans">
      <main className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logos/circle.svg"
              alt="Circle"
              width={120}
              height={30}
              priority
              unoptimized
              className="h-7 w-auto"
            />
            <span
              aria-hidden
              className="h-5 w-px bg-zinc-300"
            />
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Reserve Composition
            </p>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            USDC &amp; EURC reserve attestations
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600">
            Pick any monthly examination report to see the breakdown of reserve
            assets backing the token on each attestation date.
          </p>
        </header>

        <ReportExplorer
          usdcReports={usdcReports}
          eurcReports={eurcReports}
        />

        <footer className="mt-6 border-t border-zinc-200 pt-6 text-xs text-zinc-500">
          <p className="max-w-3xl leading-relaxed">
            &ldquo;Circle&rdquo;, the Circle logo, &ldquo;USDC&rdquo;, and
            &ldquo;EURC&rdquo; are trademarks of Circle Internet Financial, LLC.
            This site is an independent, non-commercial visualization built
            from publicly available examination reports and is not affiliated
            with, endorsed by, or sponsored by Circle. All logos are property
            of their respective owners and are used for identification
            purposes only.
          </p>
        </footer>
      </main>
    </div>
  );
}
