/**
 * The mutation pipeline (FR-v1.2E-24 "edits code and appends the row in one step"; BR-U5a-03, 06, 07, 09, 11, 12,
 * 13, 16, 17, 18, 34, 55; D-U5a-14; `business-logic-model.md` §2.1–§2.2).
 *
 * Order (BR-U5a-06): copy the prepared base to a scratch analysis copy → prepare (stubs only on failed
 * resolution) → `baseTreeSha` → base type-check with the pinned tsc (`MUT_BASE_NOT_CLEAN`, no manifest write) →
 * base import graph `G` → `findSites` (stable order) → style rule and preconditions (incl. judge placement and
 * cycle cap) → derived seeds → sample (or the forced site) → per application: fresh copy, its stubs (base uses
 * plus the operator's planned package imports), its `baseTreeSha`, `apply`, `lineShifts`, mutant gate, mutant
 * graph `G'`, site collateral, expected block, one row appended by the single writer, copy marker. No step reads a
 * detector output; the only label-free exception is the judge selection inside `PreparedBase` (BR-U5a-27).
 *
 * Outcomes recorded in the manifest: one `precondition` rejection when the style rule disables every expected
 * template of a positive (BR-U5a-34); one `no-site` rejection when no candidate is eligible; per application one
 * row, or one `typecheck` rejection (copy removed), or one `apply-error` rejection (scrubbed, copy removed). A
 * rejected application is never re-drawn (BR-U5a-17). A target copy that already holds the marker refuses the run
 * with `MUT_COPY_ALREADY_SEEDED` before anything is written (BR-U5a-03).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import {
  acquireManifestLock,
  appendManifestRow,
  appendRejection,
  initManifest,
  loadManifest,
} from '../manifest.js';
import type { ManifestRow, Split } from '../manifest.js';
import { siteCollateral } from './collateral.js';
import { CYCLE_ROW_CAP, MAX_CYCLE_LENGTH } from './cycles.js';
import {
  collateralContext,
  compiledParams,
  compiledThresholds,
  declaredKeys,
  expectedBlock,
  isStyleDisabled,
  loadCompiledSpec,
} from './expected.js';
import type { CompiledSpec } from './expected.js';
import { buildImportGraph, openImportGraphProject } from './import-graph.js';
import { copyBase } from './prepare.js';
import type { OperatorRegistry } from './registry.js';
import { deriveSeed, mulberry32 } from './rng.js';
import { baseCycleCount, evaluatePreconditions, sampleSites, siteMatchesOverride, sortSites } from './sites.js';
import type { EligibleSite } from './sites.js';
import { collectImportUses, provisionStubs } from './stubs.js';
import { computeBaseTreeSha } from './tree-sha.js';
import { checkBaseClean, gateMutant } from './typecheck.js';
import { CYCLE_STRATEGIES } from './types.js';
import type {
  ApplyOptions,
  ImportGraph,
  LineShift,
  MutationEdit,
  MutationOperator,
  OperatorRole,
  PreconditionContext,
  PreparedBase,
  ProjectHandle,
  ProvisionedStub,
} from './types.js';

/** Written into a copy after its row is appended (BR-U5a-03). */
export const COPY_MARKER = '.daedalus-mutant.json';

export interface MutationEnv {
  readonly repoRoot: string;
  readonly runner: ProcessRunner;
  /** The frozen registry; its `catalogueVersion` goes into the manifest header and every row. */
  readonly registry: OperatorRegistry;
  readonly masterSeed: number;
  readonly sitesPerOperator: number;
  readonly split: Split;
  /** ISO 8601 clock (tests pin it). */
  readonly now?: () => string;
  /** Step-trace hook (BR-U5a-06 order test). */
  readonly trace?: (step: string) => void;
  /** Parent of the throwaway git object store of `baseTreeSha`. */
  readonly tmpRoot?: string;
  readonly typecheckTimeoutMs?: number;
}

export interface ApplyOutcome {
  readonly rows: number;
  readonly rejections: number;
}

function fail<T>(code: string, message: string, context?: Record<string, unknown>): DomainResult<T> {
  return DomainResult.fail([{ code, message, ...(context !== undefined ? { context } : {}) }]);
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ── Line shifts (BR-U5a-18) ─────────────────────────────────────────────────────────────────────────────────────

function lines(text: string): string[] {
  return text.split('\n');
}

/**
 * One entry per contiguous changed block between `before` and `after` (LCS line alignment after trimming the
 * common prefix and suffix): `afterLine` = the last unchanged base line before the block, `delta` = inserted −
 * removed lines; blocks with `delta = 0` give no entry.
 */
export function lineShiftsOf(filePath: string, before: string, after: string): LineShift[] {
  const a = lines(before);
  const b = lines(after);
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const am = a.slice(pre, a.length - suf);
  const bm = b.slice(pre, b.length - suf);
  if (am.length === 0 && bm.length === 0) return [];
  const out: LineShift[] = [];
  if (am.length * bm.length > 4_000_000) {
    const delta = bm.length - am.length;
    return delta === 0 ? [] : [{ filePath, afterLine: pre, delta }];
  }
  // LCS table over the middle part.
  const n = am.length;
  const m = bm.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i] ?? [];
    const below = dp[i + 1] ?? [];
    for (let j = m - 1; j >= 0; j--) {
      row[j] = am[i] === bm[j] ? (below[j + 1] ?? 0) + 1 : Math.max(below[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  let i = 0;
  let j = 0;
  let removed = 0;
  let inserted = 0;
  let blockStart = pre; // base lines before the open block
  const close = (): void => {
    const delta = inserted - removed;
    if (delta !== 0) out.push({ filePath, afterLine: blockStart, delta });
    removed = 0;
    inserted = 0;
  };
  while (i < n || j < m) {
    if (i < n && j < m && am[i] === bm[j]) {
      if (removed + inserted > 0) close();
      i++;
      j++;
      blockStart = pre + i;
    } else if (j < m && (i >= n || (dp[i]?.[j + 1] ?? 0) >= (dp[i + 1]?.[j] ?? 0))) {
      inserted++;
      j++;
    } else {
      removed++;
      i++;
    }
  }
  if (removed + inserted > 0) close();
  return out;
}

// ── Pipeline ────────────────────────────────────────────────────────────────────────────────────────────────────

function sourceTexts(handle: ReturnType<typeof openImportGraphProject>): Map<string, string> {
  const out = new Map<string, string>();
  const prefix = handle.root.endsWith('/') ? handle.root : handle.root + '/';
  for (const sf of handle.project.getSourceFiles()) {
    const abs = sf.getFilePath();
    if (!abs.startsWith(prefix)) continue;
    const rel = abs.slice(prefix.length);
    if (rel.split('/').includes('node_modules')) continue;
    out.set(rel, sf.getFullText());
  }
  return out;
}

function splitAllowed(base: PreparedBase, split: Split): boolean {
  return base.baseKind === 'fixture' ? split === 'dev' || split === 'probe' : split === 'held-out';
}

/** BR-U5a-30: an SP-* probe (role `probe`) is always `split: 'probe'`, and only probes carry it (DV-U5a-24). */
export function splitMatchesRole(role: OperatorRole, split: Split): boolean {
  return role === 'probe' ? split === 'probe' : split !== 'probe';
}

function stubsFor(dir: string, base: PreparedBase, op: MutationOperator, sites: readonly EligibleSite[]): DomainResult<readonly ProvisionedStub[]> {
  const uses = collectImportUses(dir, base.tsconfigPath);
  if (!uses.success) return uses;
  const planned = sites.flatMap((s) => op.plannedImportUses?.(s.site) ?? []);
  return provisionStubs(dir, base.tsconfigPath, [...uses.data, ...planned]);
}

interface RunState {
  readonly env: MutationEnv;
  readonly base: PreparedBase;
  readonly op: MutationOperator;
  readonly compiled: CompiledSpec;
  readonly manifestPath: string;
  readonly opts: ApplyOptions;
  readonly baseGraph: ImportGraph;
  readonly opRoot: string;
  readonly trace: (step: string) => void;
  readonly now: () => string;
}

async function rejectApply(state: RunState, dir: string, rngSeed: number, k: number, detail: string): Promise<DomainResult<'rejected'>> {
  await fs.promises.rm(dir, { recursive: true, force: true });
  const r = appendRejection(state.env.repoRoot, state.manifestPath, {
    operatorId: state.op.id,
    projectId: state.base.projectId,
    reason: 'apply-error',
    detail,
    rngSeed,
    seedDerivation: { projectId: state.base.projectId, operatorId: state.op.id, k },
    appliedAt: state.now(),
  });
  return r.success ? DomainResult.ok('rejected') : r;
}

/**
 * Class and interface counts of the copy's project (every source file, as the extractor counts `Class` and
 * `Interface` nodes). A change between before and after the edit is "the edit adds or removes a class or
 * interface", which declares the keyless `project-metric` collateral (BR-U5a-14 iv). A rename changes no count.
 */
function typeDeclarationCounts(handle: ProjectHandle): { readonly classes: number; readonly interfaces: number } {
  let classes = 0;
  let interfaces = 0;
  for (const sf of handle.project.getSourceFiles()) {
    classes += sf.getClasses().length;
    interfaces += sf.getInterfaces().length;
  }
  return { classes, interfaces };
}

/** One application at one site on a fresh copy: row or rejection. */
async function applyOne(state: RunState, chosen: EligibleSite, k: number, selection: 'sampled' | 'forced'): Promise<DomainResult<'row' | 'rejected'>> {
  const { env, base, op, compiled, trace } = state;
  const seedDerivation = { projectId: base.projectId, operatorId: op.id, k };
  const rngSeed = deriveSeed(env.masterSeed, seedDerivation);
  const dir = path.join(state.opRoot, `k-${String(k)}`);
  trace('app-copy');
  const copied = await copyBase(base, dir);
  if (!copied.success) return copied;
  trace('app-prepare');
  const stubs = stubsFor(dir, base, op, [chosen]);
  if (!stubs.success) return stubs;
  const treeSha = await computeBaseTreeSha(env.runner, base, dir, stubs.data, env.tmpRoot !== undefined ? { tmpRoot: env.tmpRoot } : {});
  if (!treeSha.success) return treeSha;

  const handle = openImportGraphProject(dir, base.tsconfigPath);
  const before = sourceTexts(handle);
  const typesBefore = typeDeclarationCounts(handle);
  trace('apply');
  let applied: DomainResult<MutationEdit>;
  try {
    applied = op.apply(handle, chosen.site, mulberry32(rngSeed));
  } catch (e: unknown) {
    return rejectApply(state, dir, rngSeed, k, `apply threw: ${errorText(e)}`);
  }
  if (!applied.success) {
    return rejectApply(state, dir, rngSeed, k, `apply failed: ${applied.errors.map((x) => `${x.code}: ${x.message}`).join('; ')}`);
  }
  trace('line-shifts');
  const after = sourceTexts(handle);
  const typesAfter = typeDeclarationCounts(handle);
  const typesAddedOrRemoved = typesBefore.classes !== typesAfter.classes || typesBefore.interfaces !== typesAfter.interfaces;
  const editedFiles: string[] = [];
  const createdFiles: string[] = [];
  const lineShifts: LineShift[] = [];
  for (const [file, text] of [...after.entries()].sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))) {
    const old = before.get(file);
    if (old === undefined) createdFiles.push(file);
    else if (old !== text) {
      editedFiles.push(file);
      lineShifts.push(...lineShiftsOf(file, old, text));
    }
  }
  const edit: MutationEdit = { ...applied.data, editedFiles, createdFiles, lineShifts };
  try {
    await handle.project.save();
  } catch (e: unknown) {
    return rejectApply(state, dir, rngSeed, k, `save failed: ${errorText(e)}`);
  }

  trace('mutant-typecheck');
  const appliedAt = state.now();
  const gate = await gateMutant({
    runner: env.runner,
    repoRoot: env.repoRoot,
    manifestPath: state.manifestPath,
    base,
    copyRoot: dir,
    operatorId: op.id,
    rngSeed,
    seedDerivation,
    appliedAt,
    ...(env.typecheckTimeoutMs !== undefined ? { timeoutMs: env.typecheckTimeoutMs } : {}),
  });
  if (!gate.success) return gate;
  if (!gate.data.passed) return DomainResult.ok('rejected');

  trace('mutant-graph');
  const mutantGraph = buildImportGraph(openImportGraphProject(dir, base.tsconfigPath), compiled.layers);
  trace('collateral');
  const declared = declaredKeys(compiled, op, chosen.site, edit);
  if (!declared.success) return rejectApply(state, dir, rngSeed, k, declared.errors.map((x) => `${x.code}: ${x.message}`).join('; '));
  const keysSoFar = [...declared.data.keys, ...declared.data.operatorCollateral.flatMap((c) => (c.key !== undefined ? [c.key] : []))];
  const sc = siteCollateral(state.baseGraph, mutantGraph, edit, { ...collateralContext(compiled, state.opts.cycleStrategy, keysSoFar), typesAddedOrRemoved });
  if (!sc.success) return rejectApply(state, dir, rngSeed, k, sc.errors.map((x) => `${x.code}: ${x.message}`).join('; '));
  trace('expected');
  const expected = expectedBlock(compiled, op, chosen.site, edit, sc.data);
  if (!expected.success) return rejectApply(state, dir, rngSeed, k, expected.errors.map((x) => `${x.code}: ${x.message}`).join('; '));

  trace('append');
  const row: ManifestRow = {
    seedId: `${base.projectId}:${op.id}:${String(k)}`,
    projectId: base.projectId,
    baseKind: base.baseKind,
    ...(base.baseCommit !== undefined ? { baseCommit: base.baseCommit } : {}),
    ...(base.baseGenerationTreeSha !== undefined ? { baseGenerationTreeSha: base.baseGenerationTreeSha } : {}),
    baseTreeSha: treeSha.data,
    ...(base.installLockSha256 !== undefined ? { installLockSha256: base.installLockSha256 } : {}),
    specPath: compiled.specPath,
    specSha256: compiled.specSha256,
    split: env.split,
    operatorId: op.id,
    catalogueVersion: env.registry.catalogueVersion,
    rngSeed,
    seedDerivation,
    siteIndex: chosen.siteIndex,
    siteSelection: selection,
    site: { filePath: chosen.site.filePath, line: chosen.site.line, kind: chosen.site.kind, detail: { ...chosen.site.detail } },
    editedFiles,
    createdFiles,
    lineShifts,
    expected: expected.data,
    provisionedStubs: stubs.data,
    typecheck: gate.data.typecheck,
    appliedAt,
  };
  const appended = appendManifestRow(env.repoRoot, state.manifestPath, row, state.opts.cycleStrategy);
  if (!appended.success) return appended;
  fs.writeFileSync(path.join(dir, COPY_MARKER), JSON.stringify({ seedId: row.seedId, operatorId: op.id, appliedAt }, null, 2) + '\n');
  return DomainResult.ok('row');
}

/**
 * Applies one operator to fresh copies of one prepared base and records rows and rejections (BR-U5a-06).
 * `scratchRoot` holds `<projectId>/<operatorId>/k-<k>/` copies; the prepared base is never written (BR-U5a-04).
 */
export async function applyMutation(
  env: MutationEnv,
  base: PreparedBase,
  operatorId: string,
  manifestPath: string,
  scratchRoot: string,
  opts: ApplyOptions,
): Promise<DomainResult<ApplyOutcome>> {
  const trace = env.trace ?? ((): void => undefined);
  const now = env.now ?? ((): string => new Date().toISOString());
  const op = env.registry.get(operatorId);
  if (op === undefined) return fail('MUT_UNKNOWN_OPERATOR', `operator ${operatorId} is not in the frozen registry`);
  if (!CYCLE_STRATEGIES.includes(opts.cycleStrategy)) return fail('MUT_CYCLE_STRATEGY', `unknown cycle strategy ${JSON.stringify(opts.cycleStrategy)}`);
  if (!splitAllowed(base, env.split)) return fail('MUT_SPLIT_INVALID', `split ${env.split} is not allowed for a ${base.baseKind} base (BR-U5a-02)`);
  if (!splitMatchesRole(op.role, env.split)) {
    return fail('MUT_SPLIT_ROLE', `operator ${op.id} has role ${op.role}; ${op.role === 'probe' ? "a probe must use split 'probe'" : "split 'probe' is reserved for SP-* probes"} (BR-U5a-30)`);
  }
  if (opts.siteOverride !== undefined && env.split === 'held-out') {
    return fail('MUT_SITE_OVERRIDE_INVALID', 'a forced site is never a held-out instance (BR-U5a-55)');
  }
  const compiledR = await loadCompiledSpec(env.repoRoot, base.specPath);
  if (!compiledR.success) return compiledR;
  const compiled = compiledR.data;

  if (!fs.existsSync(manifestPath)) {
    const init = initManifest(env.repoRoot, manifestPath, {
      catalogueVersion: env.registry.catalogueVersion,
      masterSeed: env.masterSeed,
      cycleStrategy: opts.cycleStrategy,
    });
    if (!init.success) return init;
  } else {
    const loaded = loadManifest(env.repoRoot, manifestPath);
    if (!loaded.success) return loaded;
    if (loaded.data.catalogueVersion !== env.registry.catalogueVersion || loaded.data.masterSeed !== env.masterSeed) {
      return fail('MAN_HEADER_MISMATCH', 'manifest header catalogueVersion/masterSeed differ from this run');
    }
  }
  const lock = acquireManifestLock(manifestPath);
  if (!lock.success) return lock;
  const opRoot = path.join(scratchRoot, base.projectId, op.id);
  const analysis = path.join(opRoot, `.analysis-${String(process.pid)}-${randomBytes(4).toString('hex')}`);
  try {
    trace('copy');
    const copied = await copyBase(base, analysis);
    if (!copied.success) return copied;
    trace('prepare');
    const stubs = stubsFor(analysis, base, op, []);
    if (!stubs.success) return stubs;
    trace('baseTreeSha');
    const treeSha = await computeBaseTreeSha(env.runner, base, analysis, stubs.data, env.tmpRoot !== undefined ? { tmpRoot: env.tmpRoot } : {});
    if (!treeSha.success) return treeSha;
    trace('base-typecheck');
    const clean = await checkBaseClean(env.runner, base, analysis, env.typecheckTimeoutMs);
    if (!clean.success) return clean;
    trace('base-graph');
    const handle = openImportGraphProject(analysis, base.tsconfigPath);
    const baseGraph = buildImportGraph(handle, compiled.layers);
    trace('find-sites');
    const candidates = sortSites(op.findSites(handle, compiled.spec));
    trace('preconditions');
    const appliedAt = now();
    if (op.role === 'positive' && isStyleDisabled(compiled, op.expectedTemplates.map((r) => r.template))) {
      const r = appendRejection(env.repoRoot, manifestPath, {
        operatorId: op.id,
        projectId: base.projectId,
        reason: 'precondition',
        detail: JSON.stringify({ reason: 'style-disabled', candidates: candidates.length }),
        appliedAt,
      });
      return r.success ? DomainResult.ok({ rows: 0, rejections: 1 }) : r;
    }
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
    const tally = evaluatePreconditions(op, handle, compiled.spec, candidates, ctx);
    if (tally.eligible.length === 0) {
      const r = appendRejection(env.repoRoot, manifestPath, {
        operatorId: op.id,
        projectId: base.projectId,
        reason: 'no-site',
        detail: JSON.stringify({ candidates: candidates.length, rejectedByReason: tally.rejectedByReason }),
        appliedAt,
      });
      return r.success ? DomainResult.ok({ rows: 0, rejections: 1 }) : r;
    }

    trace('seeds');
    let plan: { chosen: EligibleSite; k: number }[];
    let selection: 'sampled' | 'forced';
    if (opts.siteOverride !== undefined) {
      const override = opts.siteOverride;
      const match = tally.eligible.find((e) => siteMatchesOverride(e.site, override));
      if (match === undefined) {
        return fail('MUT_SITE_OVERRIDE_INVALID', `forced site ${override.filePath} is not an eligible ${op.id} site`, {
          rejectedByReason: tally.rejectedByReason,
        });
      }
      plan = [{ chosen: match, k: opts.k ?? 0 }];
      selection = 'forced';
    } else {
      const selectSeed = deriveSeed(env.masterSeed, { projectId: base.projectId, operatorId: op.id, k: 'select' });
      trace('sample');
      plan = sampleSites(tally.eligible, env.sitesPerOperator, selectSeed).map((chosen, k) => ({ chosen, k }));
      selection = 'sampled';
    }
    for (const { k } of plan) {
      if (fs.existsSync(path.join(opRoot, `k-${String(k)}`, COPY_MARKER))) {
        return fail('MUT_COPY_ALREADY_SEEDED', `copy k-${String(k)} of ${op.id} on ${base.projectId} already holds a seed`);
      }
    }
    const state: RunState = { env, base, op, compiled, manifestPath, opts, baseGraph, opRoot, trace, now };
    let rows = 0;
    let rejections = 0;
    for (const { chosen, k } of plan) {
      const r = await applyOne(state, chosen, k, selection);
      if (!r.success) return r;
      if (r.data === 'row') rows++;
      else rejections++;
    }
    return DomainResult.ok({ rows, rejections });
  } finally {
    await fs.promises.rm(analysis, { recursive: true, force: true });
    lock.data.release();
  }
}
