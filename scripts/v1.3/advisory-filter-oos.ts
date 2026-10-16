/**
 * U1: PR #139's advisory post-filters on data they never saw (external set #133, wild set #114).
 * Pass criterion and plan: Docs/DiagnosticRuns/v1.3-advisory-filter-oos-criterion-2026-10-16.md (committed first).
 *
 * Reads `evaluate --engine cypher-interp` reports from a runs directory (never committed: they hold clone paths):
 *   <runs>/ext/<set>/<id>.json   live runs, one per option set (`none` is the baseline)
 *   <runs>/wild/none/<id>.json   live baseline only (the wild repositories take minutes per run)
 * and applies every option set offline with the pipeline's own functions (`filterReportAdvisory` over
 * `fsProjectView`, as `pipeline-factory.ts` builds it). On the external set the offline result is checked against the
 * live `--advisory-filter` run, row for row. Offline: no Neo4j, no model call.
 *
 * Usage: npx tsx scripts/v1.3/advisory-filter-oos.ts --runs <dir> --clones <dir> --wild-specs <dir> [--out <dir>]
 *   --clones holds ext__<id>/ and wild__<id>/ clones at the pinned SHAs; --wild-specs holds <id>.yaml (the committed
 *   `results/v1.3-wild/repos/<id>/ise-spec.yaml` of branch v1.3-wild) and <id>.selection.json is not needed.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { filterReportAdvisory } from '../../src/advisory-filter/report.js';
import { fsProjectView } from '../../src/advisory-filter/project-view.js';
import type { AdvisoryFilterOption } from '../../src/advisory-filter/advisory-filter.js';
import { parseSpec } from '../../src/spec-parser/index.js';
import type { EvaluationReport } from '../../src/shared/types/evaluation.js';
import { wilson } from '../lib/stats.js';
import { findingsOfReport } from './lib/labelling/findings.js';
import { ruleOf } from './lib/labelling/sampler.js';

const REPO = process.cwd();
const SEED = 20261016;
const SAMPLE_N = 40;

const PROPOSED: AdvisoryFilterOption[] = ['cv05-no-logic', 'composition-roots', 'c03-core-only', 'c02-abstract-imports', 'c04-entry-points', 'so-framework-members'];
export const SETS: ReadonlyArray<{ name: string; options: AdvisoryFilterOption[] }> = [
  { name: 'cv05-no-logic', options: ['cv05-no-logic'] },
  { name: 'composition-roots', options: ['composition-roots'] },
  { name: 'c03-core-only', options: ['c03-core-only'] },
  { name: 'proposed', options: PROPOSED },
  { name: 'cv05-rollup', options: ['cv05-rollup'] },
  { name: 'proposed+rollup', options: [...PROPOSED, 'cv05-rollup'] },
];
const FILTER_RULES = ['FF-CV05', 'FF-C03', 'FF-C02', 'FF-C04', 'FF-SO01', 'FF-SO02'];

/** #139 §4, advisory volume before -> after (in-sample; the options were designed on these rows). */
const IN_SAMPLE: Readonly<Record<string, { dev: [number, number]; e1: [number, number] }>> = {
  'cv05-no-logic': { dev: [1606, 1233], e1: [1428, 1176] },
  'composition-roots': { dev: [1606, 1529], e1: [1428, 1313] },
  'c03-core-only': { dev: [1606, 1513], e1: [1428, 1272] },
  proposed: { dev: [1606, 1082], e1: [1428, 953] },
  'cv05-rollup': { dev: [1606, 490], e1: [1428, 314] },
  'proposed+rollup': { dev: [1606, 297], e1: [1428, 137] },
};

interface Violation { id: string; functionId: string; filePath: string; [k: string]: unknown }
interface Entry { id: string; root: string; set: 'ext' | 'wild'; spec: string; projectDir: string }

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const need = (name: string): string => {
  const v = arg(name);
  if (v === undefined) throw new Error(`missing ${name}`);
  return path.resolve(v);
};
const readJson = <T>(f: string): T => JSON.parse(fs.readFileSync(f, 'utf8')) as T;
const blockingIds = (r: EvaluationReport): Set<string> => new Set((r.tiers?.blocking.rules ?? []).map((x) => x.functionId));
const stable = (v: unknown): string => JSON.stringify(v);
/** The report minus fields that differ between two runs of the same input (ids, timings, durations, paths). */
function invariant(r: EvaluationReport): unknown {
  const fr = (r.functionResults ?? []).map((f) => ({ ...f, executionTimeMs: 0 }));
  return { verdict: r.verdict, tiers: r.tiers, perDimensionScores: r.perDimensionScores, functionResults: fr, ahs: r.ahsDeterministic };
}
const ci = (k: number, n: number): { k: number; n: number; rate: number | null; low: number | null; high: number | null } => {
  if (n === 0) return { k, n, rate: null, low: null, high: null };
  const w = wilson(k, n);
  return { k, n, rate: k / n, low: w.low, high: w.high };
};
const fmt = (c: ReturnType<typeof ci>): string => (c.rate === null ? '-' : `${String(c.k)}/${String(c.n)} = ${c.rate.toFixed(2)} [${(c.low ?? 0).toFixed(2)}, ${(c.high ?? 0).toFixed(2)}]`);

function entries(clones: string, wildSpecs: string): Entry[] {
  const out: Entry[] = [];
  const ext = readJson<{ entries: { id: string; root: string }[] }>(path.join(REPO, 'results/v1.3-external/selection.json')).entries;
  for (const e of ext) out.push({ id: e.id, root: e.root, set: 'ext', spec: path.join(REPO, 'results/v1.3-external/specs', `${e.id}.yaml`), projectDir: path.join(clones, `ext__${e.id}`, e.root) });
  const wild = readJson<{ entries: { id: string; root: string }[] }>(path.join(wildSpecs, 'selection.json')).entries;
  for (const e of wild) out.push({ id: e.id, root: e.root, set: 'wild', spec: path.join(wildSpecs, `${e.id}.yaml`), projectDir: path.join(clones, `wild__${e.id}`, e.root) });
  return out;
}

async function main(): Promise<void> {
  const runs = need('--runs');
  const clones = need('--clones');
  const wildSpecs = need('--wild-specs');
  const outDir = path.resolve(arg('--out') ?? path.join(REPO, 'results/v1.3-advisory-filter-oos'));
  fs.mkdirSync(outDir, { recursive: true });

  type Cell = { advisory: number; removed: number; byRule: Record<string, [number, number]>; blockingIdentical: boolean; liveMatches: boolean | null; liveInvariant: boolean | null };
  const perProject: Record<string, { set: string; status: string; advisory: number; blocking: number; cells: Record<string, Cell> }> = {};
  const removedPool = new Map<string, { projectId: string; set: string; violation: Violation; options: string[]; reasons: string[] }>();
  const jobs: unknown[] = [];

  for (const e of entries(clones, wildSpecs)) {
    const pid = `${e.set}/${e.id}`;
    const baseFile = path.join(runs, e.set, 'none', `${e.id}.json`);
    if (!fs.existsSync(baseFile) || fs.statSync(baseFile).size === 0) { perProject[pid] = { set: e.set, status: 'no baseline run', advisory: 0, blocking: 0, cells: {} }; continue; }
    const base = readJson<EvaluationReport>(baseFile);
    const parsed = await parseSpec({ specFilePath: e.spec });
    if (!parsed.success) throw new Error(`${e.spec}: ${parsed.errors[0]?.message ?? 'spec'}`);
    const view = fsProjectView({ projectDir: e.projectDir, layerModel: parsed.data.layerModel, functions: parsed.data.fitnessFunctions });
    const bl = blockingIds(base);
    const baseViol = base.violations as unknown as Violation[];
    const adv = baseViol.filter((v) => !bl.has(v.functionId));
    const blockRows = stable(baseViol.filter((v) => bl.has(v.functionId)));
    const cells: Record<string, Cell> = {};
    jobs.push({ projectId: pid, projectRoot: e.projectDir, spec: e.spec, report: baseFile, style: base.tiers?.style ?? undefined });
    for (const s of SETS) {
      const off = filterReportAdvisory(base, s.options, view);
      const offViol = off.violations as unknown as Violation[];
      const supp = off.advisoryFilter?.suppressed ?? [];
      const byRule: Record<string, [number, number]> = {};
      for (const r of FILTER_RULES) byRule[r] = [adv.filter((v) => v.functionId === r).length, supp.filter((x) => x.violation.functionId === r).length];
      let liveMatches: boolean | null = null;
      let liveInvariant: boolean | null = null;
      let blockingIdentical = stable(offViol.filter((v) => bl.has(v.functionId))) === blockRows && supp.every((x) => !bl.has(x.violation.functionId));
      const liveFile = path.join(runs, e.set, s.name, `${e.id}.json`);
      if (fs.existsSync(liveFile) && fs.statSync(liveFile).size > 0) {
        const live = readJson<EvaluationReport>(liveFile);
        const liveViol = live.violations as unknown as Violation[];
        const liveSupp = live.advisoryFilter?.suppressed ?? [];
        liveMatches = stable(liveViol) === stable(offViol)
          && stable(liveSupp.map((x) => [x.option, x.reason, x.violation])) === stable(supp.map((x) => [x.option, x.reason, x.violation]));
        liveInvariant = stable(invariant(live)) === stable(invariant(base));
        blockingIdentical = blockingIdentical && liveInvariant && stable(liveViol.filter((v) => bl.has(v.functionId))) === blockRows;
      }
      cells[s.name] = { advisory: adv.length, removed: supp.length, byRule, blockingIdentical, liveMatches, liveInvariant };
      for (const x of supp) {
        const v = x.violation as unknown as Violation;
        const key = `${pid}:${v.id}`;
        const cur = removedPool.get(key) ?? { projectId: pid, set: e.set, violation: v, options: [], reasons: [] };
        cur.options.push(s.name);
        if (!cur.reasons.includes(`${x.option}: ${x.reason}`)) cur.reasons.push(`${x.option}: ${x.reason}`);
        removedPool.set(key, cur);
      }
    }
    perProject[pid] = { set: e.set, status: 'ok', advisory: adv.length, blocking: baseViol.length - adv.length, cells };
  }

  // Aggregates per data set and option set.
  const agg: Record<string, Record<string, unknown>> = {};
  for (const set of ['ext', 'wild']) {
    agg[set] = {};
    const projs = Object.entries(perProject).filter(([, p]) => p.set === set && p.status === 'ok');
    for (const s of SETS) {
      const n = projs.reduce((a, [, p]) => a + (p.cells[s.name]?.advisory ?? 0), 0);
      const k = projs.reduce((a, [, p]) => a + (p.cells[s.name]?.removed ?? 0), 0);
      const rates = projs.filter(([, p]) => (p.cells[s.name]?.advisory ?? 0) > 0).map(([, p]) => (p.cells[s.name]?.removed ?? 0) / (p.cells[s.name]?.advisory ?? 1));
      const byRule: Record<string, ReturnType<typeof ci>> = {};
      for (const r of FILTER_RULES) {
        const rn = projs.reduce((a, [, p]) => a + (p.cells[s.name]?.byRule[r]?.[0] ?? 0), 0);
        const rk = projs.reduce((a, [, p]) => a + (p.cells[s.name]?.byRule[r]?.[1] ?? 0), 0);
        byRule[r] = ci(rk, rn);
      }
      agg[set][s.name] = {
        projects: projs.length,
        removal: ci(k, n),
        perProjectRange: rates.length > 0 ? [Math.min(...rates), Math.max(...rates)] : null,
        blockingIdenticalAll: projs.every(([, p]) => p.cells[s.name]?.blockingIdentical === true),
        liveChecked: projs.filter(([, p]) => p.cells[s.name]?.liveMatches !== null).length,
        liveMatchesAll: projs.every(([, p]) => p.cells[s.name]?.liveMatches !== false),
        byRule,
      };
    }
  }

  // Seeded sample of removed rows.
  const order = (key: string): string => createHash('sha256').update(`${String(SEED)}:${key}`).digest('hex');
  const pool = [...removedPool.entries()].sort((a, b) => (order(a[0]) < order(b[0]) ? -1 : 1));
  const picked = pool.slice(0, SAMPLE_N);
  const items = picked.map(([, r]) => {
    const style = perProject[r.projectId] !== undefined ? (readJson<EvaluationReport>(path.join(runs, r.set, 'none', `${r.projectId.slice(r.set.length + 1)}.json`)).tiers?.style ?? '') : '';
    const f = findingsOfReport({ violations: [r.violation] }, { projectId: r.projectId }, style)[0];
    if (f === undefined) throw new Error(`no finding for ${r.projectId} ${r.violation.id}`);
    return { ...f, rule: ruleOf(f), inclusionProbability: SAMPLE_N / pool.length, removedBy: r.options, reasons: r.reasons };
  });
  const sample = { schemaVersion: 1, seed: SEED, cap: SAMPLE_N, tiers: 'all', excludedNotApplicable: {}, rules: [], poolSize: pool.length, items };
  fs.writeFileSync(path.join(outDir, 'sample.json'), `${JSON.stringify(sample, null, 1)}\n`);
  fs.writeFileSync(path.join(outDir, 'jobs.local.json'), `${JSON.stringify({ schemaVersion: 1, kind: 'custom', jobs }, null, 1)}\n`);

  const measure = { schemaVersion: 1, seed: SEED, sets: SETS, inSample: IN_SAMPLE, aggregate: agg, perProject, removedPoolSize: pool.length };
  fs.writeFileSync(path.join(outDir, 'measure.json'), `${JSON.stringify(measure, null, 1)}\n`);

  // Markdown summary.
  const md: string[] = ['# Advisory post-filters out of sample: measurement', '', 'Generated by `scripts/v1.3/advisory-filter-oos.ts`. Exploratory; external (#133) and wild (#114) sets.', ''];
  md.push('| Set | In-sample dev | In-sample E1 | External removal (Wilson 95%) | External per-repo range | Wild removal (Wilson 95%) | Wild per-repo range | Blocking identical ext / wild | Live = offline (ext) |', '|---|---|---|---|---|---|---|---|---|');
  for (const s of SETS) {
    const i = IN_SAMPLE[s.name];
    const x = agg.ext?.[s.name] as { removal: ReturnType<typeof ci>; perProjectRange: number[] | null; blockingIdenticalAll: boolean; liveChecked: number; liveMatchesAll: boolean };
    const w = agg.wild?.[s.name] as typeof x;
    const rng = (r: number[] | null): string => (r === null ? '-' : `${r[0]?.toFixed(2) ?? ''}–${r[1]?.toFixed(2) ?? ''}`);
    const ins = (p: [number, number] | undefined): string => (p === undefined ? '-' : `${((p[0] - p[1]) / p[0]).toFixed(2)} (${String(p[0])} → ${String(p[1])})`);
    md.push(`| \`${s.name}\` | ${ins(i?.dev)} | ${ins(i?.e1)} | ${fmt(x.removal)} | ${rng(x.perProjectRange)} | ${fmt(w.removal)} | ${rng(w.perProjectRange)} | ${x.blockingIdenticalAll ? 'yes' : 'NO'} / ${w.blockingIdenticalAll ? 'yes' : 'NO'} | ${x.liveMatchesAll ? 'yes' : 'NO'} (${String(x.liveChecked)} repos) |`);
  }
  md.push('', '## Per rule (removed / advisory rows of the rule)', '', `| Set | Data | ${FILTER_RULES.join(' | ')} |`, `|---|---|${FILTER_RULES.map(() => '---').join('|')}|`);
  for (const s of SETS) for (const set of ['ext', 'wild']) {
    const br = (agg[set]?.[s.name] as { byRule: Record<string, ReturnType<typeof ci>> }).byRule;
    md.push(`| \`${s.name}\` | ${set} | ${FILTER_RULES.map((r) => (br[r]?.n === 0 ? '-' : `${String(br[r]?.k)}/${String(br[r]?.n)}`)).join(' | ')} |`);
  }
  md.push('', '## Per repository (advisory rows; removed by `proposed` / `proposed+rollup`)', '', '| Repository | Status | Blocking rows | Advisory rows | proposed | proposed+rollup |', '|---|---|---|---|---|---|');
  for (const [pid, p] of Object.entries(perProject)) md.push(`| ${pid} | ${p.status} | ${String(p.blocking)} | ${String(p.advisory)} | ${String(p.cells.proposed?.removed ?? '-')} | ${String(p.cells['proposed+rollup']?.removed ?? '-')} |`);
  md.push('', `## Sample of removed rows (seed ${String(SEED)}, ${String(items.length)} of ${String(pool.length)})`, '', '| # | Repository | Rule | File | Removed by | Reason (first) |', '|---|---|---|---|---|---|');
  items.forEach((it, n) => md.push(`| ${String(n + 1)} | ${it.projectId} | ${it.ruleId} | \`${it.file}\` | ${it.removedBy.join(', ')} | ${(it.reasons[0] ?? '').replace(/\|/g, '/')} |`));
  fs.writeFileSync(path.join(outDir, 'measure.md'), `${md.join('\n')}\n`);
  process.stdout.write(`${md.slice(0, 12).join('\n')}\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 1;
});
