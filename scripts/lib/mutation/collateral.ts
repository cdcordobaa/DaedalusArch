/**
 * Site collateral of one application (FR-v1.2E-24; BR-U5a-14 i–iv; `business-logic-model.md` §2.2 "Site collateral").
 *
 * Computed after the mutant type-check gate from the base import graph `G` and the mutant graph `G'` (both from
 * `buildImportGraph`, BR-U5a-56), never from a detector output:
 *
 * 0. `edges(G') − edges(G)` (as (source, target) pairs, any type) must equal the operator's planned `newEdges`;
 *    otherwise `MUT_NEW_EDGES_MISMATCH` (the cycle-cap precondition simulated the wrong edges).
 * 1. **cycle** — for the spec's `no-cyclic-deps` function, the new cycles under the explicit strategy
 *    (`cycles.ts`, D-U5a-14).
 * 2. **metric-crossing** — for each declared per-file metric template, every file of
 *    `violating(G') \ violating(G)` with the compiled threshold (spec value, else the registry default):
 *    key `(functionId, file, '', [])`, `lineRule: 'none'`, `metric {base, mutant, threshold}` (`base: null` when the
 *    file is absent or not considered in `G`).
 * 3. **created-without-test** — for the spec's `test-file-pairing` function, every created file that is a File of
 *    `G'` with a layer, not a barrel, not itself a `.spec.`/`.test.` file, and with no File
 *    `replace(path, '.ts', '.spec.ts')` / `.test.ts` in `G'` (the template's predicate).
 * 4. **project-metric** — for the spec's `abstraction-ratio` function, one keyless entry, only when the caller
 *    reports that the edit added or removed a class or interface (no catalogue edit does).
 *
 * A template the spec does not declare gives no entry. A key equal (by `functionId`, `filePath`, `target`,
 * `discriminator`) to an `expected.keys` entry or to an earlier collateral key is not repeated.
 */
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { newEdgePairs, siteCycleKeys } from './cycles.js';
import { isMetricTemplate, METRIC_DEFAULT_THRESHOLDS, metricValues, violates } from './metrics.js';
import type { CycleStrategy, ExpectedKey, ImportGraph, MutationEdit, SiteCollateral } from './types.js';

/** One compiled, enabled function of the spec as collateral needs it (Step 25 maps `compileFunctions` output). */
export interface CompiledFunctionRef {
  readonly functionId: string;
  readonly template: string;
  /** Compiled threshold (spec value, else the registry default); absent → registry default. */
  readonly threshold?: number;
}

export interface CollateralContext {
  readonly functions: readonly CompiledFunctionRef[];
  /** The spec's domain layer name (`domain-stability`), `null` when the spec has none. */
  readonly domainLayer: string | null;
  readonly cycleStrategy: CycleStrategy;
  readonly maxCycleLength: number;
  readonly cycleRowCap: number;
  /** `expected.keys` of the same application (collateral never repeats them). */
  readonly expectedKeys: readonly ExpectedKey[];
  /** The edit added or removed a class or interface (BR-U5a-14 iv). Default false. */
  readonly typesAddedOrRemoved?: boolean;
}

function fail<T>(code: string, message: string, context?: Record<string, unknown>): DomainResult<T> {
  return DomainResult.fail([{ code, message, ...(context !== undefined ? { context } : {}) }]);
}

function identity(k: ExpectedKey): string {
  return JSON.stringify([k.functionId, k.filePath, k.target, k.discriminator]);
}

function pairSet(pairs: readonly { readonly source: string; readonly target: string }[]): string[] {
  return [...new Set(pairs.map((p) => `${p.source} -> ${p.target}`))].sort();
}

/** True when the created file has a layer, is not a barrel or a test, and no `.spec.ts`/`.test.ts` File exists. */
export function createdWithoutTest(g: ImportGraph, file: string): boolean {
  const f = g.files.get(file);
  if (f === undefined) return false;
  if (f.layer === null || f.isBarrel) return false;
  if (file.includes('.spec.') || file.includes('.test.')) return false;
  return !g.files.has(file.replaceAll('.ts', '.spec.ts')) && !g.files.has(file.replaceAll('.ts', '.test.ts'));
}

export function siteCollateral(
  base: ImportGraph,
  mutant: ImportGraph,
  edit: MutationEdit,
  ctx: CollateralContext,
): DomainResult<SiteCollateral[]> {
  const actual = pairSet(newEdgePairs(base, mutant));
  const planned = pairSet(edit.newEdges);
  if (JSON.stringify(actual) !== JSON.stringify(planned)) {
    return fail('MUT_NEW_EDGES_MISMATCH', 'edges(G\') − edges(G) differs from the operator\'s planned newEdges', {
      actual,
      planned,
    });
  }

  const seen = new Set(ctx.expectedKeys.map(identity));
  const out: SiteCollateral[] = [];
  const push = (entry: SiteCollateral): void => {
    if (entry.key !== undefined) {
      const id = identity(entry.key);
      if (seen.has(id)) return;
      seen.add(id);
    }
    out.push(entry);
  };

  // (i) cycles
  for (const fn of ctx.functions) {
    if (fn.template !== 'no-cyclic-deps') continue;
    const keys = siteCycleKeys(base, mutant, ctx.cycleStrategy, {
      functionId: fn.functionId,
      maxLength: ctx.maxCycleLength,
      cap: ctx.cycleRowCap,
    });
    for (const key of keys) push({ kind: 'site', template: fn.template, functionId: fn.functionId, cause: 'cycle', key });
  }

  // (ii) metric crossings
  for (const fn of ctx.functions) {
    const template = fn.template;
    if (!isMetricTemplate(template)) continue;
    const threshold = fn.threshold ?? METRIC_DEFAULT_THRESHOLDS[template];
    const before = metricValues(base, template, ctx.domainLayer);
    const after = metricValues(mutant, template, ctx.domainLayer);
    for (const [file, value] of after) {
      if (!violates(template, value, threshold)) continue;
      const baseValue = before.get(file);
      if (baseValue !== undefined && violates(template, baseValue, threshold)) continue;
      push({
        kind: 'site',
        template,
        functionId: fn.functionId,
        cause: 'metric-crossing',
        key: { functionId: fn.functionId, filePath: file, target: '', discriminator: [], lineRule: 'none' },
        metric: { base: baseValue ?? null, mutant: value, threshold },
      });
    }
  }

  // (iii) created files without a test
  for (const fn of ctx.functions) {
    if (fn.template !== 'test-file-pairing') continue;
    for (const file of [...edit.createdFiles].sort()) {
      if (!createdWithoutTest(mutant, file)) continue;
      push({
        kind: 'site',
        template: fn.template,
        functionId: fn.functionId,
        cause: 'created-without-test',
        key: { functionId: fn.functionId, filePath: file, target: '', discriminator: [], lineRule: 'none' },
      });
    }
  }

  // (iv) project-level metric
  if (ctx.typesAddedOrRemoved === true) {
    for (const fn of ctx.functions) {
      if (fn.template !== 'abstraction-ratio') continue;
      push({ kind: 'site', template: fn.template, functionId: fn.functionId, cause: 'project-metric' });
    }
  }

  return DomainResult.ok(out);
}
