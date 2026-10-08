/**
 * Pinned type-check runner and the two type-check gates (FR-v1.2E-24 "must type-check"; BR-U5a-07, 08, 09;
 * SECURITY-10).
 *
 * - `typecheckProject(runner, tscPath, tsconfigAbs)` runs exactly
 *   `<process.execPath> <tscPath> --noEmit --incremental false -p <tsconfigAbs>` through `ProcessRunner`, with
 *   `cwd` = the tsconfig's directory and an empty environment. `tsc` is never resolved from `PATH` or `npx`
 *   (BR-U5a-08). `error TSnnnn` lines become `{ code, file, line, message }` (file relative to the tsconfig
 *   directory after `realpath`, POSIX; `null` file/line for global diagnostics). A non-zero exit without a parsed diagnostic, or a
 *   timeout, counts as one synthetic error (`TSC_EXIT_<n>` / `TSC_TIMEOUT`), so a crashed tsc never passes a gate.
 * - `checkBaseClean` (BR-U5a-07): any error ⇒ `MUT_BASE_NOT_CLEAN`; it never writes the manifest.
 * - `gateMutant` (BR-U5a-09): zero errors ⇒ the row's `TypecheckEvidence`; any error ⇒ one `typecheck` rejection
 *   (error count and per-code counts in `detail`, scrubbed by `appendRejection`), the copy removed, no re-draw.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { appendRejection } from '../manifest.js';
import type { RowSeedDerivation } from '../manifest.js';
import type { PreparedBase, TypecheckEvidence } from './types.js';

/** Default wall-clock limit for one tsc run. */
export const TYPECHECK_TIMEOUT_MS = 10 * 60 * 1000;

export interface TscDiagnostic {
  /** `TSnnnn`, or `TSC_EXIT_<n>` / `TSC_TIMEOUT` for a run without a parsed diagnostic. */
  readonly code: string;
  /** POSIX, relative to the tsconfig directory; `null` for a global diagnostic. */
  readonly file: string | null;
  readonly line: number | null;
  readonly message: string;
}

export interface TypecheckRun {
  readonly exitCode: number;
  readonly timedOut: boolean;
  readonly errors: readonly TscDiagnostic[];
}

/** The exact argv after `process.execPath` (BR-U5a-08). */
export function tscArgs(tscPath: string, tsconfigAbs: string): readonly string[] {
  return [tscPath, '--noEmit', '--incremental', 'false', '-p', tsconfigAbs];
}

const DIAGNOSTIC = /^(?:(.+?)\((\d+),(\d+)\): )?error (TS\d+): (.*)$/;

/** Parses tsc's non-pretty output (`file(line,col): error TSnnnn: message` or `error TSnnnn: message`). */
export function parseTscOutput(output: string): readonly TscDiagnostic[] {
  const out: TscDiagnostic[] = [];
  for (const raw of output.split(/\r?\n/)) {
    const m = DIAGNOSTIC.exec(raw.trimEnd());
    if (m === null) continue;
    const [, file, line, , code, message] = m;
    out.push({
      code: code ?? '',
      file: file === undefined ? null : file.split(path.sep).join('/'),
      line: line === undefined ? null : Number(line),
      message: message ?? '',
    });
  }
  return out;
}

function realpathOr(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

/**
 * tsc prints paths relative to its real working directory; a root reached through a symlink (macOS `/var` →
 * `/private/var`) would give `../../…` paths. Both sides are resolved through `realpath`.
 */
function relativeToRoot(root: string, file: string | null): string | null {
  if (file === null) return null;
  const realRoot = realpathOr(root);
  const abs = realpathOr(path.resolve(realRoot, file));
  return path.relative(realRoot, abs).split(path.sep).join('/');
}

/** Runs the pinned tsc over one project (BR-U5a-08). Fails only when the process cannot start. */
export async function typecheckProject(
  runner: ProcessRunner,
  tscPath: string,
  tsconfigAbs: string,
  timeoutMs: number = TYPECHECK_TIMEOUT_MS,
): Promise<DomainResult<TypecheckRun>> {
  if (!path.isAbsolute(tscPath) || !path.isAbsolute(tsconfigAbs)) {
    return DomainResult.fail([{ code: 'MUT_TYPECHECK_PATH', message: 'tscPath and tsconfig must be absolute' }]);
  }
  const run = await runner.run(process.execPath, tscArgs(tscPath, tsconfigAbs), {
    cwd: path.dirname(tsconfigAbs),
    env: {},
    timeoutMs,
  });
  if (!run.success) return run;
  const { exitCode, timedOut, stdout, stderr } = run.data;
  const root = path.dirname(tsconfigAbs);
  const errors = [...parseTscOutput(stdout), ...parseTscOutput(stderr)].map((e) => ({ ...e, file: relativeToRoot(root, e.file) }));
  if (timedOut) {
    errors.push({ code: 'TSC_TIMEOUT', file: null, line: null, message: `tsc exceeded ${String(timeoutMs)} ms` });
  } else if (exitCode !== 0 && errors.length === 0) {
    errors.push({ code: `TSC_EXIT_${String(exitCode)}`, file: null, line: null, message: `tsc exited ${String(exitCode)} without a diagnostic` });
  }
  return DomainResult.ok({ exitCode, timedOut, errors });
}

/** Error count and per-code counts, keys sorted (rejection `detail`, BR-U5a-09). */
export function summariseErrors(errors: readonly TscDiagnostic[]): { readonly errorCount: number; readonly codes: Readonly<Record<string, number>> } {
  const counts = new Map<string, number>();
  for (const e of errors) counts.set(e.code, (counts.get(e.code) ?? 0) + 1);
  const codes: Record<string, number> = {};
  for (const k of [...counts.keys()].sort()) codes[k] = counts.get(k) ?? 0;
  return { errorCount: errors.length, codes };
}

function tsconfigIn(base: PreparedBase, copyRoot: string): string {
  return path.resolve(copyRoot, ...base.tsconfigPath.split('/'));
}

/** BR-U5a-07: the prepared copy must type-check with its pinned tsc; any error ⇒ `MUT_BASE_NOT_CLEAN`. */
export async function checkBaseClean(
  runner: ProcessRunner,
  base: PreparedBase,
  copyRoot: string,
  timeoutMs?: number,
): Promise<DomainResult<{ readonly baseErrors: 0 }>> {
  const run = await typecheckProject(runner, base.tscPath, tsconfigIn(base, copyRoot), timeoutMs);
  if (!run.success) return run;
  if (run.data.errors.length > 0) {
    const summary = summariseErrors(run.data.errors);
    return DomainResult.fail([
      {
        code: 'MUT_BASE_NOT_CLEAN',
        message: `prepared base ${base.projectId} has ${String(summary.errorCount)} type error(s) under tsc ${base.tscVersion}`,
        context: { ...summary, errors: run.data.errors },
      },
    ]);
  }
  return DomainResult.ok({ baseErrors: 0 });
}

export interface MutantGateInput {
  readonly runner: ProcessRunner;
  readonly repoRoot: string;
  readonly manifestPath: string;
  readonly base: PreparedBase;
  /** The mutant copy; removed when the gate rejects. */
  readonly copyRoot: string;
  readonly operatorId: string;
  readonly rngSeed?: number;
  readonly seedDerivation?: RowSeedDerivation;
  /** ISO 8601. */
  readonly appliedAt: string;
  readonly timeoutMs?: number;
}

export type MutantGateOutcome =
  | { readonly passed: true; readonly typecheck: TypecheckEvidence }
  | { readonly passed: false; readonly errorCount: number; readonly codes: Readonly<Record<string, number>> };

/**
 * BR-U5a-09: the mutant must have zero errors under the base's tsc and tsconfig. On any error one `typecheck`
 * rejection is appended and the copy directory removed; the caller does not re-draw.
 */
export async function gateMutant(input: MutantGateInput): Promise<DomainResult<MutantGateOutcome>> {
  const { base } = input;
  const run = await typecheckProject(input.runner, base.tscPath, tsconfigIn(base, input.copyRoot), input.timeoutMs);
  if (!run.success) return run;
  if (run.data.errors.length === 0) {
    return DomainResult.ok({
      passed: true,
      typecheck: { tscPath: base.tscPath, tscVersion: base.tscVersion, baseErrors: 0, mutantErrors: 0 },
    });
  }
  const summary = summariseErrors(run.data.errors);
  const appended = appendRejection(input.repoRoot, input.manifestPath, {
    operatorId: input.operatorId,
    projectId: base.projectId,
    reason: 'typecheck',
    detail: JSON.stringify(summary),
    ...(input.rngSeed !== undefined ? { rngSeed: input.rngSeed } : {}),
    ...(input.seedDerivation !== undefined ? { seedDerivation: input.seedDerivation } : {}),
    appliedAt: input.appliedAt,
  });
  await fs.promises.rm(input.copyRoot, { recursive: true, force: true });
  if (!appended.success) return appended;
  return DomainResult.ok({ passed: false, errorCount: summary.errorCount, codes: summary.codes });
}
