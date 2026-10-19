/**
 * Step agents of the multi-step loop: one CLI turn in an existing work directory, under an arm.
 *
 * Both adapters reuse the E1 generator code unchanged in what it confines:
 * - Claude Code: `buildArmCall` (the E1 BR-U5a-41 argv; `daedalus-mcp` adds the strict MCP config and the exact
 *   spec-only tool rules, `evaluate_project` denied), the allow-listed child environment (`buildGeneratorChildEnv`),
 *   the tolerant envelope reader and the E1 attempt disposition.
 * - Codex: `buildCodexArgs` with the per-call read denies, `buildCodexChildEnv`, the config-home check before every
 *   call, the rollout taken out of `CODEX_HOME`, and `codexAttemptDisposition`. For `daedalus-mcp` the same server is
 *   added with `-c mcp_servers.daedalus-arch.*` overrides (`withCodexMcpServer`), allowing the spec-only tools by exact
 *   name and disabling `evaluate_project`. This wiring has NOT been through a live confinement probe yet (see the
 *   Study 2 outline, prerequisites).
 * - Both: `runWithRetries` (BR-U5a-50): usage limits consume no attempt, pause until the reported reset and resume the
 *   same turn after the interrupted tree is archived and the work tree is put back to the last snapshot; infrastructure
 *   failures are retried at most twice from the last snapshot.
 *
 * The `gate` arm runs every turn with the `none` argv: its feedback is the repair prompt, not a tool.
 * The pinned per-run tsconfig is written under `<H>/runs/<runId>/` before every turn (the type-check command of the
 * prompt points at it).
 *
 * - Gemini (`agy-cli`, decision CDX; OFF by default and NOT YET THROUGH S4, `Docs/v1.4/gemini-s4-probe-spec.md`):
 *   `buildAgyGenArgs` (prompt on stdin), `buildAgyGenChildEnv` (the arm's dedicated generator home as `HOME`), the
 *   generator home check before every spawn, the turn's home files (exact allow list with the run's type-check
 *   command; the MCP config with `--project` and `--call-log` for `daedalus-mcp`), `agyGenAttemptDisposition`, and the
 *   `status` hook. An auth failure or a completed tool step outside the arm's allow list fails the turn
 *   (`LOOP_GEMINI_AUTH`, `LOOP_GEMINI_TOOL_ESCAPE`), which stops the grid.
 *
 * Claude only, OFF by default (`isolation.ts`, `Docs/v1.3/loop-isolation.md`): `cliVersion` makes the pre-run probe
 * refuse any other `claude --version`; `isolation` runs the probe and every turn with a per-run `HOME`, the dedicated
 * `CLAUDE_CONFIG_DIR` and auto-update off, checks both before every spawn, and writes `env-<turnId>.json`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { DAEDALUS_ARM_TOOLS, DAEDALUS_DENIED_TOOLS, DAEDALUS_MCP_SERVER, armPrompt, buildArmCall, checkDaedalusInput } from '../generators/arms.js';
import type { DaedalusServerInput, ExperimentArm } from '../generators/arms.js';
import { codexAttemptDisposition } from '../generators/codex-adapter.js';
import { buildCodexArgs, buildCodexChildEnv, checkCodexHome, codexReadDenies, parseCodexVersion } from '../generators/codex-cli.js';
import type { CodexCliConfig } from '../generators/codex-cli.js';
import { parseCodexRun, takeRollout } from '../generators/codex-events.js';
import { parseEnvelope, writeEnvelope } from '../generators/envelope.js';
import type { ParsedEnvelope } from '../generators/envelope.js';
import { buildGeneratorChildEnv } from '../generators/env.js';
import { writeHarnessTsconfig } from '../generators/harness-tsconfig.js';
import { judgeModelUsage } from '../generators/model-usage.js';
import { attemptDisposition } from '../generators/outcome.js';
import type { AttemptDisposition } from '../generators/outcome.js';
import { DEFAULT_RETRY_POLICY, realSleep, runWithRetries, systemClock } from '../generators/retry.js';
import type { Clock, RetryPolicy, Sleeper } from '../generators/retry.js';
import { AGY_GEN_CLI_ADAPTER_ID, CLAUDE_CODE_ADAPTER_ID, CODEX_CLI_ADAPTER_ID_VALUE } from '../generators/types.js';
import { parseAgyVersion } from '../../../src/llm-critic/agy-cli-provider.js';
import { agyGenArmOf, buildAgyGenArgs, buildAgyGenChildEnv, checkAgyGenHome, checkAncestors, writeAgyTurnFiles } from '../generators/agy-gen-cli.js';
import type { AgyGenArm, AgyGenCliConfig } from '../generators/agy-gen-cli.js';
import { agyGenAttemptDisposition, agyGenStop, agyGenTurnStatus, parseAgyGenRun } from '../generators/agy-gen-events.js';
import { typecheckCommand } from '../generators/argv.js';
import type { GeneratorCliConfig } from '../generators/types.js';
import { checkIsolationBeforeSpawn, isolatedClaudeEnv, parseCliVersion, probeHomeOf, runHomeOf, turnEnvRecord } from './isolation.js';
import type { ClaudeIsolation } from './isolation.js';
import { EMPTY_USAGE } from './types.js';
import type { LoopArm, StepAgent, TurnInput, TurnResult, TurnStatus, TurnUsage } from './types.js';

export const PROMPT_PLACEHOLDER = '<prompt>';

const VERSION_TIMEOUT_MS = 30_000;

/** The E1 arm whose argv a loop arm uses for its turns (`gate` turns carry no tool). */
export function generatorArmFor(arm: LoopArm): ExperimentArm {
  return arm === 'gate' ? 'none' : arm;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/**
 * Tokens and cost of a turn from the scrubbed envelope: the Claude `usage` block (`input_tokens`, `output_tokens`,
 * `cache_read_input_tokens`, `cache_creation_input_tokens`) when present, else the sum of `modelUsage[*]` output tokens.
 */
export function turnUsage(env: ParsedEnvelope | null): TurnUsage {
  if (env === null) return EMPTY_USAGE;
  const raw = env.scrubbed;
  const usage = isRecord(raw.usage) ? raw.usage : {};
  let outputTokens = num(usage.output_tokens);
  if (outputTokens === null && env.summary.modelUsage !== undefined) {
    let sum = 0;
    let any = false;
    for (const m of Object.values(env.summary.modelUsage)) {
      if (m.outputTokens !== undefined) {
        sum += m.outputTokens;
        any = true;
      }
    }
    outputTokens = any ? sum : null;
  }
  return {
    costUsd: env.summary.totalCostUsd ?? null,
    inputTokens: num(usage.input_tokens),
    outputTokens,
    cacheReadTokens: num(usage.cache_read_input_tokens),
    cacheCreationTokens: num(usage.cache_creation_input_tokens),
    numTurns: env.summary.numTurns ?? null,
    durationMs: env.summary.durationMs ?? null,
  };
}

/** Status of a finished turn, in the E1 status order (infrastructure, timeout, envelope, model, agent error). */
export function turnStatus(cli: ProcessResult | null, exhausted: boolean, envelope: ParsedEnvelope | null, modelId: string): TurnStatus {
  if (cli === null || exhausted) return 'infrastructure';
  if (cli.timedOut) return 'timeout';
  if (envelope === null) return 'envelope-unreadable';
  if (!judgeModelUsage(modelId, envelope.summary).valid) return 'model-mismatch';
  if (envelope.summary.isError === true) return 'agent-error';
  return 'completed';
}

/** The argv with the prompt value replaced, for the record (the prompt is hashed separately). */
export function redactPrompt(args: readonly string[], prompt: string): readonly string[] {
  return args.map((a) => (a === prompt ? PROMPT_PLACEHOLDER : a));
}

export interface StepAgentDeps {
  readonly runner: ProcessRunner;
  readonly parentEnv?: NodeJS.ProcessEnv;
  readonly policy?: RetryPolicy;
  readonly clock?: Clock;
  readonly sleep?: Sleeper;
  readonly knownSecrets?: readonly string[];
  /** Required for the `daedalus-mcp` arm. */
  readonly daedalus?: DaedalusServerInput;
  /** Claude only: the pinned `claude --version` (x.y.z); the probe refuses any other. Unpinned when absent. */
  readonly cliVersion?: string;
  /** Claude only: the isolation of every spawn. The E1 environment when absent. */
  readonly isolation?: ClaudeIsolation;
}

interface CallPlan {
  readonly command: string;
  readonly args: readonly string[];
  readonly stdin?: string;
  readonly env: Readonly<Record<string, string>>;
  readonly before?: () => DomainResult<void>;
  readonly parse: (cli: ProcessResult) => ParsedEnvelope | null;
  readonly disposition: (cli: ProcessResult | null, envelope: ParsedEnvelope | null, changed: number) => AttemptDisposition;
  /** Written as `env-<turnId>.json` beside the envelope when present (isolated Claude turns). */
  readonly envRecord?: () => unknown;
  /**
   * The turn status; `turnStatus` when absent (Claude and Codex pass none, so their records are unchanged). The Gemini
   * agent passes `agyGenTurnStatus`: agy reports a print timeout as exit 0 with SUCCESS, which `turnStatus` (keyed on
   * `cli.timedOut`) would read as completed.
   */
  readonly status?: (cli: ProcessResult | null, exhausted: boolean, envelope: ParsedEnvelope | null, modelId: string) => TurnStatus;
}

/** The shared turn driver: retries, interruptions, envelope, status and usage. */
async function driveTurn(
  input: TurnInput,
  config: GeneratorCliConfig,
  deps: StepAgentDeps,
  plan: CallPlan,
  prompt: string,
): Promise<DomainResult<TurnResult>> {
  const clock = deps.clock ?? systemClock;
  const started = clock.now();
  const last: { envelope: ParsedEnvelope | null } = { envelope: null };
  const retried = await runWithRetries<ProcessResult | null>(
    {
      runAttempt: async () => {
        if (plan.before !== undefined) {
          const ok = plan.before();
          if (!ok.success) return DomainResult.fail(ok.errors);
        }
        const call = await deps.runner.run(plan.command, plan.args, {
          cwd: input.cwd,
          env: plan.env,
          timeoutMs: config.timeoutMs,
          ...(plan.stdin !== undefined ? { stdin: plan.stdin } : {}),
        });
        const cli = call.success ? call.data : null;
        last.envelope = cli === null ? null : plan.parse(cli);
        return DomainResult.ok({ disposition: plan.disposition(cli, last.envelope, input.changedFiles()), value: cli });
      },
      onInterruption: (index) => {
        const moved = input.archive(index);
        if (!moved.success) return moved;
        const back = input.restore();
        return back.success ? moved : DomainResult.fail(back.errors);
      },
      onRetry: () => input.restore(),
    },
    deps.policy ?? DEFAULT_RETRY_POLICY,
    clock,
    deps.sleep ?? realSleep,
  );
  if (!retried.success) return DomainResult.fail(retried.errors);
  const cli = retried.data.last.value;
  const envelope = cli === null ? null : last.envelope;
  fs.mkdirSync(input.recordDir, { recursive: true });
  const envelopeName = `envelope-${input.turnId}.json`;
  writeEnvelope(
    path.join(input.recordDir, envelopeName),
    envelope !== null ? envelope.scrubbed : { unreadable: true, exitCode: cli?.exitCode ?? null, timedOut: cli?.timedOut ?? null },
  );
  if (plan.envRecord !== undefined) {
    fs.writeFileSync(path.join(input.recordDir, `env-${input.turnId}.json`), `${JSON.stringify(plan.envRecord(), null, 2)}\n`);
  }
  return DomainResult.ok({
    status: (plan.status ?? turnStatus)(cli, retried.data.exhausted, envelope, config.modelId),
    usage: turnUsage(envelope),
    wallMs: clock.now() - started,
    attempts: retried.data.attempts,
    interruptions: retried.data.interruptions,
    argv: redactPrompt(plan.args, prompt),
    envelopePath: envelopeName,
    permissionDenials: envelope?.summary.permissionDenials?.length ?? 0,
  });
}

function writeMcpConfig(file: string, config: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

export class ClaudeStepAgent implements StepAgent {
  readonly adapterId = CLAUDE_CODE_ADAPTER_ID;
  readonly modelId: string;

  constructor(
    private readonly config: GeneratorCliConfig,
    private readonly deps: StepAgentDeps,
  ) {
    this.modelId = config.modelId;
  }

  private probedVersion: string | null = null;

  /**
   * The pre-run probe: `<binary> --version` answers (the E1 availability check), in the environment the turns use;
   * with `cliVersion`, the first `x.y.z` token must equal it (`LOOP_CLI_VERSION_MISMATCH`).
   */
  async probe(): Promise<DomainResult<{ readonly cliVersion: string | null }>> {
    const parent = this.deps.parentEnv ?? process.env;
    const iso = this.deps.isolation;
    let env: Readonly<Record<string, string>>;
    if (iso !== undefined) {
      const home = probeHomeOf(this.config.harnessRoot);
      const ok = checkIsolationBeforeSpawn(home, iso);
      if (!ok.success) return DomainResult.fail(ok.errors);
      env = isolatedClaudeEnv(parent, home, iso);
    } else {
      env = buildGeneratorChildEnv(parent);
    }
    const r = await this.deps.runner.run(this.config.binary, ['--version'], { env, timeoutMs: VERSION_TIMEOUT_MS });
    if (!r.success || r.data.exitCode !== 0 || r.data.timedOut) {
      return DomainResult.fail([{ code: 'LOOP_CLI_UNAVAILABLE', message: 'the claude CLI is not available at the plan binary path' }]);
    }
    const version = parseCliVersion(r.data.stdout);
    const pinned = this.deps.cliVersion;
    if (pinned !== undefined && version !== pinned) {
      return DomainResult.fail([
        { code: 'LOOP_CLI_VERSION_MISMATCH', message: `claude --version reports ${version ?? 'no version'}, the plan pins ${pinned}`, context: { found: version, pinned } },
      ]);
    }
    this.probedVersion = version;
    return DomainResult.ok({ cliVersion: version });
  }

  /** `<binary> --version` answers (the E1 availability check, unchanged; the unpinned, unisolated path). */
  async isAvailable(): Promise<boolean> {
    const env = buildGeneratorChildEnv(this.deps.parentEnv ?? process.env);
    const r = await this.deps.runner.run(this.config.binary, ['--version'], { env, timeoutMs: VERSION_TIMEOUT_MS });
    return r.success && r.data.exitCode === 0 && !r.data.timedOut;
  }

  /** The argv, prompt and MCP config of one turn (no process is spawned). */
  plan(input: Pick<TurnInput, 'runId' | 'cwd' | 'prompt' | 'arm'>): DomainResult<{ args: readonly string[]; prompt: string; mcpConfigPath: string | null; mcpConfig: unknown }> {
    const call = buildArmCall(this.config, { runId: input.runId, outputDir: input.cwd }, input.prompt, {
      arm: generatorArmFor(input.arm),
      ...(this.deps.daedalus !== undefined ? { daedalus: this.deps.daedalus } : {}),
    });
    if (!call.success) return DomainResult.fail(call.errors);
    return DomainResult.ok({ args: call.data.args, prompt: call.data.prompt, mcpConfigPath: call.data.mcpConfigPath, mcpConfig: call.data.mcpConfig });
  }

  async runTurn(input: TurnInput): Promise<DomainResult<TurnResult>> {
    const planned = this.plan(input);
    if (!planned.success) return DomainResult.fail(planned.errors);
    writeHarnessTsconfig(this.config.harnessRoot, input.runId, input.cwd);
    if (planned.data.mcpConfigPath !== null) writeMcpConfig(planned.data.mcpConfigPath, withCallLogArg(planned.data.mcpConfig, input.callLogPath));
    const secrets = this.deps.knownSecrets ?? [];
    const parent = this.deps.parentEnv ?? process.env;
    const iso = this.deps.isolation;
    const home = runHomeOf(this.config.harnessRoot, input.runId);
    const env = iso !== undefined ? isolatedClaudeEnv(parent, home, iso) : buildGeneratorChildEnv(parent);
    let listingSha256 = '';
    const isolated =
      iso === undefined
        ? {}
        : {
            before: (): DomainResult<void> => {
              const ok = checkIsolationBeforeSpawn(home, iso);
              if (!ok.success) return DomainResult.fail(ok.errors);
              listingSha256 = ok.data.configListingSha256;
              return DomainResult.ok(undefined);
            },
            envRecord: () => turnEnvRecord(env, this.probedVersion, listingSha256),
          };
    return driveTurn(
      input,
      this.config,
      this.deps,
      {
        command: this.config.binary,
        args: planned.data.args,
        env,
        parse: (cli) => {
          const p = parseEnvelope(cli.stdout, secrets);
          return p.success ? p.data : null;
        },
        disposition: attemptDisposition,
        ...isolated,
      },
      planned.data.prompt,
    );
  }
}

/**
 * The MCP config with `--call-log <path>` appended to the DaedalusArch server's arguments (Docs/v1.3/mcp-call-log.md);
 * the config unchanged when the turn has no call-log path (the default).
 */
export function withCallLogArg(config: unknown, callLogPath: string | undefined): unknown {
  if (callLogPath === undefined || !isRecord(config) || !isRecord(config.mcpServers)) return config;
  const server = config.mcpServers[DAEDALUS_MCP_SERVER];
  if (!isRecord(server) || !Array.isArray(server.args)) return config;
  return { ...config, mcpServers: { ...config.mcpServers, [DAEDALUS_MCP_SERVER]: { ...server, args: [...(server.args as unknown[]), '--call-log', callLogPath] } } };
}

/** TOML basic string (JSON escaping is a subset of TOML's for these values). */
function tomlString(s: string): string {
  return JSON.stringify(s);
}

function tomlArray(items: readonly string[]): string {
  return `[${items.map(tomlString).join(',')}]`;
}

/**
 * The Codex argument set with the DaedalusArch server added as `-c` overrides before the trailing `-` (prompt on
 * stdin): `command`, `args` (`--spec`, `--project` absolute, and `--call-log` when the turn has a log path), `enabled_tools` (the spec-only tools, exact names) and
 * `disabled_tools` (`evaluate_project`).
 */
export function withCodexMcpServer(base: readonly string[], input: DaedalusServerInput, cwd: string, callLogPath?: string): readonly string[] {
  const key = `mcp_servers.${DAEDALUS_MCP_SERVER}`;
  const serverArgs = [input.serverEntry, '--spec', input.specPath, '--project', cwd, ...(callLogPath !== undefined ? ['--call-log', callLogPath] : [])];
  const extra = [
    '-c',
    `${key}.command=${tomlString(input.nodeBinary)}`,
    '-c',
    `${key}.args=${tomlArray(serverArgs)}`,
    '-c',
    `${key}.enabled_tools=${tomlArray(DAEDALUS_ARM_TOOLS)}`,
    '-c',
    `${key}.disabled_tools=${tomlArray(DAEDALUS_DENIED_TOOLS)}`,
  ];
  const args = [...base];
  const at = args.lastIndexOf('-');
  args.splice(at < 0 ? args.length : at, 0, ...extra);
  return Object.freeze(args);
}

export class CodexStepAgent implements StepAgent {
  readonly adapterId = CODEX_CLI_ADAPTER_ID_VALUE;
  readonly modelId: string;

  constructor(
    private readonly config: CodexCliConfig,
    private readonly deps: StepAgentDeps & { readonly repoRoot: string },
  ) {
    this.modelId = config.modelId;
  }

  /** `codex --version` equals the pinned CLI version (the E1 availability check). */
  async isAvailable(): Promise<boolean> {
    const env = buildCodexChildEnv(this.deps.parentEnv ?? process.env, this.config);
    const r = await this.deps.runner.run(this.config.binary, ['--version'], { env, timeoutMs: VERSION_TIMEOUT_MS });
    return r.success && r.data.exitCode === 0 && !r.data.timedOut && parseCodexVersion(r.data.stdout) === this.config.cliVersion;
  }

  /** The argument set and stdin prompt of one turn (no process is spawned). */
  plan(input: Pick<TurnInput, 'runId' | 'cwd' | 'prompt' | 'arm' | 'callLogPath'>): DomainResult<{ args: readonly string[]; prompt: string }> {
    const arm = generatorArmFor(input.arm);
    const denies = codexReadDenies(this.config, input.cwd, path.dirname(path.resolve(this.deps.repoRoot)));
    const base = buildCodexArgs(this.config, input.cwd, denies);
    const prompt = armPrompt(input.prompt, arm);
    if (arm === 'none') return DomainResult.ok({ args: base, prompt });
    if (arm !== 'daedalus-mcp' || this.deps.daedalus === undefined) {
      return DomainResult.fail([{ code: 'ARM_NOT_CONFIGURED', message: `the ${arm} arm needs nodeBinary, serverEntry and specPath` }]);
    }
    const errors = checkDaedalusInput(this.deps.daedalus, { runId: input.runId, outputDir: input.cwd });
    if (errors.length > 0) return DomainResult.fail(errors);
    return DomainResult.ok({ args: withCodexMcpServer(base, this.deps.daedalus, input.cwd, input.callLogPath), prompt });
  }

  async runTurn(input: TurnInput): Promise<DomainResult<TurnResult>> {
    const planned = this.plan(input);
    if (!planned.success) return DomainResult.fail(planned.errors);
    writeHarnessTsconfig(this.config.harnessRoot, input.runId, input.cwd);
    const secrets = this.deps.knownSecrets ?? [];
    const codexHome = this.config.codexHome;
    return driveTurn(
      input,
      this.config,
      this.deps,
      {
        command: this.config.binary,
        args: planned.data.args,
        stdin: planned.data.prompt,
        env: buildCodexChildEnv(this.deps.parentEnv ?? process.env, this.config),
        before: () => {
          const home = checkCodexHome(codexHome);
          return home.success ? DomainResult.ok(undefined) : DomainResult.fail(home.errors);
        },
        parse: (cli) => {
          const first = parseCodexRun(cli.stdout, null, secrets);
          const rollout = takeRollout(codexHome, first.success ? first.data.summary.sessionId : undefined);
          const parsed = parseCodexRun(cli.stdout, rollout, secrets);
          return parsed.success ? parsed.data : null;
        },
        disposition: codexAttemptDisposition,
      },
      planned.data.prompt,
    );
  }
}

/**
 * The Gemini generator over `agy` (module header). NOT YET THROUGH S4: the live wiring refuses it without a passing
 * committed S4 result (`checkS4Result`); the recorded dry run drives it with a scripted runner.
 */
export class GeminiStepAgent implements StepAgent {
  readonly adapterId = AGY_GEN_CLI_ADAPTER_ID;
  readonly modelId: string;
  private probedVersion: string | null = null;

  constructor(
    private readonly config: AgyGenCliConfig,
    private readonly deps: StepAgentDeps,
  ) {
    this.modelId = config.modelId;
  }

  /** The pre-run probe (no model call): each arm's home passes the structural check, and `agy --version` equals the pin. */
  async probe(arms: readonly AgyGenArm[] = ['none', 'daedalus-mcp']): Promise<DomainResult<{ readonly cliVersion: string }>> {
    for (const arm of arms) {
      const home = checkAgyGenHome(this.config.homes[arm], arm, null, this.config.allowCommand);
      if (home.problems.length > 0) {
        return DomainResult.fail([{ code: 'GEN_AGY_HOME_FORBIDDEN', message: `the ${arm} generator home fails ${String(home.problems.length)} check(s)`, context: { problems: [...home.problems] } }]);
      }
    }
    const env = buildAgyGenChildEnv(this.deps.parentEnv ?? process.env, this.config.homes.none);
    const r = await this.deps.runner.run(this.config.binary, ['--version'], { env, timeoutMs: VERSION_TIMEOUT_MS, stdin: '' });
    if (!r.success || r.data.exitCode !== 0 || r.data.timedOut) {
      return DomainResult.fail([{ code: 'LOOP_CLI_UNAVAILABLE', message: 'the agy CLI is not available at the gemini binary path' }]);
    }
    const version = parseAgyVersion(r.data.stdout);
    if (version !== this.config.cliVersion) {
      return DomainResult.fail([
        { code: 'LOOP_CLI_VERSION_MISMATCH', message: `agy --version reports ${version ?? 'no version'}, the plan pins ${this.config.cliVersion}`, context: { found: version, pinned: this.config.cliVersion } },
      ]);
    }
    this.probedVersion = version;
    return DomainResult.ok({ cliVersion: version });
  }

  /** The argv, the stdin prompt and the arm home of one turn (no process is spawned). */
  plan(input: Pick<TurnInput, 'prompt' | 'arm'>): { readonly args: readonly string[]; readonly prompt: string; readonly arm: AgyGenArm; readonly home: string } {
    const arm = agyGenArmOf(input.arm);
    return { args: buildAgyGenArgs(this.config), prompt: armPrompt(input.prompt, generatorArmFor(input.arm)), arm, home: this.config.homes[arm] };
  }

  async runTurn(input: TurnInput): Promise<DomainResult<TurnResult>> {
    const planned = this.plan(input);
    writeHarnessTsconfig(this.config.harnessRoot, input.runId, input.cwd);
    const ambient = checkAncestors(input.cwd);
    if (!ambient.success) return DomainResult.fail(ambient.errors);
    const files = writeAgyTurnFiles(planned.home, {
      arm: planned.arm,
      runId: input.runId,
      harnessRoot: this.config.harnessRoot,
      cwd: input.cwd,
      allowCommand: this.config.allowCommand,
      ...(input.callLogPath !== undefined ? { callLogPath: input.callLogPath } : {}),
      ...(this.deps.daedalus !== undefined ? { daedalus: this.deps.daedalus } : {}),
    });
    if (!files.success) return DomainResult.fail(files.errors);
    const secrets = this.deps.knownSecrets ?? [];
    const env = buildAgyGenChildEnv(this.deps.parentEnv ?? process.env, planned.home);
    const stopCtx = { arm: planned.arm, allowCommand: this.config.allowCommand, typecheckCommand: typecheckCommand(this.config.harnessRoot, input.runId) };
    // Design R3: the version pin is checked before every turn (agy self-updates), not only at probe time.
    const pin = await this.checkVersionPin(env);
    if (!pin.success) return DomainResult.fail(pin.errors);
    // Design §3.5 (stop row): every attempt's process result is kept, so a forbidden step completed in an attempt that
    // was then retried (print timeout with no files, usage-limit pause and resume) still stops the grid.
    const seen: ProcessResult[] = [];
    let listingSha256 = '';
    const driven = await driveTurn(
      input,
      this.config,
      this.deps,
      {
        command: this.config.binary,
        args: planned.args,
        stdin: planned.prompt,
        env,
        before: () => {
          const home = checkAgyGenHome(planned.home, planned.arm, files.data.allow, this.config.allowCommand);
          listingSha256 = home.listingSha256;
          return home.problems.length === 0
            ? DomainResult.ok(undefined)
            : DomainResult.fail([{ code: 'GEN_AGY_HOME_FORBIDDEN', message: `the ${planned.arm} generator home fails ${String(home.problems.length)} check(s)`, context: { problems: [...home.problems] } }]);
        },
        parse: (cli) => {
          seen.push(cli);
          const p = parseAgyGenRun(cli.stdout, secrets);
          return p.success ? p.data : null;
        },
        disposition: agyGenAttemptDisposition,
        status: agyGenTurnStatus,
        envRecord: () => ({ schema: 'loop-agy-env/v1', envNames: Object.keys(env).sort(), cliVersion: this.probedVersion, homeListingSha256: listingSha256 }),
      },
      planned.prompt,
    );
    if (!driven.success) return driven;
    for (const cli of seen) {
      const stop = agyGenStop(cli, stopCtx, secrets);
      if (stop !== null) return DomainResult.fail([stop]);
    }
    return driven;
  }

  /** `agy --version` in the turn's environment equals the pin (`LOOP_CLI_VERSION_MISMATCH`); no model call. */
  private async checkVersionPin(env: Readonly<Record<string, string>>): Promise<DomainResult<void>> {
    const r = await this.deps.runner.run(this.config.binary, ['--version'], { env, timeoutMs: VERSION_TIMEOUT_MS, stdin: '' });
    if (!r.success || r.data.exitCode !== 0 || r.data.timedOut) {
      return DomainResult.fail([{ code: 'LOOP_CLI_UNAVAILABLE', message: 'the agy CLI is not available at the gemini binary path' }]);
    }
    const version = parseAgyVersion(r.data.stdout);
    if (version !== this.config.cliVersion) {
      return DomainResult.fail([
        { code: 'LOOP_CLI_VERSION_MISMATCH', message: `agy --version reports ${version ?? 'no version'} before the turn, the plan pins ${this.config.cliVersion}`, context: { found: version, pinned: this.config.cliVersion } },
      ]);
    }
    this.probedVersion = version;
    return DomainResult.ok(undefined);
  }
}
