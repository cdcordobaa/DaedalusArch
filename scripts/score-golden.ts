/**
 * C15.3 differential scorer (FR-25; BR-U5b-02..11, 25; U5b domain-entities §2, §3; business-logic-model §3).
 *
 * Scores seeded copies against their baselines under the pre-registered matching rule
 * (`Docs/matching-rule.md`, loaded by `scripts/lib/matching-rule.ts`):
 * - key `baselineMatchKey` (BR-U5b-02); new violations = multiset difference seeded − baseline,
 *   baseline-matched occurrences counted in `preExistingIgnored` (BR-U5b-03);
 * - detection through the row's stored `expected.keys[]` (U5a computes them, the scorer never re-derives a key),
 *   line confirmatory only (BR-U5b-04); count-once at instance, dimension, tag and overall level, per-function
 *   TP/FN for every applicable expected function (BR-U5b-05, 06, 07);
 * - collateral by key only, keyless only for `cause = 'project-metric'` on `'<project>'`, any other keyless entry
 *   refused (`SCORE_COLLATERAL_UNKEYED`, BR-U5b-08); every other new violation FP-strict with one P1 label item
 *   (BR-U5b-09); FP-labelled from reconciled labels, `null` before labels (BR-U5b-10); `computePrf` with `null` on
 *   a zero denominator (BR-U5b-11);
 * - `scoreDifferential` takes each report with its `RunRecord` and rejects a pair that fails acceptance or differs in
 *   `specSha`, `cliCommit`, `evaluationMode` or `judge` (`SCORE_INPUT_REJECTED`, BR-U5b-25).
 *
 * The output is a `GoldenScore`; `canonicalGoldenScore` writes it in the canonical form (BR-U5b-26).
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { EvaluationReport } from '../src/shared/types/evaluation.js';
import type { Dimension } from '../src/shared/types/enums.js';
import { canonicalize, ratio } from './lib/canonical-json.js';
import { loadManifest } from './lib/manifest.js';
import type { Manifest, ManifestRejection, ManifestRow, Split } from './lib/manifest.js';
import type { MatchingRule, RuleLoad } from './lib/matching-rule.js';
import { acceptReport, checkRunRecord } from './lib/report-io.js';
import type { PinnedJudge, RunRecord } from './lib/report-io.js';
import type { BaseKind, Coverage, ExpectedKey, LineShift, SiteCollateral } from './lib/mutation/types.js';

export type { MatchingRule };

// ---------------------------------------------------------------------------------------------
// Shapes (domain-entities §2, §3)

export type Violation = EvaluationReport['violations'][number];
export type MatchKey = string;
export type InstanceStatus = 'matched' | 'missed' | 'not-applicable' | 'site-invalid' | 'twin-clean' | 'twin-fired';
export type ReconciledP1Label = 'TP' | 'FP' | 'unseeded-TP' | 'uncertain';

export const PROJECT_FILE_PATH = '<project>';
/** Template whose rows also form the `structural / data-flow` sub-row of the tag table (BR-U5b-07). */
export const DATA_FLOW_TEMPLATE = 'domain-state-purity';
export const DATA_FLOW_SUB_ROW = 'structural/data-flow';

export const SCORE_INPUT_REJECTED = 'SCORE_INPUT_REJECTED';
export const SCORE_COLLATERAL_UNKEYED = 'SCORE_COLLATERAL_UNKEYED';
export type ScoreErrorCode = typeof SCORE_INPUT_REJECTED | typeof SCORE_COLLATERAL_UNKEYED;

export interface Confusion { readonly tp: number; readonly fp: number; readonly fn: number }
export interface Prf extends Confusion {
  readonly precision: number | null;
  readonly recall: number | null;
  readonly f1: number | null;
}
export interface PrfModes {
  readonly strict: Prf;
  readonly labelled: Prf | null;
  readonly inclTwins: Prf | null;
  readonly fpUncertain: number;
}

export interface InstanceResult {
  readonly seedId: string;
  readonly projectId: string;
  readonly operatorId: string;
  readonly split: Split;
  readonly baseKind: BaseKind;
  readonly coverage: Coverage;
  /** `null` for twins (the negative expected block has no dimension; DV-U5b-9). */
  readonly dimension: Dimension | null;
  readonly tags: readonly string[];
  readonly status: InstanceStatus;
  readonly detectedBy: readonly string[];
  readonly lineConfirmed: boolean | null;
  readonly collateral: readonly MatchKey[];
  readonly undeclaredNew: readonly MatchKey[];
}

export interface EdgeEvidence {
  readonly seedId: string; readonly negative: boolean; readonly edgeType: 'FLOWS_TO';
  readonly baseline: number; readonly seeded: number; readonly delta: number; readonly declared: number; readonly pass: boolean;
}
export interface JudgeProbeResult {
  readonly seedId: string; readonly probe: 'semantic' | 'integrity'; readonly negative: boolean; readonly runIndex: number;
  readonly detected: boolean; readonly inSelection: boolean; readonly coverageShare: number;
}
/** One `denominators.csv` row per scored report (BR-U5b-24; DV-U5b-9). */
export interface DenominatorRow {
  readonly seedId: string | null;
  readonly runId: string;
  readonly declared: number; readonly adrDerived: number; readonly compiled: number; readonly disabled: number;
  readonly dropped: number; readonly droppedIds: readonly string[]; readonly skippedByMode: number;
  readonly executed: number; readonly failed: number; readonly notApplicable: number; readonly metricKeyExcluded: number;
  readonly identityOk: boolean;
}

export interface GoldenScore {
  readonly ruleVersion: string;
  readonly perInstance: readonly InstanceResult[];
  /** stratum JSON → function id → PRF. */
  readonly perFunction: ReadonlyMap<string, ReadonlyMap<string, PrfModes>>;
  readonly perDimension: ReadonlyMap<string, ReadonlyMap<string, PrfModes>>;
  /** stratum JSON → tag (or the `structural/data-flow` sub-row) → PRF. */
  readonly perTag: ReadonlyMap<string, ReadonlyMap<string, PrfModes>>;
  readonly overall: ReadonlyMap<string, PrfModes>;
  readonly executedFunctions: number;
  readonly preExistingIgnored: number;
  readonly collateralByFunction: ReadonlyMap<string, number>;
  readonly notApplicable: ReadonlyMap<string, number>;
  readonly siteInvalid: number;
  readonly metricCrossings: number;
  readonly metricKeyExclusions: ReadonlyMap<string, number>;
  readonly sccOverlapMatches: number;
  readonly judgeCollateral: number;
  readonly twinSpecificity: { readonly clean: number; readonly scored: number };
  readonly edgeEvidence: readonly EdgeEvidence[];
  readonly judgeProbe: readonly JudgeProbeResult[];
  readonly denominators: readonly DenominatorRow[];
}

/** A P1 labeller item (BR-U5b-09, 33): one per FP-strict new violation; the context is built at labelling time. */
export interface P1Item {
  readonly itemId: string;
  readonly kind: 'violation';
  readonly population: 'P1';
  readonly projectId: string;
  readonly seedId: string;
  readonly functionId: string;
  readonly stratum: string;
  readonly inclusionProbability: 1;
  readonly key: MatchKey;
  readonly twin: boolean;
}

export interface ScoredRun {
  /** Parsed report JSON (validated by `acceptReport`). */
  readonly report: unknown;
  /** Absent → the pair is rejected (BR-U5b-25). */
  readonly record: RunRecord | undefined;
}
export interface SeedInput {
  readonly row: ManifestRow;
  readonly baseline: ScoredRun;
  readonly seeded: ScoredRun;
}
export interface ScoreInput {
  readonly rule: MatchingRule;
  readonly seeds: readonly SeedInput[];
  readonly rejections?: readonly ManifestRejection[];
  /** Reconciled P1 labels by item id; absent → FP-labelled is `null` (BR-U5b-10). */
  readonly labels?: ReadonlyMap<string, ReconciledP1Label>;
  /** The plan mode's pinned judge (acceptance, BR-U5b-45); absent for symbolic-only plans. */
  readonly pinnedJudge?: PinnedJudge;
}

export type ScoreOutcome =
  | { readonly ok: true; readonly score: GoldenScore; readonly labelItems: readonly P1Item[] }
  | { readonly ok: false; readonly code: ScoreErrorCode; readonly detail: string };

// ---------------------------------------------------------------------------------------------
// Keys (BR-U5b-02, 03)

/** `JSON.stringify([functionId, filePath, target ?? "", [...discriminator]])`; line, id, message, evidence excluded. */
export function baselineMatchKey(v: {
  readonly functionId: string; readonly filePath: string; readonly target?: string; readonly discriminator?: readonly string[];
}): MatchKey {
  return JSON.stringify([v.functionId, v.filePath, v.target ?? '', [...(v.discriminator ?? [])]]);
}

/** Key of a stored expected or collateral key (U5a encoding: `target` '' when absent). */
export function expectedMatchKey(k: ExpectedKey): MatchKey {
  return baselineMatchKey(k);
}

/** Multiset difference seeded − baseline: each new key with its multiplicity, and the matched occurrences. */
export function multisetDifference(
  baseline: readonly MatchKey[],
  seeded: readonly MatchKey[],
): { readonly newKeys: ReadonlyMap<MatchKey, number>; readonly preExisting: number } {
  const remaining = new Map<MatchKey, number>();
  for (const k of baseline) remaining.set(k, (remaining.get(k) ?? 0) + 1);
  const newKeys = new Map<MatchKey, number>();
  let preExisting = 0;
  for (const k of seeded) {
    const left = remaining.get(k) ?? 0;
    if (left > 0) {
      remaining.set(k, left - 1);
      preExisting += 1;
    } else {
      newKeys.set(k, (newKeys.get(k) ?? 0) + 1);
    }
  }
  return { newKeys, preExisting };
}

/**
 * Maps a baseline line of `filePath` into seeded-copy coordinates through the row's `lineShifts` (`afterLine`,
 * `delta`, applied in order). U5a stores `expected.keys[].line` already in mutant coordinates, so line
 * confirmation compares the seeded line with that value; this remap is the same transformation applied to a
 * baseline line.
 */
export function remapLine(line: number, filePath: string, shifts: readonly LineShift[]): number {
  let out = line;
  for (const s of shifts) if (s.filePath === filePath && out > s.afterLine) out += s.delta;
  return out;
}

// ---------------------------------------------------------------------------------------------
// P/R/F1 (BR-U5b-11)

export function computePrf(c: Confusion): Prf {
  const precision = c.tp + c.fp === 0 ? null : c.tp / (c.tp + c.fp);
  const recall = c.tp + c.fn === 0 ? null : c.tp / (c.tp + c.fn);
  const f1 = precision === null || recall === null || precision + recall === 0 ? null : (2 * precision * recall) / (precision + recall);
  return { tp: c.tp, fp: c.fp, fn: c.fn, precision, recall, f1 };
}

// ---------------------------------------------------------------------------------------------
// Input acceptance and provenance (BR-U5b-25)

interface AcceptedPair {
  readonly row: ManifestRow;
  readonly baseline: EvaluationReport;
  readonly seeded: EvaluationReport;
  readonly baselineRecord: RunRecord;
  readonly seededRecord: RunRecord;
}

function judgeTriple(r: EvaluationReport): string {
  const j = r.judge as { readonly provider: string; readonly model: string; readonly resolvedModel?: string };
  return JSON.stringify([j.provider, j.model, j.resolvedModel ?? null]);
}

/** Returns the accepted pair or the rejection reason (BR-U5b-25). */
export function acceptPair(seed: SeedInput, pinnedJudge?: PinnedJudge): { ok: true; pair: AcceptedPair } | { ok: false; reason: string } {
  const id = seed.row.seedId;
  const runs = [['baseline', seed.baseline], ['seeded', seed.seeded]] as const;
  const reports: EvaluationReport[] = [];
  const records: RunRecord[] = [];
  for (const [role, run] of runs) {
    if (run.record === undefined) return { ok: false, reason: `${id}: ${role} report without its RunRecord` };
    const problems = checkRunRecord(run.record);
    if (problems.length > 0) return { ok: false, reason: `${id}: ${role} RunRecord invalid (${problems.join('; ')})` };
    const acc = acceptReport(run.report, pinnedJudge === undefined ? {} : { pinnedJudge });
    if (!acc.accepted) return { ok: false, reason: `${id}: ${role} report rejected (${acc.reasonCode}: ${acc.reasonDetail})` };
    reports.push(acc.report);
    records.push(run.record);
  }
  const [b, s] = reports as [EvaluationReport, EvaluationReport];
  const [br, sr] = records as [RunRecord, RunRecord];
  if (br.specSha !== sr.specSha) return { ok: false, reason: `${id}: specSha differs (${br.specSha} vs ${sr.specSha})` };
  if (br.cliCommit !== sr.cliCommit) return { ok: false, reason: `${id}: cliCommit differs (${br.cliCommit} vs ${sr.cliCommit})` };
  if (b.evaluationMode !== s.evaluationMode) return { ok: false, reason: `${id}: evaluationMode differs (${b.evaluationMode} vs ${s.evaluationMode})` };
  if (judgeTriple(b) !== judgeTriple(s)) return { ok: false, reason: `${id}: judge differs (${judgeTriple(b)} vs ${judgeTriple(s)})` };
  return { ok: true, pair: { row: seed.row, baseline: b, seeded: s, baselineRecord: br, seededRecord: sr } };
}

// ---------------------------------------------------------------------------------------------
// Per-seed classification

interface FunctionInfo { readonly dimension: string; readonly tag: string | undefined; readonly template: string | undefined }

function functionInfo(report: EvaluationReport): ReadonlyMap<string, FunctionInfo> {
  const out = new Map<string, FunctionInfo>();
  for (const r of report.functionResults) {
    const row = r as typeof r & { readonly name?: string; readonly tag?: string };
    out.set(String(r.functionId), { dimension: r.dimension, tag: row.tag, template: row.name });
  }
  return out;
}

function isSymbolic(v: Violation): boolean {
  return v.route !== 'neuronal';
}

interface CountedItem { readonly itemId: string; readonly functionId: string }

interface SeedOutcome {
  readonly instance: InstanceResult;
  /** Applicable expected functions with their per-function result. */
  readonly perFunction: readonly { readonly functionId: string; readonly detected: boolean }[];
  readonly fps: readonly CountedItem[];
  readonly items: readonly P1Item[];
  readonly collateralFunctions: readonly string[];
  readonly preExisting: number;
  readonly info: ReadonlyMap<string, FunctionInfo>;
}

function p1ItemId(row: ManifestRow, key: MatchKey): string {
  return createHash('sha256').update(JSON.stringify(['violation', row.projectId, row.baseTreeSha, key])).digest('hex');
}

/** Refuses keyless collateral other than `project-metric` (BR-U5b-08). */
function checkCollateral(row: ManifestRow): string | undefined {
  for (const c of row.expected.collateral) {
    if (c.key === undefined && c.cause !== 'project-metric') {
      return `${row.seedId}: keyless ${c.kind} collateral for template ${c.template} (${c.functionId}, cause ${c.cause})`;
    }
  }
  return undefined;
}

function collateralMatcher(collateral: readonly SiteCollateral[]): (v: Violation, key: MatchKey) => boolean {
  const keyed = new Set(collateral.flatMap((c) => (c.key === undefined ? [] : [expectedMatchKey(c.key)])));
  const projectMetric = new Set(collateral.filter((c) => c.key === undefined && c.cause === 'project-metric').map((c) => c.functionId));
  return (v, key) => keyed.has(key) || (projectMetric.has(String(v.functionId)) && v.filePath === PROJECT_FILE_PATH);
}

function classifySeed(pair: AcceptedPair): SeedOutcome {
  const { row, baseline, seeded } = pair;
  const info = functionInfo(seeded);
  const baseKeys = baseline.violations.filter(isSymbolic).map(baselineMatchKey);
  const seededSym = seeded.violations.filter(isSymbolic);
  const { newKeys, preExisting } = multisetDifference(baseKeys, seededSym.map(baselineMatchKey));
  const byKey = new Map<MatchKey, Violation[]>();
  for (const v of seededSym) {
    const k = baselineMatchKey(v);
    byKey.set(k, [...(byKey.get(k) ?? []), v]);
  }
  const expected = row.expected;
  const applicable = expected.functionIds.filter((f) => info.has(f));
  const expectedKeys = new Map(expected.keys.map((k) => [expectedMatchKey(k), k]));
  const isCollateral = collateralMatcher(expected.collateral);

  const detectedBy = new Set<string>();
  const lineChecks: boolean[] = [];
  const collateral: MatchKey[] = [];
  const collateralFunctions: string[] = [];
  const undeclared: MatchKey[] = [];
  const fps: CountedItem[] = [];
  const items: P1Item[] = [];
  for (const [key, count] of [...newKeys.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const sample = byKey.get(key)?.[0];
    if (sample === undefined) continue;
    const fid = String(sample.functionId);
    const exp = expectedKeys.get(key);
    if (exp !== undefined && applicable.includes(fid)) {
      detectedBy.add(fid);
      if (exp.lineRule !== 'none' && exp.line !== undefined) {
        const lines = (byKey.get(key) ?? []).map((v) => v.line).filter((l): l is number => l !== undefined);
        if (lines.length > 0) lineChecks.push(lines.includes(exp.line));
      }
      continue;
    }
    for (let i = 0; i < count; i += 1) {
      if (isCollateral(sample, key)) {
        collateral.push(key);
        collateralFunctions.push(fid);
        continue;
      }
      undeclared.push(key);
      const itemId = p1ItemId(row, key);
      fps.push({ itemId, functionId: fid });
      items.push({
        itemId, kind: 'violation', population: 'P1', projectId: row.projectId, seedId: row.seedId, functionId: fid,
        stratum: `${row.projectId}, ${fid}`, inclusionProbability: 1, key, twin: false,
      });
    }
  }
  const detected = [...detectedBy].sort();
  const tags = new Set<string>();
  for (const f of applicable) {
    const t = info.get(f)?.tag;
    if (t !== undefined) tags.add(t);
  }
  const dimension = expected.negative === true ? null : expected.dimension;
  const instance: InstanceResult = {
    seedId: row.seedId,
    projectId: row.projectId,
    operatorId: row.operatorId,
    split: row.split,
    baseKind: row.baseKind,
    coverage: expected.coverage,
    dimension,
    tags: [...tags].sort(),
    status: detected.length > 0 ? 'matched' : 'missed',
    detectedBy: detected,
    lineConfirmed: lineChecks.length === 0 ? null : lineChecks.every(Boolean),
    collateral: [...collateral].sort(),
    undeclaredNew: [...undeclared].sort(),
  };
  return {
    instance,
    perFunction: applicable.map((functionId) => ({ functionId, detected: detectedBy.has(functionId) })),
    fps,
    items,
    collateralFunctions,
    preExisting,
    info,
  };
}

// ---------------------------------------------------------------------------------------------
// Aggregation

class Cell {
  tp = 0;
  fn = 0;
  readonly fpItems: string[] = [];
  readonly twinFpItems: string[] = [];
}

function bump(map: Map<string, Map<string, Cell>>, stratum: string, key: string): Cell {
  let inner = map.get(stratum);
  if (inner === undefined) {
    inner = new Map();
    map.set(stratum, inner);
  }
  let cell = inner.get(key);
  if (cell === undefined) {
    cell = new Cell();
    inner.set(key, cell);
  }
  return cell;
}

function modesOf(cell: Cell, labels: ReadonlyMap<string, ReconciledP1Label> | undefined): PrfModes {
  const strict = computePrf({ tp: cell.tp, fp: cell.fpItems.length, fn: cell.fn });
  if (labels === undefined) return { strict, labelled: null, inclTwins: null, fpUncertain: 0 };
  const fpLabelled = cell.fpItems.filter((id) => labels.get(id) !== 'unseeded-TP').length;
  const twinLabelled = cell.twinFpItems.filter((id) => labels.get(id) !== 'unseeded-TP').length;
  const fpUncertain = cell.fpItems.filter((id) => labels.get(id) === 'uncertain').length;
  return {
    strict,
    labelled: computePrf({ tp: cell.tp, fp: fpLabelled, fn: cell.fn }),
    inclTwins: computePrf({ tp: cell.tp, fp: fpLabelled + twinLabelled, fn: cell.fn }),
    fpUncertain,
  };
}

function freeze(map: Map<string, Map<string, Cell>>, labels: ReadonlyMap<string, ReconciledP1Label> | undefined): Map<string, Map<string, PrfModes>> {
  return new Map([...map].map(([s, inner]) => [s, new Map([...inner].map(([k, c]) => [k, modesOf(c, labels)]))]));
}

/** Stratum keys a scored (non-probe) instance contributes to. */
export function strataOf(i: Pick<InstanceResult, 'split' | 'baseKind' | 'coverage'>): string[] {
  return [JSON.stringify([i.split, 'all', 'all'])];
}

function tagRows(tags: readonly string[], templates: readonly (string | undefined)[]): string[] {
  return templates.includes(DATA_FLOW_TEMPLATE) ? [...tags, DATA_FLOW_SUB_ROW] : [...tags];
}

/** Scores the seeds (BR-U5b-02..11, 25). */
export function scoreDifferential(input: ScoreInput): ScoreOutcome {
  const pairs: AcceptedPair[] = [];
  for (const seed of input.seeds) {
    const unkeyed = checkCollateral(seed.row);
    if (unkeyed !== undefined) return { ok: false, code: SCORE_COLLATERAL_UNKEYED, detail: unkeyed };
    const acc = acceptPair(seed, input.pinnedJudge);
    if (!acc.ok) return { ok: false, code: SCORE_INPUT_REJECTED, detail: acc.reason };
    pairs.push(acc.pair);
  }
  const perFunction = new Map<string, Map<string, Cell>>();
  const perDimension = new Map<string, Map<string, Cell>>();
  const perTag = new Map<string, Map<string, Cell>>();
  const overall = new Map<string, Map<string, Cell>>();
  const collateralByFunction = new Map<string, number>();
  const instances: InstanceResult[] = [];
  const items: P1Item[] = [];
  let preExistingIgnored = 0;
  let executedFunctions = 0;
  for (const pair of [...pairs].sort((a, b) => (a.row.seedId < b.row.seedId ? -1 : a.row.seedId > b.row.seedId ? 1 : 0))) {
    const o = classifySeed(pair);
    instances.push(o.instance);
    items.push(...o.items);
    preExistingIgnored += o.preExisting;
    executedFunctions = Math.max(executedFunctions, pair.seeded.functionExecution.executed);
    for (const f of o.collateralFunctions) collateralByFunction.set(f, (collateralByFunction.get(f) ?? 0) + 1);
    if (o.instance.split === 'probe') continue; // probes never enter a P/R table (BR-U5b-20)
    const i = o.instance;
    const tp = i.status === 'matched';
    const templates = o.perFunction.map((p) => o.info.get(p.functionId)?.template);
    for (const stratum of strataOf(i)) {
      for (const p of o.perFunction) {
        const c = bump(perFunction, stratum, p.functionId);
        if (p.detected) c.tp += 1;
        else c.fn += 1;
      }
      const seedCells = [
        bump(overall, stratum, ''),
        ...(i.dimension === null ? [] : [bump(perDimension, stratum, i.dimension)]),
        ...tagRows(i.tags, templates).map((t) => bump(perTag, stratum, t)),
      ];
      for (const c of seedCells) {
        if (tp) c.tp += 1;
        else c.fn += 1;
      }
      for (const fp of o.fps) {
        const fi = o.info.get(fp.functionId);
        const cells = [
          bump(perFunction, stratum, fp.functionId),
          bump(overall, stratum, ''),
          ...(fi === undefined ? [] : [bump(perDimension, stratum, fi.dimension)]),
          ...(fi?.tag === undefined ? [] : tagRows([fi.tag], [fi.template]).map((t) => bump(perTag, stratum, t))),
        ];
        for (const c of cells) c.fpItems.push(fp.itemId);
      }
    }
  }
  const overallModes = new Map([...freeze(overall, input.labels)].flatMap(([s, inner]) => {
    const m = inner.get('');
    return m === undefined ? [] : [[s, m] as const];
  }));
  return {
    ok: true,
    labelItems: items,
    score: {
      ruleVersion: input.rule.version,
      perInstance: instances,
      perFunction: freeze(perFunction, input.labels),
      perDimension: freeze(perDimension, input.labels),
      perTag: freeze(perTag, input.labels),
      overall: overallModes,
      executedFunctions,
      preExistingIgnored,
      collateralByFunction,
      notApplicable: new Map(),
      siteInvalid: 0,
      metricCrossings: 0,
      metricKeyExclusions: new Map(),
      sccOverlapMatches: 0,
      judgeCollateral: 0,
      twinSpecificity: { clean: 0, scored: 0 },
      edgeEvidence: [],
      judgeProbe: [],
      denominators: [],
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Canonical form (BR-U5b-26)

function prfValue(p: Prf | null): unknown {
  if (p === null) return null;
  const r = (x: number | null): unknown => (x === null ? null : ratio(x));
  return { tp: p.tp, fp: p.fp, fn: p.fn, precision: r(p.precision), recall: r(p.recall), f1: r(p.f1) };
}

function modesValue(m: PrfModes): unknown {
  return { strict: prfValue(m.strict), labelled: prfValue(m.labelled), inclTwins: prfValue(m.inclTwins), fpUncertain: m.fpUncertain };
}

function nestedValue(m: ReadonlyMap<string, ReadonlyMap<string, PrfModes>>): Map<string, Map<string, unknown>> {
  return new Map([...m].map(([s, inner]) => [s, new Map([...inner].map(([k, v]) => [k, modesValue(v)]))]));
}

/** Canonical JSON text of a `GoldenScore` (BR-U5b-26). */
export function canonicalGoldenScore(score: GoldenScore): string {
  return canonicalize({
    ...score,
    perFunction: nestedValue(score.perFunction),
    perDimension: nestedValue(score.perDimension),
    perTag: nestedValue(score.perTag),
    overall: new Map([...score.overall].map(([s, v]) => [s, modesValue(v)])),
    judgeProbe: score.judgeProbe.map((p) => ({ ...p, coverageShare: ratio(p.coverageShare) })),
  });
}

// ---------------------------------------------------------------------------------------------
// Case loading (a directory with `manifest.json` and `reports/<name>.json` + `reports/<name>.run.json`)

export interface LoadedCase {
  readonly manifest: Manifest;
  readonly seeds: readonly SeedInput[];
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8')) as unknown;
}

/**
 * Loads a scoring case. Every `*.run.json` record under `reports/` is read; a record with `seed` is the seeded run
 * of that manifest row, and its `seed.baselineReportPath` names the baseline report (relative to the case
 * directory), whose record is the one with that `reportPath`.
 */
export function loadCase(repoRoot: string, caseDir: string): { ok: true; value: LoadedCase } | { ok: false; detail: string } {
  const dir = resolve(caseDir);
  const manifest = loadManifest(repoRoot, join(dir, 'manifest.json'));
  if (!manifest.success) return { ok: false, detail: manifest.errors.map((e) => e.message).join('; ') };
  const records = readdirSync(join(dir, 'reports'))
    .filter((f) => f.endsWith('.run.json'))
    .sort()
    .map((f) => readJson(join(dir, 'reports', f)) as RunRecord);
  const byReportPath = new Map(records.flatMap((r) => (r.reportPath === undefined ? [] : [[r.reportPath, r] as const])));
  const seeds: SeedInput[] = [];
  for (const row of manifest.data.rows) {
    const rec = records.find((r) => r.seed?.seedId === row.seedId);
    if (rec?.reportPath === undefined || rec.seed === undefined) return { ok: false, detail: `no seeded run for ${row.seedId}` };
    const baseRec = byReportPath.get(rec.seed.baselineReportPath);
    seeds.push({
      row,
      seeded: { report: readJson(join(dir, rec.reportPath)), record: rec },
      baseline: { report: readJson(join(dir, rec.seed.baselineReportPath)), record: baseRec },
    });
  }
  return { ok: true, value: { manifest: manifest.data, seeds } };
}

// ---------------------------------------------------------------------------------------------
// CLI main (BR-U5b-73; entry file `scripts/score-golden-cli.ts`)

export const SCORE_USAGE = [
  'usage: npx tsx scripts/score-golden-cli.ts --case <dir> [--labels <labels.json>] [--out <file>]',
  '       npx tsx scripts/score-golden-cli.ts --self-test | --help',
  '',
  'Scores the seeded copies of a case directory (manifest.json, reports/*.json with reports/*.run.json) under',
  'Docs/matching-rule.md and writes the canonical GoldenScore (stdout, or --out).',
  'Exit: 0 scored; 1 refused (SCORE_RULE_MISMATCH, SCORE_INPUT_REJECTED, SCORE_COLLATERAL_UNKEYED, …); 2 usage or input error.',
  '',
].join('\n');

export interface ScoreMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly writeFile: (file: string, text: string) => void;
}

function parseArgs(argv: readonly string[]): Map<string, string | true> | string {
  const args = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? '';
    if (a === '--help' || a === '--self-test') {
      args.set(a, true);
      continue;
    }
    if (a === '--case' || a === '--labels' || a === '--out') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return `${a} needs a value`;
      args.set(a, v);
      i += 1;
      continue;
    }
    return `unknown argument ${a}`;
  }
  return args;
}

/** Built-in known-bad input for `--self-test`: a pair whose seeded report comes without its RunRecord. */
function selfTestInput(rule: MatchingRule): ScoreInput {
  return { rule, seeds: [{ row: { seedId: 'self-test:MO-S01:0', expected: { collateral: [] } } as unknown as ManifestRow, baseline: { report: {}, record: undefined }, seeded: { report: {}, record: undefined } }] };
}

export function main(argv: readonly string[], repoRoot: string, io: ScoreMainIo, loadRule: (root: string) => RuleLoad): number {
  const args = parseArgs(argv);
  if (typeof args === 'string') {
    io.err(`${args}\n${SCORE_USAGE}`);
    return 2;
  }
  if (args.has('--help')) {
    io.out(SCORE_USAGE);
    return 0;
  }
  const rule = loadRule(repoRoot);
  if (!rule.ok) {
    io.err(`${rule.code}: ${rule.detail}\n`);
    return 1;
  }
  if (args.has('--self-test')) {
    const r = scoreDifferential(selfTestInput(rule.rule));
    io.err(r.ok ? 'self-test: known-bad input was scored\n' : `self-test: ${r.code}: ${r.detail}\n`);
    return 1;
  }
  const caseDir = args.get('--case');
  if (typeof caseDir !== 'string') {
    io.err(`--case is required\n${SCORE_USAGE}`);
    return 2;
  }
  let loaded: ReturnType<typeof loadCase>;
  let labels: ReadonlyMap<string, ReconciledP1Label> | undefined;
  try {
    loaded = loadCase(repoRoot, caseDir);
    const labelsFile = args.get('--labels');
    if (typeof labelsFile === 'string') {
      labels = new Map(Object.entries(readJson(labelsFile) as Record<string, ReconciledP1Label>));
    }
  } catch (e) {
    io.err(`input error: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  if (!loaded.ok) {
    io.err(`input error: ${loaded.detail}\n`);
    return 2;
  }
  const result = scoreDifferential({
    rule: rule.rule, seeds: loaded.value.seeds, rejections: loaded.value.manifest.rejections, ...(labels !== undefined && { labels }),
  });
  if (!result.ok) {
    io.err(`${result.code}: ${result.detail}\n`);
    return 1;
  }
  const text = canonicalGoldenScore(result.score);
  const outFile = args.get('--out');
  if (typeof outFile === 'string') io.writeFile(outFile, text);
  else io.out(text);
  return 0;
}
