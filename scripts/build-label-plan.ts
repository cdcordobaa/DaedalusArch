/**
 * Label-plan producer (ADR-021 SO3-2, SO4-02, SO3-3, items 6 and 8; FR-27; BR-U5b-33..36, 38, 63).
 *
 * Builds, from stored outputs only, the input of `llm-label`:
 *
 * - **P1** (exhaustive): the FP-strict and twin-FP items of the SO4 score (`score-golden --label-items`), each read
 *   from its seeded copy at the new violation's line;
 * - **missed seeds**: the score's `missed` instances run through the mechanical FN rules of `Docs/matching-rule.md`
 *   §7 (`classifyMissedSeeds`); a cause becomes a row of `fn-causes.json`, an unexplained seed an MS item;
 * - **P2** corpus baseline violations (accepted non-seeded, non-E1 runs of `--corpus-runs`, instrument v2) and, since
 *   ADR-026 (analysis plan §10 B8), the **v1-only stratum set**: the violations the paired v1 symbolic-only
 *   re-evaluation of the same stored code (`--corpus-v1-runs`, `instrumentVersion` 1) adds, i.e. the rows the v2 role
 *   exemptions remove; strata `'v1-only: <project>, <function>'`, drawn separately with their own inclusion
 *   probabilities and registered size (`sampled.P2.v1OnlyMaxItems`); **P3** E1
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
  ITEM_KINDS, LABEL_PLAN_CONFIG_FILE, LABEL_PLAN_CONFIG_INVALID, V1_ONLY_STRATUM_PREFIX, ceilingsFor, checkLabelPlanConfig, estimateTokens,
  p2FrameOf, precisionStatement, sampleRegistered, thinExhaustive, trimContext, weeksNeeded,
} from './lib/label-plan.js';
import type { LabelPlanConfig, P2Split, PrecisionStatement } from './lib/label-plan.js';
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

/** `corpus-v1`: the v1 symbolic-only re-evaluation of an accepted `corpus` run's stored code (ADR-026). */
export type RunRole = 'corpus' | 'corpus-v1' | 'e1' | 'fixture';

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
  /** P2 items per frame (ADR-026): the v2 population and the v1-only stratum set. */
  readonly p2Items: P2Split;
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
  /** The P2 ceiling per frame. */
  readonly p2Ceilings: P2Split;
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
    if (isCorpusP2(run)) {
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

/** An accepted, unseeded, non-E1 run of the given corpus role (the P2 sources). */
function isCorpusP2(run: LoadedRun, role: RunRole = 'corpus'): boolean {
  const r = run.record;
  return run.role === role && r.status === 'accepted' && r.seed === undefined && r.cell === undefined;
}

/**
 * The v1-only P2 candidates (ADR-026; analysis plan §10 B8): for each accepted `corpus-v1` run, the violations of
 * its report whose key is absent from the paired v2 `corpus` run (same project and spec) of the same stored code.
 * Strata are `'v1-only: <project>, <function>'`. Refused (`detail`): a v1 run not stamped `instrumentVersion` 1, a v2
 * run stamped 1, a v1 run without its v2 pair or with two, a v2 run without its v1 pair when any v1 run is given or
 * the registered v1-only size is above 0, and a v2 violation that the v1 report lacks (v2 = v1 minus the exempted
 * rows, ADR-026 item 6).
 */
export function v1OnlyCandidates(
  runs: readonly LoadedRun[],
  v1OnlyMaxItems: number,
): { ok: true; candidates: Candidate[]; seedOf: Map<string, number> } | { ok: false; detail: string } {
  const v2 = runs.filter((r) => isCorpusP2(r));
  const v1 = runs.filter((r) => isCorpusP2(r, 'corpus-v1'));
  const pairKey = (r: LoadedRun): string => JSON.stringify([r.record.projectId, r.record.specSha]);
  for (const r of v2) {
    if (r.record.instrumentVersion === 1) return { ok: false, detail: `corpus run ${r.record.runId} is instrument v1; --corpus-runs takes the v2 runs, --corpus-v1-runs the v1 re-evaluation` };
  }
  for (const r of v1) {
    if (r.record.instrumentVersion !== 1) return { ok: false, detail: `v1 corpus run ${r.record.runId} is not stamped instrumentVersion 1 (ADR-026)` };
  }
  const byKey = new Map<string, LoadedRun[]>();
  for (const r of v2) byKey.set(pairKey(r), [...(byKey.get(pairKey(r)) ?? []), r]);
  const v1Keys = new Set(v1.map(pairKey));
  if (v1.length > 0 || (v1OnlyMaxItems > 0 && v2.length > 0)) {
    const unpaired = v2.filter((r) => !v1Keys.has(pairKey(r))).map((r) => r.record.runId);
    if (unpaired.length > 0) {
      return { ok: false, detail: `the v1-only P2 frame needs the v1 re-evaluation of every v2 corpus run (--corpus-v1-runs, ADR-026); missing for ${unpaired.join(', ')}` };
    }
  }
  const candidates: Candidate[] = [];
  const seedOf = new Map<string, number>();
  const seenV1 = new Set<string>();
  for (const r of v1) {
    const key = pairKey(r);
    if (seenV1.has(key)) return { ok: false, detail: `two v1 corpus runs for project ${r.record.projectId} and spec ${r.record.specSha}` };
    seenV1.add(key);
    const pair = byKey.get(key) ?? [];
    const [v2Run] = pair;
    if (pair.length !== 1 || v2Run === undefined) {
      return { ok: false, detail: `v1 corpus run ${r.record.runId}: ${pair.length === 0 ? 'no' : 'more than one'} accepted v2 corpus run of project ${r.record.projectId} with spec ${r.record.specSha}` };
    }
    const src = { projectId: r.record.projectId, treeSha: r.record.specSha, sourceRoot: r.sourceRoot, describe: r.describe, population: 'P2' as const };
    const v2Keys = new Set(violationCandidates(v2Run.report, { ...src, stratumOwner: r.record.projectId }).map((c) => c.key));
    const v1All = violationCandidates(r.report, { ...src, stratumOwner: `${V1_ONLY_STRATUM_PREFIX}${r.record.projectId}`, runId: r.record.runId });
    const v1Set = new Set(v1All.map((c) => c.key));
    const missing = [...v2Keys].filter((k) => !v1Set.has(k));
    if (missing.length > 0) {
      return { ok: false, detail: `v2 corpus run ${v2Run.record.runId} has ${String(missing.length)} violation(s) its v1 re-evaluation ${r.record.runId} lacks (v2 must be v1 minus the exempted rows, ADR-026 item 6), e.g. ${missing[0] ?? ''}` };
    }
    for (const c of v1All.filter((x) => !v2Keys.has(x.key))) {
      candidates.push(c);
      seedOf.set(`P2\u0000${candidateStratum(c)}`, r.samplingSeed);
    }
  }
  return { ok: true, candidates, seedOf };
}

// ---------------------------------------------------------------------------------------------
// Precision rows (ADR-021 item 8.3)

const weightOf = (i: LabelItem): number => 1 / Math.max(i.inclusionProbability, Number.EPSILON);

/**
 * The rows whose precision is stated before any run, each at its Kish effective n: the P4 E1 headline (the units of
 * E1 cells), the P4 fixtures, P4 per E1 generator model, the P2 rows per instrument version (`p2PrecisionRows`), and
 * the P1 and MS censuses.
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
    ...p2PrecisionRows(items.filter((i) => i.population === 'P2')),
    precisionStatement('P1 FP-labelled share (census)', items.filter((i) => i.population === 'P1').map(weightOf)),
    precisionStatement('MS root-cause shares (census)', items.filter((i) => i.population === 'MS').map(weightOf)),
  );
  return rows;
}

export const P2_ROW_V2 = 'P2 baseline precision, instrument v2 (v2 population)';
export const P2_ROW_V1 = 'P2 baseline precision, instrument v1 (v2 population + v1-only set)';
export const P2_ROW_V1_ONLY = 'P2 baseline precision, v1-only set alone (counts only)';

/**
 * The P2 rows of analysis plan §10 B8 (ADR-026), each at the Kish n_eff of its design weights: the **v2 estimate**
 * (the v2 items over the v2 population), the **v1 estimate** (the stratified Horvitz–Thompson combination of both
 * frames over the v1 population v2 ∪ v1-only: all P2 items, each weighing 1 / p of its own frame, Kish over the
 * combined weights) and the **v1-only part alone** (counts only, never a half-width).
 */
export function p2PrecisionRows(p2: readonly LabelItem[]): PrecisionStatement[] {
  const v2 = p2.filter((i) => p2FrameOf(i.stratum) === 'v2');
  const v1Only = p2.filter((i) => p2FrameOf(i.stratum) === 'v1-only');
  return [
    precisionStatement(P2_ROW_V2, v2.map(weightOf)),
    precisionStatement(P2_ROW_V1, [...v2, ...v1Only].map(weightOf)),
    precisionStatement(P2_ROW_V1_ONLY, v1Only.map(weightOf), true),
  ];
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
  const v1 = v1OnlyCandidates(input.runs, config.sampled.P2.v1OnlyMaxItems ?? 0);
  if (!v1.ok) return { ok: false, code: LABEL_PLAN_INPUT_INVALID, detail: `${LABEL_PLAN_INPUT_INVALID}: ${v1.detail}` };
  for (const [k, seed] of v1.seedOf) seedOf.set(k, seed);
  const stratumSizes = (cs: readonly Candidate[]): number[] => {
    const counts = new Map<string, Set<string>>();
    for (const c of cs) {
      const k = candidateStratum(c);
      counts.set(k, (counts.get(k) ?? new Set<string>()).add(candidateItemId(c)));
    }
    return [...counts.values()].map((v) => v.size);
  };
  const sizes = Object.fromEntries(SAMPLED_POPULATIONS.map((p) => [p, stratumSizes(candidates.filter((x) => x.population === p))])) as Record<SampledPopulation, number[]>;
  const ceilings = ceilingsFor(config, exhaustiveItems, sizes, stratumSizes(v1.candidates));
  // ADR-021 item 8.2: past the escalation limit the censuses are thinned, never refused.
  const sampled: (StratumSample & { stratumInclusionProbability?: number })[] = thinExhaustive(exhaustive, ceilings.exhaustiveKept, config.seeds.strata);
  for (const p of SAMPLED_POPULATIONS) {
    const itemSeed = (stratum: string): number => seedOf.get(`${p}\u0000${stratum}`) ?? 0;
    if (p !== 'P2') {
      sampled.push(...sampleRegistered(candidates, p, config.sampled[p], ceilings.maxItems[p], config.seeds.strata, itemSeed));
      continue;
    }
    // ADR-026: the two P2 frames are drawn separately, each by the §4 PPS rule with its own ceiling and probabilities.
    sampled.push(
      ...sampleRegistered(candidates, 'P2', config.sampled.P2, ceilings.p2Split.v2, config.seeds.strata, itemSeed),
      ...sampleRegistered(v1.candidates, 'P2', config.sampled.P2, ceilings.p2Split.v1Only, config.seeds.strata, itemSeed, 'v1-only'),
    );
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
    p2Items: {
      v2: items.filter((i) => i.population === 'P2' && p2FrameOf(i.stratum) === 'v2').length,
      v1Only: items.filter((i) => i.population === 'P2' && p2FrameOf(i.stratum) === 'v1-only').length,
    },
    mechanicalFnCauses: causes.length, calls, reaskReserveCalls: config.reaskReserveCalls, budgetCalls: ceilings.budgetCalls,
    registeredBudgetCalls: config.budgetCalls, escalated: ceilings.escalated,
    exhaustive: { found: exhaustiveItems, kept: ceilings.exhaustiveKept, basis: config.exhaustivePlannedBasis },
    weeks: weeksNeeded(config, calls + config.reaskReserveCalls), ceilings: ceilings.maxItems, p2Ceilings: ceilings.p2Split, lowered: ceilings.lowered,
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
    `ceilings: P4 ${String(s.ceilings.P4)}, P2 ${String(s.ceilings.P2)} (v2 ${String(s.p2Ceilings.v2)}, v1-only ${String(s.p2Ceilings.v1Only)}), P3 ${String(s.ceilings.P3)}${s.lowered.length === 0 ? '' : ` (lowered for the budget: ${s.lowered.join(', ')})`}`,
    `P2 frames (ADR-026): v2 population ${String(s.p2Items.v2)} items, v1-only set ${String(s.p2Items.v1Only)} items`,
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
  '         [--corpus-runs <dir>[,<dir>...] --corpus-v1-runs <dir>[,<dir>...]] [--e1-runs <dir>[,<dir>...]]',
  '         [--fixture-runs <dir>[,<dir>...]]',
  '         [--specs <spec>[,<spec>...]] [--root-map <from>=<to>[,...]]',
  '       npx tsx scripts/build-label-plan-cli.ts --self-test | --help',
  '',
  'Writes <out>/label-plan.json, fn-causes.json, judge-verdicts.json and label-plan-summary.json (ADR-021 SO3-2, SO4-02,',
  'SO3-3, item 6). No model call and no database: contexts are read from the stored source trees. --corpus-v1-runs are',
  'the --instrument v1 symbolic-only re-evaluations of the --corpus-runs; their extra rows are the v1-only P2 set (ADR-026).',
  'Exit: 0 written (an over-budget P1 + MS escalates the budget, ADR-021 item 8.2); 1 refused (LABEL_PLAN_CONFIG_INVALID,',
  'LABEL_PLAN_INPUT_INVALID, LABEL_CONTEXT_FAILED); 2 usage.',
  '',
].join('\n');

export interface BuildMainIo {
  out(text: string): void;
  err(text: string): void;
  writeFile(path: string, text: string): void;
}

const VALUED = ['--out', '--config', '--case', '--label-items', '--copies', '--bases', '--corpus-runs', '--corpus-v1-runs', '--e1-runs', '--fixture-runs', '--specs', '--root-map'];

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
    version: 3, provider: 'agy', model: 'gemini-3.1-pro-high', budgetCalls: 400, reaskReserveCalls: 0, seeds: { strata: 1, permutation: 2, bootstrap: 3, audit: 4 },
    priority: ['P4', 'P2', 'P3'], sampled: { P2: { perStratum: 1, maxItems: 1, v1OnlyMaxItems: 0 }, P3: { perStratum: 1, maxItems: 1 }, P4: { perStratum: 1, maxItems: 1 } },
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
    for (const [flag, role] of [['corpus-runs', 'corpus'], ['corpus-v1-runs', 'corpus-v1'], ['e1-runs', 'e1'], ['fixture-runs', 'fixture']] as const) {
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
