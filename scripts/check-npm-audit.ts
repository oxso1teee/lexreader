// docs/release-2026-08-22/07_TESTIROVANIE_I_CI.md раздел 3 — раньше находки
// вроде pdfjs-dist (docs/release-2026-08-22/02_KRITICHNYE_BAGI_SEYCHAS.md
// A.1) можно было узнать только вручную запустив `npm audit`; уязвимость
// провисела необнаруженной примерно неделю. Этот скрипт — CI-шаг, который
// ловит это автоматически.
//
// Правило: падает на любой high/critical severity уязвимости на СВОЕЙ
// ПРЯМОЙ зависимости (package.json), которой нет в
// .github/npm-audit-allowlist.json. Прямые/транзитивные различает само
// поле `isDirect` из `npm audit --json` (проверено вручную: next -> true,
// его собственные транзитивные postcss/sharp -> false) — транзитивные
// уязвимости исключаются автоматически, без записи в allowlist, отдельная
// команда `npm audit` (без --omit=dev) по-прежнему покажет их разработчику
// локально.
//
// Usage: node --experimental-strip-types scripts/check-npm-audit.ts

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface NpmAuditVia {
  title?: string;
  url?: string;
  severity?: string;
}

interface NpmAuditVulnerability {
  name: string;
  severity: string;
  isDirect: boolean;
  via: (string | NpmAuditVia)[];
}

interface NpmAuditReport {
  vulnerabilities?: Record<string, NpmAuditVulnerability>;
}

interface Allowlist {
  acceptedAdvisories: { package: string; reason: string; trackedIn?: string }[];
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowlist: Allowlist = JSON.parse(
  readFileSync(path.join(projectRoot, ".github/npm-audit-allowlist.json"), "utf8"),
);
const allowedPackages = new Set(allowlist.acceptedAdvisories.map((a) => a.package));

function runNpmAudit(): NpmAuditReport {
  // npm audit exits non-zero the moment it finds anything at all — that's
  // the expected, informative case here, not a real failure of the command
  // itself. Only stdout (the JSON body) matters; a genuine invocation
  // failure (e.g. network error) produces no parseable JSON and throws
  // below on JSON.parse, which is the right failure mode either way.
  try {
    const stdout = execSync("npm audit --omit=dev --json", { cwd: projectRoot, encoding: "utf8" });
    return JSON.parse(stdout);
  } catch (e) {
    const stdout = (e as { stdout?: string }).stdout;
    if (!stdout) throw e;
    return JSON.parse(stdout);
  }
}

const HIGH_SEVERITIES = new Set(["high", "critical"]);

const report = runNpmAudit();
const vulnerabilities = report.vulnerabilities ?? {};

const known: { package: string; severity: string; titles: string[] }[] = [];
const unexpected: { package: string; severity: string; titles: string[] }[] = [];

for (const [packageName, info] of Object.entries(vulnerabilities)) {
  if (!HIGH_SEVERITIES.has(info.severity)) continue;
  if (!info.isDirect) continue; // transitive-only — not this check's job, see file header

  const titles = info.via.filter((v): v is NpmAuditVia => typeof v === "object").map((v) => v.title ?? "(untitled advisory)");
  const entry = { package: packageName, severity: info.severity, titles };
  if (allowedPackages.has(packageName)) known.push(entry);
  else unexpected.push(entry);
}

if (known.length > 0) {
  console.log("Known, deliberately-deferred high/critical vulnerabilities on direct dependencies (see .github/npm-audit-allowlist.json):");
  for (const f of known) {
    console.log(`  - ${f.package} (${f.severity})`);
    for (const t of f.titles) console.log(`      ${t}`);
  }
}

if (unexpected.length > 0) {
  console.error("\nNEW high/critical severity npm audit finding(s) on a direct dependency, not in .github/npm-audit-allowlist.json:");
  for (const f of unexpected) {
    console.error(`  - ${f.package} (${f.severity})`);
    for (const t of f.titles) console.error(`      ${t}`);
  }
  console.error(
    "\nFix it (npm audit fix, or a deliberate version bump), or — only if it genuinely can't be fixed right now — " +
      "add a justified entry to .github/npm-audit-allowlist.json explaining why and where it's tracked.",
  );
  process.exit(1);
}

console.log(known.length > 0 ? "\nnpm audit: no *new* high/critical severity findings on direct dependencies." : "npm audit: clean — no high/critical severity findings on direct dependencies.");
