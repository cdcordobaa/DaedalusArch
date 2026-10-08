/**
 * Catalogue freeze tooling (FR-v1.2E-24 amendment; Q1, Q4, Q11; BR-U5a-36 b, c, BR-U5a-37;
 * `business-logic-model.md` §3–§4).
 *
 * - `measureBaseTypecheck` (gate b): every prepared base is copied to scratch, given its stubs (only on failed
 *   resolution, BR-U5a-10) and type-checked with its pinned tsc; per base the tsc version, error count, error codes
 *   and `excluded` (any error, BR-U5a-07). The prepared base is only read (BR-U5a-04).
 * - `siteFeasibility` (gate c): `findSites` + preconditions per operator per prepared base, no RNG, no detector, no
 *   edit. Golden-instance operators (BR-U5a-01: symbolic positives, not judge probes) form the main section; twins
 *   and judge probes a separate section; SP probes are never passed in.
 * - `chooseSitesPerOperator` (BR-U5a-37): over the **held-out golden section only**, k = the smallest of {2, 3}
 *   whose total `Σ min(k, eligible)` reaches 80; a chosen total above 120 is cut to 120 by a seeded subsample
 *   (`k = 'subsample'`, BR-U5a-15); if k = 3 does not reach 80, `CAT_SHORTFALL`.
 * - `compareDeclaredKeys` (gate a, pure): from the detector's violation keys of a baseline and of a mutant copy and
 *   the manifest row, the new keys, the expected / collateral keys, the undeclared new keys (the `project-metric`
 *   exception, BR-U5b-08, admits any new key of a function declared keyless) and, for an in-coverage positive with
 *   non-empty `functionIds`, whether an expected key is among the new keys. It reads no file.
 * - Writers of `Docs/DiagnosticRuns/u5a-base-typecheck.{json,md}` and `u5a-site-feasibility.{json,md}` to a
 *   directory argument.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { SYMBOLIC_DIMENSIONS } from '../../../src/shared/types/enums.js';
import type { ManifestRow, Split } from '../manifest.js';
import { CYCLE_ROW_CAP, MAX_CYCLE_LENGTH } from './cycles.js';
import { compiledParams, compiledThresholds, isStyleDisabled, loadCompiledSpec } from './expected.js';
import { buildImportGraph, openImportGraphProject } from './import-graph.js';
import { copyBase } from './prepare.js';
import { deriveSeed, mulberry32 } from './rng.js';
import { baseCycleCount, evaluatePreconditions, sortSites } from './sites.js';
import { collectImportUses, provisionStubs } from './stubs.js';
import { summariseErrors, typecheckProject } from './typecheck.js';
import type { MutationOperator, PreconditionContext, PreconditionReason, PreparedBase } from './types.js';

// ── (b) base type-check measurement ────────────────────────────────────────────────────────────────────────────

export interface BaseTypecheckRow {
  readonly projectId: string;
  readonly baseKind: PreparedBase['baseKind'];
  readonly tscVersion: string;
  readonly errorCount: number;
  readonly codes: Readonly<Record<string, number>>;
  /** Any error: the base is excluded before seeding (BR-U5a-07). */
  readonly excluded: boolean;
}

async function withAnalysisCopy<T>(base: PreparedBase, scratchRoot: string, body: (dir: string) => Promise<DomainResult<T>>): Promise<DomainResult<T>> {
  fs.mkdirSync(scratchRoot, { recursive: true });
  const parent = await fs.promises.mkdtemp(path.join(scratchRoot, 'u5a-freeze-'));
  const dir = path.join(parent, base.projectId);
  try {
    const copied = await copyBase(base, dir);
    if (!copied.success) return copied;
    const uses = collectImportUses(dir, base.tsconfigPath);
    if (!uses.success) return uses;
    const stubs = provisionStubs(dir, base.tsconfigPath, uses.data);
    if (!stubs.success) return stubs;
    return await body(dir);
  } finally {
    await fs.promises.rm(parent, { recursive: true, force: true });
  }
}

/** Gate (b): type-checks every prepared base on a scratch copy with its pinned tsc. */
export async function measureBaseTypecheck(
  runner: ProcessRunner,
  bases: readonly PreparedBase[],
  scratchRoot: string = os.tmpdir(),
): Promise<DomainResult<BaseTypecheckRow[]>> {
  const rows: BaseTypecheckRow[] = [];
  for (const base of bases) {
    const r = await withAnalysisCopy(base, scratchRoot, async (dir) => {
      const run = await typecheckProject(runner, base.tscPath, path.resolve(dir, ...base.tsconfigPath.split('/')));
      if (!run.success) return run;
      const s = summariseErrors(run.data.errors);
      return DomainResult.ok({ projectId: base.projectId, baseKind: base.baseKind, tscVersion: base.tscVersion, errorCount: s.errorCount, codes: s.codes, excluded: s.errorCount > 0 });
    });
    if (!r.success) return r;
    rows.push(r.data);
  }
  return DomainResult.ok(rows);
}

// ── (c) site feasibility ───────────────────────────────────────────────────────────────────────────────────────

/** `domain-entities.md` §4 `SiteFeasibilityRow`. */
export interface SiteFeasibilityRow {
  readonly projectId: string;
  readonly split: 'dev' | 'held-out';
  readonly operatorId: string;
  readonly candidates: number;
  readonly rejectedByReason: Readonly<Partial<Record<PreconditionReason, number>>>;
  readonly eligible: number;
  /** min(2, eligible). */
  readonly takenAtK2: number;
  /** min(3, eligible). */
  readonly takenAtK3: number;
}

export interface SiteFeasibilityTable {
  /** Golden-instance operators (BR-U5a-01): the only rows the k rule counts. */
  readonly golden: readonly SiteFeasibilityRow[];
  /** Twins and judge probes: sampled with the same k, never counted. */
  readonly twinsAndJudgeProbes: readonly SiteFeasibilityRow[];
}

export interface FeasibilityInput {
  readonly base: PreparedBase;
  readonly split: 'dev' | 'held-out';
}

/** BR-U5a-01: a symbolic positive that is not a judge probe. */
export function isGoldenInstanceOperator(op: MutationOperator): boolean {
  return op.role === 'positive' && op.judgeProbe === undefined && (SYMBOLIC_DIMENSIONS as readonly string[]).includes(op.dimension);
}

function row(projectId: string, split: 'dev' | 'held-out', operatorId: string, candidates: number, rejectedByReason: Partial<Record<PreconditionReason, number>>, eligible: number): SiteFeasibilityRow {
  return { projectId, split, operatorId, candidates, rejectedByReason, eligible, takenAtK2: Math.min(2, eligible), takenAtK3: Math.min(3, eligible) };
}

/** Gate (c): `findSites` + preconditions per operator per base (no RNG, no detector, no edit). */
export async function siteFeasibility(
  repoRoot: string,
  inputs: readonly FeasibilityInput[],
  operators: readonly MutationOperator[],
  scratchRoot: string = os.tmpdir(),
): Promise<DomainResult<SiteFeasibilityTable>> {
  const golden: SiteFeasibilityRow[] = [];
  const other: SiteFeasibilityRow[] = [];
  for (const { base, split } of inputs) {
    const compiledR = await loadCompiledSpec(repoRoot, base.specPath);
    if (!compiledR.success) return compiledR;
    const compiled = compiledR.data;
    const r = await withAnalysisCopy(base, scratchRoot, (dir) => {
      const handle = openImportGraphProject(dir, base.tsconfigPath);
      const baseGraph = buildImportGraph(handle, compiled.layers);
      const ctx: PreconditionContext = {
        base,
        baseGraph,
        baseCycleCount: baseCycleCount(baseGraph, MAX_CYCLE_LENGTH, CYCLE_ROW_CAP),
        maxCycleLength: MAX_CYCLE_LENGTH,
        cycleRowCap: CYCLE_ROW_CAP,
        thresholds: compiledThresholds(compiled),
        templateParams: compiledParams(compiled),
        enabledTemplates: [...compiled.enabled.keys()],
      };
      for (const op of operators) {
        if (op.role === 'probe') continue;
        const candidates = sortSites(op.findSites(handle, compiled.spec));
        let out: SiteFeasibilityRow;
        if (op.role === 'positive' && isStyleDisabled(compiled, op.expectedTemplates.map((t) => t.template))) {
          out = row(base.projectId, split, op.id, candidates.length, candidates.length > 0 ? { 'style-disabled': candidates.length } : {}, 0);
        } else {
          const tally = evaluatePreconditions(op, handle, compiled.spec, candidates, ctx);
          out = row(base.projectId, split, op.id, candidates.length, tally.rejectedByReason, tally.eligible.length);
        }
        (isGoldenInstanceOperator(op) ? golden : other).push(out);
      }
      return Promise.resolve(DomainResult.ok(undefined));
    });
    if (!r.success) return r;
  }
  return DomainResult.ok({ golden, twinsAndJudgeProbes: other });
}

// ── BR-U5a-37 sitesPerOperator ─────────────────────────────────────────────────────────────────────────────────

export const K_TARGET_MIN = 80;
export const K_TARGET_MAX = 120;

export interface SubsampledInstance {
  readonly projectId: string;
  readonly operatorId: string;
  /** 0-based application index within (project, operator). */
  readonly k: number;
}

export interface SitesPerOperatorChoice {
  readonly k: 2 | 3;
  readonly totalAtK2: number;
  readonly totalAtK3: number;
  /** Instances kept: the chosen-k total, or 120 after the subsample. */
  readonly total: number;
  /** Present when the chosen-k total exceeded 120 (`k = 'subsample'` seed). */
  readonly subsample?: readonly SubsampledInstance[];
}

/** Held-out golden totals at k = 2 and k = 3 (twins, judge probes, dev rows and probes excluded). */
export function heldOutTotals(rows: readonly SiteFeasibilityRow[]): { readonly k2: number; readonly k3: number } {
  let k2 = 0;
  let k3 = 0;
  for (const r of rows) {
    if (r.split !== 'held-out') continue;
    k2 += r.takenAtK2;
    k3 += r.takenAtK3;
  }
  return { k2, k3 };
}

function instanceOrder(a: SubsampledInstance, b: SubsampledInstance): number {
  if (a.projectId !== b.projectId) return a.projectId < b.projectId ? -1 : 1;
  if (a.operatorId !== b.operatorId) return a.operatorId < b.operatorId ? -1 : 1;
  return a.k - b.k;
}

/**
 * The seeded subsample (`k = 'subsample'`, BR-U5a-15): from the held-out golden instances at `k`
 * (`min(k, eligible)` per row), `max` drawn with mulberry32 (partial Fisher–Yates over the ordered pool), returned
 * in (project, operator, k) order. Reproducible for a given master seed and table.
 */
export function subsampleInstances(rows: readonly SiteFeasibilityRow[], k: 2 | 3, masterSeed: number, max: number = K_TARGET_MAX): SubsampledInstance[] {
  const pool: SubsampledInstance[] = [];
  for (const r of rows) {
    if (r.split !== 'held-out') continue;
    const taken = k === 2 ? r.takenAtK2 : r.takenAtK3;
    for (let i = 0; i < taken; i++) pool.push({ projectId: r.projectId, operatorId: r.operatorId, k: i });
  }
  pool.sort(instanceOrder);
  const rng = mulberry32(deriveSeed(masterSeed, { projectId: 'catalogue', operatorId: 'sitesPerOperator', k: 'subsample' }));
  return [...rng.pickDistinct(pool, max)].sort(instanceOrder);
}

/**
 * BR-U5a-37 over the golden section: k = 2 when its held-out total reaches 80, else k = 3 when its total reaches
 * 80, else `CAT_SHORTFALL`. A chosen total above 120 is cut to 120 by the seeded subsample. (Since
 * `Σ min(3, e) ≤ 1.5 · Σ min(2, e)`, a k = 3 total above 120 implies a k = 2 total of at least 80; the 120 cap
 * therefore applies to the chosen k, DV-U5a-22.)
 */
export function chooseSitesPerOperator(table: Pick<SiteFeasibilityTable, 'golden'>, masterSeed: number): DomainResult<SitesPerOperatorChoice> {
  const { k2, k3 } = heldOutTotals(table.golden);
  let k: 2 | 3;
  if (k2 >= K_TARGET_MIN) k = 2;
  else if (k3 >= K_TARGET_MIN) k = 3;
  else {
    return DomainResult.fail([
      {
        code: 'CAT_SHORTFALL',
        message: `held-out golden total at k = 3 is ${String(k3)} < ${String(K_TARGET_MIN)}; no k chosen (author decision, BR-U5a-37)`,
        context: { totalAtK2: k2, totalAtK3: k3 },
      },
    ]);
  }
  const total = k === 2 ? k2 : k3;
  if (total <= K_TARGET_MAX) return DomainResult.ok({ k, totalAtK2: k2, totalAtK3: k3, total });
  return DomainResult.ok({ k, totalAtK2: k2, totalAtK3: k3, total: K_TARGET_MAX, subsample: subsampleInstances(table.golden, k, masterSeed) });
}

// ── (a) declaration gate comparison (pure) ─────────────────────────────────────────────────────────────────────

/** One detector violation projected to the scorer key (U5bP Q2). */
export interface ViolationKeyInput {
  readonly functionId: string;
  readonly filePath: string;
  readonly target?: string;
  readonly discriminator?: readonly string[];
}

/** The violations of one evaluated project (baseline or mutant copy). */
export interface EvaluatedViolations {
  readonly violations: readonly ViolationKeyInput[];
}

export interface DeclarationGateRow {
  readonly seedId: string;
  readonly operatorId: string;
  readonly newKeys: readonly string[];
  readonly expectedKeys: readonly string[];
  readonly collateralKeys: readonly string[];
  /** New keys outside `expected.keys ∪ collateral keys` (project-metric functions exempt). */
  readonly undeclared: readonly string[];
  /** In-coverage positive with non-empty `functionIds` and no expected key among the new keys. */
  readonly missingExpected: boolean;
  readonly passed: boolean;
}

/** `(functionId, filePath, target, discriminator)` as one comparable string. */
export function keyString(k: ViolationKeyInput): string {
  return JSON.stringify([k.functionId, k.filePath, k.target ?? '', [...(k.discriminator ?? [])]]);
}

/** BR-U5a-36 (a) for one manifest row against its baseline. */
export function compareDeclaredKeys(baseline: EvaluatedViolations, mutant: EvaluatedViolations, row: ManifestRow): DeclarationGateRow {
  const before = new Set(baseline.violations.map(keyString));
  const newKeys = [...new Set(mutant.violations.map(keyString))].filter((k) => !before.has(k)).sort();
  const expectedKeys = row.expected.keys.map(keyString).sort();
  const collateralKeys = row.expected.collateral.flatMap((c) => (c.key !== undefined ? [keyString(c.key)] : [])).sort();
  const keyless = new Set(row.expected.collateral.filter((c) => c.cause === 'project-metric').map((c) => c.functionId));
  const declared = new Set([...expectedKeys, ...collateralKeys]);
  const undeclared = newKeys.filter((k) => {
    if (declared.has(k)) return false;
    const parsed = JSON.parse(k) as [string, ...unknown[]];
    return !keyless.has(parsed[0]);
  });
  const isPositive = !('negative' in row.expected);
  const inCoverage = row.expected.coverage === 'in';
  const fnIds = 'functionIds' in row.expected ? row.expected.functionIds : [];
  const missingExpected = isPositive && inCoverage && fnIds.length > 0 && !expectedKeys.some((k) => newKeys.includes(k));
  return { seedId: row.seedId, operatorId: row.operatorId, newKeys, expectedKeys, collateralKeys, undeclared, missingExpected, passed: undeclared.length === 0 && !missingExpected };
}

// ── Writers (to a directory argument) ──────────────────────────────────────────────────────────────────────────

export const BASE_TYPECHECK_STEM = 'u5a-base-typecheck';
export const SITE_FEASIBILITY_STEM = 'u5a-site-feasibility';

function writePair(outDir: string, stem: string, json: unknown, md: string): readonly string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const j = path.join(outDir, `${stem}.json`);
  const m = path.join(outDir, `${stem}.md`);
  fs.writeFileSync(j, JSON.stringify(json, null, 2) + '\n');
  fs.writeFileSync(m, md);
  return [j, m];
}

/** Writes `u5a-base-typecheck.{json,md}`; returns the two paths. */
export function writeBaseTypecheckTable(outDir: string, rows: readonly BaseTypecheckRow[], measuredAt: string): readonly string[] {
  const lines = [
    '# U5a base type-check measurement (BR-U5a-36 b)',
    '',
    `Measured ${measuredAt}. Each prepared base type-checked on a scratch copy with its pinned tsc; any error excludes the base before seeding (BR-U5a-07).`,
    '',
    '| Project | Base kind | tsc | Errors | Codes | Excluded |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.projectId} | ${r.baseKind} | ${r.tscVersion} | ${String(r.errorCount)} | ${Object.entries(r.codes).map(([c, n]) => `${c} ${String(n)}`).join(', ') || '—'} | ${r.excluded ? 'yes' : 'no'} |`),
    '',
  ];
  return writePair(outDir, BASE_TYPECHECK_STEM, { measuredAt, rows }, lines.join('\n'));
}

function feasibilityLines(rows: readonly SiteFeasibilityRow[]): string[] {
  return [
    '| Project | Split | Operator | Candidates | Rejected by reason | Eligible | k=2 | k=3 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.projectId} | ${r.split} | ${r.operatorId} | ${String(r.candidates)} | ${Object.entries(r.rejectedByReason).map(([k, n]) => `${k} ${String(n)}`).join(', ') || '—'} | ${String(r.eligible)} | ${String(r.takenAtK2)} | ${String(r.takenAtK3)} |`,
    ),
  ];
}

/** Writes `u5a-site-feasibility.{json,md}` (golden section, then twins and judge probes); returns the two paths. */
export function writeSiteFeasibilityTable(outDir: string, table: SiteFeasibilityTable, choice: DomainResult<SitesPerOperatorChoice>, measuredAt: string): readonly string[] {
  const totals = heldOutTotals(table.golden);
  const verdict = choice.success
    ? `k = ${String(choice.data.k)} (held-out golden total ${String(choice.data.total)}${choice.data.subsample !== undefined ? ', seeded subsample to 120' : ''})`
    : `no k: ${choice.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}`;
  const lines = [
    '# U5a site-feasibility table (BR-U5a-36 c, BR-U5a-37)',
    '',
    `Measured ${measuredAt}. findSites + preconditions per operator per prepared base; no RNG, no detector, no edit.`,
    '',
    `Held-out golden totals: k = 2 → ${String(totals.k2)}, k = 3 → ${String(totals.k3)}. Rule: ${verdict}.`,
    '',
    '## Golden-instance operators (counted)',
    '',
    ...feasibilityLines(table.golden),
    '',
    '## Twins and judge probes (sampled with the same k, not counted)',
    '',
    ...feasibilityLines(table.twinsAndJudgeProbes),
    '',
  ];
  return writePair(outDir, SITE_FEASIBILITY_STEM, { measuredAt, totals, choice: choice.success ? choice.data : { errors: choice.errors }, ...table }, lines.join('\n'));
}

/** The split a feasibility input may carry (dev fixtures, held-out corpus and frozen E7). */
export type FeasibilitySplit = Extract<Split, 'dev' | 'held-out'>;
