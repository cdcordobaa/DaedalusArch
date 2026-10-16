/**
 * v1.3 external set, waves 1 + 2 pooled (Docs/DiagnosticRuns/v1.3-external-set-2-2026-10-16.md): pooled finding counts
 * and graph-fidelity agreement over the 35 projects. Reads only committed outputs of both waves:
 * `<wave>/selection.json`, `<wave>/summary.json` and `<wave>/fidelity/<id>/aggregate.json`. No Neo4j, no LLM, no labels.
 * Entry file: no exports.
 *
 * Usage (repository root):
 *   node --import tsx scripts/v1.3/external-pooled.ts [--wave1 results/v1.3-external] [--wave2 results/v1.3-external-2]
 * Wave 1 lives on branch v1.3-external-set (PR #133); pass its directory with --wave1 until that PR is merged.
 * Writes <wave2>/pooled.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? String(process.argv[i + 1]) : fallback;
}

interface Entry { readonly id: string; readonly style: string; readonly srcTsFiles: number }
interface PerProject {
  readonly id: string; readonly style: string; readonly verdictV13: string; readonly blocking: number; readonly advisory: number;
  readonly byRule: Record<string, number>; readonly blockingRulesViolated: readonly string[];
}
interface Micro { readonly apgEdges: number; readonly refEdges: number; readonly both: number }
interface Variant { readonly agreement: Record<string, { readonly micro: Micro }>; readonly disagreementClasses: Record<string, Record<string, number>> }
interface Aggregate { readonly variants: Record<string, Variant> }

interface Row {
  readonly wave: number; readonly id: string; readonly style: string; readonly files: number; readonly verdict: string;
  readonly blocking: number; readonly advisory: number; readonly byRule: Record<string, number>; readonly blockingRules: string[];
  readonly fidelity: Record<string, Micro & { readonly topDisagreement: string }>;
}

const waves: [number, string][] = [[1, arg('wave1', 'results/v1.3-external')], [2, arg('wave2', 'results/v1.3-external-2')]];
const rows: Row[] = [];
for (const [wave, dir] of waves) {
  const sel = JSON.parse(readFileSync(join(dir, 'selection.json'), 'utf8')) as { entries: Entry[] };
  const sum = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8')) as { perProject: PerProject[] };
  for (const e of sel.entries) {
    const p = sum.perProject.find((q) => q.id === e.id);
    if (p === undefined) throw new Error(`no summary row for ${e.id}`);
    const agg = JSON.parse(readFileSync(join(dir, 'fidelity', e.id, 'aggregate.json'), 'utf8')) as Aggregate;
    const fidelity: Row['fidelity'] = {};
    for (const v of ['apg-v12e-default', 'apg-v13-literal']) {
      const m = agg.variants[v]?.agreement['tsc.scoped']?.micro;
      if (m === undefined) throw new Error(`no ${v} tsc.scoped for ${e.id}`);
      const classes = Object.entries(agg.variants[v]?.disagreementClasses['tsc'] ?? {}).sort((a, b) => b[1] - a[1]);
      fidelity[v] = { apgEdges: m.apgEdges, refEdges: m.refEdges, both: m.both, topDisagreement: classes.map(([k, n]) => `${k} ${String(n)}`).join('; ') };
    }
    rows.push({
      wave, id: e.id, style: e.style, files: e.srcTsFiles, verdict: p.verdictV13, blocking: p.blocking, advisory: p.advisory,
      byRule: p.byRule, blockingRules: p.blockingRulesViolated.map((s) => s.split(' ')[0] ?? s), fidelity,
    });
  }
}

/** Wilson score interval, 95 %. */
function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.959964; const p = k / n; const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d; const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Number((c - h).toFixed(3)), Number((c + h).toFixed(3))];
}
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length === 0 ? 0 : s.length % 2 === 1 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};
const r3 = (x: number): number => Number(x.toFixed(3));

function group(sel: Row[]): Record<string, unknown> {
  const fails = sel.filter((r) => r.verdict === 'fail').length;
  const withBlocking = sel.filter((r) => r.blocking > 0).length;
  const files = sel.reduce((a, r) => a + r.files, 0);
  const blocking = sel.reduce((a, r) => a + r.blocking, 0);
  const advisory = sel.reduce((a, r) => a + r.advisory, 0);
  const fid = (v: string): Record<string, number> => {
    const both = sel.reduce((a, r) => a + (r.fidelity[v]?.both ?? 0), 0);
    const ref = sel.reduce((a, r) => a + (r.fidelity[v]?.refEdges ?? 0), 0);
    const apg = sel.reduce((a, r) => a + (r.fidelity[v]?.apgEdges ?? 0), 0);
    const exact = sel.filter((r) => r.fidelity[v]?.both === r.fidelity[v]?.refEdges && r.fidelity[v]?.both === r.fidelity[v]?.apgEdges).length;
    return { both, tscEdges: ref, apgEdges: apg, coverage: r3(both / ref), confirmation: r3(both / apg), projectsExact: exact };
  };
  return {
    projects: sel.length, srcTsFiles: files, fail: fails, pass: sel.length - fails, failRate: r3(fails / sel.length), failRateWilson95: wilson(fails, sel.length),
    projectsWithBlocking: withBlocking, blocking, advisory,
    blockingPerProject: { mean: r3(blocking / sel.length), median: median(sel.map((r) => r.blocking)), max: Math.max(...sel.map((r) => r.blocking)) },
    blockingPer100Files: r3((100 * blocking) / files),
    fidelityDefaultGraph: fid('apg-v12e-default'), fidelityLiteralView: fid('apg-v13-literal'),
  };
}

const styles = [...new Set(rows.map((r) => r.style))];
const ruleTotals = (sel: Row[], tier: 'blocking' | 'all'): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const r of sel) for (const [k, n] of Object.entries(r.byRule)) if (tier === 'all' || r.blockingRules.includes(k)) out[k] = (out[k] ?? 0) + n;
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
};
const blockingRuleProjects: Record<string, number> = {};
for (const r of rows) for (const k of r.blockingRules) blockingRuleProjects[k] = (blockingRuleProjects[k] ?? 0) + 1;

const out = {
  note: 'Counts are unlabelled candidates, not precision. Fidelity is agreement with the TypeScript compiler (tsc.scoped, micro), not ground truth.',
  pooled: group(rows),
  byWave: { wave1: group(rows.filter((r) => r.wave === 1)), wave2: group(rows.filter((r) => r.wave === 2)) },
  byStyle: Object.fromEntries(styles.map((s) => [s, group(rows.filter((r) => r.style === s))])),
  blockingFindingsByRule: ruleTotals(rows, 'blocking'),
  projectsWithBlockingRule: Object.fromEntries(Object.entries(blockingRuleProjects).sort((a, b) => b[1] - a[1])),
  allFindingsByRule: ruleTotals(rows, 'all'),
  perProject: rows,
};
writeFileSync(join(waves[1]?.[1] ?? '', 'pooled.json'), JSON.stringify(out, null, 1) + '\n');
process.stdout.write(`${String(rows.length)} projects pooled\n`);
