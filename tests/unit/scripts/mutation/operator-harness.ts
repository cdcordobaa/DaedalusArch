/**
 * Shared harness of the operator tests (Steps 27–31): forced applications on fresh copies of a fixture base.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { loadManifest } from '../../../../scripts/lib/manifest.js';
import type { Manifest, ManifestRow } from '../../../../scripts/lib/manifest.js';
import { applyMutation } from '../../../../scripts/lib/mutation/apply.js';
import { makePreparedBase, repoTscPath } from '../../../../scripts/lib/mutation/prepare.js';
import type { CycleStrategy, MutationOperator, MutationSite, PreparedBase } from '../../../../scripts/lib/mutation/types.js';
import { testRegistry } from './test-operators.js';

export const REPO = process.cwd();
export const CORRECT_DIR = path.join(REPO, 'fixtures/correct-reference');
export const CLEAN_SPEC = 'specs/clean-arch.yaml';
export const LAYERED_SPEC = 'tests/fixtures/u5a/layered/firewall.spec.yaml';
export const NOW = '2026-10-08T12:00:00.000Z';
const runner = new NodeProcessRunner();

export function fixtureBase(specPath: string, dir: string = CORRECT_DIR, judgeSelection?: PreparedBase['judgeSelection']): PreparedBase {
  const r = makePreparedBase({
    projectId: path.basename(dir),
    baseKind: 'fixture',
    dir,
    baseCommit: 'a'.repeat(40),
    tsconfigPath: 'tsconfig.json',
    tscPath: repoTscPath(REPO),
    tscVersion: '5.9.3',
    overlays: [],
    specPath,
    ...(judgeSelection !== undefined ? { judgeSelection } : {}),
  });
  if (!r.success) throw new Error(JSON.stringify(r.errors));
  return r.data;
}

export interface Applied {
  readonly manifest: Manifest;
  readonly row: ManifestRow | undefined;
  /** Mutant copy root (k-0). */
  readonly copy: string;
}

let counter = 0;

/** Applies `op` (forced at `site`, or sampled when `site` is undefined) in a fresh scratch directory. */
export async function applyForced(
  scratch: string,
  ops: readonly MutationOperator[],
  opId: string,
  base: PreparedBase,
  site: Omit<MutationSite, 'kind' | 'line'> | undefined,
  cycleStrategy: CycleStrategy = 'simple-cycles',
): Promise<Applied> {
  counter++;
  const dir = path.join(scratch, `${opId}-${String(counter)}`);
  fs.mkdirSync(dir, { recursive: true });
  const manifestPath = path.join(dir, 'manifest.json');
  const r = await applyMutation(
    { repoRoot: REPO, runner, registry: testRegistry(ops), masterSeed: 20261008, sitesPerOperator: 1, split: 'dev', now: () => NOW },
    base,
    opId,
    manifestPath,
    path.join(dir, 'copies'),
    { cycleStrategy, ...(site !== undefined ? { siteOverride: { filePath: site.filePath, detail: site.detail } } : {}) },
  );
  if (!r.success) throw new Error(JSON.stringify(r.errors));
  const m = loadManifest(REPO, manifestPath);
  if (!m.success) throw new Error(JSON.stringify(m.errors));
  return { manifest: m.data, row: m.data.rows[0], copy: path.join(dir, 'copies', base.projectId, opId, 'k-0') };
}

/** Projection of keys for compact assertions. */
export function keyTuples(keys: readonly { functionId: string; filePath: string; target: string; discriminator: readonly string[]; lineRule: string; line?: number }[]): unknown[] {
  return keys.map((k) => [k.functionId, k.filePath, k.target, k.discriminator, k.lineRule, k.line ?? null]);
}

export function collateralTuples(row: ManifestRow | undefined): unknown[] {
  return (row?.expected.collateral ?? []).map((c) => [c.kind, c.cause, c.functionId, c.key?.filePath ?? null, c.key?.target ?? null, c.key?.discriminator ?? null]);
}
