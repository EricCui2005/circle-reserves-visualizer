// Parse all PDFs in public/pdfs/manifest.json. Emit data/reports/<kind>-<key>.json
// and data/reports/_index.json.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_INDEX = Object.fromEntries(MONTH_NAMES.map((m, i) => [m.toLowerCase(), i + 1]));

const manifest = JSON.parse(readFileSync("public/pdfs/manifest.json", "utf8"));

mkdirSync("data/reports", { recursive: true });

// Manual overrides for PDFs that pdftotext can't decode (custom font encoding).
// Values were read visually from the PDF.
const OVERRIDES = {
  "usdc-2022-05": {
    format: "grant-thornton",
    reportDates: ["2022-05-31"],
    series: [{
      date: "2022-05-31",
      circulation: 54_005_995_420,
      reserveTotal: 54_005_995_420,
      composition: null,
    }],
    note: "Manual override: source PDF uses encoded font that pdftotext cannot decode.",
  },
};

// Replace ligatures and clean text
function clean(text) {
  return text
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/ﬀ/g, "ff")
    .replace(/ﬃ/g, "ffi")
    .replace(/ﬄ/g, "ffl")
    .replace(/‘|’/g, "'")
    .replace(/“|”/g, '"');
}

function pdftotext(path, layout = true) {
  const args = layout ? ["-layout", path, "-"] : [path, "-"];
  const r = spawnSync("pdftotext", args, { encoding: "utf8", maxBuffer: 20 << 20 });
  if (r.status !== 0) throw new Error(`pdftotext failed: ${r.stderr}`);
  return clean(r.stdout);
}

function parseNumber(s) {
  if (s == null) return null;
  const cleaned = String(s).replace(/[,\s$€€]/g, "").replace(/[()]/g, "");
  const neg = /\(/.test(s) || /^-/.test(cleaned);
  const n = Number(cleaned.replace(/^-/, ""));
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

// Parenthesized number capture, e.g. "(7,089,359)" => negative
function parseSignedNumber(s) {
  if (s == null) return null;
  const isNeg = /^\(.*\)$/.test(s.trim());
  const bare = s.replace(/[(),\s$€€]/g, "");
  const n = Number(bare);
  if (!Number.isFinite(n)) return null;
  return isNeg ? -n : n;
}

function findReportDates(text) {
  // Try: "as of Month D, YYYY, and Month D, YYYY" (Deloitte two-date)
  const dual = text.match(
    /as of\s+([A-Z][a-z]+)\s+(\d{1,2}),?\s*(\d{4}),?\s+and\s+([A-Z][a-z]+)\s+(\d{1,2}),?\s*(\d{4})/,
  );
  if (dual) {
    return [
      isoDate(dual[1], dual[2], dual[3]),
      isoDate(dual[4], dual[5], dual[6]),
    ].filter(Boolean);
  }
  // Try: single "as of Month D, YYYY"
  const single = text.match(/as of\s+([A-Z][a-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (single) {
    const d = isoDate(single[1], single[2], single[3]);
    return d ? [d] : [];
  }
  return [];
}

function isoDate(monthName, day, year) {
  const m = MONTH_INDEX[monthName.toLowerCase()];
  if (!m) return null;
  return `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// A "money number" is comma-formatted with at least one comma, optionally
// parenthesized (negative). e.g., 40,579,500,000 or (755,928,072).
// Footnote refs like "3" or "12" are bare digits without commas, so this
// pattern skips them naturally.
const MONEY = `\\(?(\\d{1,3}(?:,\\d{3})+)\\)?`;

// Find first money number after a label, allowing line wraps within 200 chars.
function valueAfter(text, labelRegex) {
  const re = new RegExp(
    `${labelRegex.source}[\\s\\S]{0,200}?${MONEY}`,
    labelRegex.flags,
  );
  const m = text.match(re);
  if (!m) return null;
  const raw = m[0].endsWith(")") ? `-${m[1]}` : m[1];
  return parseNumber(raw);
}

// Returns the money value on a line if the line contains ONLY whitespace +
// the money number (right-aligned value column). Returns null otherwise.
function moneyOnlyLine(line) {
  const trimmed = line.trim();
  const m = trimmed.match(new RegExp(`^${MONEY}$`));
  if (!m) return null;
  const raw = m[0].endsWith(")") ? `-${m[1]}` : m[1];
  return parseNumber(raw);
}

// Find the money value associated with a label in a Deloitte-style table.
// Priority:
//   1. Same line as label (after it) — standard row layout.
//   2. Nearest "money-only" line above OR below the label, skipping blanks.
function valueNear(text, labelRegex) {
  const labelMatch = text.match(labelRegex);
  if (!labelMatch) return null;
  const idx = labelMatch.index;
  const labelEnd = idx + labelMatch[0].length;

  const lineEnd = text.indexOf("\n", labelEnd);
  const sameLine = text.slice(labelEnd, lineEnd >= 0 ? lineEnd : labelEnd + 200);
  const sameLineM = sameLine.match(new RegExp(MONEY));
  if (sameLineM) {
    const raw = sameLineM[0].endsWith(")") ? `-${sameLineM[1]}` : sameLineM[1];
    return parseNumber(raw);
  }

  // Walk below: skip blank lines, take the first MONEY-ONLY line. If the next
  // non-blank line has other content (e.g. it's a different labeled row), stop.
  let cursor = lineEnd >= 0 ? lineEnd + 1 : text.length;
  let belowValue = null;
  for (let i = 0; i < 4 && cursor < text.length; i++) {
    const nextEnd = text.indexOf("\n", cursor);
    const line = text.slice(cursor, nextEnd >= 0 ? nextEnd : text.length);
    if (line.trim().length === 0) {
      cursor = nextEnd >= 0 ? nextEnd + 1 : text.length;
      continue;
    }
    belowValue = moneyOnlyLine(line);
    break;
  }

  // Walk above: same logic upward.
  const lineStart = text.lastIndexOf("\n", idx - 1) + 1;
  let aboveValue = null;
  let above = lineStart;
  for (let i = 0; i < 4 && above > 0; i++) {
    const prevStart = text.lastIndexOf("\n", above - 2) + 1;
    const line = text.slice(prevStart, above - 1);
    if (line.trim().length === 0) {
      above = prevStart;
      continue;
    }
    aboveValue = moneyOnlyLine(line);
    break;
  }

  // Prefer above (Deloitte EURC layout puts value in column above label) when
  // it exists; fall back to below.
  if (aboveValue != null) return aboveValue;
  if (belowValue != null) return belowValue;
  return null;
}

// Find two money numbers after a label (Deloitte dual-date rows).
function valuesAfter(text, labelRegex) {
  const re = new RegExp(
    `${labelRegex.source}[\\s\\S]{0,200}?${MONEY}[\\s\\S]{0,80}?${MONEY}`,
    labelRegex.flags,
  );
  const m = text.match(re);
  if (!m) return null;
  return [parseNumber(m[1]), parseNumber(m[2])];
}

function parseGT(text, kind, year, month) {
  // Grant Thornton era. Single report date per file.
  // Token names: USDC (2018-2022) and EUROC (2022).
  const tokenName = kind === "usdc" ? "USDC" : "EUROC";
  const dates = findReportDates(text);
  // GT wording variants:
  //   "tokens issued and outstanding = X USDC"
  //   "tokens issued and outstanding less blacklisted tokens = X USDC"
  //   "tokens issued and outstanding less tokens allowed but not issued (Y) and less blacklisted tokens = X USDC"
  //   "in Circulation = X USDC" / "in Circulation1 = X USDC" (2022 wording)
  // [\s\S]{0,300}? allows line wraps within a bounded window.
  const issued = text.match(/tokens? issued and outstanding[\s\S]{0,300}?=\s*([\d,]+)/i);
  const inCirc = text.match(new RegExp(
    `${tokenName}[^\\n]*?[Ii]n [Cc]irculation[\\s\\S]{0,30}?=\\s*([\\d,]+)`,
  ));
  const custody = text.match(/(?:US Dollars|Euros) held in custody accounts?[\s\S]{0,100}?=\s*[\$€]?\s*([\d,]+)/i);
  const circulation = parseNumber((inCirc && inCirc[1]) || (issued && issued[1]));
  const reserveTotal = parseNumber(custody && custody[1]);
  return {
    kind,
    year: Number(year),
    month: Number(month),
    format: "grant-thornton",
    reportDates: dates,
    series: dates.map((date) => ({
      date,
      circulation,
      reserveTotal: reserveTotal ?? circulation, // 2022 reports don't break out total
      composition: null,
    })),
  };
}

function splitCompositionSections(text, kind) {
  // Each section starts at the per-date header and ends at the next per-date
  // header (or end of doc). USDC uses "CIRCLE RESERVE FUND ASSETS AS OF",
  // EURC/EUROC uses "<token> RESERVE ASSETS AS OF" (no fund).
  // Date format is sloppy across years: "JANUARY 17, 2023", "JANUARY, 31 2023",
  // "JUNE 30, 2023" — allow commas in either or both positions.
  const dateExpr = `[A-Z][A-Z]+,?\\s+\\d{1,2},?\\s+\\d{4}`;
  const startRe = kind === "usdc"
    ? new RegExp(`CIRCLE RESERVE FUND ASSETS AS OF\\s+(${dateExpr})`, "g")
    : new RegExp(`(?:EURC|EUROC) RESERVE ASSETS AS OF\\s+(${dateExpr})`, "g");
  const matches = [...text.matchAll(startRe)];
  if (matches.length === 0) return [];
  const sections = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    sections.push({
      headerDate: matches[i][1],
      body: text.slice(start, end),
    });
  }
  return sections;
}

function parseComposition(body, kind) {
  // Sub-split this date's section into "Fund" vs "Other" sub-sections so that
  // labels that appear in both (e.g. "Cash held at U.S. regulated financial
  // institutions") are read from the correct sub-section.
  const otherHeaderRe = /OTHER (?:USDC|EURC) RESERVE ASSETS AS OF/i;
  const totalHeaderRe = /TOTAL (?:USDC|EURC) RESERVE ASSETS AS OF/i;
  const otherIdx = body.search(otherHeaderRe);
  const totalIdx = body.search(totalHeaderRe);

  // For USDC (Deloitte): Fund = [start, otherIdx). Other = [otherIdx, totalIdx).
  // For EURC: no Fund section, the whole body is treated as Other.
  let fundBody = "";
  let otherBody = body;
  if (kind === "usdc" && otherIdx >= 0) {
    fundBody = body.slice(0, otherIdx);
    otherBody = body.slice(otherIdx, totalIdx > otherIdx ? totalIdx : body.length);
  } else if (kind === "usdc") {
    // Pre-2023 EUROC-style: no Other section. Treat whole body as Fund.
    fundBody = body;
    otherBody = "";
  }

  const treasuries = valueAfter(fundBody, /TOTAL U\.S\.\s*TREASURY SECURITIES/i);
  const repos = valueNear(fundBody, /U\.?S\.?\s*Treasury Repurchase Agreements/i);
  // "Cash held in Circle Reserve Fund" only exists in newer reports. In early
  // 2023 the in-fund cash was labeled "Cash held at U.S. regulated financial
  // institutions" — same label as the Other section but inside the Fund.
  const cashInFund =
    valueNear(fundBody, /Cash held in Circle Reserve Fund/i) ??
    valueNear(fundBody, /Cash held at\s+U\.S\.\s+regulated financial institutions/i) ??
    valueNear(fundBody, /Cash held at regulated financial institutions/i);

  const cashAtBanks =
    valueNear(otherBody, /Cash held at\s+U\.S\.\s+regulated financial institutions/i) ??
    valueNear(otherBody, /Cash held at regulated financial institutions/i) ??
    valueNear(otherBody, /Cash held in segregated accounts/i);

  const totalReserveFund = valueAfter(body, /TOTAL CIRCLE RESERVE FUND ASSETS/i);
  const totalOther = valueAfter(body, /TOTAL OTHER (?:USDC|EURC) RESERVE ASSETS/i);
  const totalReserveAssets = valueAfter(body, totalHeaderRe);

  if (
    treasuries == null && repos == null && cashInFund == null &&
    cashAtBanks == null && totalReserveAssets == null
  ) {
    return null;
  }

  return {
    treasuries: treasuries ?? 0,
    repos: repos ?? 0,
    cashInFund: cashInFund ?? 0,
    cashAtBanks: cashAtBanks ?? 0,
    totalReserveFund,
    totalOther,
    totalReserveAssets,
  };
}

function parseDeloitte(text, kind, year, month) {
  const dates = findReportDates(text);
  // EURC reports from early 2023 still use the old "EUROC" name.
  const tokenName = kind === "usdc" ? "USDC" : "(?:EURC|EUROC)";
  const circRow = valuesAfter(text, new RegExp(`${tokenName} (?:I|i)n Circulation`));
  const fvRow = valuesAfter(text, new RegExp(`Fair Value of Assets Held in ${tokenName} Reserve`));

  const sections = splitCompositionSections(text, kind);

  const series = dates.map((date, i) => {
    const composition = sections[i] ? parseComposition(sections[i].body, kind) : null;
    return {
      date,
      circulation: circRow ? circRow[i] : null,
      reserveTotal: fvRow ? fvRow[i] : (composition?.totalReserveAssets ?? null),
      composition,
    };
  });

  return {
    kind,
    year: Number(year),
    month: Number(month),
    format: "deloitte",
    reportDates: dates,
    series,
  };
}

function detectFormat(text, kind, year) {
  // Grant Thornton era covers all USDC 2018-2022 and EUROC 2022.
  if (Number(year) <= 2022) {
    if (/Reserve Account Report/i.test(text) || /Grant Thornton/i.test(text)) {
      return "grant-thornton";
    }
  }
  return "deloitte";
}

const results = [];
const issues = [];

for (const m of manifest) {
  const pdfPath = resolve("public/pdfs", m.kind, `${m.key}.pdf`);
  if (!existsSync(pdfPath)) {
    issues.push({ file: pdfPath, reason: "missing" });
    continue;
  }
  let text;
  try {
    text = pdftotext(pdfPath, true);
  } catch (e) {
    issues.push({ file: pdfPath, reason: `pdftotext: ${e.message}` });
    continue;
  }
  const overrideKey = `${m.kind}-${m.key}`;
  const override = OVERRIDES[overrideKey];
  const format = override?.format ?? detectFormat(text, m.kind, m.year);
  let parsed;
  try {
    parsed = format === "grant-thornton"
      ? parseGT(text, m.kind, m.year, m.month)
      : parseDeloitte(text, m.kind, m.year, m.month);
  } catch (e) {
    issues.push({ file: pdfPath, reason: `parse: ${e.message}` });
    continue;
  }
  if (override) {
    parsed.reportDates = override.reportDates;
    parsed.series = override.series;
    parsed.format = override.format;
    parsed.overrideNote = override.note;
  }

  // Sanity checks
  const warnings = [];
  if (parsed.series.length === 0) warnings.push("no report dates found");
  for (const s of parsed.series) {
    if (s.circulation == null) warnings.push(`missing circulation for ${s.date}`);
    if (s.reserveTotal == null) warnings.push(`missing reserveTotal for ${s.date}`);
  }
  parsed.warnings = warnings;
  parsed.sourcePdf = `public/pdfs/${m.kind}/${m.key}.pdf`;
  parsed.localPdf = `/pdfs/${m.kind}/${m.key}.pdf`;
  parsed.sourceUrl = m.url;

  const outPath = `data/reports/${m.kind}-${m.key}.json`;
  writeFileSync(outPath, JSON.stringify(parsed, null, 2) + "\n");
  results.push({ key: `${m.kind}-${m.key}`, format, warnings, dates: parsed.reportDates });
}

const index = {
  generatedAt: new Date().toISOString(),
  count: results.length,
  reports: results,
};
writeFileSync("data/reports/_index.json", JSON.stringify(index, null, 2) + "\n");

const clean_count = results.filter(r => r.warnings.length === 0).length;
const warned = results.filter(r => r.warnings.length > 0);

console.log(`Parsed ${results.length} reports (${clean_count} clean, ${warned.length} with warnings, ${issues.length} hard failures)`);
if (warned.length > 0) {
  console.log("\nReports with warnings:");
  for (const r of warned) {
    console.log(`  ${r.key} [${r.format}] dates=${r.dates.length}: ${r.warnings.join("; ")}`);
  }
}
if (issues.length > 0) {
  console.log("\nHard failures:");
  for (const i of issues) console.log(`  ${i.file}: ${i.reason}`);
}
