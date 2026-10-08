/**
 * C15.3 differential scorer (FR-25; BR-U5b-02..27, 78; U5b domain-entities §2, §3; business-logic-model §3).
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
 *   `specSha`, `cliCommit`, `evaluationMode` or `judge` (`SCORE_INPUT_REJECTED`, BR-U5b-25);
 * - fixed rule order per row (BR-U5b-12): manifest rejections are never instances; not-applicable by
 *   `disabledFunctionIds`, `absentTemplates`, the report's `disabledFunctions` and absence from
 *   `functionResults[].functionId` (BR-U5b-13); site-invalid (BR-U5b-14); metric threshold crossing through
 *   `parseEvidence` and the spec threshold at `specSha256` (BR-U5b-15); metric-key exclusions from the frozen
 *   instrument's readiness flags (BR-U5b-16); twins, specificity and "incl. twins" precision (BR-U5b-17); SCC
 *   member-overlap matching (BR-U5b-18); neural rows by `(functionId, filePath, [unitId])` with judge collateral
 *   (BR-U5b-19);
 * - strata `split` × `baseKind` × `coverage` (split total, base-kind and coverage strata; never pooled across splits;
 *   SP-* probe rows only through `scoreSensitivity` into `FunctionSensitivityResult`, BR-U5b-20, 21, 78); FLOWS_TO
 *   edge evidence (`EDGE_EVIDENCE_UNAVAILABLE` on `{}`, BR-U5b-22); judge probes overall and conditional on the
 *   baseline selection (BR-U5b-23); one `denominators` row per report with U3's identities I1 / I2 (BR-U5b-24).
 *
 * The output is a `GoldenScore`; `canonicalGoldenScore` writes it in the canonical form (BR-U5b-26).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { EvaluationReport } from '../src/shared/types/evaluation.js';
import type { Dimension } from '../src/shared/types/enums.js';
import { parseEvidence } from '../src/evaluation-engine/evidence.js';
import { canonicalize, ratio } from './lib/canonical-json.js';
import { loadManifest } from './lib/manifest.js';
import type { Manifest, ManifestRejection, ManifestRow, Split } from './lib/manifest.js';
import type { MatchingRule, RuleLoad } from './lib/matching-rule.js';
import { acceptReport, checkRunRecord } from './lib/report-io.js';
import type { PinnedJudge, RunRecord } from './lib/report-io.js';
import { compiledThresholds, loadCompiledSpec } from './lib/mutation/expected.js';
import { isMetricTemplate } from './lib/mutation/metrics.js';
import { loadCatalogueRegistry } from './lib/mutation/operators/index.js';
import type { BaseKind, Coverage, ExpectedKey, LineShift } from './lib/mutation/types.js';

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
export const EDGE_EVIDENCE_UNAVAILABLE = 'EDGE_EVIDENCE_UNAVAILABLE';
export const SENSITIVITY_EXCLUSION_UNSUPPORTED = 'SENSITIVITY_EXCLUSION_UNSUPPORTED';
export type ScoreErrorCode = typeof SCORE_INPUT_REJECTED | typeof SCORE_COLLATERAL_UNKEYED | typeof EDGE_EVIDENCE_UNAVAILABLE;

/** Probed neural template per judge probe (BR-U5b-23). */
export const JUDGE_PROBE_TEMPLATE = { semantic: 'intent-alignment', integrity: 'architectural-integrity' } as const;
export type JudgeProbeKind = keyof typeof JUDGE_PROBE_TEMPLATE;

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
/** One SP-* probe result (BR-U5b-78); `split: 'probe'` only, never in a `GoldenScore` stratum. */
export interface FunctionSensitivityResult {
  readonly probeId: string;
  readonly functionId: string;
  /** `null` = run rejected (the reason is `rejectedReason`, and in `runs.csv`). */
  readonly pass: boolean | null;
  readonly lineConfirmed: boolean | null;
  readonly excludedAfterFail: boolean;
  readonly fixAttemptRef?: string;
  readonly rejectedReason?: string;
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
  /**
   * Metric-key readiness flags of the frozen instrument export (BR-U5b-16, 52). When either is false, the new
   * violations of `METRIC_KEY_TEMPLATES` functions are listed in `metricKeyExclusions`, never FP. Absent → only the
   * rule's own `metricKeyExclusions` list applies (until the Step 13 export exists).
   */
  readonly metricKeyReadiness?: MetricKeyReadiness;
  /** Compiled thresholds by `specSha256` → template name (BR-U5b-15; `metricThresholds`). */
  readonly thresholds?: ReadonlyMap<string, Readonly<Record<string, number>>>;
  /**
   * Operator id → judge probe kind for twins of judge probes (the negative expected block carries no `judgeProbe`;
   * BR-U5b-23). Positive judge-probe rows are recognised by `expected.judgeProbe`; their operator ids are added.
   */
  readonly judgeProbeOperators?: ReadonlyMap<string, JudgeProbeKind>;
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
// Per-seed classification (rule order BR-U5b-12)

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

/** Neural key (BR-U5b-19): `(functionId, filePath, [unitId])`, line-independent. */
export function neuralMatchKey(v: { readonly functionId: string; readonly filePath: string; readonly unitId?: string }): MatchKey {
  return JSON.stringify([v.functionId, v.filePath, [v.unitId ?? '']]);
}

/** SCC members of a Tarjan-fallback cycle row (`discriminator ["scc"]`, evidence `cycle=<JSON>`), else undefined. */
export function sccMembers(v: Pick<Violation, 'discriminator' | 'evidence'>): readonly string[] | undefined {
  if (v.discriminator?.length !== 1 || v.discriminator[0] !== 'scc') return undefined;
  const cycle = parseEvidence(v.evidence ?? []).cycle;
  if (typeof cycle !== 'string') return [];
  try {
    const parsed = JSON.parse(cycle) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function overlaps(a: readonly string[], b: readonly string[]): boolean {
  return a.some((x) => b.includes(x));
}

/**
 * Templates whose project-level / ratio rows are excluded from differential FP accounting unless U3's metric-key
 * readiness flags are both set (BR-U5b-16): FF-C06, FF-P02, FF-C01 on the shipped specs.
 */
export const METRIC_KEY_TEMPLATES: readonly string[] = ['abstraction-ratio', 'dependency-inversion', 'domain-stability'];

/** The flags of `corpus/frozen-instrument.json` `metricKeyReadiness` (BR-U5b-16, 52). */
export interface MetricKeyReadiness { readonly projectLevelKeys: boolean; readonly rowFilters: boolean }

/**
 * Metric crossing (BR-U5b-15): some numeric evidence column crosses `threshold` between the baseline row and the
 * seeded row (non-violating side to violating side, either direction of the template's comparison).
 */
export function crossesThreshold(baselineEvidence: readonly string[], seededEvidence: readonly string[], threshold: number): boolean {
  const b = parseEvidence(baselineEvidence);
  const s = parseEvidence(seededEvidence);
  return Object.entries(s).some(([col, sv]) => {
    const bv = b[col];
    if (typeof sv !== 'number' || typeof bv !== 'number') return false;
    return (bv <= threshold && sv > threshold) || (bv >= threshold && sv < threshold);
  });
}

interface CountedItem { readonly itemId: string; readonly functionId: string }

interface SeedOutcome {
  readonly instance: InstanceResult;
  /** Applicable expected functions with their per-function result (empty unless the row is a scored positive). */
  readonly perFunction: readonly { readonly functionId: string; readonly detected: boolean }[];
  readonly fps: readonly CountedItem[];
  readonly twinFps: readonly CountedItem[];
  readonly items: readonly P1Item[];
  readonly collateralFunctions: readonly string[];
  readonly notApplicable: readonly string[];
  readonly metricKeyExcluded: readonly string[];
  readonly metricCrossing: boolean;
  readonly sccOverlapMatches: number;
  readonly judgeCollateral: number;
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

function sortStrings(xs: Iterable<string>): string[] {
  return [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

interface ClassifyContext {
  readonly excludedTemplates: ReadonlySet<string>;
  readonly excludedFunctions: ReadonlySet<string>;
  readonly thresholds: ReadonlyMap<string, Readonly<Record<string, number>>> | undefined;
}

/** A new symbolic violation occurrence (one per multiset count) with a sample violation of its key. */
interface NewOccurrence { readonly key: MatchKey; readonly v: Violation; readonly members: readonly string[] | undefined }

/**
 * Key diff of one pair (BR-U5b-03, 18, 19): symbolic multiset difference, with SCC rows (`["scc"]`) of the Tarjan
 * fallback matched to an unconsumed baseline SCC row of the same function by member overlap; neural rows by
 * `(functionId, filePath, [unitId])`.
 */
function diffPair(baseline: EvaluationReport, seeded: EvaluationReport): {
  readonly fresh: readonly NewOccurrence[]; readonly preExisting: number; readonly sccOverlap: number;
  readonly neuralNew: readonly Violation[]; readonly baselineKeys: ReadonlySet<MatchKey>;
  readonly baselineByKey: ReadonlyMap<MatchKey, Violation>;
} {
  const baseSym = baseline.violations.filter(isSymbolic);
  const baselineByKey = new Map<MatchKey, Violation>();
  for (const v of baseSym) if (!baselineByKey.has(baselineMatchKey(v))) baselineByKey.set(baselineMatchKey(v), v);
  const seededSym = seeded.violations.filter(isSymbolic);
  const { newKeys, preExisting } = multisetDifference(baseSym.map(baselineMatchKey), seededSym.map(baselineMatchKey));
  const sample = new Map<MatchKey, Violation[]>();
  for (const v of seededSym) {
    const k = baselineMatchKey(v);
    sample.set(k, [...(sample.get(k) ?? []), v]);
  }
  // SCC overlap: baseline SCC rows not consumed by an exact key match.
  const seededCount = new Map<MatchKey, number>();
  for (const v of seededSym) seededCount.set(baselineMatchKey(v), (seededCount.get(baselineMatchKey(v)) ?? 0) + 1);
  const freeBaseScc: { fid: string; members: readonly string[] }[] = [];
  const baseCount = new Map<MatchKey, number>();
  for (const v of baseSym) {
    const k = baselineMatchKey(v);
    baseCount.set(k, (baseCount.get(k) ?? 0) + 1);
    const members = sccMembers(v);
    if (members !== undefined && (baseCount.get(k) ?? 0) > (seededCount.get(k) ?? 0)) freeBaseScc.push({ fid: v.functionId, members });
  }
  const fresh: NewOccurrence[] = [];
  let pre = preExisting;
  let sccOverlap = 0;
  for (const [key, count] of [...newKeys.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const v = sample.get(key)?.[0];
    if (v === undefined) continue;
    const members = sccMembers(v);
    for (let i = 0; i < count; i += 1) {
      if (members !== undefined) {
        const at = freeBaseScc.findIndex((b) => b.fid === v.functionId && overlaps(b.members, members));
        if (at >= 0) {
          freeBaseScc.splice(at, 1);
          pre += 1;
          sccOverlap += 1;
          continue;
        }
      }
      fresh.push({ key, v, members });
    }
  }
  const neural = multisetDifference(
    baseline.violations.filter((v) => !isSymbolic(v)).map(neuralMatchKey),
    seeded.violations.filter((v) => !isSymbolic(v)).map(neuralMatchKey),
  );
  const neuralSample = new Map(seeded.violations.filter((v) => !isSymbolic(v)).map((v) => [neuralMatchKey(v), v] as const));
  const neuralNew = [...neural.newKeys.entries()].flatMap(([k, n]) => {
    const v = neuralSample.get(k);
    return v === undefined ? [] : Array.from({ length: n }, () => v);
  });
  return { fresh, preExisting: pre + neural.preExisting, sccOverlap, neuralNew, baselineKeys: new Set(baselineByKey.keys()), baselineByKey };
}

/** Judge units added by the variant or covering an edited or created file of the row (BR-U5b-19). */
function judgeCollateralUnits(seeded: EvaluationReport, row: ManifestRow): ReadonlySet<string> {
  const touched = new Set([...row.editedFiles, ...row.createdFiles]);
  const out = new Set<string>();
  for (const nr of seeded.neuralResults ?? []) {
    for (const u of nr.unitResults) {
      const unit = u as typeof u & { readonly origin?: string };
      if (unit.origin === 'addedByVariant' || u.filePaths.some((f) => touched.has(f))) out.add(u.unitId);
    }
  }
  return out;
}

function classifySeed(pair: AcceptedPair, ctx: ClassifyContext): SeedOutcome {
  const { row, baseline, seeded } = pair;
  const info = functionInfo(seeded);
  const expected = row.expected;
  const diff = diffPair(baseline, seeded);
  const judgeUnits = judgeCollateralUnits(seeded, row);
  const judgeCollateral = diff.neuralNew.filter((v) => v.unitId !== undefined && judgeUnits.has(v.unitId)).length;
  const neuralFp = diff.neuralNew.filter((v) => v.unitId === undefined || !judgeUnits.has(v.unitId));

  // Not-applicable expected functions (BR-U5b-13).
  const disabledInReport = new Set(seeded.disabledFunctions.map((d) => String(d.functionId)));
  const declaredDisabled = expected.negative === true ? [] : expected.disabledFunctionIds.map((d) => d.functionId);
  const absent = expected.negative === true ? [] : [...expected.absentTemplates];
  const notApplicable = [...declaredDisabled, ...absent];
  const applicable: string[] = [];
  for (const f of expected.functionIds) {
    const fi = info.get(f);
    if (fi === undefined || disabledInReport.has(f) || (fi.template !== undefined && absent.includes(fi.template))) notApplicable.push(f);
    else applicable.push(f);
  }
  const expectedKeys = new Map(expected.keys.map((k) => [expectedMatchKey(k), k] as const));
  const keyed = new Map(expected.collateral.flatMap((c) => (c.key === undefined ? [] : [[expectedMatchKey(c.key), c.key] as const])));
  const projectMetric = new Set(expected.collateral.filter((c) => c.key === undefined && c.cause === 'project-metric').map((c) => c.functionId));
  const isCollateral = (o: NewOccurrence): boolean => {
    if (keyed.has(o.key)) return true;
    if (projectMetric.has(o.v.functionId) && o.v.filePath === PROJECT_FILE_PATH) return true;
    // SCC fallback: a declared SCC key matches a new SCC row of its function whose members contain its filePath.
    return o.members !== undefined && [...keyed.values()].some((k) => k.functionId === o.v.functionId && k.discriminator[0] === 'scc' && o.members?.includes(k.filePath) === true);
  };
  const isExcluded = (v: Violation): boolean => {
    const t = info.get(v.functionId)?.template;
    return ctx.excludedFunctions.has(v.functionId) || (t !== undefined && ctx.excludedTemplates.has(t));
  };

  const detectedBy = new Set<string>();
  const lineChecks: boolean[] = [];
  const collateral: MatchKey[] = [];
  const collateralFunctions: string[] = [];
  const undeclared: MatchKey[] = [];
  const excluded: string[] = [];
  let sccOverlapMatches = diff.sccOverlap;
  let metricCrossing = false;

  const base = {
    seedId: row.seedId, projectId: row.projectId, operatorId: row.operatorId, split: row.split, baseKind: row.baseKind,
    coverage: expected.coverage,
  };
  const empty = {
    perFunction: [], fps: [], twinFps: [], items: [], metricKeyExcluded: [], metricCrossing: false,
    sccOverlapMatches: diff.sccOverlap, judgeCollateral, preExisting: diff.preExisting, info,
  };
  const tagsOf = (fns: readonly string[]): string[] => sortStrings(new Set(fns.flatMap((f) => { const t = info.get(f)?.tag; return t === undefined ? [] : [t]; })));

  // Twins (BR-U5b-17): declared collateral neutral, anything else a twin FP.
  if (expected.negative === true) {
    const twinFps: CountedItem[] = [];
    const items: P1Item[] = [];
    for (const o of diff.fresh) {
      if (isCollateral(o)) {
        collateral.push(o.key);
        collateralFunctions.push(o.v.functionId);
      } else if (isExcluded(o.v)) {
        excluded.push(o.v.functionId);
      } else {
        undeclared.push(o.key);
        const itemId = p1ItemId(row, o.key);
        twinFps.push({ itemId, functionId: o.v.functionId });
        items.push({ itemId, kind: 'violation', population: 'P1', projectId: row.projectId, seedId: row.seedId, functionId: o.v.functionId, stratum: `${row.projectId}, ${o.v.functionId}`, inclusionProbability: 1, key: o.key, twin: true });
      }
    }
    for (const v of neuralFp) {
      const k = neuralMatchKey(v);
      undeclared.push(k);
      const itemId = p1ItemId(row, k);
      twinFps.push({ itemId, functionId: v.functionId });
      items.push({ itemId, kind: 'violation', population: 'P1', projectId: row.projectId, seedId: row.seedId, functionId: v.functionId, stratum: `${row.projectId}, ${v.functionId}`, inclusionProbability: 1, key: k, twin: true });
    }
    return {
      ...empty,
      instance: {
        ...base, dimension: null, tags: [], status: twinFps.length === 0 ? 'twin-clean' : 'twin-fired', detectedBy: [], lineConfirmed: null,
        collateral: sortStrings(collateral), undeclaredNew: sortStrings(undeclared),
      },
      twinFps, items, collateralFunctions, notApplicable: [], metricKeyExcluded: excluded,
    };
  }

  const dimension = expected.dimension;
  // (2) Not-applicable.
  if (applicable.length === 0) {
    return { ...empty, instance: { ...base, dimension, tags: [], status: 'not-applicable', detectedBy: [], lineConfirmed: null, collateral: [], undeclaredNew: [] }, collateralFunctions: [], notApplicable };
  }
  const tags = tagsOf(applicable);
  const isMetricSeed = applicable.every((f) => isMetricTemplate(info.get(f)?.template ?? ''));
  const applicableKeys = [...expectedKeys].filter(([, k]) => applicable.includes(k.functionId));
  // (3) Site-invalid: a non-metric seed whose expected key is already in the baseline.
  if (!isMetricSeed && applicableKeys.some(([k]) => diff.baselineKeys.has(k))) {
    return { ...empty, instance: { ...base, dimension, tags, status: 'site-invalid', detectedBy: [], lineConfirmed: null, collateral: [], undeclaredNew: [] }, collateralFunctions: [], notApplicable };
  }
  // (4) Metric threshold crossing on a pre-existing key (BR-U5b-15).
  if (isMetricSeed) {
    for (const [k, ek] of applicableKeys) {
      const b = diff.baselineByKey.get(k);
      const s = seeded.violations.find((v) => isSymbolic(v) && baselineMatchKey(v) === k);
      if (b === undefined || s === undefined) continue;
      const template = info.get(ek.functionId)?.template ?? '';
      const threshold = ctx.thresholds?.get(row.specSha256)?.[template];
      if (threshold === undefined) continue;
      if (crossesThreshold(b.evidence ?? [], s.evidence ?? [], threshold)) {
        detectedBy.add(ek.functionId);
        metricCrossing = true;
      }
    }
  }
  // (6) Detection, collateral, FP-strict.
  const fps: CountedItem[] = [];
  const items: P1Item[] = [];
  const addFp = (key: MatchKey, functionId: string): void => {
    undeclared.push(key);
    const itemId = p1ItemId(row, key);
    fps.push({ itemId, functionId });
    items.push({ itemId, kind: 'violation', population: 'P1', projectId: row.projectId, seedId: row.seedId, functionId, stratum: `${row.projectId}, ${functionId}`, inclusionProbability: 1, key, twin: false });
  };
  const sccExpected = applicableKeys.filter(([, k]) => k.discriminator[0] === 'scc');
  for (const o of diff.fresh) {
    const fid = o.v.functionId;
    let exp = applicable.includes(fid) ? expectedKeys.get(o.key) : undefined;
    if (exp === undefined && o.members !== undefined && applicable.includes(fid)) {
      exp = sccExpected.find(([, k]) => k.functionId === fid && o.members?.includes(k.filePath) === true)?.[1];
      if (exp !== undefined) sccOverlapMatches += 1;
    }
    if (exp !== undefined) {
      detectedBy.add(fid);
      if (exp.lineRule !== 'none' && exp.line !== undefined && o.v.line !== undefined) lineChecks.push(o.v.line === exp.line);
      continue;
    }
    if (isCollateral(o)) {
      collateral.push(o.key);
      collateralFunctions.push(fid);
      continue;
    }
    if (isExcluded(o.v)) {
      excluded.push(fid);
      continue;
    }
    addFp(o.key, fid);
  }
  for (const v of neuralFp) addFp(neuralMatchKey(v), v.functionId);
  const detected = sortStrings(detectedBy);
  return {
    instance: {
      ...base, dimension, tags, status: detected.length > 0 ? 'matched' : 'missed', detectedBy: detected,
      lineConfirmed: lineChecks.length === 0 ? null : lineChecks.every(Boolean),
      collateral: sortStrings(collateral), undeclaredNew: sortStrings(undeclared),
    },
    perFunction: applicable.map((functionId) => ({ functionId, detected: detectedBy.has(functionId) })),
    fps, twinFps: [], items, collateralFunctions, notApplicable, metricKeyExcluded: excluded, metricCrossing,
    sccOverlapMatches, judgeCollateral, preExisting: diff.preExisting, info,
  };
}

// ---------------------------------------------------------------------------------------------
// Evidence: FLOWS_TO edges, judge probes, denominators (BR-U5b-22, 23, 24)

/** Edge evidence of a row with `expected.expectedEdges` (BR-U5b-22); `{}` in either report is refused. */
function edgeEvidenceOf(p: AcceptedPair): { ok: true; value: EdgeEvidence[] } | { ok: false; detail: string } {
  const declared = p.row.expected.expectedEdges ?? [];
  if (declared.length === 0) return { ok: true, value: [] };
  const b = p.baseline.graphStats.edgeCountByType;
  const s = p.seeded.graphStats.edgeCountByType;
  if (Object.keys(b).length === 0 || Object.keys(s).length === 0) {
    return { ok: false, detail: `${p.row.seedId}: graphStats.edgeCountByType is empty in the ${Object.keys(b).length === 0 ? 'baseline' : 'seeded'} report` };
  }
  // `expectedEdges` entries are FLOWS_TO edges only (U5a `FlowsToEdge`); declared = their number.
  const baseline = b.FLOWS_TO ?? 0;
  const seeded = s.FLOWS_TO ?? 0;
  const declaredCount = declared.length;
  return {
    ok: true,
    value: [{ seedId: p.row.seedId, negative: p.row.expected.negative === true, edgeType: 'FLOWS_TO', baseline, seeded, delta: seeded - baseline, declared: declaredCount, pass: seeded - baseline === declaredCount }],
  };
}

type NeuralRow = NonNullable<EvaluationReport['neuralResults']>[number];

function neuralRowOf(report: EvaluationReport, template: string): NeuralRow | undefined {
  const ids = new Set(report.functionResults.filter((r) => (r as typeof r & { readonly name?: string }).name === template).map((r) => String(r.functionId)));
  return report.neuralResults?.find((n) => ids.has(String(n.functionId)));
}

/**
 * Judge probe (BR-U5b-23): detected when the probed function has a failing unit covering an edited or created file
 * of the row that does not fail on the baseline; `inSelection` when every such file lies inside a baseline-selected
 * unit, `coverageShare` the share that does.
 */
function judgeProbeResult(p: AcceptedPair, probe: JudgeProbeKind): JudgeProbeResult {
  const template = JUDGE_PROBE_TEMPLATE[probe];
  const touched = new Set([...p.row.editedFiles, ...p.row.createdFiles]);
  const seededRow = neuralRowOf(p.seeded, template);
  const baseRow = neuralRowOf(p.baseline, template);
  const baseFailing = new Set((baseRow?.unitResults ?? []).filter((u) => u.verdict === 'fail').map((u) => u.unitId));
  const detected = (seededRow?.unitResults ?? []).some(
    (u) => u.verdict === 'fail' && !baseFailing.has(u.unitId) && u.filePaths.some((f) => touched.has(f)),
  );
  const selected = new Set(baseRow?.selection.selectedUnitIds ?? []);
  const selectedFiles = new Set((baseRow?.unitResults ?? []).filter((u) => selected.has(u.unitId)).flatMap((u) => u.filePaths));
  const covered = [...touched].filter((f) => selectedFiles.has(f)).length;
  const coverageShare = touched.size === 0 ? 0 : covered / touched.size;
  return {
    seedId: p.row.seedId, probe, negative: p.row.expected.negative === true, runIndex: p.seededRecord.cell?.runIndex ?? 0,
    detected, inSelection: touched.size > 0 && covered === touched.size, coverageShare,
  };
}

/** A `denominators.csv` row with U3's identities I1 and I2 (BR-U5b-24). */
export function denominatorRow(seedId: string | null, runId: string, r: EvaluationReport, notApplicable: number, metricKeyExcluded: number): DenominatorRow {
  const fe = r.functionExecution;
  const i1 = fe.declared + fe.adrDerived === fe.compiled + fe.disabled + fe.dropped.length;
  const i2 = fe.compiled === fe.executed + fe.failed.length + fe.skippedByMode;
  return {
    seedId, runId, declared: fe.declared, adrDerived: fe.adrDerived, compiled: fe.compiled, disabled: fe.disabled,
    dropped: fe.dropped.length, droppedIds: sortStrings(fe.dropped), skippedByMode: fe.skippedByMode, executed: fe.executed,
    failed: fe.failed.length, notApplicable, metricKeyExcluded, identityOk: i1 && i2,
  };
}

// ---------------------------------------------------------------------------------------------
// Function sensitivity probes (BR-U5b-78)

export interface SensitivityInput {
  readonly rule: MatchingRule;
  /** Rows with `split: 'probe'` (SP-*), each against its own baseline. */
  readonly probes: readonly SeedInput[];
  /** Function ids disabled (`enabled: false` + reason) in a later registered spec version (ADR-016 b). */
  readonly laterDisabled?: ReadonlySet<string>;
  /** `ExperimentPlan.fixAttempts` of the sensitivity plan. */
  readonly fixAttempts?: readonly { readonly functionId: string; readonly ref: string }[];
  readonly pinnedJudge?: PinnedJudge;
}

export type SensitivityOutcome =
  | { readonly ok: true; readonly results: readonly FunctionSensitivityResult[] }
  | { readonly ok: false; readonly code: typeof SENSITIVITY_EXCLUSION_UNSUPPORTED | typeof SCORE_INPUT_REJECTED; readonly detail: string };

/**
 * Scores SP-* probes (BR-U5b-78): `pass` when a new violation of the probe's target function has a key in
 * `expected.keys[]` (key rules BR-U5b-02..04; line confirmation recorded, never changing `pass`); a rejected run gives
 * `pass: null`. `excludedAfterFail` only for a failed probe whose function a later spec disables, with the fix
 * attempt named; a later-disabled function without a failed probe and a recorded fix attempt is refused.
 */
export function scoreSensitivity(input: SensitivityInput): SensitivityOutcome {
  const results: FunctionSensitivityResult[] = [];
  const fix = new Map((input.fixAttempts ?? []).map((f) => [f.functionId, f.ref] as const));
  for (const seed of [...input.probes].sort((a, b) => (a.row.seedId < b.row.seedId ? -1 : a.row.seedId > b.row.seedId ? 1 : 0))) {
    const row = seed.row;
    if (row.split !== 'probe') return { ok: false, code: SCORE_INPUT_REJECTED, detail: `${row.seedId}: split ${row.split} is not a probe row` };
    const functionId = row.expected.functionIds[0] ?? '';
    const acc = acceptPair(seed, input.pinnedJudge);
    if (!acc.ok) {
      results.push({ probeId: row.operatorId, functionId, pass: null, lineConfirmed: null, excludedAfterFail: false, rejectedReason: acc.reason });
      continue;
    }
    const diff = diffPair(acc.pair.baseline, acc.pair.seeded);
    const keys = new Map(row.expected.keys.filter((k) => k.functionId === functionId).map((k) => [expectedMatchKey(k), k] as const));
    const hits = diff.fresh.filter((o) => o.v.functionId === functionId && keys.has(o.key));
    const lineChecks = hits.flatMap((o) => {
      const k = keys.get(o.key);
      return k === undefined || k.lineRule === 'none' || k.line === undefined || o.v.line === undefined ? [] : [o.v.line === k.line];
    });
    const pass = hits.length > 0;
    const disabledLater = input.laterDisabled?.has(functionId) === true;
    const ref = fix.get(functionId);
    results.push({
      probeId: row.operatorId, functionId, pass, lineConfirmed: lineChecks.length === 0 ? null : lineChecks.every(Boolean),
      excludedAfterFail: !pass && disabledLater && ref !== undefined, ...(ref !== undefined && { fixAttemptRef: ref }),
    });
  }
  for (const f of sortStrings(input.laterDisabled ?? [])) {
    const failed = results.some((r) => r.functionId === f && r.pass === false);
    if (!failed || !fix.has(f)) {
      return { ok: false, code: SENSITIVITY_EXCLUSION_UNSUPPORTED, detail: `${f} is disabled in a later spec without ${failed ? 'a recorded fix attempt' : 'a failed probe'}` };
    }
  }
  return { ok: true, results };
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
  // BR-U5b-20, 21: the split total, the base-kind stratum and the coverage stratum; never across splits.
  return [JSON.stringify([i.split, 'all', 'all']), JSON.stringify([i.split, i.baseKind, 'all']), JSON.stringify([i.split, 'all', i.coverage])];
}

function tagRows(tags: readonly string[], templates: readonly (string | undefined)[]): string[] {
  return templates.includes(DATA_FLOW_TEMPLATE) ? [...tags, DATA_FLOW_SUB_ROW] : [...tags];
}

function increment(m: Map<string, number>, k: string): void {
  m.set(k, (m.get(k) ?? 0) + 1);
}

/** Scores the seeds (BR-U5b-02..25; SP-* probe rows are left to `scoreSensitivity`). */
export function scoreDifferential(input: ScoreInput): ScoreOutcome {
  const pairs: AcceptedPair[] = [];
  for (const seed of input.seeds) {
    const unkeyed = checkCollateral(seed.row);
    if (unkeyed !== undefined) return { ok: false, code: SCORE_COLLATERAL_UNKEYED, detail: unkeyed };
    const acc = acceptPair(seed, input.pinnedJudge);
    if (!acc.ok) return { ok: false, code: SCORE_INPUT_REJECTED, detail: acc.reason };
    pairs.push(acc.pair);
  }
  const probeOps = new Map(input.judgeProbeOperators ?? []);
  for (const p of pairs) if (p.row.expected.negative !== true && p.row.expected.judgeProbe !== undefined) probeOps.set(p.row.operatorId, p.row.expected.judgeProbe);
  const judgeProbeOf = (p: AcceptedPair): JudgeProbeKind | undefined =>
    p.row.expected.negative === true ? probeOps.get(p.row.operatorId) ?? probeOps.get(p.row.expected.twinOf) : p.row.expected.judgeProbe;
  const edgeEvidence: EdgeEvidence[] = [];
  const judgeProbe: JudgeProbeResult[] = [];
  const denominators = new Map<string, DenominatorRow>();
  const scored: AcceptedPair[] = [];
  for (const p of pairs) {
    if (p.row.split === 'probe') continue; // SP-* probes: scoreSensitivity only (BR-U5b-20, 78)
    const edges = edgeEvidenceOf(p);
    if (!edges.ok) return { ok: false, code: EDGE_EVIDENCE_UNAVAILABLE, detail: edges.detail };
    edgeEvidence.push(...edges.value);
    const probe = judgeProbeOf(p);
    if (probe !== undefined) {
      judgeProbe.push(judgeProbeResult(p, probe));
      continue;
    }
    scored.push(p);
  }
  const readiness = input.metricKeyReadiness;
  const ctx: ClassifyContext = {
    excludedFunctions: new Set(input.rule.metricKeyExclusions),
    excludedTemplates: new Set(readiness === undefined || (readiness.projectLevelKeys && readiness.rowFilters) ? [] : METRIC_KEY_TEMPLATES),
    thresholds: input.thresholds,
  };
  const perFunction = new Map<string, Map<string, Cell>>();
  const perDimension = new Map<string, Map<string, Cell>>();
  const perTag = new Map<string, Map<string, Cell>>();
  const overall = new Map<string, Map<string, Cell>>();
  const collateralByFunction = new Map<string, number>();
  const notApplicable = new Map<string, number>();
  const metricKeyExclusions = new Map<string, number>();
  const instances: InstanceResult[] = [];
  const items: P1Item[] = [];
  let preExistingIgnored = 0;
  let executedFunctions = 0;
  let siteInvalid = 0;
  let metricCrossings = 0;
  let sccOverlapMatches = 0;
  let judgeCollateral = 0;
  const twins = { clean: 0, scored: 0 };
  for (const pair of [...scored].sort((a, b) => (a.row.seedId < b.row.seedId ? -1 : a.row.seedId > b.row.seedId ? 1 : 0))) {
    const o = classifySeed(pair, ctx);
    if (!denominators.has(pair.baselineRecord.runId)) denominators.set(pair.baselineRecord.runId, denominatorRow(null, pair.baselineRecord.runId, pair.baseline, 0, 0));
    denominators.set(`${pair.row.seedId}\u0000${pair.seededRecord.runId}`, denominatorRow(pair.row.seedId, pair.seededRecord.runId, pair.seeded, o.notApplicable.length, o.metricKeyExcluded.length));
    const i = o.instance;
    instances.push(i);
    items.push(...o.items);
    preExistingIgnored += o.preExisting;
    sccOverlapMatches += o.sccOverlapMatches;
    judgeCollateral += o.judgeCollateral;
    executedFunctions = Math.max(executedFunctions, pair.seeded.functionExecution.executed);
    for (const f of o.collateralFunctions) increment(collateralByFunction, f);
    for (const f of o.notApplicable) increment(notApplicable, f);
    for (const f of o.metricKeyExcluded) increment(metricKeyExclusions, f);
    if (i.status === 'site-invalid') siteInvalid += 1;
    if (o.metricCrossing) metricCrossings += 1;
    if (i.status === 'twin-clean' || i.status === 'twin-fired') {
      twins.scored += 1;
      if (i.status === 'twin-clean') twins.clean += 1;
    }
    if (i.split === 'probe') continue; // probes never enter a P/R table (BR-U5b-20)
    const scoredPositive = i.status === 'matched' || i.status === 'missed';
    const templates = o.perFunction.map((p) => o.info.get(p.functionId)?.template);
    for (const stratum of strataOf(i)) {
      const fpCells = (fid: string): Cell[] => {
        const fi = o.info.get(fid);
        return [
          bump(perFunction, stratum, fid),
          bump(overall, stratum, ''),
          ...(fi === undefined ? [] : [bump(perDimension, stratum, fi.dimension)]),
          ...(fi?.tag === undefined ? [] : tagRows([fi.tag], [fi.template]).map((t) => bump(perTag, stratum, t))),
        ];
      };
      for (const fp of o.twinFps) for (const c of fpCells(fp.functionId)) c.twinFpItems.push(fp.itemId);
      if (!scoredPositive) continue;
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
        if (i.status === 'matched') c.tp += 1;
        else c.fn += 1;
      }
      for (const fp of o.fps) for (const c of fpCells(fp.functionId)) c.fpItems.push(fp.itemId);
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
      notApplicable,
      siteInvalid,
      metricCrossings,
      metricKeyExclusions,
      sccOverlapMatches,
      judgeCollateral,
      twinSpecificity: twins,
      edgeEvidence: [...edgeEvidence].sort((a, b) => (a.seedId < b.seedId ? -1 : a.seedId > b.seedId ? 1 : 0)),
      judgeProbe: [...judgeProbe].sort((a, b) => (a.seedId < b.seedId ? -1 : a.seedId > b.seedId ? 1 : a.runIndex - b.runIndex)),
      denominators: [...denominators.values()].sort((a, b) => {
        const ka = `${a.seedId ?? ''}\u0000${a.runId}`;
        const kb = `${b.seedId ?? ''}\u0000${b.runId}`;
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      }),
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
// Metric thresholds (BR-U5b-15): parsed from the spec at the row's `specSha256` (C3 `parseSpec` and the compiled
// functions, through U5a's `loadCompiledSpec`), refusing a spec file whose bytes no longer match the recorded hash.

export async function metricThresholds(
  repoRoot: string,
  rows: readonly ManifestRow[],
): Promise<{ ok: true; value: Map<string, Record<string, number>> } | { ok: false; detail: string }> {
  const out = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (out.has(row.specSha256)) continue;
    const compiled = await loadCompiledSpec(repoRoot, row.specPath);
    if (!compiled.success) return { ok: false, detail: `${row.seedId}: spec ${row.specPath}: ${compiled.errors.map((e) => e.message).join('; ')}` };
    if (compiled.data.specSha256 !== row.specSha256) {
      return { ok: false, detail: `${row.seedId}: spec ${row.specPath} sha256 ${compiled.data.specSha256} != recorded ${row.specSha256}` };
    }
    out.set(row.specSha256, compiledThresholds(compiled.data));
  }
  return { ok: true, value: out };
}

// ---------------------------------------------------------------------------------------------
// Case loading (a directory with `manifest.json` and `reports/<name>.json` + `reports/<name>.run.json`)

export interface LoadedCase {
  readonly manifest: Manifest;
  readonly seeds: readonly SeedInput[];
  /** `metricKeyReadiness` of `<case>/frozen-instrument.json`, else `corpus/frozen-instrument.json`, when present. */
  readonly metricKeyReadiness?: MetricKeyReadiness;
}

function readReadiness(repoRoot: string, dir: string): MetricKeyReadiness | undefined {
  for (const f of [join(dir, 'frozen-instrument.json'), join(repoRoot, 'corpus/frozen-instrument.json')]) {
    if (!existsSync(f)) continue;
    const r = (readJson(f) as { readonly metricKeyReadiness?: MetricKeyReadiness }).metricKeyReadiness;
    if (r !== undefined) return r;
  }
  return undefined;
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
  const metricKeyReadiness = readReadiness(repoRoot, dir);
  return { ok: true, value: { manifest: manifest.data, seeds, ...(metricKeyReadiness !== undefined && { metricKeyReadiness }) } };
}

// ---------------------------------------------------------------------------------------------
// Judge-probe operators from U5a's catalogue registry (twins of judge probes carry no `judgeProbe`; BR-U5b-23)

export function judgeProbeOperators(repoRoot: string): Map<string, JudgeProbeKind> {
  const out = new Map<string, JudgeProbeKind>();
  const reg = loadCatalogueRegistry(repoRoot);
  if (!reg.success) return out;
  for (const op of reg.data.list()) {
    const probe = op.judgeProbe ?? (op.twinOf === undefined ? undefined : reg.data.get(op.twinOf)?.judgeProbe);
    if (probe !== undefined) out.set(op.id, probe);
  }
  return out;
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

export async function main(argv: readonly string[], repoRoot: string, io: ScoreMainIo, loadRule: (root: string) => RuleLoad): Promise<number> {
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
  const thresholds = await metricThresholds(repoRoot, loaded.value.manifest.rows);
  if (!thresholds.ok) {
    io.err(`${SCORE_INPUT_REJECTED}: ${thresholds.detail}\n`);
    return 1;
  }
  const result = scoreDifferential({
    rule: rule.rule, seeds: loaded.value.seeds, rejections: loaded.value.manifest.rejections, thresholds: thresholds.value,
    judgeProbeOperators: judgeProbeOperators(repoRoot),
    ...(loaded.value.metricKeyReadiness !== undefined && { metricKeyReadiness: loaded.value.metricKeyReadiness }),
    ...(labels !== undefined && { labels }),
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
