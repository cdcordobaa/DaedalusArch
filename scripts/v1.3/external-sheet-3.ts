/**
 * v1.3 external set, wave 3 (Docs/DiagnosticRuns/v1.3-external-set-3-2026-10-16.md): per-project finding counts and
 * the wave-3 extension of the human labelling sheet. Same logic as wave 2's scripts/v1.3/external-sheet-2.ts (PR #181),
 * with the output directory, the row offset (685) and the `wave` value (3) as the only changes, so the wave-3 rows
 * append to the wave-1 + wave-2 sheet (685 rows) without renumbering. Reads only
 * `results/v1.3-external-3/{selection.json,findings/<id>.json}`;
 * no Neo4j, no LLM. Entry file: no exports.
 *
 * Usage (repository root):
 *   node --import tsx scripts/v1.3/external-sheet-3.ts [--seed 20261016] [--advisory-sample 30] [--row-offset 685]
 * Writes results/v1.3-external-3/summary.json and results/v1.3-external-3/labelling-sheet.csv.
 *
 * The sheet holds EVERY blocking finding plus a seeded random sample of the pooled advisory findings. A finding's tier
 * is the one its own report gives (`tiers.blocking.rules` / `tiers.advisory.rules`, from Docs/v1.3/rule-tiers.md), so
 * FF-S03 is blocking only for `layered`. The `correct` and `meaningful` columns are left empty for human labellers.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mulberry32, seededSample, toCsv } from './lib/graph-fidelity.js';

const OUT = 'results/v1.3-external-3';

interface Entry { readonly id: string; readonly repo: string; readonly sha: string; readonly style: string; readonly root: string }
interface Violation {
  readonly id: string; readonly functionId: string; readonly severity: string; readonly filePath?: string;
  readonly target?: string; readonly line?: number; readonly message: string; readonly type: string;
}
interface TierRule { readonly functionId: string; readonly name: string; readonly tier: string; readonly violationCount: number }
interface Report {
  readonly verdict: string; readonly ahsDeterministic: number;
  readonly violations: readonly Violation[];
  readonly tiers: { readonly verdict: string; readonly blocking: { readonly rules: readonly TierRule[] }; readonly advisory: { readonly rules: readonly TierRule[] } };
  readonly disabledFunctions?: readonly { functionId: string }[];
  readonly layerAnnotation?: { mapped: number; unmapped: number };
  readonly graphStats?: Record<string, unknown>;
  readonly durationMs?: number;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? String(process.argv[i + 1]) : fallback;
}

const seed = Number(arg('seed', '20261016'));
const sampleSize = Number(arg('advisory-sample', '30'));
const rowOffset = Number(arg('row-offset', '685'));
const selection = JSON.parse(readFileSync(join(OUT, 'selection.json'), 'utf8')) as { entries: Entry[] };

interface Row { readonly entry: Entry; readonly tier: string; readonly ruleName: string; readonly v: Violation }
const blocking: Row[] = [];
const advisory: Row[] = [];
const perProject: Record<string, unknown>[] = [];

for (const e of selection.entries) {
  const r = JSON.parse(readFileSync(join(OUT, 'findings', `${e.id}.json`), 'utf8')) as Report;
  const tierOf = new Map<string, TierRule>();
  for (const t of [...r.tiers.blocking.rules, ...r.tiers.advisory.rules]) tierOf.set(t.functionId, t);
  const byRule: Record<string, number> = {};
  let b = 0;
  let a = 0;
  let untiered = 0;
  for (const v of r.violations) {
    const t = tierOf.get(v.functionId);
    byRule[v.functionId] = (byRule[v.functionId] ?? 0) + 1;
    if (t === undefined) { untiered++; continue; }
    const row = { entry: e, tier: t.tier, ruleName: t.name, v };
    if (t.tier === 'blocking') { blocking.push(row); b++; } else { advisory.push(row); a++; }
  }
  perProject.push({
    id: e.id, style: e.style, verdictV13: r.tiers.verdict, verdictV12e: r.verdict, ahsDeterministic: r.ahsDeterministic,
    blocking: b, advisory: a, untiered,
    blockingRulesViolated: r.tiers.blocking.rules.filter((t) => t.violationCount > 0).map((t) => `${t.functionId} ${t.name} (${String(t.violationCount)})`),
    advisoryRulesViolated: r.tiers.advisory.rules.filter((t) => t.violationCount > 0).map((t) => `${t.functionId} ${t.name} (${String(t.violationCount)})`),
    byRule, disabled: (r.disabledFunctions ?? []).map((d) => d.functionId), layerAnnotation: r.layerAnnotation,
    graphStats: r.graphStats, durationMs: r.durationMs,
  });
}

const key = (x: Row): string => `${x.entry.id}\u0000${x.v.functionId}\u0000${x.v.filePath ?? ''}\u0000${x.v.target ?? ''}\u0000${x.v.id}`;
const sortRows = (rows: Row[]): Row[] => [...rows].sort((p, q) => (key(p) < key(q) ? -1 : key(p) > key(q) ? 1 : 0));
const sampled = sortRows(seededSample(sortRows(advisory), sampleSize, mulberry32(seed)));
const sheet = [...sortRows(blocking).map((r) => ({ ...r, origin: 'all-blocking' })), ...sampled.map((r) => ({ ...r, origin: `advisory-sample(seed=${String(seed)})` }))];

const link = (e: Entry, file: string | undefined, line: number | undefined): string => {
  if (file === undefined || file === '') return '';
  const p = e.root === '.' ? file : `${e.root}/${file}`;
  return `https://github.com/${e.repo}/blob/${e.sha}/${p}${line !== undefined ? `#L${String(line)}` : ''}`;
};

const header = ['row', 'wave', 'origin', 'project', 'style', 'tier', 'ruleId', 'ruleName', 'severity', 'type', 'file', 'line', 'target', 'message', 'sourceUrl', 'findingId', 'correct', 'meaningful', 'labellerNotes'];
const rows = sheet.map((r, i) => [
  rowOffset + i + 1, 3, r.origin, r.entry.id, r.entry.style, r.tier, r.v.functionId, r.ruleName, r.v.severity, r.v.type, r.v.filePath ?? '', r.v.line ?? '',
  r.v.target ?? '', r.v.message, link(r.entry, r.v.filePath, r.v.line), r.v.id, '', '', '',
]);
writeFileSync(join(OUT, 'labelling-sheet.csv'), toCsv(header, rows));
writeFileSync(join(OUT, 'summary.json'), JSON.stringify({
  seed, rowOffset, advisorySample: sampled.length, totals: { blocking: blocking.length, advisory: advisory.length, sheetRows: sheet.length }, perProject,
}, null, 1) + '\n');
process.stdout.write(`blocking ${String(blocking.length)}, advisory ${String(advisory.length)} (sampled ${String(sampled.length)}), sheet ${String(sheet.length)} rows\n`);
