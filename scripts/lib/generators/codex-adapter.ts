/**
 * Codex CLI generator adapter (FR-v1.2E-28; SECURITY-11; ADR-029; `Docs/generator-protocol.md` §12).
 *
 * `CodexCliAdapter` is the Codex counterpart of `ClaudeCodeAdapter` (`grid.ts`) and shares everything after the CLI
 * call: per-run path checks → fresh `cwd` with the skeleton `package.json` and the read-only `node_modules` symlink →
 * pinned per-run tsconfig under `<H>/runs/<runId>/` → instantiated frozen prompt (the same templates and
 * `{{TYPECHECK_COMMAND}}` as the Claude arm) → one `codex exec` call with the confined argument set
 * (`buildCodexArgs`, prompt on stdin), the Codex child environment and `timeoutMs` → retries and usage-limit pauses
 * (`runWithRetries`, the same policy) → `finaliseRun` (envelope, the pre-registered model-usage rule, skeleton
 * integrity, the harness type-check of record, counts, tree sha), with `adapterId` `codex-cli`.
 *
 * Before every call the config home is checked (`checkCodexHome`, fail closed); after it the session rollout is
 * moved out of `CODEX_HOME` into the envelope (`takeRollout`). `isAvailable()` requires `codex --version` to equal
 * the pinned `cliVersion` (the npm-installed CLI does not self-update; the pin catches a manual update).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { typecheckCommand } from './argv.js';
import { buildCodexArgs, buildCodexChildEnv, checkCodexHome, codexReadDenies, CODEX_CLI_ADAPTER_ID, parseCodexVersion } from './codex-cli.js';
import type { CodexCliConfig } from './codex-cli.js';
import { codexUsageLimit, parseCodexRun, takeRollout } from './codex-events.js';
import { checkRunDirs } from './config.js';
import type { ParsedEnvelope } from './envelope.js';
import { writeHarnessTsconfig } from './harness-tsconfig.js';
import { agentFileCount, attemptDisposition, finaliseRun } from './outcome.js';
import type { AttemptDisposition } from './outcome.js';
import { DEFAULT_RETRY_POLICY, realSleep, runWithRetries, systemClock } from './retry.js';
import type { Clock, RetryPolicy, Sleeper } from './retry.js';
import { prepareCellDir, removeTree } from './skeleton.js';
import type { SkeletonInstall } from './skeleton.js';
import type { GenerationOutcome, GenerationRequest, GeneratorAdapter, PromptProvider } from './types.js';

const VERSION_TIMEOUT_MS = 30_000;
const INTERRUPTIONS_DIR = 'interruptions';

export interface CodexCliAdapterDeps {
  readonly runner: ProcessRunner;
  readonly config: CodexCliConfig;
  readonly repoRoot: string;
  readonly install: () => SkeletonInstall;
  readonly prompts: PromptProvider;
  readonly parentEnv?: NodeJS.ProcessEnv;
  readonly policy?: RetryPolicy;
  readonly clock?: Clock;
  readonly sleep?: Sleeper;
  readonly knownSecrets?: readonly string[];
  readonly tmpRoot?: string;
}

/** Disposition of one Codex call: the Codex usage-limit reading first, then the shared rule (BR-U5a-50). */
export function codexAttemptDisposition(cli: ProcessResult | null, envelope: ParsedEnvelope | null, agentFiles: number): AttemptDisposition {
  if (cli !== null) {
    const usage = codexUsageLimit(cli, envelope);
    if (usage !== null) return { kind: 'usage-limit', usage, label: 'usage-limit' };
  }
  return attemptDisposition(cli, envelope, agentFiles);
}

export class CodexCliAdapter implements GeneratorAdapter {
  readonly id = CODEX_CLI_ADAPTER_ID;
  readonly modelId: string;

  constructor(private readonly deps: CodexCliAdapterDeps) {
    this.modelId = deps.config.modelId;
  }

  private childEnv(): Readonly<Record<string, string>> {
    return buildCodexChildEnv(this.deps.parentEnv ?? process.env, this.deps.config);
  }

  /** The installed CLI answers `--version` with exactly the pinned version. */
  async isAvailable(): Promise<boolean> {
    const r = await this.deps.runner.run(this.deps.config.binary, ['--version'], { env: this.childEnv(), timeoutMs: VERSION_TIMEOUT_MS });
    return r.success && r.data.exitCode === 0 && !r.data.timedOut && parseCodexVersion(r.data.stdout) === this.deps.config.cliVersion;
  }

  private prepare(req: GenerationRequest): DomainResult<void> {
    const prep = prepareCellDir(this.deps.install(), this.deps.repoRoot, req.outputDir);
    if (!prep.success) return prep;
    writeHarnessTsconfig(this.deps.config.harnessRoot, req.runId, req.outputDir);
    return DomainResult.ok(undefined);
  }

  async generate(req: GenerationRequest): Promise<DomainResult<GenerationOutcome>> {
    const { config, runner } = this.deps;
    const dirs = checkRunDirs(config, req, this.deps.repoRoot);
    if (!dirs.success) return DomainResult.fail(dirs.errors);
    const prompt = this.deps.prompts(req, typecheckCommand(config.harnessRoot, req.runId));
    if (!prompt.success) return DomainResult.fail(prompt.errors);
    const prepared = this.prepare(req);
    if (!prepared.success) return DomainResult.fail(prepared.errors);
    const env = this.childEnv();
    const knownSecrets = this.deps.knownSecrets ?? [];
    let lastRollout: Parameters<typeof parseCodexRun>[1] = null;

    const retried = await runWithRetries<ProcessResult | null>(
      {
        runAttempt: async () => {
          const home = checkCodexHome(config.codexHome);
          if (!home.success) return DomainResult.fail(home.errors);
          const args = buildCodexArgs(config, req.outputDir, codexReadDenies(config, req.outputDir, path.dirname(path.resolve(this.deps.repoRoot))));
          const call = await runner.run(config.binary, args, { cwd: req.outputDir, env, stdin: prompt.data.prompt, timeoutMs: config.timeoutMs });
          const cli = call.success ? call.data : null;
          let envelope: ParsedEnvelope | null = null;
          lastRollout = null;
          if (cli !== null) {
            const first = parseCodexRun(cli.stdout, null, knownSecrets);
            lastRollout = takeRollout(config.codexHome, first.success ? first.data.summary.sessionId : undefined);
            const parsed = parseCodexRun(cli.stdout, lastRollout, knownSecrets);
            envelope = parsed.success ? parsed.data : null;
          }
          return DomainResult.ok({ disposition: codexAttemptDisposition(cli, envelope, agentFileCount(req.outputDir)), value: cli });
        },
        onInterruption: (index) => {
          const rel = path.posix.join(INTERRUPTIONS_DIR, req.runId, String(index));
          const to = path.join(config.outputRoot, ...rel.split('/'));
          fs.mkdirSync(path.dirname(to), { recursive: true });
          if (fs.existsSync(to)) removeTree(to);
          fs.renameSync(req.outputDir, to);
          const again = this.prepare(req);
          return again.success ? DomainResult.ok(rel) : DomainResult.fail(again.errors);
        },
        onRetry: () => {
          removeTree(req.outputDir);
          return this.prepare(req);
        },
      },
      this.deps.policy ?? DEFAULT_RETRY_POLICY,
      this.deps.clock ?? systemClock,
      this.deps.sleep ?? realSleep,
    );
    if (!retried.success) return DomainResult.fail(retried.errors);
    const rollout = lastRollout;
    return finaliseRun({
      runner,
      repoRoot: this.deps.repoRoot,
      config,
      req,
      install: this.deps.install(),
      prompt: prompt.data,
      cli: retried.data.last.value,
      infrastructureExhausted: retried.data.exhausted,
      attempts: retried.data.attempts,
      interruptions: retried.data.interruptions,
      knownSecrets,
      adapterId: CODEX_CLI_ADAPTER_ID,
      parse: (cli, secrets) => parseCodexRun(cli.stdout, rollout, secrets),
      ...(this.deps.tmpRoot !== undefined ? { tmpRoot: this.deps.tmpRoot } : {}),
    });
  }
}
