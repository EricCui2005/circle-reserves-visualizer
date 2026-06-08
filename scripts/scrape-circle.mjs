// Fetch https://www.circle.com/transparency and extract every attestation PDF
// URL. Writes one URL per line to /tmp/pdf_urls.txt for download.mjs to consume.
// Exits non-zero on any anomaly so the daily workflow surfaces breakage loudly.
import { writeFileSync } from "node:fs";

const PAGE = "https://www.circle.com/transparency";
const PDF_HOST = "6778953.fs1.hubspotusercontent-na1.net";
const MIN_PDFS = 50; // 138 today; below this means the page or our regex broke.

const UA =
  "Mozilla/5.0 (compatible; CircleReservesBot/1.0; +https://github.com/EricCui2005/circle-reserves-visualizer)";

const res = await fetch(PAGE, {
  headers: { "User-Agent": UA, Accept: "text/html" },
  redirect: "follow",
});

if (!res.ok) {
  console.error(`HTTP ${res.status} ${res.statusText} from ${PAGE}`);
  process.exit(1);
}

const html = await res.text();
const re = new RegExp(
  `href="(https://${PDF_HOST.replace(/\./g, "\\.")}/[^"]+\\.pdf)"`,
  "gi",
);
const urls = [...new Set([...html.matchAll(re)].map((m) => m[1]))];

if (urls.length < MIN_PDFS) {
  console.error(
    `Only found ${urls.length} PDF URLs (expected at least ${MIN_PDFS}). ` +
      `Circle's transparency page structure may have changed — bailing out so ` +
      `we don't overwrite the manifest with a partial set.`,
  );
  process.exit(1);
}

writeFileSync("/tmp/pdf_urls.txt", urls.join("\n") + "\n");
console.log(`Found ${urls.length} attestation PDF URLs.`);
