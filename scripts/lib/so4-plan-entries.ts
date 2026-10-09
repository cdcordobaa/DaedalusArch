/**
 * Seeded plan entries from a U5a manifest (ADR-021 item 9, SO4-04 convention; P-U6 runbook, step "SO4 entries").
 *
 * A registered SO4 plan (`experiments/so4-heldout/plan.json`) names its baseline entries before `mutate` runs
 * (ADR-021 item 5). After `mutate`, every manifest row becomes one seeded entry, written in the registered form:
 *
 * - `projectId` = the row's `seedId` (`<projectId>:<operatorId>:<k>`; `runIdOf` sanitises the colons);
 * - `path` = the seeded copy `<copies>/<projectId>/<operatorId>/k-<k>` (U5a `applyMutation` layout);
 * - `specPath` = the baseline entry's spec, which must be the spec the row was mutated under;
 * - `seed` = `{ seedId, baseProjectId, split, baseKind, manifestPath, baselineReportPath }`, where
 *   `baselineReportPath = reports/<runIdOf(planId, baseline entry)>.json` is known before the run.
 *
 * Baseline entries keep their positions (indices 0..n-1, so their run ids do not move); seeded entries follow in
 * manifest order. Earlier seeded entries of the plan are replaced, so the step is idempotent. Manifest rejections
 * add no entry (score-golden lists them as `manifestRejections`). Pure: reading and writing is the CLI's.
 */
import { join, posix } from 'node:path';
import type { ManifestRow } from './manifest.js';
import type { SeedRef } from './report-io.js';

export const SO4_PLAN_BASELINE_MISSING = 'SO4_PLAN_BASELINE_MISSING';
export const SO4_PLAN_SPEC_MISMATCH = 'SO4_PLAN_SPEC_MISMATCH';
export const SO4_PLAN_SEED_INVALID = 'SO4_PLAN_SEED_INVALID';

/** The plan fields this step reads and writes (structurally `ExperimentPlan` of `run-experiment.ts`). */
export interface So4PlanLike {
  readonly id: string;
  readonly projects: readonly So4PlanEntry[];
}
export interface So4PlanEntry {
  readonly projectId: string;
  readonly path: string;
  readonly specPath: string;
  readonly seed?: SeedRef;
}

export type ManifestRowView = Pick<ManifestRow, 'seedId' | 'projectId' | 'operatorId' | 'split' | 'baseKind' | 'specPath'>;

/** `run-experiment.ts` `runIdOf` for an entry at `index` (restated: a lib does not import the harness; tested equal). */
export function so4RunIdOf(planId: string, index: number, projectId: string): string {
  return `${planId}-${String(index).padStart(3, '0')}-${projectId.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

/** `k` of a seed id `<projectId>:<operatorId>:<k>`, or `undefined` when the id does not have that form. */
export function seedK(row: Pick<ManifestRow, 'seedId' | 'projectId' | 'operatorId'>): number | undefined {
  const prefix = `${row.projectId}:${row.operatorId}:`;
  if (!row.seedId.startsWith(prefix)) return undefined;
  const k = Number(row.seedId.slice(prefix.length));
  return Number.isSafeInteger(k) && k >= 0 ? k : undefined;
}

export type SeededPlanResult<P extends So4PlanLike> =
  | { readonly ok: true; readonly plan: Omit<P, 'projects'> & { readonly projects: readonly So4PlanEntry[] }; readonly baselines: number; readonly seeded: number }
  | { readonly ok: false; readonly code: string; readonly detail: string };

/**
 * The plan with one seeded entry per manifest row after its baseline entries. `copiesRoot` and `manifestPath` are
 * written as given (repository-relative paths keep the plan portable).
 */
export function seededPlan<P extends So4PlanLike>(
  plan: P, rows: readonly ManifestRowView[], opts: { readonly copiesRoot: string; readonly manifestPath: string },
): SeededPlanResult<P> {
  const baselines = plan.projects.filter((p) => p.seed === undefined);
  const seeded: So4PlanEntry[] = [];
  for (const row of rows) {
    // A base may have one baseline entry per spec (the sensitivity plan evaluates correct-reference under the clean
    // and the layered fixture spec); a row pairs with the baseline of its own project and spec.
    const ofProject = baselines.map((b, i) => [b, i] as const).filter(([b]) => b.projectId === row.projectId);
    if (ofProject.length === 0) {
      return { ok: false, code: SO4_PLAN_BASELINE_MISSING, detail: `${SO4_PLAN_BASELINE_MISSING}: manifest row ${row.seedId}: no baseline entry for ${row.projectId} in plan ${plan.id}` };
    }
    const hit = ofProject.find(([b]) => posix.normalize(b.specPath) === posix.normalize(row.specPath));
    if (hit === undefined) {
      return { ok: false, code: SO4_PLAN_SPEC_MISMATCH, detail: `${SO4_PLAN_SPEC_MISMATCH}: manifest row ${row.seedId} was mutated under ${row.specPath}, the baseline entry evaluates with ${ofProject.map(([b]) => b.specPath).join(', ')}` };
    }
    const [base, i] = hit;
    const k = seedK(row);
    if (k === undefined) return { ok: false, code: SO4_PLAN_SEED_INVALID, detail: `${SO4_PLAN_SEED_INVALID}: seed id ${row.seedId} is not <projectId>:<operatorId>:<k>` };
    seeded.push({
      projectId: row.seedId,
      path: join(opts.copiesRoot, row.projectId, row.operatorId, `k-${String(k)}`),
      specPath: base.specPath,
      seed: {
        seedId: row.seedId, baseProjectId: row.projectId, split: row.split, baseKind: row.baseKind, manifestPath: opts.manifestPath,
        baselineReportPath: `reports/${so4RunIdOf(plan.id, i, base.projectId)}.json`,
      },
    });
  }
  return { ok: true, plan: { ...plan, projects: [...baselines, ...seeded] }, baselines: baselines.length, seeded: seeded.length };
}
