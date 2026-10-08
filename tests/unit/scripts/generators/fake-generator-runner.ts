/**
 * Test support for the generator (U5a plan Steps 20–22): a fake `ProcessRunner` that plays the Claude CLI and the
 * harness tsc, delegating `git` (tree sha) to the real runner; a fake read-only skeleton install; envelope builders.
 * No network, no real CLI (D-U5a-9).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { createGeneratorCliConfig, runIdFor } from '../../../../scripts/lib/generators/config.js';
import { installHash, makeReadOnly, prepareCellDir, removeTree } from '../../../../scripts/lib/generators/skeleton.js';
import type { SkeletonInstall } from '../../../../scripts/lib/generators/skeleton.js';
import { writeHarnessTsconfig } from '../../../../scripts/lib/generators/harness-tsconfig.js';
import type {
  GenerationRequest,
  GeneratorCliConfig,
  PromptInstance,
  SpecLevel,
  TaskId,
} from '../../../../scripts/lib/generators/types.js';

export const REPO = process.cwd();
export const MODEL = 'test-model-a';
export const HELPER_MODEL = 'test-helper-model';

export interface CliCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: ProcessRunOptions;
}

/** What one fake CLI call does: files it writes into `cwd`, then the process result it returns. */
export interface CliScript {
  readonly files?: Readonly<Record<string, string>>;
  readonly effect?: (cwd: string) => void;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
  readonly timedOut?: boolean;
  /** Simulate a spawn failure (`PROCESS_SPAWN_FAILED`). */
  readonly spawnFails?: boolean;
}

export class FakeGeneratorRunner implements ProcessRunner {
  readonly cliCalls: CliCall[] = [];
  readonly tscCalls: CliCall[] = [];
  private readonly real = new NodeProcessRunner();
  /** Number of `error TS…` lines the harness tsc prints (per call, last value repeats). */
  tscErrors: number[] = [0];

  constructor(
    private readonly cliBinary: string,
    private readonly scripts: CliScript[] = [],
  ) {}

  queue(...s: CliScript[]): this {
    this.scripts.push(...s);
    return this;
  }

  run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    if (command === 'git') return this.real.run(command, args, options);
    if (command.endsWith('/bin/tsc')) {
      this.tscCalls.push({ command, args, options });
      const n = this.tscErrors.length > 1 ? (this.tscErrors.shift() ?? 0) : (this.tscErrors[0] ?? 0);
      const lines = Array.from({ length: n }, (_, i) => `src/x${String(i)}.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.`);
      return Promise.resolve(
        DomainResult.ok({ exitCode: n === 0 ? 0 : 2, stdout: lines.join('\n'), stderr: '', timedOut: false, durationMs: 5 }),
      );
    }
    if (command === this.cliBinary) {
      this.cliCalls.push({ command, args, options });
      const s = this.scripts.shift() ?? {};
      if (s.spawnFails === true) {
        return Promise.resolve(DomainResult.fail([{ code: 'PROCESS_SPAWN_FAILED', message: 'spawn ENOENT', context: { errno: 'ENOENT' } }]));
      }
      const cwd = options.cwd ?? '';
      for (const [rel, text] of Object.entries(s.files ?? {})) {
        fs.mkdirSync(path.dirname(path.join(cwd, rel)), { recursive: true });
        fs.writeFileSync(path.join(cwd, rel), text);
      }
      s.effect?.(cwd);
      return Promise.resolve(
        DomainResult.ok({
          exitCode: s.exitCode ?? 0,
          stdout: s.stdout ?? '',
          stderr: s.stderr ?? '',
          timedOut: s.timedOut ?? false,
          durationMs: 42,
        }),
      );
    }
    return Promise.resolve(DomainResult.fail([{ code: 'PROCESS_SPAWN_FAILED', message: `unexpected command ${command}` }]));
  }
}

export interface EnvelopeOptions {
  readonly isError?: boolean;
  readonly numTurns?: number;
  readonly denials?: number;
  readonly pinnedTokens?: number;
  readonly helperTokens?: number;
  readonly pinned?: string | null;
  readonly result?: string;
  readonly subtype?: string;
}

export function envelope(o: EnvelopeOptions = {}): string {
  const usage: Record<string, { outputTokens: number }> = {};
  const pinned = o.pinned === undefined ? MODEL : o.pinned;
  if (pinned !== null) usage[pinned] = { outputTokens: o.pinnedTokens ?? 5000 };
  if (o.helperTokens !== undefined) usage[HELPER_MODEL] = { outputTokens: o.helperTokens };
  return JSON.stringify({
    type: 'result',
    subtype: o.subtype ?? (o.isError === true ? 'error_during_execution' : 'success'),
    is_error: o.isError ?? false,
    num_turns: o.numTurns ?? 12,
    result: o.result ?? 'done',
    permission_denials: Array.from({ length: o.denials ?? 0 }, (_, i) => ({ tool_name: 'Bash', tool_use_id: `t${String(i)}` })),
    total_cost_usd: 0.5,
    duration_ms: 1000,
    session_id: 'session-1',
    modelUsage: usage,
  });
}

/** `n` small `.ts` files under `src/`. */
export function sourceFiles(n: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < n; i++) out[`src/domain/f${String(i)}.ts`] = `export const v${String(i)} = ${String(i)};\n`;
  return out;
}

export interface Harness {
  readonly tmp: string;
  readonly outRoot: string;
  readonly harnessRoot: string;
  readonly binary: string;
  readonly config: GeneratorCliConfig;
  readonly install: SkeletonInstall;
  cleanup(): void;
}

/** A temp harness (outside the repo) with a fake read-only skeleton install. */
export function makeHarness(opts: { allowBash?: boolean; outRootName?: string } = {}): Harness {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-gen-')));
  const outRoot = path.join(tmp, opts.outRootName ?? 'out');
  const harnessRoot = path.join(tmp, 'h');
  const binary = path.join(tmp, 'bin', 'claude');
  fs.mkdirSync(outRoot, { recursive: true });
  const dir = path.join(harnessRoot, 'skeleton-install');
  fs.mkdirSync(path.join(dir, 'node_modules', 'typescript', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'node_modules', 'typescript', 'lib', 'tsc.js'), '// tsc\n');
  fs.writeFileSync(path.join(dir, 'node_modules', 'typescript', 'package.json'), '{"name":"typescript","version":"5.9.3"}\n');
  fs.mkdirSync(path.join(dir, 'node_modules', '.bin'));
  fs.symlinkSync('../typescript/lib/tsc.js', path.join(dir, 'node_modules', '.bin', 'tsc'));
  const install: SkeletonInstall = {
    dir,
    installHash: installHash(dir),
    packageJsonSha256: '0'.repeat(64),
    lockSha256: '0'.repeat(64),
    tscJs: path.join(dir, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    tscVersion: '5.9.3',
  };
  makeReadOnly(dir);
  const cfg = createGeneratorCliConfig(
    { binary, modelId: MODEL, outputRoot: outRoot, harnessRoot, ...(opts.allowBash === false ? { allowBash: false } : {}) },
    REPO,
  );
  if (!cfg.success) throw new Error(cfg.errors.map((e) => e.code).join(','));
  return {
    tmp,
    outRoot,
    harnessRoot,
    binary,
    config: cfg.data,
    install,
    cleanup: () => {
      removeTree(tmp);
    },
  };
}

export function request(
  h: Harness,
  o: { taskId?: TaskId; specLevel?: SpecLevel; runIndex?: number; modelId?: string; pilot?: boolean } = {},
): GenerationRequest {
  const modelId = o.modelId ?? MODEL;
  const taskId = o.taskId ?? 'task-management';
  const specLevel = o.specLevel ?? 'none';
  const runIndex = o.runIndex ?? 0;
  const runId = runIdFor(modelId, taskId, specLevel, runIndex);
  return {
    runId,
    promptTemplateId: `${specLevel}/${taskId}`,
    taskId,
    modelId,
    style: 'clean-architecture',
    specLevel,
    runIndex,
    outputDir: path.join(h.outRoot, ...runId.split('/')),
    fileRange: { min: 20, max: 100 },
    orderSeed: 7,
    pilot: o.pilot ?? false,
  };
}

export const PROMPT: PromptInstance = {
  promptTemplateId: 'none/task-management',
  promptTemplateSha256: 'a'.repeat(64),
  prompt: 'Build it. Type-check with the command.',
  promptSha256: 'b'.repeat(64),
};

/** Prepares the cell directory and the per-run tsconfig, as the adapter does before the first call. */
export function prepareCell(h: Harness, req: GenerationRequest): void {
  const r = prepareCellDir(h.install, REPO, req.outputDir);
  if (!r.success) throw new Error(r.errors[0]?.message);
  writeHarnessTsconfig(h.harnessRoot, req.runId, req.outputDir);
}
