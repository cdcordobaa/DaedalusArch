/**
 * U5b scorer test helpers: synthetic baseline/seeded report pairs (schema-valid, built through `storedReport`),
 * synthetic manifest rows and run records. In-memory test inputs only.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { storedReport } from './report-fixture.js';
import type { StoredReport } from './report-fixture.js';
import { loadMatchingRule } from '../../../../scripts/lib/matching-rule.js';
import type { MatchingRule } from '../../../../scripts/lib/matching-rule.js';
import type { ManifestRow } from '../../../../scripts/lib/manifest.js';
import type { RunRecord } from '../../../../scripts/lib/report-io.js';
import type { SeedInput } from '../../../../scripts/score-golden.js';
import type { EvaluationMode } from '../../../../src/shared/types/enums.js';

export const ROOT = resolve(__dirname, '../../../..');

/**
 * A temp root holding `specPath` as committed at `commit` (the fixture's `RunRecord.cliCommit`). The committed
 * fixtures were produced against that spec; a later spec edit by another unit (U4-K6 renamed the FF-N01 / FF-N02
 * rubric, DV-U5b-21) must not make them unreadable. Needs full history, as the provenance test (CI: fetch-depth 0).
 */
export function specRootAt(commit: string, specPath: string): string {
  const root = mkdtempSync(join(tmpdir(), 'u5b-spec-at-'));
  const bytes = execFileSync('git', ['show', `${commit}:${specPath}`], { cwd: ROOT });
  mkdirSync(dirname(join(root, specPath)), { recursive: true });
  writeFileSync(join(root, specPath), bytes);
  return root;
}

export function rule(): MatchingRule {
  const r = loadMatchingRule(ROOT);
  if (!r.ok) throw new Error(r.detail);
  return r.rule;
}

export interface V {
  readonly functionId: string;
  readonly filePath: string;
  readonly target?: string;
  readonly discriminator?: readonly string[];
  readonly line?: number;
  readonly evidence?: readonly string[];
  readonly id?: string;
  readonly message?: string;
  readonly route?: 'symbolic' | 'neuronal';
  readonly unitId?: string;
}

export interface Fn {
  readonly functionId: string;
  readonly name: string;
  readonly dimension: string;
  readonly tag: 'structural' | 'topological' | 'pattern-proxy';
}

/** Functions of the synthetic spec (template names as in `specs/clean-arch.yaml`). */
export const FNS: readonly Fn[] = [
  { functionId: 'FF-S01', name: 'dependency-direction', dimension: 'structural', tag: 'structural' },
  { functionId: 'FF-S02', name: 'no-cyclic-deps', dimension: 'structural', tag: 'topological' },
  { functionId: 'FF-S04', name: 'no-domain-outward-dep', dimension: 'structural', tag: 'structural' },
  { functionId: 'FF-C04', name: 'no-orphan-files', dimension: 'coupling', tag: 'topological' },
  { functionId: 'FF-C05', name: 'module-fan-out', dimension: 'coupling', tag: 'topological' },
  { functionId: 'FF-C06', name: 'abstraction-ratio', dimension: 'coupling', tag: 'topological' },
  { functionId: 'FF-CV05', name: 'test-file-pairing', dimension: 'convention', tag: 'pattern-proxy' },
  { functionId: 'FF-P06', name: 'domain-state-purity', dimension: 'pattern', tag: 'structural' },
];

let counter = 0;

function violation(v: V): Record<string, unknown> {
  const fn = FNS.find((f) => f.functionId === v.functionId);
  counter += 1;
  return {
    id: v.id ?? `v-${String(counter)}`,
    type: 'LAYER_VIOLATION',
    dimension: fn?.dimension ?? 'structural',
    severity: 'major',
    functionId: v.functionId,
    route: v.route ?? 'symbolic',
    filePath: v.filePath,
    message: v.message ?? 'm',
    deterministic: v.route !== 'neuronal',
    tag: fn?.tag ?? 'structural',
    ...(v.target !== undefined && { target: v.target }),
    ...(v.discriminator !== undefined && { discriminator: [...v.discriminator] }),
    ...(v.line !== undefined && { line: v.line }),
    ...(v.evidence !== undefined && { evidence: [...v.evidence] }),
    ...(v.unitId !== undefined && { unitId: v.unitId }),
  };
}

/** A schema-valid report holding exactly `violations` and one `functionResults` row per function in `fns`. */
export async function report(violations: readonly V[], opts: { mode?: EvaluationMode; fns?: readonly Fn[] } = {}): Promise<StoredReport> {
  const r = await storedReport(opts.mode ?? 'symbolic-only');
  const fns = opts.fns ?? FNS;
  r.violations = violations.map(violation);
  r.functionResults = fns.map((f) => ({
    functionId: f.functionId, name: f.name, dimension: f.dimension, route: 'symbolic', tag: f.tag,
    passed: !violations.some((v) => v.functionId === f.functionId),
    violationCount: violations.filter((v) => v.functionId === f.functionId).length,
    executionTimeMs: 1, truncated: false,
  }));
  return r;
}

export const SPEC_SHA = 'a'.repeat(64);
export const CLI = 'b'.repeat(40);

export function record(over: Partial<RunRecord> = {}): RunRecord {
  return {
    runId: `run-${String((counter += 1))}`, planId: 'unit', projectId: 'p', status: 'accepted', attempt: 1,
    specSha: SPEC_SHA, cliCommit: CLI, preregVersion: 0, frozenHashes: {}, envRecordId: 'env',
    startedAt: '2026-10-08T00:00:00.000Z', wallMs: 1, ...over,
  };
}

export interface RowOpts {
  readonly seedId?: string;
  readonly operatorId?: string;
  readonly split?: 'dev' | 'held-out' | 'probe';
  readonly baseKind?: 'fixture' | 'corpus' | 'generated';
  readonly expected: Record<string, unknown>;
  readonly lineShifts?: readonly { filePath: string; afterLine: number; delta: number }[];
  readonly editedFiles?: readonly string[];
  readonly createdFiles?: readonly string[];
  readonly specSha256?: string;
}

export function row(o: RowOpts): ManifestRow {
  const seedId = o.seedId ?? 'p:MO-S01:0';
  return {
    seedId,
    projectId: seedId.split(':')[0] ?? 'p',
    operatorId: o.operatorId ?? seedId.split(':')[1] ?? 'MO-S01',
    split: o.split ?? 'held-out',
    baseKind: o.baseKind ?? 'corpus',
    baseTreeSha: 'c'.repeat(40),
    specPath: 'specs/clean-arch.yaml',
    specSha256: o.specSha256 ?? SPEC_SHA,
    editedFiles: o.editedFiles ?? [],
    createdFiles: o.createdFiles ?? [],
    lineShifts: o.lineShifts ?? [],
    expected: {
      functionIds: [], disabledFunctionIds: [], absentTemplates: [], dimension: 'structural', keys: [], collateral: [],
      coverage: 'in', ...o.expected,
    },
  } as unknown as ManifestRow;
}

export function key(functionId: string, filePath: string, target = '', discriminator: readonly string[] = [], lineRule: 'site-line' | 'first-edge-line' | 'none' = 'none', line?: number): Record<string, unknown> {
  return { functionId, filePath, target, discriminator: [...discriminator], lineRule, ...(line !== undefined && { line }) };
}

export function seed(r: ManifestRow, baseline: unknown, seeded: unknown, rec: { baseline?: RunRecord | null; seeded?: RunRecord | null } = {}): SeedInput {
  // A seeded run reuses the baseline's judge selection (BR-U4-SEL-07, `--judge-baseline-report`).
  const rows = (seeded as { neuralResults?: { selection: { source: string } }[] } | null)?.neuralResults;
  for (const nr of rows ?? []) nr.selection.source = 'baseline';
  return {
    row: r,
    baseline: { report: baseline, record: rec.baseline === null ? undefined : (rec.baseline ?? record()) },
    seeded: { report: seeded, record: rec.seeded === null ? undefined : (rec.seeded ?? record()) },
  };
}

/** The total stratum key of a held-out corpus seed. */
export const HELD_OUT = JSON.stringify(['held-out', 'all', 'all']);
