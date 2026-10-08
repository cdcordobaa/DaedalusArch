/**
 * Generator configuration and confinement path checks (FR-v1.2E-28; SECURITY-11; BR-U5a-41, 42).
 *
 * - `createGeneratorCliConfig(input, repoRoot)`: the only way to build a `GeneratorCliConfig`. Every path is absolute;
 *   `outputRoot` and `harnessRoot` lie outside the repository (`GEN_CWD_INSIDE_REPO` / `GEN_HARNESS_INSIDE_REPO`);
 *   `harnessRoot` is not inside `outputRoot` (`GEN_HARNESS_INSIDE_CWD`, since every `cwd` is under `outputRoot`).
 *   `harnessRoot` and `modelId` use a conservative character set (`GEN_PATH_UNSAFE`, `GEN_MODEL_ID_INVALID`)
 *   because both are spliced into the exact Bash allow rule of BR-U5a-41, which must not contain whitespace, glob
 *   or shell metacharacters.
 * - `checkRunDirs(config, req, repoRoot)`: the per-run `cwd` (`req.outputDir`) is absolute, under `outputRoot`,
 *   outside the repository (`GEN_CWD_INSIDE_REPO`), and does not contain `harnessRoot` (`GEN_HARNESS_INSIDE_CWD`).
 * - Paths are compared after resolving symlinks of their nearest existing ancestor (macOS `/var` → `/private/var`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import { DEFAULT_GENERATOR_TIMEOUT_MS } from './types.js';
import type { GenerationRequest, GeneratorCliConfig, SpecLevel, TaskId } from './types.js';

export interface GeneratorCliConfigInput {
  readonly binary: string;
  readonly modelId: string;
  readonly timeoutMs?: number;
  readonly outputRoot: string;
  readonly harnessRoot: string;
  readonly allowBash?: boolean;
}

/** Characters allowed in `harnessRoot` (it is part of the exact Bash allow rule). */
const SAFE_PATH = /^\/[A-Za-z0-9._/-]*$/;
/** Characters allowed in a model id (it is part of `runId`, hence of the allow rule). */
const SAFE_MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Resolves symlinks of the nearest existing ancestor and re-appends the missing tail. */
export function canonicalPath(p: string): string {
  const abs = path.resolve(p);
  const tail: string[] = [];
  let cur = abs;
  for (;;) {
    try {
      const real = fs.realpathSync(cur);
      return tail.length === 0 ? real : path.join(real, ...tail.reverse());
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return abs;
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
}

/** True when `child` equals `parent` or lies below it (canonical paths). */
export function isInsideOrEqual(parent: string, child: string): boolean {
  const rel = path.relative(canonicalPath(parent), canonicalPath(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function err(code: string, message: string, context?: Record<string, unknown>): DomainError {
  return context === undefined ? { code, message } : { code, message, context };
}

export function createGeneratorCliConfig(
  input: GeneratorCliConfigInput,
  repoRoot: string,
): DomainResult<GeneratorCliConfig> {
  const errors: DomainError[] = [];
  for (const [field, value] of [
    ['binary', input.binary],
    ['outputRoot', input.outputRoot],
    ['harnessRoot', input.harnessRoot],
  ] as const) {
    if (!path.isAbsolute(value)) errors.push(err('GEN_PATH_NOT_ABSOLUTE', `${field} must be an absolute path`, { field }));
  }
  if (!SAFE_MODEL_ID.test(input.modelId)) {
    errors.push(err('GEN_MODEL_ID_INVALID', 'modelId must match [A-Za-z0-9][A-Za-z0-9._-]*'));
  }
  const timeoutMs = input.timeoutMs ?? DEFAULT_GENERATOR_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    errors.push(err('GEN_TIMEOUT_INVALID', 'timeoutMs must be a positive integer'));
  }
  if (errors.length > 0) return DomainResult.fail(errors);

  const outputRoot = path.normalize(input.outputRoot);
  const harnessRoot = path.normalize(input.harnessRoot).replace(/\/+$/, '');
  if (!SAFE_PATH.test(harnessRoot)) {
    errors.push(err('GEN_PATH_UNSAFE', 'harnessRoot may contain only [A-Za-z0-9._/-] (it is part of the Bash allow rule)'));
  }
  if (isInsideOrEqual(repoRoot, outputRoot)) {
    errors.push(err('GEN_CWD_INSIDE_REPO', 'outputRoot must lie outside the repository'));
  }
  if (isInsideOrEqual(repoRoot, harnessRoot)) {
    errors.push(err('GEN_HARNESS_INSIDE_REPO', 'harnessRoot must lie outside the repository'));
  }
  if (isInsideOrEqual(outputRoot, harnessRoot)) {
    errors.push(err('GEN_HARNESS_INSIDE_CWD', 'harnessRoot must not lie inside outputRoot (every cwd is under it)'));
  }
  if (errors.length > 0) return DomainResult.fail(errors);

  return DomainResult.ok(
    Object.freeze({
      binary: input.binary,
      modelId: input.modelId,
      timeoutMs,
      outputRoot,
      harnessRoot,
      allowBash: input.allowBash ?? true,
    }),
  );
}

/** `${modelId}/${taskId}/${specLevel}/run-${runIndex}` (domain-entities §5). */
export function runIdFor(modelId: string, taskId: TaskId, specLevel: SpecLevel, runIndex: number): string {
  return `${modelId}/${taskId}/${specLevel}/run-${String(runIndex)}`;
}

/** Per-run path checks of BR-U5a-42. */
export function checkRunDirs(config: GeneratorCliConfig, req: GenerationRequest, repoRoot: string): DomainResult<void> {
  const errors: DomainError[] = [];
  if (!path.isAbsolute(req.outputDir)) {
    errors.push(err('GEN_PATH_NOT_ABSOLUTE', 'outputDir must be an absolute path', { field: 'outputDir' }));
    return DomainResult.fail(errors);
  }
  if (req.modelId !== config.modelId) {
    errors.push(err('GEN_MODEL_ID_MISMATCH', 'request modelId differs from the adapter modelId'));
  }
  if (req.runId !== runIdFor(req.modelId, req.taskId, req.specLevel, req.runIndex)) {
    errors.push(err('GEN_RUN_ID_INVALID', 'runId must be modelId/taskId/specLevel/run-runIndex'));
  }
  if (isInsideOrEqual(repoRoot, req.outputDir)) {
    errors.push(err('GEN_CWD_INSIDE_REPO', 'the run cwd must lie outside the repository'));
  }
  if (!isInsideOrEqual(config.outputRoot, req.outputDir) || canonicalPath(config.outputRoot) === canonicalPath(req.outputDir)) {
    errors.push(err('GEN_CWD_OUTSIDE_OUTPUT_ROOT', 'the run cwd must be a directory below outputRoot'));
  }
  if (isInsideOrEqual(req.outputDir, config.harnessRoot)) {
    errors.push(err('GEN_HARNESS_INSIDE_CWD', 'harnessRoot must not lie inside the run cwd'));
  }
  return errors.length > 0 ? DomainResult.fail(errors) : DomainResult.ok(undefined);
}
