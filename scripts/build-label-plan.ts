/**
 * Label-plan producer (ADR-021 SO3-2, SO4-02, SO3-3, items 6 and 8; FR-27; BR-U5b-33..36, 38, 63).
 *
 * Builds, from stored outputs only, the input of `llm-label`:
 *
 * - **P1** (exhaustive): the FP-strict and twin-FP items of the SO4 score (`score-golden --label-items`), each read
 *   from its seeded copy at the new violation's line;
 * - **missed seeds**: the score's `missed` instances run through the mechanical FN rules of `Docs/matching-rule.md`
 *   §7 (`classifyMissedSeeds`); a cause becomes a row of `fn-causes.json`, an unexplained seed an MS item;
 * - **P2** corpus baseline violations (accepted non-seeded, non-E1 runs of `--corpus-runs`), **P3** E1
 *   generated-project violations (accepted E1 runs with `generationStatus = 'ok'`), **P4** judge units of run index 0
 *   of every valid E1 cell and of the fixtures (`p4SourceOf`): sampled to the registered sizes of
 *   `corpus/label-plan-config.json` (`label-plan.ts`), with inclusion probabilities;
 * - **judge verdicts** of the P4 units (`judge-verdicts.json`, with `source` and `generatorModel`), the
 *   `--judge-verdicts` input of the agreement step (SO3-3);
 * - a **summary**: counts, calls, the ceilings that the budget lowered, the precision the sizes allow, the context
 *   size per item and the weeks of quota (ADR-021 item 6).
 *
 * Contexts follow BR-U5b-35: the source tree (the report's `projectPath`, or the seeded copy) and the item's own
 * fields. P4 contexts need no graph: the labeller context uses the unit source and the rubric, never the APG
 * excerpt, so no project is re-extracted (ADR-010) and no database is touched. Every context is cut at the registered
 * ceiling. The within-stratum draw uses the `sampling` seed of the plan that produced the run; the stratum draw,
 * run 1's permutations and the agreement bootstrap use the label plan's own registered seeds.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CYPHER_TEMPLATES } from '../src/fitness-compiler/cypher-templates.js';
import type { JudgeGraphView } from '../src/llm-critic/judge-graph.js';
import { judgeVerdictsFromRuns, p4SourceOf } from './lib/judge-verdicts.js';
import type { JudgeUnitVerdict } from './lib/judge-verdicts.js';
import {
  POPULATION_CAPS, RUNS_PER_ITEM, SAMPLED_POPULATIONS, buildItems, candidateItemId, candidateStratum, classifyMissedSeeds,
  judgeUnitCandidates, p1Candidate, sampleCandidates, violationCandidates,
} from './lib/label-context.js';
import type { Candidate, FnCause, ItemKind, LabelItem, MissedSeedEvidence, SampledPopulation, StratumSample } from './lib/label-context.js';
import {
  ITEM_KINDS, LABEL_PLAN_CONFIG_FILE, LABEL_PLAN_CONFIG_INVALID, ceilingsFor, checkLabelPlanConfig, estimateTokens, precisionStatement,
  sampleRegistered, thinExhaustive, trimContext, weeksNeeded,
} from './lib/label-plan.js';
import type { LabelPlanConfig, PrecisionStatement } from './lib/label-plan.js';
import { loadBases } from './lib/base-measure-main.js';
import { loadManifest } from './lib/manifest.js';
import type { ManifestRow } from './lib/manifest.js';
import { loadCompiledSpec } from './lib/mutation/expected.js';
import type { CompiledSpec } from './lib/mutation/expected.js';
import { FIXTURE_SPECS } from './lib/prereg.js';
import { loadRunDir } from './lib/report-io.js';
import type { RunRecord } from './lib/report-io.js';
import type { LabelPlanFile, LabelPlanStratum } from './llm-label.js';
import type { LabelItemsFile } from './score-golden.js';

export const LABEL_PLAN_INPUT_INVALID = 'LABEL_PLAN_INPUT_INVALID';
const NO_DESCRIPTION = '(no template description)';
const EMPTY_VIEW: JudgeGraphView = { files: [], classes: [], interfaces: [], edges: [] };

// ---------------------------------------------------------------------------------------------
// Inputs (already read; the core is pure apart from the source-tree reads of the context builder)

export type RunRole = 'corpus' | 'e1' | 'fixture';

export interface LoadedRun {
  readonly role: RunRole;
  readonly record: RunRecord;
  readonly report: unknown;
  /** Root of the evaluated tree (the report's `projectPath`, mapped). */
  readonly sourceRoot: string;
  /** `seeds.sampling` of the run's plan (within-stratum draws). */
  readonly samplingSeed: number;
  readonly describe: (functionId: string) => string;
}

export interface So4Inputs {
  readonly items: LabelItemsFile;
  readonly rows: ReadonlyMap<string, ManifestRow>;
  /** The seeded report of a seed (warnings and disabled functions for the FN rules). */
  readonly seededReport: (seedId: string) => unknown;
  /** Root of the seed's seeded copy (`<copies>/<projectId>/<operatorId>/k-<k>`). */
  readonly seededRoot: (seedId: string) => string;
  /** The prepared base's `tsconfigPath` (relative to the copy root). */
  readonly tsconfigPath: (projectId: string) => string | undefined;
  readonly describe: (specSha256: string) => ((functionId: string) => string) | undefined;
}

export interface BuildInput {
  readonly config: LabelPlanConfig;
  readonly so4?: So4Inputs;
  readonly runs: readonly LoadedRun[];
}

export interface PlanSummary {
  readonly items: Readonly<Record<'P1' | 'MS' | SampledPopulation, number>>;
  readonly mechanicalFnCauses: number;
  readonly calls: number;
  readonly reaskReserveCalls: number;
  /** The plan's budget: the registered one, or the escalated one (ADR-021 item 8.2). */
  readonly budgetCalls: number;
  readonly registeredBudgetCalls: number;
  readonly escalated: boolean;
  /** P1 + MS items found, and kept (fewer only past the escalation limit). */
  readonly exhaustive: { readonly found: number; readonly kept: number; readonly basis: string };
  readonly weeks: number;
  readonly ceilings: Readonly<Record<SampledPopulation, number>>;
  readonly lowered: readonly SampledPopulation[];
  readonly precision: readonly PrecisionStatement[];
  readonly context: {
    readonly maxChars: Readonly<Record<ItemKind, number>>;
    readonly meanChars: number;
    readonly estimatedTokensMean: number;
    readonly estimatedTokensMax: number;
    readonly cut: number;
    /** Items cut at the ceiling, per kind (ADR-021 item 8.6). */
    readonly cutByKind: Readonly<Record<ItemKind, number>>;
  };
  readonly judgeVerdicts: number;
  readonly detail?: string;
}

export type BuildResult =
  | { readonly ok: true; readonly plan: LabelPlanFile; readonly fnCauses: readonly FnCause[]; readonly judgeVerdicts: readonly JudgeUnitVerdict[]; readonly summary: PlanSummary }
  | { readonly ok: false; readonly code: string; readonly detail: string };

// ---------------------------------------------------------------------------------------------
// Candidates

/** Routed warnings and disabled function ids of a seeded report (the FN-rule evidence, BR-U5b-38). */
function evidenceOf(report: unknown): Pick<MissedSeedEvidence, 'warnings' | 'reportDisabled'> {
  const r = (report ?? {}) as { readonly warnings?: unknown; readonly disabledFunctions?: unknown };
  const warnings = (Array.isArray(r.warnings) ? (r.warnings as Record<string, unknown>[]) : []).flatMap((w) => (typeof w.code === 'string'
    ? [{ code: w.code, ...(typeof w.context === 'object' && w.context !== null && { context: w.context as Record<string, unknown> }) }]
    : []));
  const reportDisabled = (Array.isArray(r.disabledFunctions) ? (r.disabledFunctions as Record<string, unknown>[]) : [])
    .flatMap((d) => (typeof d.functionId === 'string' ? [d.functionId] : []));
  return { warnings, reportDisabled };
}

function so4Candidates(so4: So4Inputs): { ok: true; candidates: Candidate[]; causes: FnCause[] } | { ok: false; detail: string } {
  const candidates: Candidate[] = [];
  for (const item of so4.items.p1) {
    const row = so4.rows.get(item.seedId);
    if (row === undefined) return { ok: false, detail: `P1 item ${item.itemId}: seed ${item.seedId} is not in the manifest` };
    const describe = so4.describe(row.specSha256);
    if (describe === undefined) return { ok: false, detail: `P1 item ${item.itemId}: no spec with sha256 ${row.specSha256} in --specs` };
    const c = p1Candidate({
      itemKey: item.key, projectId: row.projectId, treeSha: row.baseTreeSha, sourceRoot: so4.seededRoot(item.seedId), describe,
      ...(item.line !== undefined && { line: item.line }),
    });
    if (candidateItemId(c) !== item.itemId) return { ok: false, detail: `P1 item ${item.itemId}: the rebuilt item id differs (${candidateItemId(c)})` };
    candidates.push(c);
  }
  const missed: MissedSeedEvidence[] = [];
  for (const seedId of so4.items.missed) {
    const row = so4.rows.get(seedId);
    if (row === undefined) return { ok: false, detail: `missed seed ${seedId} is not in the manifest` };
    const tsconfigPath = so4.tsconfigPath(row.projectId);
    if (tsconfigPath === undefined) return { ok: false, detail: `missed seed ${seedId}: no prepared base ${row.projectId} in --bases` };
    missed.push({ row, seededRoot: so4.seededRoot(seedId), tsconfigPath, ...evidenceOf(so4.seededReport(seedId)) });
  }
  // A missed seed's function is described from the spec of a missed row that compiles it (rows of one case may use
  // different specs); the first spec that has a template description wins.
  const describers = [...new Set(missed.map((m) => m.row.specSha256))].flatMap((sha) => {
    const d = so4.describe(sha);
    return d === undefined ? [] : [d];
  });
  const describeOf = (fid: string): string => describers.map((d) => d(fid)).find((t) => !t.includes(NO_DESCRIPTION)) ?? `${fid} ${NO_DESCRIPTION}`;
  const { causes, candidates: ms } = classifyMissedSeeds(missed, describeOf);
  return { ok: true, candidates: [...candidates, ...ms], causes };
}

/** P2 / P3 / P4 candidates of the loaded runs, and the sampling seed of each stratum's run. */
function runCandidates(runs: readonly LoadedRun[]): { candidates: Candidate[]; seedOf: Map<string, number> } {
  const candidates: Candidate[] = [];
  const seedOf = new Map<string, number>();
  const add = (cs: readonly Candidate[], seed: number): void => {
    for (const c of cs) {
      candidates.push(c);
      seedOf.set(`${c.population}\u0000${candidateStratum(c)}`, seed);
    }
  };
  for (const run of runs) {
    const r = run.record;
    if (r.status !== 'accepted') continue;
    const base = { projectId: r.projectId, treeSha: r.specSha, stratumOwner: r.projectId, sourceRoot: run.sourceRoot, runId: r.runId };
    if (run.role === 'corpus' && r.seed === undefined && r.cell === undefined) {
      add(violationCandidates(run.report, { ...base, population: 'P2', describe: run.describe }), run.samplingSeed);
    }
    if (run.role === 'e1' && r.cell?.generationStatus === 'ok') {
      add(violationCandidates(run.report, { ...base, population: 'P3', describe: run.describe }), run.samplingSeed);
    }
    if ((run.role === 'e1' || run.role === 'fixture') && p4SourceOf(r) !== null) {
      add(judgeUnitCandidates(run.report, { ...base, view: EMPTY_VIEW }), run.samplingSeed);
    }
  }
  return { candidates, seedOf };
}

// ---------------------------------------------------------------------------------------------
// Precision rows (ADR-021 item 8.3)

const weightOf = (i: LabelItem): number => 1 / Math.max(i.inclusionProbability, Number.EPSILON);

/**
 * The rows whose precision is stated before any run, each at its Kish effective n: the P4 E1 headline (the units of
 * E1 cells), the P4 fixtures, P4 per E1 generator model, P2 overall, and the P1 and MS censuses.
 */
export function precisionRows(items: readonly LabelItem[], runs: readonly LoadedRun[]): PrecisionStatement[] {
  const runOf = new Map(runs.map((r) => [r.record.runId, r]));
  const p4 = items.filter((i) => i.population === 'P4');
  const roleOf = (i: LabelItem): RunRole | undefined => (i.runId === undefined ? undefined : runOf.get(i.runId)?.role);
  const generatorOf = (i: LabelItem): string | undefined => (i.runId === undefined ? undefined : runOf.get(i.runId)?.record.cell?.requestedModelId);
  const e1 = p4.filter((i) => roleOf(i) === 'e1');
  const rows: PrecisionStatement[] = [
    precisionStatement('P4 judge-vs-panel agreement, E1 headline', e1.map(weightOf)),
    precisionStatement('P4 judge-vs-panel agreement, fixtures', p4.filter((i) => roleOf(i) === 'fixture').map(weightOf)),
  ];
  for (const g of [...new Set(e1.flatMap((i) => { const m = generatorOf(i); return m === undefined ? [] : [m]; }))].sort()) {
    rows.push(precisionStatement(`P4 judge-vs-panel agreement, generator ${g}`, e1.filter((i) => generatorOf(i) === g).map(weightOf)));
  }
  rows.push(
    precisionStatement('P2 baseline precision, overall', items.filter((i) => i.population === 'P2').map(weightOf)),
    precisionStatement('P1 FP-labelled share (census)', items.filter((i) => i.population === 'P1').map(weightOf)),
    precisionStatement('MS root-cause shares (census)', items.filter((i) => i.population === 'MS').map(weightOf)),
  );
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Core

const ORDER = ['P1', 'MS', 'P4', 'P2', 'P3'] as const;

export function buildLabelPlan(input: BuildInput): BuildResult {
  const errs = checkLabelPlanConfig(input.config);
  if (errs.length > 0) return { ok: false, code: LABEL_PLAN_CONFIG_INVALID, detail: `${LABEL_PLAN_CONFIG_INVALID}: ${errs.join('; ')}` };
  const config = input.config;
  let exhaustiveCandidates: Candidate[] = [];
  let causes: FnCause[] = [];
  if (input.so4 !== undefined) {
    const s = so4Candidates(input.so4);
    if (!s.ok) return { ok: false, code: LABEL_PLAN_INPUT_INVALID, detail: `${LABEL_PLAN_INPUT_INVALID}: ${s.detail}` };
    exhaustiveCandidates = s.candidates;
    causes = s.causes;
  }
  const exhaustive = sampleCandidates(exhaustiveCandidates, POPULATION_CAPS, 0);
  const exhaustiveItems = exhaustive.reduce((n, s) => n + s.sampled.length, 0);
  const { candidates, seedOf } = runCandidates(input.runs);
  const sizes = Object.fromEntries(SAMPLED_POPULATIONS.map((p) => {
    const counts = new Map<string, Set<string>>();
    for (const c of candidates.filter((x) => x.population === p)) {
      const k = candidateStratum(c);
      counts.set(k, (counts.get(k) ?? new Set<string>()).add(candidateItemId(c)));
    }
    return [p, [...counts.values()].map((v) => v.size)];
  })) as Record<SampledPopulation, number[]>;
  const ceilings = ceilingsFor(config, exhaustiveItems, sizes);
  // ADR-021 item 8.2: past the escalation limit the censuses are thinned, never refused.
  const sampled: (StratumSample & { stratumInclusionProbability?: number })[] = thinExhaustive(exhaustive, ceilings.exhaustiveKept, config.seeds.strata);
  for (const p of SAMPLED_POPULATIONS) {
    sampled.push(...sampleRegistered(candidates, p, config.sampled[p], ceilings.maxItems[p], config.seeds.strata, (stratum) => seedOf.get(`${p}\u0000${stratum}`) ?? 0));
  }
  const built = buildItems(sampled);
  if (!built.ok) return { ok: false, code: built.code, detail: built.detail };
  const cutByKind: Record<ItemKind, number> = { violation: 0, 'judge-unit': 0, 'missed-seed': 0 };
  const items: LabelItem[] = built.items.map((i) => {
    const t = trimContext(i.context, config.context.maxChars[i.kind]);
    if (t.cut) cutByKind[i.kind] += 1;
    return { ...i, context: t.text };
  });
  const rank = (i: LabelItem): number => ORDER.indexOf(i.population);
  items.sort((a, b) => rank(a) - rank(b) || (a.stratum < b.stratum ? -1 : a.stratum > b.stratum ? 1 : a.itemId < b.itemId ? -1 : 1));
  const strata: LabelPlanStratum[] = sampled
    .map((s) => ({
      population: s.population, stratum: s.stratum, size: s.size, cap: s.cap,
      ...(s.stratumInclusionProbability !== undefined && s.stratumInclusionProbability !== 1 && { stratumInclusionProbability: s.stratumInclusionProbability }),
    }))
    .sort((a, b) => ORDER.indexOf(a.population) - ORDER.indexOf(b.population) || (a.stratum < b.stratum ? -1 : 1));
  const plan: LabelPlanFile = {
    version: 1, permutationSeed: config.seeds.permutation, budgetCalls: ceilings.budgetCalls, strata, items,
    sizing: 'registered', reaskReserveCalls: config.reaskReserveCalls, bootstrapSeed: config.seeds.bootstrap,
    auditSeed: config.seeds.audit, provider: config.provider, model: config.model,
  };
  const p4Runs = input.runs.filter((r) => r.role === 'e1' || r.role === 'fixture');
  const judgeVerdicts = judgeVerdictsFromRuns(p4Runs.map((r) => r.record), new Map(p4Runs.map((r) => [r.record.runId, r.report])));
  const count = (p: (typeof ORDER)[number]): number => items.filter((i) => i.population === p).length;
  const chars = items.map((i) => i.context.length);
  const calls = items.length * RUNS_PER_ITEM;
  const summary: PlanSummary = {
    items: { P1: count('P1'), MS: count('MS'), P2: count('P2'), P3: count('P3'), P4: count('P4') },
    mechanicalFnCauses: causes.length, calls, reaskReserveCalls: config.reaskReserveCalls, budgetCalls: ceilings.budgetCalls,
    registeredBudgetCalls: config.budgetCalls, escalated: ceilings.escalated,
    exhaustive: { found: exhaustiveItems, kept: ceilings.exhaustiveKept, basis: config.exhaustivePlannedBasis },
    weeks: weeksNeeded(config, calls + config.reaskReserveCalls), ceilings: ceilings.maxItems, lowered: ceilings.lowered,
    precision: precisionRows(items, input.runs),
    context: {
      maxChars: config.context.maxChars,
      meanChars: chars.length === 0 ? 0 : chars.reduce((a, b) => a + b, 0) / chars.length,
      estimatedTokensMean: chars.length === 0 ? 0 : estimateTokens(chars.reduce((a, b) => a + b, 0) / chars.length),
      estimatedTokensMax: estimateTokens(Math.max(0, ...chars)),
      cut: ITEM_KINDS.reduce((n, k) => n + cutByKind[k], 0),
      cutByKind,
    },
    judgeVerdicts: judgeVerdicts.length,
    ...(ceilings.detail !== undefined && { detail: ceilings.detail }),
  };
  return { ok: true, plan, fnCauses: causes, judgeVerdicts, summary };
}

/** One line per summary fact, for the CLI. */
export function summaryLines(s: PlanSummary): string[] {
  const hw = (x: number | null): string => (x === null ? 'n_eff<10, counts only' : `+/-${x.toFixed(3)}`);
  return [
    `items: P1 ${String(s.items.P1)}, MS ${String(s.items.MS)}, P4 ${String(s.items.P4)}, P2 ${String(s.items.P2)}, P3 ${String(s.items.P3)}; mechanical FN causes ${String(s.mechanicalFnCauses)}`,
    `calls: ${String(s.calls)} + re-ask reserve ${String(s.reaskReserveCalls)} <= budget ${String(s.budgetCalls)}${s.escalated ? ` (escalated from ${String(s.registeredBudgetCalls)}, ADR-021 item 8.2)` : ''}; at least ${String(s.weeks)} week(s) of quota`,
    `P1 + MS: ${String(s.exhaustive.found)} found, ${String(s.exhaustive.kept)} kept`,
    `ceilings: P4 ${String(s.ceilings.P4)}, P2 ${String(s.ceilings.P2)}, P3 ${String(s.ceilings.P3)}${s.lowered.length === 0 ? '' : ` (lowered for the budget: ${s.lowered.join(', ')})`}`,
    ...s.precision.map((p) => `precision ${p.row}: n ${String(p.n)}, Kish n_eff ${p.nEff.toFixed(1)}, Wilson 95% half-width ${hw(p.halfWidthAt50)} at p=0.5, ${hw(p.halfWidthAt85)} at p=0.85`),
    `context: mean ${s.context.meanChars.toFixed(0)} chars (~${String(s.context.estimatedTokensMean)} tokens), max ~${String(s.context.estimatedTokensMax)} tokens; cut at the ceiling: ${ITEM_KINDS.map((k) => `${k} ${String(s.context.cutByKind[k])} (${String(s.context.maxChars[k])} chars)`).join(', ')}`,
    `judge verdicts: ${String(s.judgeVerdicts)}`,
    ...(s.detail === undefined ? [] : [s.detail]),
  ];
}

// ---------------------------------------------------------------------------------------------
// Reading the inputs

/** `template: description` (and the threshold) of every enabled template function of a compiled spec. */
export function describerOf(compiled: CompiledSpec): (functionId: string) => string {
  const byId = new Map<string, string>();
  for (const [template, fns] of compiled.enabled) {
    const text = CYPHER_TEMPLATES.get(template)?.description ?? '';
    for (const f of fns) byId.set(f.functionId, `${template}: ${text}${f.threshold === undefined ? '' : ` (threshold ${String(f.threshold)})`}`);
  }
  return (fid) => byId.get(fid) ?? `${fid} ${NO_DESCRIPTION}`;
}

/** The default spec list: the fixture specs and every corpus spec. */
export function defaultSpecs(repoRoot: string): string[] {
  const dir = join(repoRoot, 'corpus/specs');
  const corpus = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort().map((f) => `corpus/specs/${f}`) : [];
  return [...FIXTURE_SPECS, ...corpus];
}

/** `<from>=<to>` prefix rewrites of report project paths (runs recorded under another root). */
export function mapRoot(path: string, maps: readonly (readonly [string, string])[]): string {
  for (const [from, to] of maps) if (path === from || path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
  return path;
}

/** Seeded copy root of a seed id `<projectId>:<operatorId>:<k>` (U5a `applyMutation`). */
export function seededCopyRoot(copies: string, row: Pick<ManifestRow, 'seedId' | 'projectId' | 'operatorId'>): string {
  const k = row.seedId.slice(row.seedId.lastIndexOf(':') + 1);
  return join(copies, row.projectId, row.operatorId, `k-${k}`);
}

export const BUILD_LABEL_PLAN_USAGE = [
  'usage: npx tsx scripts/build-label-plan-cli.ts --out <dir> [--config corpus/label-plan-config.json]',
  '         [--case <score case dir> --label-items <file> --copies <seeded copies root> [--bases <prepared-bases.json>]]',
  '         [--corpus-runs <dir>[,<dir>...]] [--e1-runs <dir>[,<dir>...]] [--fixture-runs <dir>[,<dir>...]]',
  '         [--specs <spec>[,<spec>...]] [--root-map <from>=<to>[,...]]',
  '       npx tsx scripts/build-label-plan-cli.ts --self-test | --help',
  '',
  'Writes <out>/label-plan.json, fn-causes.json, judge-verdicts.json and label-plan-summary.json (ADR-021 SO3-2, SO4-02,',
  'SO3-3, item 6). No model call and no database: contexts are read from the stored source trees.',
  'Exit: 0 written (an over-budget P1 + MS escalates the budget, ADR-021 item 8.2); 1 refused (LABEL_PLAN_CONFIG_INVALID,',
  'LABEL_PLAN_INPUT_INVALID, LABEL_CONTEXT_FAILED); 2 usage.',
  '',
].join('\n');

export interface BuildMainIo {
  out(text: string): void;
  err(text: string): void;
  writeFile(path: string, text: string): void;
}

const VALUED = ['--out', '--config', '--case', '--label-items', '--copies', '--bases', '--corpus-runs', '--e1-runs', '--fixture-runs', '--specs', '--root-map'];

function parseArgs(argv: readonly string[]): Map<string, string> | string {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? '';
    if (a === '--self-test' || a === '--help') {
      out.set(a.slice(2), 'true');
      continue;
    }
    if (!VALUED.includes(a)) return `unknown argument ${a}`;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) return `${a} needs a value`;
    out.set(a.slice(2), v);
    i += 1;
  }
  return out;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

const list = (v: string | undefined): string[] => (v ?? '').split(',').map((x) => x.trim()).filter((x) => x !== '');

/** A known-bad configuration for `--self-test`: 400 calls exceed the ADR-021 ceiling of 300. */
export function selfTestConfig(): unknown {
  return {
    version: 2, provider: 'agy', model: 'gemini-3.1-pro-high', budgetCalls: 400, reaskReserveCalls: 0, seeds: { strata: 1, permutation: 2, bootstrap: 3, audit: 4 },
    priority: ['P4', 'P2', 'P3'], sampled: { P2: { perStratum: 1, maxItems: 1 }, P3: { perStratum: 1, maxItems: 1 }, P4: { perStratum: 1, maxItems: 1 } },
    exhaustivePlanned: 0, exhaustivePlannedBasis: 'self-test', context: { maxChars: { violation: 4000, 'judge-unit': 4000, 'missed-seed': 4000 } },
    quota: { callsPerWeek: 180, minWeeks: 2, maxWeeks: 4 },
  };
}

export async function main(argv: readonly string[], repoRoot: string, io: BuildMainIo): Promise<number> {
  const args = parseArgs(argv);
  if (typeof args === 'string') {
    io.err(`${args}\n${BUILD_LABEL_PLAN_USAGE}`);
    return 2;
  }
  if (args.has('help')) {
    io.out(BUILD_LABEL_PLAN_USAGE);
    return 0;
  }
  if (args.has('self-test')) {
    const errs = checkLabelPlanConfig(selfTestConfig());
    io.err(errs.length === 0 ? 'self-test: known-bad config was accepted\n' : `self-test: ${LABEL_PLAN_CONFIG_INVALID}: ${errs.join('; ')}\n`);
    return 1;
  }
  const outDir = args.get('out');
  if (outDir === undefined) {
    io.err(`--out is required\n${BUILD_LABEL_PLAN_USAGE}`);
    return 2;
  }
  // --bases is read only when a missed seed needs its prepared base's tsconfig (the FN rules); a case without
  // missed seeds, or a fixture case, needs none.
  const so4Flags = ['case', 'label-items', 'copies'].filter((f) => args.has(f));
  if ((so4Flags.length !== 0 && so4Flags.length !== 3) || (args.has('bases') && so4Flags.length === 0)) {
    io.err(`--case, --label-items and --copies go together (--bases with them)\n${BUILD_LABEL_PLAN_USAGE}`);
    return 2;
  }
  const at = (p: string): string => resolve(repoRoot, p);
  let config: LabelPlanConfig;
  try {
    config = readJson(at(args.get('config') ?? LABEL_PLAN_CONFIG_FILE)) as LabelPlanConfig;
  } catch (e) {
    io.err(`input error: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  // Specs, indexed by the sha256 of their bytes (RunRecord.specSha, ManifestRow.specSha256).
  const describers = new Map<string, (fid: string) => string>();
  for (const spec of list(args.get('specs')).length > 0 ? list(args.get('specs')) : defaultSpecs(repoRoot)) {
    const compiled = await loadCompiledSpec(repoRoot, spec);
    if (!compiled.success) {
      io.err(`${LABEL_PLAN_INPUT_INVALID}: spec ${spec}: ${compiled.errors.map((e) => e.message).join('; ')}\n`);
      return 1;
    }
    describers.set(compiled.data.specSha256, describerOf(compiled.data));
  }
  const maps = list(args.get('root-map')).map((m) => {
    const i = m.indexOf('=');
    return [m.slice(0, i), m.slice(i + 1)] as const;
  });
  try {
    const runs: LoadedRun[] = [];
    const planSeeds = new Map<string, number>();
    const samplingSeedOf = (planId: string): number => {
      const known = planSeeds.get(planId);
      if (known !== undefined) return known;
      const f = at(`experiments/${planId}/plan.json`);
      const seed = existsSync(f) ? (readJson(f) as { readonly seeds?: { readonly sampling?: unknown } }).seeds?.sampling : undefined;
      if (typeof seed !== 'number') throw new Error(`${LABEL_PLAN_INPUT_INVALID}: no registered sampling seed for plan ${planId} (experiments/${planId}/plan.json)`);
      planSeeds.set(planId, seed);
      return seed;
    };
    for (const [flag, role] of [['corpus-runs', 'corpus'], ['e1-runs', 'e1'], ['fixture-runs', 'fixture']] as const) {
      for (const dir of list(args.get(flag))) {
        const { records, reports } = loadRunDir(at(dir), LABEL_PLAN_INPUT_INVALID);
        for (const record of records) {
          const report = reports.get(record.runId);
          if (record.status !== 'accepted' || report === undefined) continue;
          const describe = describers.get(record.specSha);
          if (describe === undefined) throw new Error(`${LABEL_PLAN_INPUT_INVALID}: run ${record.runId}: no spec with sha256 ${record.specSha} in --specs`);
          const projectPath = (report as { readonly projectPath?: unknown }).projectPath;
          if (typeof projectPath !== 'string') throw new Error(`${LABEL_PLAN_INPUT_INVALID}: run ${record.runId}: the report has no projectPath`);
          runs.push({ role, record, report, sourceRoot: resolve(repoRoot, mapRoot(projectPath, maps)), samplingSeed: samplingSeedOf(record.planId), describe });
        }
      }
    }
    let so4: So4Inputs | undefined;
    if (so4Flags.length === 3) {
      const caseDir = at(args.get('case') ?? '');
      const manifest = loadManifest(repoRoot, join(caseDir, 'manifest.json'));
      if (!manifest.success) throw new Error(`${LABEL_PLAN_INPUT_INVALID}: ${manifest.errors.map((e) => e.message).join('; ')}`);
      const basesFile = args.get('bases');
      const bases = basesFile === undefined ? [] : loadBases(at(basesFile));
      if (typeof bases === 'string') throw new Error(`${LABEL_PLAN_INPUT_INVALID}: --bases: ${bases}`);
      const reportsDir = join(caseDir, 'reports');
      const seededPath = new Map<string, string>();
      for (const f of readdirSync(reportsDir).filter((n) => n.endsWith('.run.json'))) {
        const rec = readJson(join(reportsDir, f)) as RunRecord;
        if (rec.seed !== undefined && rec.reportPath !== undefined) seededPath.set(rec.seed.seedId, join(caseDir, rec.reportPath));
      }
      const rows = new Map(manifest.data.rows.map((r) => [r.seedId, r]));
      const copies = at(args.get('copies') ?? '');
      so4 = {
        items: readJson(at(args.get('label-items') ?? '')) as LabelItemsFile,
        rows,
        seededReport: (seedId) => {
          const p = seededPath.get(seedId);
          return p === undefined ? {} : readJson(p);
        },
        seededRoot: (seedId) => {
          const row = rows.get(seedId);
          return row === undefined ? copies : seededCopyRoot(copies, row);
        },
        tsconfigPath: (projectId) => bases.find((b) => b.projectId === projectId)?.tsconfigPath,
        describe: (sha) => describers.get(sha),
      };
    }
    const r = buildLabelPlan({ config, runs, ...(so4 !== undefined && { so4 }) });
    if (!r.ok) {
      io.err(`${r.detail}\n`);
      return 1;
    }
    const out = at(outDir);
    io.writeFile(join(out, 'label-plan.json'), `${JSON.stringify(r.plan, null, 2)}\n`);
    io.writeFile(join(out, 'fn-causes.json'), `${JSON.stringify(r.fnCauses, null, 2)}\n`);
    io.writeFile(join(out, 'judge-verdicts.json'), `${JSON.stringify(r.judgeVerdicts, null, 2)}\n`);
    io.writeFile(join(out, 'label-plan-summary.json'), `${JSON.stringify(r.summary, null, 2)}\n`);
    io.out(`${summaryLines(r.summary).join('\n')}\n`);
    return 0;
  } catch (e) {
    io.err(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}
