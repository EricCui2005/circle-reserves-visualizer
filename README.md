# Circle Reserve Visualizer

**Live site:** https://circle-reserves-visualizer.vercel.app/

Interactive visualization of every published USDC and EURC reserve attestation
from Circle's transparency page. Parses the third-party examination PDFs
(Grant Thornton 2018–2022, Deloitte 2023–present) into a typed dataset and
renders:

- a stacked area chart of reserve composition over time, and
- a per-report pie breakdown with a date selector.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS
- recharts
- `pdftotext` (poppler-utils) for PDF extraction

## Run locally

```bash
npm install
npm run dev
```

The app is fully static; `npm run build` produces a deploy that needs no
runtime data fetching.

## Dataset

- `public/pdfs/{usdc,eurc}/<YYYY-MM>.pdf` — source PDFs (also served at
  `/pdfs/...` so each report links to its own examination report).
- `data/reports/<kind>-<YYYY-MM>.json` — one parsed report per PDF.
- `src/data/reports/index.ts` — auto-generated typed index that
  statically imports every JSON.

Each report contains one or two attestation dates with circulation, total
reserve assets, and (for the Deloitte era) composition broken into
short-term Treasuries, repos, cash in the Circle Reserve Fund, and cash at
regulated FIs.

### Refreshing the dataset

```bash
node scripts/scrape-circle.mjs # write PDF URLs to /tmp/pdf_urls.txt
node scripts/download.mjs      # download missing PDFs into public/pdfs/
node scripts/parse.mjs         # parse PDFs -> data/reports/*.json
node scripts/build-index.mjs   # regenerate src/data/reports/index.ts
```

One PDF (`usdc/2022-05.pdf`) uses a custom font encoding that `pdftotext`
cannot decode; values are hard-coded as a manual override in `parse.mjs`.

### Daily refresh (GitHub Actions)

`.github/workflows/refresh-reports.yml` runs the four-step pipeline above
every day at 12:00 UTC, commits any new reports to `main` (which triggers
a Vercel rebuild), and emails a status digest to the owner. Three outcomes
are possible: "no new reports", "new report(s) found and committed", or
"refresh failed". Manual runs are available via the Actions tab.

The email step uses Gmail SMTP and requires two repository secrets:

| Secret          | Value                                                  |
| --------------- | ------------------------------------------------------ |
| `SMTP_USERNAME` | The Gmail address that sends the digest                |
| `SMTP_PASSWORD` | A [Google App Password](https://myaccount.google.com/apppasswords) for that account |

## Trademarks

"Circle", the Circle logo, "USDC", and "EURC" are trademarks of Circle
Internet Financial, LLC. This project is an independent, non-commercial
visualization of publicly available examination reports and is not
affiliated with or endorsed by Circle. Logos shipped under `public/logos/`
are used for identification purposes only.

## Deploy

Deployed on Vercel at https://circle-reserves-visualizer.vercel.app/. The
PDFs live under `public/` and ship as CDN static assets, so source links
keep working even if Circle reorganizes their site. Auto-rebuilds on every
push to `main`, including the daily commits from the refresh workflow.
