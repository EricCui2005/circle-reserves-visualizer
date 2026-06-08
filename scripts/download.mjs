// Download every PDF in /tmp/pdf_urls.txt into public/pdfs/{usdc,eurc}/<key>.pdf
// where <key> = YYYY-MM, derived from the filename.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const MONTHS = {
  january: "01", jan: "01",
  february: "02", feb: "02",
  march: "03", mar: "03",
  april: "04", apr: "04",
  may: "05",
  june: "06", jun: "06",
  july: "07", jul: "07",
  august: "08", aug: "08",
  september: "09", sept: "09", sep: "09",
  october: "10", oct: "10",
  november: "11", nov: "11",
  december: "12", dec: "12",
};

function parseUrl(url) {
  const decoded = decodeURIComponent(url);
  const file = decoded.split("/").pop().replace(/\.pdf$/i, "");
  const lower = file.toLowerCase();

  // kind
  let kind;
  if (/usdc/.test(lower)) kind = "usdc";
  else if (/eurc|euroc/.test(lower)) kind = "eurc";
  else throw new Error(`unknown kind: ${file}`);

  // year (use first 4-digit year that appears 2018-2030)
  const yearMatch = file.match(/\b(20[12]\d)\b/);
  if (!yearMatch) throw new Error(`no year: ${file}`);
  const year = yearMatch[1];

  // month: longest match of any month name
  let month = null;
  for (const [name, num] of Object.entries(MONTHS)) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    if (re.test(file) && (!month || name.length > month.name.length)) {
      month = { name, num };
    }
  }
  if (!month) throw new Error(`no month: ${file}`);

  return { kind, year, month: month.num, key: `${year}-${month.num}`, originalFile: file };
}

const urls = readFileSync("/tmp/pdf_urls.txt", "utf8")
  .split("\n")
  .map(s => s.trim())
  .filter(Boolean);

const manifest = [];
const seen = new Map(); // key -> url (detect duplicates within kind)

for (const url of urls) {
  try {
    const meta = parseUrl(url);
    const k = `${meta.kind}|${meta.key}`;
    if (seen.has(k)) {
      console.warn(`DUPLICATE ${k}: ${url}  (already: ${seen.get(k)})`);
      continue;
    }
    seen.set(k, url);
    manifest.push({ ...meta, url });
  } catch (e) {
    console.error(`SKIP ${url}: ${e.message}`);
  }
}

manifest.sort((a, b) =>
  a.kind === b.kind ? a.key.localeCompare(b.key) : a.kind.localeCompare(b.kind)
);

mkdirSync("public/pdfs/usdc", { recursive: true });
mkdirSync("public/pdfs/eurc", { recursive: true });

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const m of manifest) {
  const out = resolve("public/pdfs", m.kind, `${m.key}.pdf`);
  if (existsSync(out)) {
    skipped++;
    continue;
  }
  const r = spawnSync("curl", ["-fsSL", "-o", out, m.url], { stdio: "inherit" });
  if (r.status === 0) {
    downloaded++;
    process.stdout.write(".");
  } else {
    failed++;
    console.error(`\nFAIL ${m.kind} ${m.key} ${m.url}`);
  }
}

writeFileSync(
  "public/pdfs/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);

console.log(
  `\nManifest: ${manifest.length} reports. Downloaded ${downloaded}, cached ${skipped}, failed ${failed}.`,
);
