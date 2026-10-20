/**
 * U5 Part B: `GeminiStepAgent` with a scripted `ProcessRunner` (no agy process, no model call). Per arm: the turn
 * statuses (the exit-0 print timeout gives `timeout` through the `status` hook), argv redaction (prompt on stdin), the
 * MCP config per turn, the usage-limit pause and resume through `runWithRetries`, the model mismatch, the auth and
 * tool-escape stops, the probe, and the recorded dry run (no absolute path, no env value in its summary).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { AGY_GEN_MCP_CONFIG_REL, buildAgyGenArgs, createAgyGenCliConfig, installBaselineAgyHooks } from '../../../../scripts/lib/generators/agy-gen-cli.js';
import type { AgyGenCliConfig } from '../../../../scripts/lib/generators/agy-gen-cli.js';
import { typecheckCommand } from '../../../../scripts/lib/generators/argv.js';
import { createGeneratorCliConfig } from '../../../../scripts/lib/generators/config.js';
import { GeminiStepAgent } from '../../../../scripts/lib/loop/agents.js';
import type { TurnInput } from '../../../../scripts/lib/loop/types.js';
import { runGeminiAdapterDryRun } from '../../../../scripts/v1.3/lib/gemini-adapter-dry-run.js';
import { FakeGeneratorRunner } from '../generators/fake-generator-runner.js';

const REPO = process.cwd();
const FIX = path.join(REPO, 'tests/fixtures/agy-gen-cli');
const MODEL = 'dry-run-gemini-model';
const PROMPT = 'Step 2 of the demo todo list.';
const DAEDALUS = { nodeBinary: '/usr/bin/node', serverEntry: '/opt/daedalus/dist/mcp-server/main.js', specPath: '/opt/daedalus/specs/clean-arch.yaml' };

let tmp: string;
let H: string;
let binary: string;
let homes: { none: string; 'daedalus-mcp': string };
let config: AgyGenCliConfig;

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u5-gemini-')));
  H = path.join(tmp, 'h');
  binary = path.join(tmp, 'bin', 'agy');
  homes = { none: path.join(tmp, 'homes', 'none'), 'daedalus-mcp': path.join(tmp, 'homes', 'mcp') };
  for (const d of [H, ...Object.values(homes)]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  for (const d of Object.values(homes)) fs.chmodSync(d, 0o700);
  if (!installBaselineAgyHooks(homes, REPO, true).success) throw new Error('hooks');
  const base = createGeneratorCliConfig({ binary, modelId: MODEL, outputRoot: path.join(tmp, 'out'), harnessRoot: H }, REPO);
  if (!base.success) throw new Error('base');
  const c = createAgyGenCliConfig({ base: base.data, homes, cliVersion: '0.0.0' }, REPO);
  if (!c.success) throw new Error('config');
  config = c.data;
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function runIdOf(arm: string): string {
  return `agy-cli/${MODEL}/todo-list/${arm}/run-0`;
}

function input(arm: 'none' | 'daedalus-mcp' | 'gate', over: Partial<TurnInput> = {}): TurnInput & { archived: number[]; restored: number } {
  const runId = runIdOf(arm);
  const cwd = path.join(tmp, 'out', 'runs', ...runId.split('/'), 'work');
  fs.mkdirSync(cwd, { recursive: true });
  const t: TurnInput & { archived: number[]; restored: number } = {
    archived: [],
    restored: 0,
    runId,
    turnId: 'step-02',
    taskId: 'todo-list',
    kind: 'step',
    stepIndex: 1,
    arm,
    cwd,
    prompt: PROMPT,
    recordDir: path.join(tmp, 'out', 'records', arm),
    changedFiles: () => 1,
    restore: () => {
      t.restored++;
      return DomainResult.ok(undefined);
    },
    archive: (i) => {
      t.archived.push(i);
      return DomainResult.ok(`interruptions/${runId}/step-02/${String(i)}`);
    },
    ...over,
  };
  return t;
}

function stream(name: string, arm: string): string {
  return fs.readFileSync(path.join(FIX, name), 'utf8').replace(/<TYPECHECK>/g, typecheckCommand(H, runIdOf(arm))).replace(/<CWD>/g, path.join(tmp, 'out', 'runs', ...runIdOf(arm).split('/'), 'work'));
}

/** Answers `agy --version` (checked before every turn, design R3) without consuming a script or a cliCalls entry. */
class VersionedRunner extends FakeGeneratorRunner {
  version = '0.0.0';
  versionCalls = 0;
  override run(command: string, args: readonly string[], options: Parameters<FakeGeneratorRunner['run']>[2]): ReturnType<FakeGeneratorRunner['run']> {
    if (command === binary && args[0] === '--version') {
      this.versionCalls++;
      return Promise.resolve(DomainResult.ok({ exitCode: 0, stdout: `agy ${this.version}\n`, stderr: '', timedOut: false, durationMs: 1 }));
    }
    return super.run(command, args, options);
  }
}

const agent = (runner: FakeGeneratorRunner, extra: Partial<ConstructorParameters<typeof GeminiStepAgent>[1]> = {}): GeminiStepAgent =>
  new GeminiStepAgent(config, { runner, daedalus: DAEDALUS, sleep: () => Promise.resolve(), parentEnv: { PATH: '/bin', HOME: '/real', GEMINI_API_KEY: 'k' }, ...extra });

describe('GeminiStepAgent: one turn per arm', () => {
  it.each(['none', 'daedalus-mcp', 'gate'] as const)('%s: completed, prompt on stdin, the argv recorded, the arm home as HOME', async (arm: 'none' | 'daedalus-mcp' | 'gate') => {
    const runner = new VersionedRunner(binary, [{ stdout: stream(arm === 'daedalus-mcp' ? 'stream-gen-mcp-completed.ndjson' : 'stream-gen-completed.ndjson', arm) }]);
    const t = input(arm);
    const r = await agent(runner).runTurn(t);
    if (!r.success) throw new Error(r.errors.map((e) => `${e.code} ${e.message}`).join(','));
    expect(r.data.status).toBe('completed');
    expect([...r.data.argv]).toEqual([...buildAgyGenArgs(config)]);
    const call = runner.cliCalls[0];
    expect(call?.options.stdin).toContain(PROMPT);
    expect(call?.args).not.toContain(PROMPT);
    expect(call?.options.env.HOME).toBe(arm === 'daedalus-mcp' ? homes['daedalus-mcp'] : homes.none);
    expect(call?.options.env.GEMINI_API_KEY).toBeUndefined();
    expect(r.data.usage).toMatchObject({ costUsd: null, inputTokens: 5200, outputTokens: 1200, cacheReadTokens: 8000 });
    const envRec = JSON.parse(fs.readFileSync(path.join(t.recordDir, 'env-step-02.json'), 'utf8')) as { envNames: string[]; homeListingSha256: string };
    expect(envRec.envNames).toEqual(['AGY_CLI_DISABLE_AUTO_UPDATE', 'HOME', 'LANG', 'PATH']);
    expect(envRec.homeListingSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('daedalus-mcp: the MCP config is written per turn with --project <cwd> and --call-log', async () => {
    const runner = new VersionedRunner(binary, [{ stdout: stream('stream-gen-mcp-completed.ndjson', 'daedalus-mcp') }]);
    const t = input('daedalus-mcp', { callLogPath: path.join(tmp, 'out', 'calls', 'step-02.jsonl') });
    const r = await agent(runner).runTurn(t);
    expect(r.success).toBe(true);
    const cfg = JSON.parse(fs.readFileSync(path.join(homes['daedalus-mcp'], AGY_GEN_MCP_CONFIG_REL), 'utf8')) as { mcpServers: Record<string, { args: string[] }> };
    const args = cfg.mcpServers['daedalus-arch']?.args ?? [];
    expect(args[args.indexOf('--project') + 1]).toBe(t.cwd);
    expect(args[args.indexOf('--call-log') + 1]).toBe(t.callLogPath);
  });

  it('the exit-0 print timeout gives timeout through the status hook; without files it is retried as infrastructure', async () => {
    const stderr = fs.readFileSync(path.join(FIX, 'stream-gen-print-timeout.stderr.txt'), 'utf8');
    const s = { stdout: stream('stream-gen-print-timeout.ndjson', 'none'), stderr };
    const r = await agent(new VersionedRunner(binary, [s])).runTurn(input('none'));
    if (!r.success) throw new Error('turn');
    expect(r.data.status).toBe('timeout');
    const t = input('none', { changedFiles: () => 0 });
    const r2 = await agent(new VersionedRunner(binary, [s, s, s])).runTurn(t);
    if (!r2.success) throw new Error('turn');
    expect(r2.data.status).toBe('infrastructure');
    expect(r2.data.attempts.map((a) => a.outcome)).toEqual(['timeout-no-files', 'timeout-no-files', 'timeout-no-files']);
    expect(t.restored).toBe(2);
  });

  it('a usage limit pauses, archives and restores, then resumes the same turn', async () => {
    const runner = new VersionedRunner(binary, [{ stdout: stream('stream-gen-usage-limit.ndjson', 'none'), exitCode: 1 }, { stdout: stream('stream-gen-completed.ndjson', 'none') }]);
    const sleeps: number[] = [];
    let now = 1_767_220_000_000;
    const t = input('none');
    const r = await agent(runner, { clock: { now: () => (now += 1000) }, sleep: (ms) => { sleeps.push(ms); return Promise.resolve(); } }).runTurn(t);
    if (!r.success) throw new Error('turn');
    expect(runner.cliCalls).toHaveLength(2);
    expect(r.data.status).toBe('completed');
    expect(r.data.interruptions).toHaveLength(1);
    expect(t.archived).toEqual([0]);
    expect(t.restored).toBe(1);
    expect(sleeps).toHaveLength(1);
  });

  it('a model mismatch is recorded as model-mismatch', async () => {
    const r = await agent(new VersionedRunner(binary, [{ stdout: stream('stream-gen-model-mismatch.ndjson', 'none') }])).runTurn(input('none'));
    expect(r.success ? r.data.status : null).toBe('model-mismatch');
  });

  it('the auth and tool-escape stops fail the turn (no retry); the envelope is kept', async () => {
    const authRunner = new VersionedRunner(binary, [{ stderr: 'Error: authentication required', exitCode: 1 }]);
    const a = await agent(authRunner).runTurn(input('none'));
    expect(a.success ? null : a.errors[0]?.code).toBe('LOOP_GEMINI_AUTH');
    expect(authRunner.cliCalls).toHaveLength(1);
    const t = input('none');
    const e = await agent(new VersionedRunner(binary, [{ stdout: stream('stream-gen-tool-escape.ndjson', 'none') }])).runTurn(t);
    expect(e.success ? null : e.errors[0]?.code).toBe('LOOP_GEMINI_TOOL_ESCAPE');
    expect(fs.existsSync(path.join(t.recordDir, 'envelope-step-02.json'))).toBe(true);
  });

  it('§3.5: a forbidden step in an attempt that is then retried still stops the turn (every attempt is checked)', async () => {
    const stderr = fs.readFileSync(path.join(FIX, 'stream-gen-print-timeout.stderr.txt'), 'utf8');
    const runner = new VersionedRunner(binary, [{ stdout: stream('stream-gen-tool-escape.ndjson', 'none'), stderr }, { stdout: stream('stream-gen-completed.ndjson', 'none') }]);
    const t = input('none', { changedFiles: () => 0 });
    const r = await agent(runner).runTurn(t);
    expect(runner.cliCalls).toHaveLength(2);
    expect(r.success ? null : r.errors[0]?.code).toBe('LOOP_GEMINI_TOOL_ESCAPE');
  });

  it('a forbidden step before a usage-limit pause still stops the resumed turn', async () => {
    const limited = stream('stream-gen-tool-escape.ndjson', 'none') + stream('stream-gen-usage-limit.ndjson', 'none');
    const runner = new VersionedRunner(binary, [{ stdout: limited, exitCode: 1 }, { stdout: stream('stream-gen-completed.ndjson', 'none') }]);
    const r = await agent(runner).runTurn(input('none'));
    expect(runner.cliCalls).toHaveLength(2);
    expect(r.success ? null : r.errors[0]?.code).toBe('LOOP_GEMINI_TOOL_ESCAPE');
  });

  it('R3: the version pin is checked before every turn; a drifted agy fails the turn before any spawn', async () => {
    const runner = new VersionedRunner(binary, [{ stdout: stream('stream-gen-completed.ndjson', 'none') }, { stdout: stream('stream-gen-completed.ndjson', 'none') }]);
    const a = agent(runner);
    expect((await a.runTurn(input('none'))).success).toBe(true);
    expect(runner.versionCalls).toBe(1);
    runner.version = '1.3.2';
    const r = await a.runTurn(input('none', { turnId: 'step-03' }));
    expect(r.success ? null : r.errors[0]?.code).toBe('LOOP_CLI_VERSION_MISMATCH');
    expect(runner.versionCalls).toBe(2);
    expect(runner.cliCalls).toHaveLength(1);
  });

  it('an ambient rule file above the cwd fails closed before any spawn', async () => {
    const runner = new VersionedRunner(binary, [{ stdout: stream('stream-gen-completed.ndjson', 'none') }]);
    const t = input('none');
    fs.writeFileSync(path.join(tmp, 'out', 'AGENTS.md'), 'canary');
    const r = await agent(runner).runTurn(t);
    expect(r.success ? null : r.errors[0]?.code).toBe('LOOP_GEMINI_AMBIENT');
    expect(runner.cliCalls).toHaveLength(0);
  });

  it('the probe checks the version pin and the homes (no model call)', async () => {
    const ok = await agent(new FakeGeneratorRunner(binary, [{ stdout: 'agy 0.0.0\n' }])).probe();
    expect(ok.success).toBe(true);
    const bad = await agent(new FakeGeneratorRunner(binary, [{ stdout: 'agy 1.3.2\n' }])).probe();
    expect(bad.success ? null : bad.errors[0]?.code).toBe('LOOP_CLI_VERSION_MISMATCH');
    fs.mkdirSync(path.join(homes.none, 'skills'));
    const home = await agent(new FakeGeneratorRunner(binary, [{ stdout: 'agy 0.0.0\n' }])).probe();
    expect(home.success ? null : home.errors[0]?.code).toBe('GEN_AGY_HOME_FORBIDDEN');
  });
});

describe('the recorded adapter dry run', () => {
  it('runs the real grid through GeminiStepAgent; the summary holds no absolute path and no env value', async () => {
    const r = await runGeminiAdapterDryRun(REPO, tmp);
    if (!r.success) throw new Error(r.errors.map((e) => `${e.code} ${e.message}`).join(','));
    const text = JSON.stringify(r.data);
    expect(text).not.toMatch(/(^|[^<])\/(Users|Volumes|private|tmp|var|home)\//);
    expect(text).not.toContain('dry-run-not-a-key');
    expect(text).not.toContain('dry-run-not-a-token');
    expect(text).not.toContain(tmp);
    const runs = r.data.runs as { steps: { turns: { status: string; modelCheck: boolean }[] }[] }[];
    expect(runs).toHaveLength(4);
    expect(runs.flatMap((x) => x.steps.flatMap((s) => s.turns.map((t) => t.status)))).toEqual(Array.from({ length: 12 }, () => 'completed'));
    expect(runs.every((x) => x.steps.every((s) => s.turns.every((t) => t.modelCheck)))).toBe(true);
    expect((r.data.s4 as { withoutAllowSynthetic: string }).withoutAllowSynthetic).toBe('LOOP_GEMINI_S4_SYNTHETIC');
  });
});
