/**
 * The Gemini generator's plan block (decision CDX; design §3.3), its validation, the config builder and the S4 guard.
 *
 * ```json
 * "gemini": { "enabled": true, "cliVersion": "x.y.z", "printTimeoutS": 1170, "allowCommand": true,
 *             "homes": { "none": "<local>", "daedalus-mcp": "<local>" }, "s4Result": "tests/fixtures/agy-gen-cli/..." }
 * ```
 * - Off by default: a plan listing `agy-cli` needs this block with `enabled` exactly `true`; with no block every
 *   existing plan is unchanged.
 * - `printTimeoutS` 60..1170 (default 1170: the hard kill `(printTimeoutS + 30) × 1000` then equals
 *   `DEFAULT_GENERATOR_TIMEOUT_MS`, so no generator gets more wall time than another).
 * - `homes` are machine-local (`"<local>"`, filled by `--gemini-home-none` / `--gemini-home-mcp`); `binary` is the
 *   absolute agy path (default: the plan's `binary`).
 * - S4 guard (`checkS4Result`): a live wiring refuses `agy-cli` unless `s4Result` names a committed result whose
 *   verdict is `pass` for this CLI version, this model and every arm of the plan. A result marked `synthetic` is refused
 *   unless the caller passes `allowSynthetic` (only the recorded dry run does).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import { AGY_GEN_PRINT_TIMEOUT_MAX_S, AGY_GEN_PRINT_TIMEOUT_MIN_S, agyGenArmOf, createAgyGenCliConfig } from './agy-gen-cli.js';
import type { AgyGenArm, AgyGenCliConfig } from './agy-gen-cli.js';
import { createGeneratorCliConfig } from './config.js';

export const GEMINI_LOCAL = '<local>';
export const S4_RESULT_SCHEMA = 'agy-gen-s4/v1';

export interface GeminiPlanBlock {
  readonly enabled: boolean;
  readonly cliVersion: string;
  /** Absolute agy binary; the plan's `binary` when absent. */
  readonly binary?: string;
  readonly printTimeoutS?: number;
  readonly allowCommand?: boolean;
  readonly homes: Readonly<Record<AgyGenArm, string>>;
  /** Repository-relative path of the committed S4 result. */
  readonly s4Result?: string;
}

const VERSION_RE = /^\d+\.\d+\.\d+$/;
const KEYS = new Set(['enabled', 'cliVersion', 'binary', 'printTimeoutS', 'allowCommand', 'homes', 's4Result']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function bad(m: string): DomainError {
  return { code: 'LOOP_PLAN_INVALID', message: m };
}

/** Problems of the plan's `gemini` block; `present`: the plan lists an `agy-cli` adapter. */
export function geminiBlockProblems(block: unknown, present: boolean): DomainError[] {
  if (block === undefined) return present ? [bad('an agy-cli adapter needs a gemini block with enabled: true')] : [];
  if (!isRecord(block)) return [bad('gemini must be an object')];
  const errors: DomainError[] = [];
  const unknown = Object.keys(block).filter((k) => !KEYS.has(k));
  if (unknown.length > 0) errors.push(bad(`gemini has unknown keys: ${unknown.sort().join(', ')}`));
  if (typeof block.enabled !== 'boolean') errors.push(bad('gemini.enabled must be a boolean'));
  else if (present && block.enabled !== true) errors.push(bad('an agy-cli adapter needs gemini.enabled: true (the Gemini generator is off by default)'));
  if (typeof block.cliVersion !== 'string' || !VERSION_RE.test(block.cliVersion)) errors.push(bad('gemini.cliVersion must be x.y.z'));
  if (block.binary !== undefined && (typeof block.binary !== 'string' || (block.binary !== GEMINI_LOCAL && !path.isAbsolute(block.binary)))) {
    errors.push(bad('gemini.binary must be an absolute path'));
  }
  if (block.printTimeoutS !== undefined) {
    const n = block.printTimeoutS;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < AGY_GEN_PRINT_TIMEOUT_MIN_S || n > AGY_GEN_PRINT_TIMEOUT_MAX_S) {
      errors.push(bad(`gemini.printTimeoutS must be an integer from ${String(AGY_GEN_PRINT_TIMEOUT_MIN_S)} to ${String(AGY_GEN_PRINT_TIMEOUT_MAX_S)}`));
    }
  }
  if (block.allowCommand !== undefined && typeof block.allowCommand !== 'boolean') errors.push(bad('gemini.allowCommand must be a boolean'));
  const homes = block.homes;
  if (!isRecord(homes) || typeof homes.none !== 'string' || typeof homes['daedalus-mcp'] !== 'string' || Object.keys(homes).some((k) => k !== 'none' && k !== 'daedalus-mcp')) {
    errors.push(bad('gemini.homes must be { none, daedalus-mcp } (absolute paths or "<local>")'));
  }
  if (block.s4Result !== undefined && (typeof block.s4Result !== 'string' || block.s4Result === '' || path.isAbsolute(block.s4Result) || block.s4Result.split(/[\\/]/).includes('..'))) {
    errors.push(bad('gemini.s4Result must be a repository-relative path'));
  }
  return errors;
}

export interface GeminiHomes {
  readonly none?: string;
  readonly mcp?: string;
}

/** The Gemini config of a plan (`"<local>"` homes filled from `homes`). */
export function agyGenConfigFromPlan(
  plan: { readonly binary: string; readonly outRoot: string; readonly harnessRoot: string; readonly gemini?: GeminiPlanBlock },
  modelId: string,
  repoRoot: string,
  homes: GeminiHomes = {},
): DomainResult<AgyGenCliConfig> {
  const g = plan.gemini;
  if (g?.enabled !== true) return DomainResult.fail([bad('an agy-cli adapter needs a gemini block with enabled: true')]);
  const fill = (v: string, local: string | undefined, flag: string): DomainResult<string> => {
    if (v !== GEMINI_LOCAL) return local === undefined ? DomainResult.ok(v) : DomainResult.fail([bad(`${flag} given but the plan pins the home`)]);
    return local === undefined ? DomainResult.fail([bad(`gemini home "<local>" needs ${flag}`)]) : DomainResult.ok(local);
  };
  const none = fill(g.homes.none, homes.none, '--gemini-home-none');
  const mcp = fill(g.homes['daedalus-mcp'], homes.mcp, '--gemini-home-mcp');
  if (!none.success || !mcp.success) return DomainResult.fail([...(none.success ? [] : none.errors), ...(mcp.success ? [] : mcp.errors)]);
  const base = createGeneratorCliConfig({ binary: g.binary ?? plan.binary, modelId, outputRoot: plan.outRoot, harnessRoot: plan.harnessRoot, allowBash: g.allowCommand ?? true }, repoRoot);
  if (!base.success) return DomainResult.fail(base.errors);
  return createAgyGenCliConfig(
    {
      base: base.data,
      homes: { none: none.data, 'daedalus-mcp': mcp.data },
      cliVersion: g.cliVersion,
      ...(g.printTimeoutS !== undefined ? { printTimeoutS: g.printTimeoutS } : {}),
      ...(g.allowCommand !== undefined ? { allowCommand: g.allowCommand } : {}),
    },
    repoRoot,
  );
}

/** A committed S4 result (`Docs/v1.4/gemini-s4-probe-spec.md`). */
export interface S4Result {
  readonly schema: typeof S4_RESULT_SCHEMA;
  readonly synthetic?: boolean;
  readonly cliVersion: string;
  readonly modelId: string;
  /** Per arm: `pass` or `fail`. */
  readonly arms: Readonly<Partial<Record<AgyGenArm, 'pass' | 'fail'>>>;
}

/** The S4 guard (module header); `arms` are the plan's loop arms (`gate` uses the `none` home). */
export function checkS4Result(
  repoRoot: string,
  block: GeminiPlanBlock | undefined,
  modelId: string,
  arms: readonly string[],
  o: { readonly allowSynthetic?: boolean } = {},
): DomainResult<S4Result> {
  const fail = (code: string, message: string): DomainResult<S4Result> => DomainResult.fail([{ code, message }]);
  if (block?.s4Result === undefined) return fail('LOOP_GEMINI_S4_MISSING', 'the Gemini generator has no S4 result (gemini.s4Result); it may not run live');
  const file = path.resolve(repoRoot, block.s4Result);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fail('LOOP_GEMINI_S4_MISSING', `the S4 result ${block.s4Result} is missing or not JSON`);
  }
  if (!isRecord(raw) || raw.schema !== S4_RESULT_SCHEMA || !isRecord(raw.arms)) return fail('LOOP_GEMINI_S4_MISSING', `${block.s4Result} is not an ${S4_RESULT_SCHEMA} result`);
  const r = raw as unknown as S4Result;
  if (r.synthetic === true && o.allowSynthetic !== true) return fail('LOOP_GEMINI_S4_SYNTHETIC', `${block.s4Result} is a synthetic S4 result; only the recorded dry run may use it`);
  if (r.cliVersion !== block.cliVersion || r.modelId !== modelId) {
    return fail('LOOP_GEMINI_S4_MISMATCH', `${block.s4Result} is for agy ${String(r.cliVersion)} and model ${String(r.modelId)}, the plan pins ${block.cliVersion} and ${modelId}`);
  }
  const needed = [...new Set(arms.map(agyGenArmOf))].sort();
  const notPassed = needed.filter((a) => r.arms[a] !== 'pass');
  if (notPassed.length > 0) return fail('LOOP_GEMINI_S4_FAILED', `the S4 result does not pass for arm(s) ${notPassed.join(', ')}`);
  return DomainResult.ok(r);
}
