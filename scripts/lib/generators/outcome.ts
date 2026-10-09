/**
 * Generation outcome and status decision (FR-v1.2E-28; BR-U5a-48, 49; `business-logic-model.md` §5.2).
 *
 * - `attemptDisposition(...)`: what one CLI call was. `usage-limit` (a usage or rate limit reported by an erroring
 *   call: no attempt consumed, BR-U5a-50), `infrastructure` (spawn failure; runner timeout with zero agent files; a
 *   non-zero exit with zero agent files and no turn taken) or `final`. Every `final` call becomes exactly one
 *   `GenerationOutcome`; nothing that the model produced (`failed-typecheck`, `agent-error`, `model-mismatch`,
 *   `skeleton-tampered`) is ever retried or replaced (BR-U5a-49).
 * - `decideStatus(inputs)`: the §5.2 order (1 infrastructure after retries, 2 timeout with files, 3 envelope
 *   unreadable, 4 skeleton tampered, 5 model mismatch, 6 `is_error`, 7 type-check errors, 8 ok).
 * - `finaliseRun(...)`: for a `final` (or retry-exhausted) call: stores the scrubbed envelope beside the tree, and,
 *   whenever the CLI ran in `cwd`, always evaluates rows 4–7 (skeleton integrity, model-usage rule when an envelope
 *   exists, the harness-owned type-check of record), counts `.ts` files under `<cwd>/src`, flags the range and
 *   computes the tree's git tree sha, then builds the outcome through `makeGenerationOutcome`.
 * - `makeGenerationOutcome(fields)`: the factory enforcing the §5 invariants (`status = ok` ⇔ no `failureReason`;
 *   `failed-typecheck` ⇒ `typecheck.errors > 0`; `fileCountInRange` = 20 ≤ `fileCount` ≤ 100).
 * - `writeGenerationJson(dir, outcome)`: `<dir>/generation.json`, written atomically (a temp file renamed into place),
 *   so a `generation.json` that exists is always complete: it is the commit marker of a cell (SO5-04).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { scrubDeep, scrubSecrets } from '../../../src/shared/errors/scrub.js';
import { computeTreeSha } from '../mutation/tree-sha.js';
import type { ParsedEnvelope } from './envelope.js';
import { parseEnvelope, writeEnvelope } from './envelope.js';
import { judgeModelUsage } from './model-usage.js';
import { checkSkeletonIntact, runHarnessTypecheck } from './skeleton.js';
import type { SkeletonInstall } from './skeleton.js';
import { CLAUDE_CODE_ADAPTER_ID, FILE_RANGE } from './types.js';
import type {
  AuxiliaryModel,
  GenerationAttempt,
  GenerationFailureReason,
  GenerationInterruption,
  GenerationOutcome,
  GenerationRequest,
  GenerationStatus,
  GeneratorCliConfig,
  PromptInstance,
} from './types.js';

export const GENERATION_JSON = 'generation.json';
export const ENVELOPE_JSON = 'envelope.json';
/** Harness-written files beside the tree (excluded from `treeSha` and the agent file count). */
export const HARNESS_RECORD_FILES: readonly string[] = [GENERATION_JSON, ENVELOPE_JSON];
/** Skeleton entries in `cwd` (BR-U5a-45), excluded from the agent file count and from `treeSha` (`node_modules`). */
const SKELETON_ENTRIES: readonly string[] = ['package.json', 'node_modules'];
/** Tail of a non-JSON stdout kept (scrubbed) in `envelope.json`. */
const UNREADABLE_TAIL_CHARS = 4000;

const USAGE_LIMIT_TEXT = /usage limit|rate[ _-]?limit|too many requests/i;
const RESET_EPOCH = /\|(\d{10})(?!\d)/;

// --- file counts and tree sha ----------------------------------------------------------------------------------

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Repo-style POSIX paths (relative to `root`) of every regular file or symlink, never following links. */
function listTree(root: string, rel: string, skip: (rel: string) => boolean, out: string[]): void {
  const abs = rel === '' ? root : path.join(root, ...rel.split('/'));
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const r = rel === '' ? e.name : `${rel}/${e.name}`;
    if (skip(r)) continue;
    if (e.isDirectory()) listTree(root, r, skip, out);
    else if (e.isFile() || e.isSymbolicLink()) out.push(r);
  }
}

/** BR-U5a-48: `.ts` files under `<cwd>/src` (the skeleton lives outside `src`; symlinks and `node_modules` skipped). */
export function countSourceFiles(cwd: string): number {
  const files: string[] = [];
  listTree(path.join(cwd, 'src'), '', (r) => r.split('/').includes('node_modules'), files);
  return files.filter((f) => f.endsWith('.ts') && fs.lstatSync(path.join(cwd, 'src', ...f.split('/'))).isFile()).length;
}

export function isFileCountInRange(count: number): boolean {
  return count >= FILE_RANGE.min && count <= FILE_RANGE.max;
}

/** Files of the generated tree: everything in `cwd` except the skeleton, harness records and any `.git`. */
export function generatedTreeFiles(cwd: string): readonly string[] {
  const files: string[] = [];
  listTree(
    cwd,
    '',
    (r) => r === 'node_modules' || HARNESS_RECORD_FILES.includes(r) || r.split('/').includes('.git'),
    files,
  );
  return files.sort(cmp);
}

/** Files the agent wrote (skeleton and harness records excluded); decides "timeout with files written". */
export function agentFileCount(cwd: string): number {
  return generatedTreeFiles(cwd).filter((f) => !SKELETON_ENTRIES.includes(f)).length;
}

// --- disposition of one CLI call -------------------------------------------------------------------------------

export interface UsageLimitSignal {
  readonly subtype: string;
  /** Reset time (epoch ms) when the CLI reported one (`…|<epoch seconds>`). */
  readonly resetAt?: number;
}

export type AttemptDisposition =
  | { readonly kind: 'usage-limit'; readonly usage: UsageLimitSignal; readonly label: string }
  | { readonly kind: 'infrastructure'; readonly label: string }
  | { readonly kind: 'final'; readonly label: string };

/**
 * A usage or rate limit: only for an erroring call (non-zero exit, unreadable stdout, or `is_error`), when the
 * envelope `result`/`subtype` or the raw output names a usage limit, rate limit or HTTP 429. A successful run whose
 * text mentions rate limiting (e.g. a generated middleware) is never read as a limit.
 */
export function detectUsageLimit(cli: ProcessResult, envelope: ParsedEnvelope | null): UsageLimitSignal | null {
  const erroring = cli.exitCode !== 0 || envelope === null || envelope.summary.isError === true;
  if (!erroring) return null;
  const parts: string[] = [];
  if (envelope !== null) {
    const result = envelope.scrubbed.result;
    if (typeof result === 'string') parts.push(result);
    if (envelope.summary.subtype !== undefined) parts.push(envelope.summary.subtype);
  } else {
    parts.push(cli.stdout.slice(-UNREADABLE_TAIL_CHARS));
  }
  parts.push(cli.stderr.slice(-UNREADABLE_TAIL_CHARS));
  const text = parts.join('\n');
  if (!USAGE_LIMIT_TEXT.test(text) && !/\b429\b/.test(text)) return null;
  const m = RESET_EPOCH.exec(text);
  const subtype = envelope?.summary.subtype ?? (/rate/i.test(text) ? 'rate-limit' : 'usage-limit');
  return m?.[1] === undefined ? { subtype } : { subtype, resetAt: Number(m[1]) * 1000 };
}

/** BR-U5a-50 classification of one CLI call (a spawn failure is passed as `cli: null`). */
export function attemptDisposition(cli: ProcessResult | null, envelope: ParsedEnvelope | null, agentFiles: number): AttemptDisposition {
  if (cli === null) return { kind: 'infrastructure', label: 'spawn-failed' };
  const usage = detectUsageLimit(cli, envelope);
  if (usage !== null) return { kind: 'usage-limit', usage, label: 'usage-limit' };
  if (cli.timedOut) {
    return agentFiles === 0 ? { kind: 'infrastructure', label: 'timeout-no-files' } : { kind: 'final', label: 'timeout' };
  }
  const turns = envelope?.summary.numTurns;
  if (cli.exitCode !== 0 && agentFiles === 0 && (turns === undefined || turns === 0)) {
    return { kind: 'infrastructure', label: `exit-${String(cli.exitCode)}-before-first-turn` };
  }
  return { kind: 'final', label: 'completed' };
}

// --- status decision -------------------------------------------------------------------------------------------

export interface StatusInputs {
  /** Row 1: infrastructure failure after the retries. */
  readonly infrastructure: boolean;
  /** Row 2: runner timeout with files written. */
  readonly timedOutWithFiles: boolean;
  /** Row 3 when false. */
  readonly envelopeReadable: boolean;
  /** Row 4 when false; `null` = not evaluated. */
  readonly skeletonIntact: boolean | null;
  /** Row 5 when false; `null` = not evaluated (no envelope). */
  readonly modelValid: boolean | null;
  /** Row 6 when true. */
  readonly isError: boolean;
  /** Row 7 when > 0; `null` = not evaluated. */
  readonly typecheckErrors: number | null;
}

export interface StatusDecision {
  readonly status: GenerationStatus;
  readonly failureReason?: GenerationFailureReason;
}

export function decideStatus(i: StatusInputs): StatusDecision {
  if (i.infrastructure) return { status: 'failed-agent', failureReason: 'infrastructure' };
  if (i.timedOutWithFiles) return { status: 'failed-agent', failureReason: 'timeout' };
  if (!i.envelopeReadable) return { status: 'failed-agent', failureReason: 'envelope-unreadable' };
  if (i.skeletonIntact === false) return { status: 'failed-agent', failureReason: 'skeleton-tampered' };
  if (i.modelValid === false) return { status: 'failed-agent', failureReason: 'model-mismatch' };
  if (i.isError) return { status: 'failed-agent', failureReason: 'agent-error' };
  if (i.typecheckErrors !== null && i.typecheckErrors > 0) return { status: 'failed-typecheck', failureReason: 'typecheck' };
  return { status: 'ok' };
}

// --- factory and writer ----------------------------------------------------------------------------------------

/** Every `GenerationOutcome` field except the derived `fileCountInRange`. */
export type GenerationOutcomeFields = Omit<GenerationOutcome, 'fileCountInRange'>;

export function makeGenerationOutcome(f: GenerationOutcomeFields): DomainResult<GenerationOutcome> {
  const errors: DomainError[] = [];
  const bad = (message: string): void => {
    errors.push({ code: 'GEN_OUTCOME_INVALID', message });
  };
  if ((f.status === 'ok') !== (f.failureReason === undefined)) bad("status 'ok' if and only if failureReason is absent");
  if (f.status === 'failed-typecheck' && (f.typecheck === null || f.typecheck.errors <= 0 || f.failureReason !== 'typecheck')) {
    bad("'failed-typecheck' needs typecheck.errors > 0 and failureReason 'typecheck'");
  }
  if (f.status === 'failed-agent' && (f.failureReason === undefined || f.failureReason === 'typecheck')) {
    bad("'failed-agent' needs an agent failure reason");
  }
  if (!Number.isInteger(f.fileCount) || f.fileCount < 0) bad('fileCount must be a non-negative integer');
  if (!/^[0-9a-f]{64}$/.test(f.promptTemplateSha256) || !/^[0-9a-f]{64}$/.test(f.promptSha256)) bad('prompt hashes must be sha256 hex');
  if (f.treeSha !== null && !/^[0-9a-f]{40}$/.test(f.treeSha)) bad('treeSha must be a 40-hex git tree sha or null');
  if (f.resolvedModelId !== undefined && f.resolvedModelId !== f.requestedModelId) bad('resolvedModelId must equal requestedModelId');
  if (errors.length > 0) return DomainResult.fail(errors);
  return DomainResult.ok(Object.freeze({ ...f, fileCountInRange: isFileCountInRange(f.fileCount) }));
}

export function generationJsonPath(dir: string): string {
  return path.join(dir, GENERATION_JSON);
}

export function writeGenerationJson(dir: string, outcome: GenerationOutcome): string {
  const file = generationJsonPath(dir);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp-${String(process.pid)}`;
  fs.writeFileSync(tmp, `${JSON.stringify(outcome, null, 2)}\n`);
  fs.renameSync(tmp, file);
  return file;
}

// --- finalising one run ----------------------------------------------------------------------------------------

export interface FinaliseRunInput {
  readonly runner: ProcessRunner;
  readonly repoRoot: string;
  readonly config: GeneratorCliConfig;
  readonly req: GenerationRequest;
  readonly install: Pick<SkeletonInstall, 'dir' | 'installHash' | 'tscVersion'>;
  readonly prompt: PromptInstance;
  /** The last CLI call (`null` when it could not be spawned). */
  readonly cli: ProcessResult | null;
  /** True when the infrastructure retries are exhausted (row 1). */
  readonly infrastructureExhausted: boolean;
  readonly attempts: readonly GenerationAttempt[];
  readonly interruptions: readonly GenerationInterruption[];
  readonly knownSecrets: readonly string[];
  /** Parent of the throwaway git object store used for `treeSha` (default `os.tmpdir()`). */
  readonly tmpRoot?: string;
}

/** Writes `envelope.json` (scrubbed) beside the tree and returns the parsed envelope (or `null` when unreadable). */
function storeEnvelope(cwd: string, cli: ProcessResult | null, knownSecrets: readonly string[]): ParsedEnvelope | null {
  const file = path.join(cwd, ENVELOPE_JSON);
  if (cli === null) {
    writeEnvelope(file, { unreadable: true, reason: 'spawn-failed' });
    return null;
  }
  const parsed = parseEnvelope(cli.stdout, knownSecrets);
  if (parsed.success) {
    writeEnvelope(file, parsed.data.scrubbed);
    return parsed.data;
  }
  writeEnvelope(
    file,
    scrubDeep(
      {
        unreadable: true,
        exitCode: cli.exitCode,
        timedOut: cli.timedOut,
        stdoutTail: cli.stdout.slice(-UNREADABLE_TAIL_CHARS),
        stderrTail: cli.stderr.slice(-UNREADABLE_TAIL_CHARS),
      },
      knownSecrets,
    ),
  );
  return null;
}

/** Builds the outcome of a finished run (see the module header). Harness failures (tsc or git cannot run) fail. */
export async function finaliseRun(input: FinaliseRunInput): Promise<DomainResult<GenerationOutcome>> {
  const { req, cli } = input;
  const cwd = req.outputDir;
  fs.mkdirSync(cwd, { recursive: true });
  const envelope = storeEnvelope(cwd, cli, input.knownSecrets);
  const ranInCwd = cli !== null && !input.infrastructureExhausted;

  let typecheck: GenerationOutcome['typecheck'] = null;
  let treeSha: string | null = null;
  let auxiliaryModels: readonly AuxiliaryModel[] = [];
  let resolvedModelId: string | undefined;
  let modelValid: boolean | null = null;
  if (envelope !== null) {
    const verdict = judgeModelUsage(req.modelId, envelope.summary);
    auxiliaryModels = verdict.auxiliaryModels;
    modelValid = verdict.valid;
    if (verdict.valid) resolvedModelId = verdict.resolvedModelId;
  }
  // Row 4 is evaluated for every run (the cell directory was prepared before the first call).
  const skeletonIntact = checkSkeletonIntact(input.install, input.repoRoot, cwd).skeletonIntact;
  if (ranInCwd) {
    const tc = await runHarnessTypecheck(input.runner, input.config.harnessRoot, req.runId, cwd);
    if (!tc.success) return DomainResult.fail(tc.errors);
    typecheck = { tscVersion: input.install.tscVersion, errors: tc.data.length };
    const tree = await computeTreeSha(input.runner, cwd, generatedTreeFiles(cwd), input.tmpRoot !== undefined ? { tmpRoot: input.tmpRoot } : {});
    if (!tree.success) return DomainResult.fail(tree.errors);
    treeSha = tree.data;
  }
  const decision = decideStatus({
    infrastructure: input.infrastructureExhausted,
    timedOutWithFiles: cli !== null && cli.timedOut && !input.infrastructureExhausted,
    envelopeReadable: envelope !== null,
    skeletonIntact,
    modelValid,
    isError: envelope?.summary.isError === true,
    typecheckErrors: typecheck?.errors ?? null,
  });
  const fileCount = ranInCwd ? countSourceFiles(cwd) : 0;
  return makeGenerationOutcome({
    status: decision.status,
    ...(decision.failureReason !== undefined ? { failureReason: decision.failureReason } : {}),
    adapterId: CLAUDE_CODE_ADAPTER_ID,
    taskId: req.taskId,
    specLevel: req.specLevel,
    runIndex: req.runIndex,
    orderSeed: req.orderSeed,
    requestedModelId: req.modelId,
    ...(resolvedModelId !== undefined ? { resolvedModelId } : {}),
    auxiliaryModels,
    promptTemplateId: input.prompt.promptTemplateId,
    promptTemplateSha256: input.prompt.promptTemplateSha256,
    promptSha256: input.prompt.promptSha256,
    prompt: scrubSecrets(input.prompt.prompt, input.knownSecrets),
    skeletonIntact,
    fileCount,
    permissionDenials: envelope?.summary.permissionDenials?.length ?? 0,
    typecheck,
    attempts: input.attempts,
    interruptions: input.interruptions,
    treeSha,
    durationMs: cli?.durationMs ?? 0,
    pilot: req.pilot,
    envelopePath: ENVELOPE_JSON,
  });
}
