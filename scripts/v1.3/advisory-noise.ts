/**
 * Advisory-noise measurement (v1.3, development set and E1; descriptive, not a registered result).
 * Entry file: no exports. Offline: no Neo4j, no model call. Every number comes from stored findings plus the source the
 * filters read.
 *
 * Inputs
 *   dev set   results/v1.3-reference/after-member-facts/evidence/<style>/<variant>.json (v1.3 defaults, member facts on);
 *             each variant is materialised from tests/fixtures/v1.3-reference so the filters can read its source.
 *   E1        results/v1.3-labelling/e1/reports/*.json (the 65 accepted Study 1 cells re-evaluated under v1.3). The cell
 *             trees are not in the repository; their source is recovered from the prompts of the Study 1 judge
 *             cassettes (experiments/e1-grid/cassettes, `=====SOURCE-BEGIN <file>=====` blocks), and file existence
 *             from the same prompts' unit lists and graph excerpts. Rows whose file was never shown to the judge keep
 *             "unknown" and are never suppressed by a source-reading option.
 *   judge     results/v1.3-advisory-noise/fe-advisory-rows.json: the non-blocking rows of the judge v2 filter-and-explain
 *             run (PR #126), copied with the source commit and sha256.
 *   labels    results/v1.3-labelling/{reference,e1}/correctness-all/correctness.csv (deterministic correctness).
 *
 * Output: results/v1.3-advisory-noise/measure.json and measure.md.
 *
 * Usage (repository root): npx tsx scripts/v1.3/advisory-noise.ts [--work <dir>]
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  ADVISORY_FILTER_DESCRIPTIONS, ADVISORY_FILTER_OPTIONS, applyAdvisoryFilter, advisoryTierOf, fsProjectView, layerLookup, specParams,
} from '../../src/advisory-filter/index.js';
import type { AdvisoryFilterOption, ProjectView } from '../../src/advisory-filter/index.js';
import { parseSpec } from '../../src/spec-parser/index.js';
import { ruleTier } from '../../src/scoring-engine/rule-tiers.js';
import { wilson } from '../lib/stats.js';
import { loadAllReferences } from './lib/reference-model.js';
import { materialiseVariant } from './lib/materialise.js';

const REPO = process.cwd();
const DEV = 'results/v1.3-reference/after-member-facts/evidence';
const E1_REPORTS = 'results/v1.3-labelling/e1/reports';
const E1_SIZES = 'results/v1.3-study1-rerun/e1/reports';
const E1_CASSETTES = 'experiments/e1-grid/cassettes';
const E1_SPEC = 'specs/clean-arch.yaml';
const E1_STYLE = 'clean-architecture';
const FE = 'results/v1.3-advisory-noise/fe-advisory-rows.json';
const LABELS = { dev: 'results/v1.3-labelling/reference/correctness-all/correctness.csv', e1: 'results/v1.3-labelling/e1/correctness-all/correctness.csv' };
const OUT = 'results/v1.3-advisory-noise';

/** The option sets measured besides each option alone. */
const COMBOS: Readonly<Record<string, readonly AdvisoryFilterOption[]>> = {
  'no-logic+composition-roots': ['cv05-no-logic', 'composition-roots'],
  'proposed': ['cv05-no-logic', 'composition-roots', 'c03-core-only', 'c02-abstract-imports', 'c04-entry-points', 'so-framework-members'],
  'proposed+rollup': ['cv05-no-logic', 'composition-roots', 'c03-core-only', 'c02-abstract-imports', 'c04-entry-points', 'so-framework-members', 'cv05-rollup'],
  'all': [...ADVISORY_FILTER_OPTIONS],
};

interface Row { functionId: string; filePath: string; evidence?: string[]; discriminator?: string[]; [k: string]: unknown }
interface Project { id: string; set: 'dev' | 'e1'; style: string; rows: Row[]; view: ProjectView; known: (file: string) => boolean }
interface FeRow { rowId: string; functionId: string; file: string; label: string; decision: string; explanation: string; promptSha: string }

const readJson = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(REPO, f), 'utf8')) as T;
const pct = (k: number, n: number): string => (n === 0 ? '-' : `${(100 * k / n).toFixed(1)}%`);
const ci = (k: number, n: number): string => {
  if (n === 0) return '-';
  const w = wilson(k, n);
  return `${String(k)}/${String(n)} = ${(k / n).toFixed(2)} [${w.low.toFixed(2)}, ${w.high.toFixed(2)}]`;
};
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

// ── dev set ──────────────────────────────────────────────────────────────────────────────────────────────────────

async function loadDev(work: string): Promise<Project[]> {
  const out: Project[] = [];
  for (const ref of loadAllReferences(REPO)) {
    const parsed = await parseSpec({ specFilePath: ref.specPath });
    if (!parsed.success) throw new Error(`${ref.specPath}: ${parsed.errors[0]?.message ?? 'spec'}`);
    for (const v of ref.variants) {
      const evFile = path.join(DEV, ref.style, `${v.manifest.variant}.json`);
      if (!fs.existsSync(path.join(REPO, evFile))) continue;
      const mat = materialiseVariant(ref, v, work);
      const view = fsProjectView({ projectDir: mat.projectDir, layerModel: parsed.data.layerModel, functions: parsed.data.fitnessFunctions });
      out.push({
        id: `${ref.style}/${v.manifest.variant}`, set: 'dev', style: ref.style,
        rows: readJson<{ violations: Row[] }>(evFile).violations, view, known: (f) => view.readSource(f) !== undefined,
      });
    }
  }
  return out;
}

// ── E1 ───────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Recovered { sources: Map<string, string>; files: Set<string>; conflicts: number }

/** Source and file names of every E1 cell, from the Study 1 judge cassette prompts. */
function recoverE1(): Map<string, Recovered> {
  const byProject = new Map<string, Recovered>();
  const root = path.join(REPO, E1_CASSETTES);
  for (const dir of fs.readdirSync(root)) {
    for (const f of fs.readdirSync(path.join(root, dir))) {
      const c = JSON.parse(fs.readFileSync(path.join(root, dir, f), 'utf8')) as { projectId?: string; prompt?: string };
      if (c.projectId === undefined || c.prompt === undefined) continue;
      let rec = byProject.get(c.projectId);
      if (rec === undefined) { rec = { sources: new Map(), files: new Set(), conflicts: 0 }; byProject.set(c.projectId, rec); }
      for (const m of c.prompt.matchAll(/=====SOURCE-BEGIN (.+?)=====\n([\s\S]*?)\n=====SOURCE-END=====/g)) {
        const file = m[1] ?? '';
        const text = m[2] ?? '';
        const prior = rec.sources.get(file);
        if (prior !== undefined && prior !== text) rec.conflicts += 1;
        if (prior === undefined) rec.sources.set(file, text);
        rec.files.add(file);
      }
      const excerpt = /## Graph excerpt\n(\{.*\})\n/.exec(c.prompt)?.[1];
      if (excerpt !== undefined) {
        try {
          const g = JSON.parse(excerpt) as { nodes?: { kind?: string; path?: string }[] };
          for (const n of g.nodes ?? []) if (n.kind === 'File' && typeof n.path === 'string') rec.files.add(n.path);
        } catch { /* a truncated excerpt adds no file */ }
      }
      for (const m of c.prompt.matchAll(/^- (src\/\S+\.tsx?)$/gm)) rec.files.add(m[1] ?? '');
    }
  }
  return byProject;
}

async function loadE1(): Promise<{ projects: Project[]; coverage: { rows: number; withSource: number; conflicts: number } }> {
  const parsed = await parseSpec({ specFilePath: path.join(REPO, E1_SPEC) });
  if (!parsed.success) throw new Error(`${E1_SPEC}: ${parsed.errors[0]?.message ?? 'spec'}`);
  const recovered = recoverE1();
  const layerOf = layerLookup(parsed.data.layerModel);
  const param = specParams(parsed.data.fitnessFunctions);
  const projects: Project[] = [];
  let rows = 0;
  let withSource = 0;
  let conflicts = 0;
  for (const f of fs.readdirSync(path.join(REPO, E1_REPORTS)).filter((n) => n.endsWith('.json')).sort()) {
    const report = readJson<{ violations: Row[] }>(path.join(E1_REPORTS, f));
    const projectId = f.replace(/\.json$/, '').replace(/_/g, '/');
    const rec = recovered.get(projectId) ?? { sources: new Map<string, string>(), files: new Set<string>(), conflicts: 0 };
    conflicts += rec.conflicts;
    const sizeFile = fs.readdirSync(path.join(REPO, E1_SIZES)).find((n) => n.endsWith(`${f.replace(/\.json$/, '')}.size.json`));
    const fileCount = sizeFile !== undefined ? readJson<{ files: number }>(path.join(E1_SIZES, sizeFile)).files : undefined;
    const view: ProjectView = {
      readSource: (file) => rec.sources.get(file),
      exists: (file) => rec.files.has(file) || rec.sources.has(file),
      layerOf,
      ...(fileCount !== undefined ? { fileCount } : {}),
      param,
      entryPoints: [],
    };
    for (const r of report.violations) {
      if (ruleTier(r.functionId, E1_STYLE).tier !== 'advisory') continue;
      rows += 1;
      if (rec.sources.has(r.filePath)) withSource += 1;
    }
    projects.push({ id: projectId, set: 'e1', style: E1_STYLE, rows: report.violations, view, known: (file) => rec.sources.has(file) });
  }
  return { projects, coverage: { rows, withSource, conflicts } };
}

// ── labels ───────────────────────────────────────────────────────────────────────────────────────────────────────

function correctness(file: string): Map<string, { n: number; correct: number; incorrect: number; notCheckable: number }> {
  const out = new Map<string, { n: number; correct: number; incorrect: number; notCheckable: number }>();
  const lines = fs.readFileSync(path.join(REPO, file), 'utf8').trim().split('\n').slice(1);
  for (const line of lines) {
    const cols = line.split(',');
    const rule = (cols[2] ?? '').split('/')[0] ?? '';
    const verdict = cols[5] ?? '';
    const e = out.get(rule) ?? { n: 0, correct: 0, incorrect: 0, notCheckable: 0 };
    e.n += 1;
    if (verdict === 'correct') e.correct += 1; else if (verdict === 'incorrect') e.incorrect += 1; else e.notCheckable += 1;
    out.set(rule, e);
  }
  return out;
}

// ── dismissal clusters ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Keyword clusters of the judge's dismissal explanations. The role clusters read only the opening (the first 300
 * characters, where the judge says what the file is): a use-case explanation that mentions "the composition root wires
 * it" later is an orchestrator, not a composition root. The content clusters read the whole text. First match wins.
 */
const CLUSTERS: readonly { id: string; label: string; rx: RegExp; opening: boolean }[] = [
  { id: 'composition-root', label: 'composition root / wiring module (instability 1 and high fan-out are expected)', opening: true,
    rx: /composition root|wiring point|only job is wiring/i },
  { id: 'outer-adapter', label: 'outer-layer adapter or controller (instability is expected)', opening: true,
    rx: /controller|inbound (?:HTTP )?adapter|HTTP adapter|outermost/i },
  { id: 'orchestrator', label: 'use-case / application service orchestrating stable abstractions', opening: true,
    rx: /use[- ]case|orchestrat|application[- ]layer|application service|Service Layer|transaction script/i },
  { id: 'no-logic', label: 'nothing worth a dedicated test (types, error subclass, in-memory pass-through)', opening: false,
    rx: /type definitions|no logic|nothing to run|pass(?:es)? straight|pass-through|does not carry the risk|subclass/i },
  { id: 'naming', label: 'the name fits the role (naming rule over-reads)', opening: false,
    rx: /naming|no repository term|Repository suffix|Repository names/i },
  { id: 'abstractions', label: 'collaborators are already abstractions', opening: false,
    rx: /domain-defined|abstractions/i },
];

const CLUSTER_LABELS: Readonly<Record<string, string>> = Object.fromEntries(CLUSTERS.map((c) => [c.id, c.label]));

function clusterOf(explanation: string): string {
  return CLUSTERS.find((c) => c.rx.test(c.opening ? explanation.slice(0, 300) : explanation))?.id ?? 'other';
}

// ── measurement ──────────────────────────────────────────────────────────────────────────────────────────────────

interface OptionResult {
  option: string;
  options: readonly AdvisoryFilterOption[];
  dev: { before: number; after: number; byRule: Record<string, [number, number]>; blockingIdentical: boolean };
  e1: { before: number; after: number; byRule: Record<string, [number, number]>; blockingIdentical: boolean };
  fe: {
    dismissed: number; dismissedRemoved: number; confirmed: number; confirmedRemoved: number;
    unscoredDismissed: number; unscoredDismissedRemoved: number; unscoredConfirmed: number; unscoredConfirmedRemoved: number;
    manifestTrue: number; manifestTrueRemoved: number;
    confirmedRemovedRows: { rowId: string; functionId: string; file: string; reason: string }[];
    /** Judge-dismissed rows the option keeps, grouped by rule and file. */
    dismissedKept: Record<string, number>;
  };
  reasons: Record<string, number>;
  /** E1 rows this option removes, a seeded sample for the author to audit (E1 has no judge labels). */
  e1Sample: { project: string; functionId: string; file: string; reason: string }[];
}

const SAMPLE_SEED = 'daedalus-v1.3-advisory-noise-20261016';
const SAMPLE_SIZE = 12;

function blockingKey(p: Project, rows: readonly Row[]): string {
  const tierOf = advisoryTierOf(p.style, undefined);
  return JSON.stringify(rows.filter((r) => tierOf(r) === 'blocking'));
}

function measure(name: string, options: readonly AdvisoryFilterOption[], projects: readonly Project[], fe: readonly FeRow[]): OptionResult {
  const res: OptionResult = {
    option: name, options,
    dev: { before: 0, after: 0, byRule: {}, blockingIdentical: true },
    e1: { before: 0, after: 0, byRule: {}, blockingIdentical: true },
    fe: {
      dismissed: 0, dismissedRemoved: 0, confirmed: 0, confirmedRemoved: 0,
      unscoredDismissed: 0, unscoredDismissedRemoved: 0, unscoredConfirmed: 0, unscoredConfirmedRemoved: 0,
      manifestTrue: 0, manifestTrueRemoved: 0, confirmedRemovedRows: [], dismissedKept: {},
    },
    reasons: {},
    e1Sample: [],
  };
  const e1Removed: { key: string; project: string; functionId: string; file: string; reason: string }[] = [];
  const removedRowIds = new Map<string, string>();
  for (const p of projects) {
    const tierOf = advisoryTierOf(p.style, undefined);
    const { kept, suppressed } = applyAdvisoryFilter(p.rows, options, tierOf, p.view);
    const bucket = p.set === 'dev' ? res.dev : res.e1;
    if (blockingKey(p, p.rows) !== blockingKey(p, kept)) bucket.blockingIdentical = false;
    for (const r of p.rows) {
      if (tierOf(r) !== 'advisory') continue;
      bucket.before += 1;
      const e = bucket.byRule[r.functionId] ?? [0, 0];
      e[0] += 1;
      bucket.byRule[r.functionId] = e;
    }
    for (const r of kept) {
      if (tierOf(r) !== 'advisory') continue;
      bucket.after += 1;
      const e = bucket.byRule[r.functionId] ?? [0, 0];
      e[1] += 1;
      bucket.byRule[r.functionId] = e;
    }
    for (const s of suppressed) {
      const key = `${s.option}: ${s.reason.replace(/\d+/g, 'N')}`;
      res.reasons[key] = (res.reasons[key] ?? 0) + 1;
      if (p.set === 'dev') removedRowIds.set(`${p.id}#${String(p.rows.indexOf(s.finding))}`, `${s.option}: ${s.reason}`);
      else {
        const key = createHash('sha256').update(`${SAMPLE_SEED}|${p.id}|${s.finding.functionId}|${s.finding.filePath}`).digest('hex');
        e1Removed.push({ key, project: p.id, functionId: s.finding.functionId, file: s.finding.filePath, reason: `${s.option}: ${s.reason}` });
      }
    }
  }
  res.e1Sample = e1Removed.sort((a, b) => a.key.localeCompare(b.key)).slice(0, SAMPLE_SIZE)
    .map(({ key: _k, ...rest }) => rest);
  for (const r of fe) {
    const removed = removedRowIds.get(r.rowId);
    const isRemoved = removed !== undefined;
    if (r.decision === 'dismiss') {
      res.fe.dismissed += 1;
      if (isRemoved) res.fe.dismissedRemoved += 1;
      else res.fe.dismissedKept[`${r.functionId} ${r.file}`] = (res.fe.dismissedKept[`${r.functionId} ${r.file}`] ?? 0) + 1;
      if (r.label === 'unscored') { res.fe.unscoredDismissed += 1; if (isRemoved) res.fe.unscoredDismissedRemoved += 1; }
    } else if (r.decision === 'confirm') {
      res.fe.confirmed += 1;
      if (r.label === 'unscored') { res.fe.unscoredConfirmed += 1; if (isRemoved) res.fe.unscoredConfirmedRemoved += 1; }
      if (isRemoved) {
        res.fe.confirmedRemoved += 1;
        res.fe.confirmedRemovedRows.push({ rowId: r.rowId, functionId: r.functionId, file: r.file, reason: removed });
      }
    }
    if (r.label === 'true') { res.fe.manifestTrue += 1; if (isRemoved) res.fe.manifestTrueRemoved += 1; }
  }
  return res;
}

// ── report ───────────────────────────────────────────────────────────────────────────────────────────────────────

const ADVISORY_RULE_ORDER = ['FF-CV05', 'FF-C03', 'FF-P02', 'FF-C02', 'FF-C06', 'FF-CV03', 'FF-C01', 'FF-C04', 'FF-SO01', 'FF-SO02', 'FF-P04', 'FF-DT05', 'FF-DT06', 'FF-S03'];

async function main(): Promise<number> {
  const work = path.resolve(arg('--work') ?? fs.mkdtempSync(path.join(os.tmpdir(), 'advisory-noise-')));
  const dev = await loadDev(work);
  const { projects: e1, coverage } = await loadE1();
  const projects = [...dev, ...e1];
  const feAll = readJson<{ source: unknown; rows: FeRow[] }>(FE);
  const styleOfRow = (rowId: string): string => rowId.split('/')[0] ?? '';
  // Advisory under the sealed tier table for the row's style (FF-S03 is blocking for layered; the FE run's own tier
  // column called those rows "advisory (unscored)").
  const fe = feAll.rows.filter((r) => ruleTier(r.functionId, styleOfRow(r.rowId)).tier === 'advisory');

  // 1. the noise table
  const labelsDev = correctness(LABELS.dev);
  const labelsE1 = correctness(LABELS.e1);
  const base = measure('none', [], projects, fe);
  const ruleIds = [...new Set([...Object.keys(base.dev.byRule), ...Object.keys(base.e1.byRule)])]
    .sort((a, b) => (ADVISORY_RULE_ORDER.indexOf(a) + 1 || 99) - (ADVISORY_RULE_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
  const totalAdvisory = base.dev.before + base.e1.before;
  const noise = ruleIds.map((rule) => {
    const rows = fe.filter((r) => r.functionId === rule);
    const dismissed = rows.filter((r) => r.decision === 'dismiss');
    const prompts = new Map<string, FeRow>();
    for (const r of dismissed) prompts.set(r.promptSha, r);
    const clusters: Record<string, { rows: number; prompts: number; example: string }> = {};
    for (const r of dismissed) {
      const c = clusterOf(r.explanation);
      const e = clusters[c] ?? { rows: 0, prompts: 0, example: '' };
      e.rows += 1;
      clusters[c] = e;
    }
    for (const r of prompts.values()) {
      const c = clusterOf(r.explanation);
      const e = clusters[c];
      if (e !== undefined) { e.prompts += 1; if (e.example === '') e.example = `${r.file}: ${r.explanation.slice(0, 160).replace(/\s+/g, ' ')}…`; }
    }
    const dev = base.dev.byRule[rule]?.[0] ?? 0;
    const e1n = base.e1.byRule[rule]?.[0] ?? 0;
    return {
      rule, dev, e1: e1n, shareOfAdvisory: (dev + e1n) / totalAdvisory,
      judged: rows.length, judgedPrompts: new Set(rows.map((r) => r.promptSha)).size,
      dismissed: dismissed.length, confirmed: rows.filter((r) => r.decision === 'confirm').length,
      manifestTrue: rows.filter((r) => r.label === 'true').length,
      correctnessDev: labelsDev.get(rule) ?? null, correctnessE1: labelsE1.get(rule) ?? null,
      clusters,
    };
  });

  // 2. the options
  const results: OptionResult[] = [];
  for (const o of ADVISORY_FILTER_OPTIONS) results.push(measure(o, [o], projects, fe));
  for (const [name, set] of Object.entries(COMBOS)) results.push(measure(name, set, projects, fe));

  const out = {
    note: 'Descriptive, development set and E1, offline. Not a registered result. See Docs/DiagnosticRuns/v1.3-advisory-noise-2026-10-16.md.',
    inputs: { dev: DEV, e1: E1_REPORTS, e1Source: E1_CASSETTES, fe: FE, feSource: feAll.source, labels: LABELS },
    e1SourceCoverage: coverage,
    devProjects: dev.length, e1Projects: e1.length,
    feAdvisoryRows: fe.length,
    clusterLabels: CLUSTER_LABELS,
    noise, results,
  };
  fs.mkdirSync(path.join(REPO, OUT), { recursive: true });
  fs.writeFileSync(path.join(REPO, OUT, 'measure.json'), `${JSON.stringify(out, null, 2)}\n`);

  const md: string[] = [];
  md.push('# Advisory-noise measurement (generated by scripts/v1.3/advisory-noise.ts)', '');
  md.push(`Dev set: ${String(dev.length)} variants. E1: ${String(e1.length)} cells; source recovered for ${ci(coverage.withSource, coverage.rows)} advisory rows (${String(coverage.conflicts)} conflicting copies). Judge rows (advisory under rule-tiers): ${String(fe.length)}.`, '');
  md.push('## Noise per advisory rule', '');
  md.push('| Rule | Dev rows | E1 rows | Share of all advisory | Judge rows (prompts) | Dismissed | Dismiss rate | Correct (dev / E1) | Dismissal clusters (rows / prompts) |');
  md.push('|---|---|---|---|---|---|---|---|---|');
  for (const n of noise) {
    const corr = (c: typeof n.correctnessDev): string => (c === null ? '-' : c.correct + c.incorrect > 0 ? `${String(c.correct)}/${String(c.correct + c.incorrect)}` : `n/c ${String(c.notCheckable)}`);
    const cl = Object.entries(n.clusters).sort((a, b) => b[1].rows - a[1].rows).map(([k, v]) => `${k} ${String(v.rows)}/${String(v.prompts)}`).join('; ');
    md.push(`| ${n.rule} | ${String(n.dev)} | ${String(n.e1)} | ${pct(n.dev + n.e1, totalAdvisory)} | ${String(n.judged)} (${String(n.judgedPrompts)}) | ${String(n.dismissed)} | ${n.judged > 0 ? ci(n.dismissed, n.judged) : '-'} | ${corr(n.correctnessDev)} / ${corr(n.correctnessE1)} | ${cl || '-'} |`);
  }
  md.push('', '## Options', '');
  md.push('| Option | Dev advisory before → after | E1 advisory before → after | Blocking identical (dev / E1) | Judge-dismissed removed | Judge-confirmed removed | Manifest-true removed |');
  md.push('|---|---|---|---|---|---|---|');
  for (const r of results) {
    md.push(`| ${r.option} | ${String(r.dev.before)} → ${String(r.dev.after)} (−${pct(r.dev.before - r.dev.after, r.dev.before)}) | ${String(r.e1.before)} → ${String(r.e1.after)} (−${pct(r.e1.before - r.e1.after, r.e1.before)}) | ${r.dev.blockingIdentical ? 'yes' : 'NO'} / ${r.e1.blockingIdentical ? 'yes' : 'NO'} | ${ci(r.fe.dismissedRemoved, r.fe.dismissed)} | ${ci(r.fe.confirmedRemoved, r.fe.confirmed)} | ${String(r.fe.manifestTrueRemoved)}/${String(r.fe.manifestTrue)} |`);
  }
  md.push('', '## Per rule, before → after (dev | E1)', '');
  md.push(`| Option | ${ruleIds.join(' | ')} |`);
  md.push(`|---|${ruleIds.map(() => '---').join('|')}|`);
  for (const r of results) {
    md.push(`| ${r.option} | ${ruleIds.map((id) => {
      const d = r.dev.byRule[id] ?? [0, 0];
      const e = r.e1.byRule[id] ?? [0, 0];
      return d[0] === d[1] && e[0] === e[1] ? '=' : `${String(d[0])}→${String(d[1])} \\| ${String(e[0])}→${String(e[1])}`;
    }).join(' | ')} |`);
  }
  md.push('', '## Judge-confirmed rows an option removes', '');
  for (const r of results) {
    if (r.fe.confirmedRemovedRows.length === 0) continue;
    md.push(`- **${r.option}**:`);
    for (const x of r.fe.confirmedRemovedRows) md.push(`  - ${x.rowId} ${x.functionId} ${x.file} (${x.reason})`);
  }
  md.push('', '## Judge-dismissed rows the option sets keep', '');
  for (const r of results.filter((x) => x.options.length > 1)) {
    md.push(`- **${r.option}**: ${Object.entries(r.fe.dismissedKept).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${String(v)}`).join('; ')}`);
  }
  md.push('', `## E1 audit sample (${String(SAMPLE_SIZE)} removed rows per single option, sha256 order, seed ${SAMPLE_SEED})`, '');
  for (const r of results.filter((x) => x.options.length === 1 && x.e1Sample.length > 0)) {
    md.push(`- **${r.option}**:`);
    for (const x of r.e1Sample) md.push(`  - ${x.project} ${x.functionId} ${x.file} (${x.reason})`);
  }
  md.push('', '## Suppression reasons (all projects)', '');
  for (const r of results.filter((x) => x.options.length === 1)) {
    md.push(`- **${r.option}** (${ADVISORY_FILTER_DESCRIPTIONS[r.options[0] as AdvisoryFilterOption]}):`);
    for (const [k, v] of Object.entries(r.reasons).sort((a, b) => b[1] - a[1])) md.push(`  - ${String(v)} × ${k}`);
  }
  fs.writeFileSync(path.join(REPO, OUT, 'measure.md'), `${md.join('\n')}\n`);
  process.stdout.write(`${md.join('\n')}\n`);
  return 0;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 1;
});
