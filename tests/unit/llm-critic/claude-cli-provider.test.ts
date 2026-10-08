// BR-U4-ISO-02..07, ISO-09, VRD-07, OPS-02, 03, 05, 06; D-U0-7; DE §5.1-5.4; ADR-018;
// T2, T14, T16, T24 (U4 plan Step 19). Runner stub and committed probe fixtures only; no
// process is spawned and no live call is made.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import type { LLMOptions } from '../../../src/shared/interfaces/llm-provider.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import {
  ClaudeCliProvider, buildClaudeCliArgs, buildJudgeChildEnv, checkConfigListing, checkJudgeIsolation, checkSettingsJson,
  classifyProcessResult, classifyStop, configDirPlacementProblem, createNeutralCwd, evaluateInitEvent,
  interpretClaudeEnvelope, isolationProbeSha256Of, modelMatches, parseCliVersion, readStreamEvents, reduceEnvelope,
  resolveActualModel,
} from '../../../src/llm-critic/claude-cli-provider.js';
import type { ClaudeCliEnvelope, InitEvent } from '../../../src/llm-critic/claude-cli-provider.js';
import { CassetteLLMProvider, buildJudgeRequest } from '../../../src/llm-critic/cassette-provider.js';
import { listCassetteKeys, readCassetteEntry } from '../../../src/llm-critic/cassette-manager.js';
import * as F from '../../../src/llm-critic/frozen.js';
import { VERDICT_SCHEMA_TEXT } from '../../../src/llm-critic/verdict-schema.js';

const FIX = path.resolve(__dirname, '../../fixtures/claude-cli');
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed fixture reader
function fixture<T = Record<string, unknown>>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8')) as T;
}

const roots: string[] = [];
function tmpDir(prefix = 'u4-cli-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(dir);
  return dir;
}
afterAll(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

function touch(root: string, rel: string, content = ''): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

/** A judge config dir with the names the probe observed (ADR-018). */
function cleanConfigDir(): string {
  const dir = tmpDir('u4-judge-cfg-');
  touch(dir, '.claude.json', '{}');
  touch(dir, '.last-cleanup');
  touch(dir, '.last-update-result.json', '{}');
  touch(dir, 'backups/.claude.json.backup.1791463800', '{}');
  touch(dir, 'cache/changelog.md');
  touch(dir, 'cache/model-catalog/opus.json', '{}');
  touch(dir, 'sessions/41234.json', '{}');
  touch(dir, 'sessions/41234.ab12cd.key');
  touch(dir, 'settings.json', JSON.stringify({ theme: 'dark', env: { DISABLE_AUTOUPDATER: '1' } }));
  fs.mkdirSync(path.join(dir, 'projects/-tmp-daedalus-judge-x/memory'), { recursive: true });
  return dir;
}

const OPTIONS: LLMOptions = { model: 'claude-opus-5-5', effort: 'high', maxTokens: 8192 };
const ENVELOPE = fixture<ClaudeCliEnvelope & Record<string, unknown>>('envelope-schema-tools-off.json');
const INIT_CLEAN = fixture<InitEvent & Record<string, unknown>>('init-clean.json');

interface Call { readonly command: string; readonly args: readonly string[]; readonly options: ProcessRunOptions }

function proc(stdout: string, extra: Partial<ProcessResult> = {}): ProcessResult {
  return { exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 5, ...extra };
}

/** Runner stub: `--version`, the stream-json init probe and judge calls each get their own answer. */
class StubRunner implements ProcessRunner {
  readonly calls: Call[] = [];
  constructor(
    private readonly answers: {
      version?: DomainResult<ProcessResult>;
      init?: DomainResult<ProcessResult>;
      judge?: readonly DomainResult<ProcessResult>[];
    } = {},
  ) {}
  private judgeCalls = 0;
  run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    this.calls.push({ command, args, options });
    if (args[0] === '--version') return Promise.resolve(this.answers.version ?? DomainResult.ok(proc('2.1.294 (Claude Code)\n')));
    if (args.includes('stream-json')) {
      return Promise.resolve(this.answers.init ?? DomainResult.ok(proc(streamJson(INIT_CLEAN))));
    }
    const script = this.answers.judge ?? [DomainResult.ok(proc(JSON.stringify(ENVELOPE)))];
    const answer = script[Math.min(this.judgeCalls, script.length - 1)];
    this.judgeCalls++;
    return Promise.resolve(answer ?? DomainResult.ok(proc(JSON.stringify(ENVELOPE))));
  }
  judgeCallCount(): number {
    return this.calls.filter((c) => c.args[0] === '-p' && !c.args.includes('stream-json')).length;
  }
}

function streamJson(init: unknown, result: unknown = { type: 'result', is_error: false, result: '{}' }): string {
  return `${JSON.stringify(init)}\n${JSON.stringify({ type: 'assistant' })}\n${JSON.stringify(result)}\n`;
}

function spawnFailed(): DomainResult<ProcessResult> {
  return DomainResult.fail([{ code: 'PROCESS_SPAWN_FAILED', message: "Failed to start process 'claude' (ENOENT)", context: { command: 'claude', errno: 'ENOENT' } }]);
}

function provider(runner: ProcessRunner, extra: { configDir?: string; parentEnv?: NodeJS.ProcessEnv; mode?: 'record' | 'replay'; projectRoot?: string } = {}): ClaudeCliProvider {
  return new ClaudeCliProvider(
    { judgeConfigDir: extra.configDir ?? cleanConfigDir(), ...(extra.mode !== undefined ? { mode: extra.mode } : {}), ...(extra.projectRoot !== undefined ? { projectRoot: extra.projectRoot } : {}) },
    { runner, parentEnv: extra.parentEnv ?? { PATH: '/usr/bin:/bin', HOME: '/home/judge' }, tmpRoot: tmpDir('u4-cwd-root-') },
  );
}

// ── ISO-02 argv ──────────────────────────────────────────────────────────────────────────

describe('ISO-02 argv (T2)', () => {
  const input = { model: 'claude-opus-5-5', effort: 'high' as const, schema: VERDICT_SCHEMA_TEXT, persona: F.JUDGE_PERSONA };

  it('is exactly the frozen list, in order, with the prompt absent', () => {
    const argv = buildClaudeCliArgs(input);
    expect(argv.binary).toBe('claude');
    expect(argv.args).toEqual([
      '-p', '--model', 'claude-opus-5-5', '--effort', 'high', '--output-format', 'json',
      '--json-schema', VERDICT_SCHEMA_TEXT, '--system-prompt', F.JUDGE_PERSONA,
      '--setting-sources', 'project', '--strict-mcp-config', '--disable-slash-commands',
      '--no-session-persistence', '--tools', '',
    ]);
    expect(argv.args.filter((a) => a.startsWith('-'))).toEqual([...F.CLAUDE_CLI_FLAGS]);
  });

  it('contains none of the excluded flags and no flag for an ignored option', () => {
    const argv = buildClaudeCliArgs(input);
    for (const flag of F.CLAUDE_CLI_EXCLUDED_FLAGS) expect(argv.args).not.toContain(flag);
    expect(argv.args.join(' ')).not.toMatch(/temperature|seed|max-tokens/);
  });

  it('argvFlags carry the non-content argv only', () => {
    expect(buildClaudeCliArgs(input).argvFlags).toEqual([
      '-p', '--model', '--effort', '--output-format=json', '--json-schema', '--system-prompt',
      '--setting-sources=project', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', '--tools=',
    ]);
  });

  it('the init probe uses stream-json with --verbose; toolsFlag false drops --tools', () => {
    const probe = buildClaudeCliArgs({ ...input, outputFormat: 'stream-json' });
    expect(probe.args.slice(5, 8)).toEqual(['--output-format', 'stream-json', '--verbose']);
    expect(buildClaudeCliArgs({ ...input, toolsFlag: false }).args).not.toContain('--tools');
  });

  it('the provider puts the prompt on stdin, never in argv, and the persona after --system-prompt', async () => {
    const runner = new StubRunner();
    const p = provider(runner);
    const result = await p.evaluate('JUDGE THIS UNIT', OPTIONS, { runIndex: 0, repetition: 0, functionId: 'FF-N02' });
    expect(result.success).toBe(true);
    const judge = runner.calls.filter((c) => c.args[0] === '-p' && !c.args.includes('stream-json'));
    expect(judge).toHaveLength(1);
    expect(judge[0]?.options.stdin).toBe('JUDGE THIS UNIT');
    expect(judge[0]?.args).not.toContain('JUDGE THIS UNIT');
    const args = judge[0]?.args ?? [];
    expect(args[args.indexOf('--system-prompt') + 1]).toBe(F.JUDGE_PERSONA);
    p.dispose();
  });
});

// ── ISO-03 child env ─────────────────────────────────────────────────────────────────────

describe('ISO-03 child environment', () => {
  const parent: NodeJS.ProcessEnv = {
    PATH: '/usr/bin', HOME: '/home/u', USER: 'u', LANG: 'en_US.UTF-8', TMPDIR: '/tmp',
    ANTHROPIC_API_KEY: 'parent-anthropic-value', CLAUDECODE: '1', CLAUDE_CODE_FOO: 'x',
    GEMINI_API_KEY: 'AIzaParentSecretValue0123456789abcdef', CLAUDE_CONFIG_DIR: '/home/u/.claude', OTHER: 'y',
  };

  it('holds exactly the allow-listed names present in the parent, the judge dir and DISABLE_AUTOUPDATER=1', () => {
    const env = buildJudgeChildEnv(parent, '/judge/dir');
    expect(Object.keys(env).sort()).toEqual(['CLAUDE_CONFIG_DIR', 'DISABLE_AUTOUPDATER', 'HOME', 'LANG', 'PATH', 'TMPDIR', 'USER']);
    expect(env.CLAUDE_CONFIG_DIR).toBe('/judge/dir');
    expect(env.DISABLE_AUTOUPDATER).toBe('1');
    for (const key of Object.keys(env)) expect(F.JUDGE_ENV_ALLOW).toContain(key);
  });

  it('every spawned process (version, init probe, judge) receives that env', async () => {
    const runner = new StubRunner();
    const dir = cleanConfigDir();
    const p = provider(runner, { configDir: dir, parentEnv: parent });
    await p.evaluate('x', OPTIONS);
    expect(runner.calls.length).toBe(3);
    for (const call of runner.calls) {
      expect(call.options.env).toEqual(buildJudgeChildEnv(parent, dir));
      expect(Object.keys(call.options.env).some((k) => k.startsWith('ANTHROPIC') || k.startsWith('CLAUDE_CODE') || k === 'CLAUDECODE' || k === 'GEMINI_API_KEY')).toBe(false);
    }
    p.dispose();
  });
});

// ── ISO-04 config-dir listing ────────────────────────────────────────────────────────────

describe('ISO-04 judge config-dir listing (ADR-018)', () => {
  it('the allow-listed names pass', () => {
    const result = checkConfigListing(cleanConfigDir());
    expect(result.failures).toEqual([]);
    expect(result.pass).toBe(true);
    expect(result.matchedItems).toContain('settings.json');
    expect(result.configListingSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a new file under a state pattern passes with an unchanged configListingSha256', () => {
    const dir = cleanConfigDir();
    const before = checkConfigListing(dir);
    touch(dir, 'sessions/99887.json', '{}');
    touch(dir, 'sessions/99887.ff00.key');
    touch(dir, 'backups/.claude.json.backup.1791999999', '{}');
    touch(dir, 'cache/model-catalog/sonnet.json', '{}');
    fs.mkdirSync(path.join(dir, 'projects/-tmp-daedalus-judge-y/memory'), { recursive: true });
    const after = checkConfigListing(dir);
    expect(after.pass).toBe(true);
    expect(after.configListingSha256).toBe(before.configListingSha256);
  });

  it.each([
    ['CLAUDE.md', 'CLAUDE.md'],
    ['plugins/', 'plugins/known_marketplaces.json'],
    ['agents/', 'agents/a.md'],
    ['commands/', 'commands/c.md'],
    ['skills/', 'skills/s/SKILL.md'],
    ['hooks', 'hooks/h.sh'],
    ['.mcp.json', '.mcp.json'],
    ['settings.local.json', 'settings.local.json'],
    ['nested CLAUDE.md under an allowed dir', 'cache/CLAUDE.md'],
    ['sessions/settings.json', 'sessions/settings.json'],
    ['a file under projects/*/memory', 'projects/-tmp-x/memory/MEMORY.md'],
    ['a file directly under projects/*', 'projects/-tmp-x/notes.jsonl'],
    ['an unknown root file', 'history.jsonl'],
  ])('%s fails closed', (_label, rel) => {
    const dir = cleanConfigDir();
    touch(dir, rel, 'x');
    const result = checkConfigListing(dir);
    expect(result.pass).toBe(false);
    expect(result.failures.map((f) => f.entry)).toContain(rel);
  });

  it('static: every forbidden name, at the root and nested, fails the listing check', () => {
    for (const name of F.CONFIG_DIR_FORBIDDEN_NAMES) {
      for (const rel of [name, `cache/${name}`, `sessions/${name}`]) {
        const dir = cleanConfigDir();
        touch(dir, rel, 'x');
        expect({ rel, pass: checkConfigListing(dir).pass }).toEqual({ rel, pass: false });
      }
    }
  });

  it('settings.json content rule: key names only, theme/env and env.DISABLE_AUTOUPDATER', () => {
    expect(checkSettingsJson('{"theme":"dark"}')).toBeNull();
    expect(checkSettingsJson('{"env":{"DISABLE_AUTOUPDATER":"1"}}')).toBeNull();
    expect(checkSettingsJson('{"hooks":{"UserPromptSubmit":[{"command":"secret-cmd"}]}}')).toBe('settings.json has disallowed keys: hooks');
    expect(checkSettingsJson('{"env":{"ANTHROPIC_API_KEY":"x"}}')).toBe('settings.json env has disallowed keys: ANTHROPIC_API_KEY');
    expect(checkSettingsJson('not json')).toBe('settings.json is not valid JSON');
    const dir = cleanConfigDir();
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ theme: 'dark', hooks: { UserPromptSubmit: [] } }));
    const result = checkConfigListing(dir);
    expect(result.pass).toBe(false);
    expect(JSON.stringify(result.failures)).not.toContain('UserPromptSubmit');
  });

  it('a symlink fails closed', () => {
    const dir = cleanConfigDir();
    const target = tmpDir('u4-link-target-');
    fs.symlinkSync(target, path.join(dir, 'cache', 'linked'));
    expect(checkConfigListing(dir).pass).toBe(false);
  });

  it('a config dir inside the evaluated project or a git repository is refused', () => {
    const project = tmpDir('u4-project-');
    const inside = path.join(project, 'judge');
    fs.mkdirSync(inside);
    expect(configDirPlacementProblem(inside, project)).toBe('judge config dir lies inside the evaluated project');
    const repo = tmpDir('u4-repo-');
    fs.mkdirSync(path.join(repo, '.git'));
    fs.mkdirSync(path.join(repo, 'cfg'));
    expect(configDirPlacementProblem(path.join(repo, 'cfg'))).toBe('judge config dir lies inside a git repository');
    expect(configDirPlacementProblem(cleanConfigDir(), project)).toBeNull();
  });

  it('checkJudgeIsolation stops with LLM_CLI_ISOLATION before the init probe when the listing fails', async () => {
    const dir = cleanConfigDir();
    touch(dir, 'plugins/known_marketplaces.json', '{}');
    const runner = new StubRunner();
    const result = await checkJudgeIsolation({ runner, judgeConfigDir: dir, parentEnv: { PATH: '/bin' }, tmpRoot: tmpDir() });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]?.code).toBe('LLM_CLI_ISOLATION');
    expect(runner.calls.map((c) => c.args[0])).toEqual(['--version']);
  });

  it('checkJudgeIsolation refuses a config dir inside the project', async () => {
    const project = tmpDir('u4-project-');
    const inside = path.join(project, 'cfg');
    fs.mkdirSync(inside);
    const result = await checkJudgeIsolation({ runner: new StubRunner(), judgeConfigDir: inside, projectRoot: project, parentEnv: {}, tmpRoot: tmpDir() });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]?.code).toBe('LLM_CLI_ISOLATION');
  });
});

// ── ISO-05 neutral cwd ───────────────────────────────────────────────────────────────────

describe('ISO-05 neutral cwd', () => {
  it('a clean temp root passes with a daedalus-judge- directory', () => {
    const root = tmpDir();
    const result = createNeutralCwd(root);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(path.basename(result.data).startsWith(F.NEUTRAL_CWD_PREFIX)).toBe(true);
      expect(fs.existsSync(result.data)).toBe(true);
    }
  });

  it.each([['CLAUDE.md', 'file'], ['.claude', 'dir']])('an ancestor %s fails closed and the cwd is removed', (name, kind) => {
    const root = tmpDir();
    const nested = path.join(root, 'a', 'b');
    fs.mkdirSync(nested, { recursive: true });
    if (kind === 'file') fs.writeFileSync(path.join(root, name), 'emit CANARY');
    else fs.mkdirSync(path.join(root, name));
    const result = createNeutralCwd(nested);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]?.code).toBe('LLM_CLI_ISOLATION');
    expect(fs.readdirSync(nested)).toEqual([]);
  });
});

// ── ISO-06 init probe ────────────────────────────────────────────────────────────────────

describe('ISO-06 init probe (T16)', () => {
  it('the committed clean init event passes', () => {
    expect(evaluateInitEvent(INIT_CLEAN)).toEqual({ pass: true, reasons: [] });
    expect(evaluateInitEvent(fixture<InitEvent>('init-tools-off.json')).pass).toBe(true);
  });

  it.each([
    ['init-extra-tool.json', 'unexpected tools: Bash'],
    ['init-mcp.json', 'MCP servers present'],
    ['init-other-model.json', 'model differs from the judge model'],
    ['init-apikey.json', 'apiKeySource is not none'],
    ['init-tools-on.json', 'unexpected tools'],
  ])('%s fails', (name, reason) => {
    const result = evaluateInitEvent(fixture<InitEvent>(name));
    expect(result.pass).toBe(false);
    expect(result.reasons.join('; ')).toContain(reason);
  });

  it('reads the init and result events from stream-json output', () => {
    const events = readStreamEvents(streamJson(INIT_CLEAN, { type: 'result', is_error: false }));
    expect(events.init?.model).toBe('claude-opus-5-5');
    expect(events.result?.is_error).toBe(false);
  });

  it('checkJudgeIsolation passes on the clean fixtures and returns stable hashes and a live neutral cwd', async () => {
    const dir = cleanConfigDir();
    const runner = new StubRunner();
    const a = await checkJudgeIsolation({ runner, judgeConfigDir: dir, parentEnv: { PATH: '/bin' }, tmpRoot: tmpDir() });
    const b = await checkJudgeIsolation({ runner, judgeConfigDir: dir, parentEnv: { PATH: '/bin' }, tmpRoot: tmpDir() });
    expect(a.success && b.success).toBe(true);
    if (a.success && b.success) {
      expect(a.data.cliVersion).toBe(F.PINNED_CLI_VERSION);
      expect(a.data.probe.pass).toBe(true);
      expect(a.data.isolationProbeSha256).toBe(b.data.isolationProbeSha256);
      expect(a.data.isolationProbeSha256).toBe(isolationProbeSha256Of(a.data.probe));
      expect(a.data.configListingSha256).toBe(checkConfigListing(dir).configListingSha256);
      expect(fs.existsSync(a.data.neutralCwd)).toBe(true);
    }
    const probe = runner.calls.find((c) => c.args.includes('stream-json'));
    expect(probe?.options.stdin).toBe(F.INIT_PROBE_PROMPT);
    expect(probe?.options.cwd).toMatch(new RegExp(F.NEUTRAL_CWD_PREFIX));
  });

  it('a failing init event stops with LLM_CLI_ISOLATION and removes the neutral cwd', async () => {
    const root = tmpDir();
    const runner = new StubRunner({ init: DomainResult.ok(proc(streamJson(fixture('init-extra-tool.json')))) });
    const result = await checkJudgeIsolation({ runner, judgeConfigDir: cleanConfigDir(), parentEnv: {}, tmpRoot: root });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]?.code).toBe('LLM_CLI_ISOLATION');
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it('no init event → LLM_CLI_ISOLATION; an auth result in the probe → LLM_AUTH', async () => {
    const none = await checkJudgeIsolation({
      runner: new StubRunner({ init: DomainResult.ok(proc('not json\n')) }), judgeConfigDir: cleanConfigDir(), parentEnv: {}, tmpRoot: tmpDir(),
    });
    expect(none.success ? null : none.errors[0]?.code).toBe('LLM_CLI_ISOLATION');
    const auth = fixture('auth-error.json');
    const unauth = await checkJudgeIsolation({
      runner: new StubRunner({ init: DomainResult.ok(proc(streamJson(INIT_CLEAN, auth), { exitCode: 1 })) }),
      judgeConfigDir: cleanConfigDir(), parentEnv: {}, tmpRoot: tmpDir(),
    });
    expect(unauth.success ? null : unauth.errors[0]?.code).toBe('LLM_AUTH');
  });

  it('the canary fixture records no token under the judge argv (ISO-07)', () => {
    const canary = fixture<{ tokensFound: { neutral: unknown[]; ancestor: unknown[] }; cliVersion: string }>('canary-result.json');
    expect(canary.tokensFound.neutral).toEqual([]);
    expect(canary.tokensFound.ancestor).toEqual([]);
  });
});

// ── ISO-09 version pin ───────────────────────────────────────────────────────────────────

describe('ISO-09 CLI version pin (T24)', () => {
  it('parses `claude --version`', () => {
    expect(parseCliVersion('2.1.294 (Claude Code)\n')).toBe('2.1.294');
    expect(parseCliVersion('garbage')).toBeNull();
  });

  it('the pinned version passes', async () => {
    const result = await checkJudgeIsolation({ runner: new StubRunner(), judgeConfigDir: cleanConfigDir(), parentEnv: {}, tmpRoot: tmpDir() });
    expect(result.success).toBe(true);
  });

  it('drift stops record mode before any judge call and no cassette is written', async () => {
    const runner = new StubRunner({ version: DomainResult.ok(proc('2.1.293 (Claude Code)\n')) });
    const inner = provider(runner);
    const dir = tmpDir('u4-cas-');
    const cassette = new CassetteLLMProvider(inner, { mode: 'record', dir, knownSecrets: [], interpret: inner.interpret });
    const result = await cassette.judge('p', OPTIONS, { runIndex: 0, repetition: 0, functionId: 'FF-N02' });
    expect(result.kind).toBe('stop');
    if (result.kind === 'stop') {
      expect(result.stop).toBe('CLI_VERSION');
      expect(result.message).toContain('2.1.293');
    }
    expect(runner.calls.map((c) => c.args[0])).toEqual(['--version']);
    expect(runner.judgeCallCount()).toBe(0);
    expect(listCassetteKeys(dir)).toEqual([]);
  });

  it('replay is unaffected: a recorded entry answers without any process', async () => {
    const dir = tmpDir('u4-cas-');
    const recordRunner = new StubRunner();
    const rec = provider(recordRunner);
    const recorder = new CassetteLLMProvider(rec, { mode: 'record', dir, knownSecrets: [], interpret: rec.interpret });
    const recorded = await recorder.judge('p', OPTIONS, { runIndex: 0, repetition: 0, functionId: 'FF-N02' });
    rec.dispose();
    expect(recorded.kind).toBe('final');

    const replayRunner = new StubRunner({ version: DomainResult.ok(proc('9.9.9\n')) });
    const rep = provider(replayRunner, { mode: 'replay' });
    const replayer = new CassetteLLMProvider(rep, { mode: 'replay', dir, knownSecrets: [], interpret: rep.interpret });
    const replayed = await replayer.judge('p', OPTIONS, { runIndex: 0, repetition: 0, functionId: 'FF-N02' });
    expect(replayed.kind).toBe('final');
    if (replayed.kind === 'final' && recorded.kind === 'final') expect(JSON.stringify(replayed.entry)).toBe(JSON.stringify(recorded.entry));
    expect(await rep.isAvailable()).toBe(true);
    expect(replayRunner.calls).toEqual([]);
  });
});

// ── VRD-07 actual-model rule ─────────────────────────────────────────────────────────────

describe('VRD-07 actual-model rule', () => {
  const request = buildJudgeRequest('claude-cli', 'p', OPTIONS, { runIndex: 0, repetition: 0, functionId: 'FF-N02' });
  const answer = (envelope: unknown): { content: string; model: string; usage: { inputTokens: number; outputTokens: number }; usedOptions: object; ignoredOptions: [] } =>
    ({ content: JSON.stringify(envelope), model: 'claude-opus-5-5', usage: { inputTokens: 1, outputTokens: 1 }, usedOptions: {}, ignoredOptions: [] });
  const usageOf = (envelope: ClaudeCliEnvelope): Record<string, unknown> => envelope.modelUsage as Record<string, unknown>;

  it('single matching model → valid with resolvedModel', () => {
    const result = interpretClaudeEnvelope(answer(ENVELOPE), request);
    expect(result.outcome).toEqual({ kind: 'valid' });
    expect(result.resolvedModel).toBe('claude-opus-5-5');
    expect(result.verdict?.pass).toBe(true);
  });

  it('a second model carrying output tokens → MODEL_MISMATCH', () => {
    const two = { ...ENVELOPE, modelUsage: { ...usageOf(ENVELOPE), 'claude-haiku-4-5': { inputTokens: 10, outputTokens: 40 } } };
    expect(interpretClaudeEnvelope(answer(two), request).outcome).toEqual({ kind: 'invalid', cause: 'MODEL_MISMATCH' });
    const other = { ...ENVELOPE, modelUsage: { 'claude-sonnet-4-5': { inputTokens: 10, outputTokens: 40 } } };
    expect(interpretClaudeEnvelope(answer(other), request).outcome).toEqual({ kind: 'invalid', cause: 'MODEL_MISMATCH' });
  });

  it('an auxiliary model with zero output tokens → valid, recorded as auxiliary', () => {
    const aux = { ...ENVELOPE, modelUsage: { ...usageOf(ENVELOPE), 'claude-haiku-4-5': { inputTokens: 50, outputTokens: 0 } } };
    expect(interpretClaudeEnvelope(answer(aux), request).outcome).toEqual({ kind: 'valid' });
    expect(resolveActualModel(aux, 'claude-opus-5-5')).toEqual({ kind: 'ok', resolvedModel: 'claude-opus-5-5', auxiliaryModels: ['claude-haiku-4-5'] });
  });

  it('alias form: identical id or a dated snapshot; the model field when no map is present', () => {
    expect(modelMatches('claude-opus-5-5', 'claude-opus-5-5')).toBe(true);
    expect(modelMatches('claude-opus-5-5', 'claude-opus-5-5-20260901')).toBe(true);
    expect(modelMatches('claude-opus-5-5', 'claude-opus-5-5-fast')).toBe(false);
    expect(resolveActualModel({ model: 'claude-opus-5-5' }, 'claude-opus-5-5').kind).toBe('ok');
    expect(resolveActualModel({ model: 'other' }, 'claude-opus-5-5').kind).toBe('mismatch');
  });

  it('unparsable content → BAD_ENVELOPE; structured_output first, result text otherwise', () => {
    expect(interpretClaudeEnvelope({ ...answer({}), content: 'not json' }, request).outcome).toEqual({ kind: 'invalid', cause: 'BAD_ENVELOPE' });
    const noSchema = fixture<ClaudeCliEnvelope>('envelope-noschema.json');
    const textOnly = interpretClaudeEnvelope(answer(noSchema), request);
    expect(['valid', 'invalid']).toContain(textOnly.outcome.kind);
    const { structured_output: _s, ...withoutStructured } = ENVELOPE;
    expect(interpretClaudeEnvelope(answer(withoutStructured), request).outcome).toEqual({ kind: 'valid' });
  });

  it('the stored answer is a reduced envelope without session ids or telemetry', () => {
    const reduced = JSON.parse(reduceEnvelope(ENVELOPE)) as Record<string, unknown>;
    expect(Object.keys(reduced).sort()).toEqual(['is_error', 'modelUsage', 'result', 'structured_output']);
    expect(reduceEnvelope(ENVELOPE)).not.toMatch(/session_id|uuid|total_cost_usd/);
    expect(reduced.modelUsage).toEqual({ 'claude-opus-5-5': { inputTokens: 2, outputTokens: 309 } });
  });
});

// ── OPS-02 ignored options; OPS-03/05 error mapping ──────────────────────────────────────

describe('OPS-02 options (T2)', () => {
  it('usedOptions = {model, effort}; temperature, seed and maxTokens are reported ignored', async () => {
    const runner = new StubRunner();
    const p = provider(runner);
    const result = await p.evaluate('x', { ...OPTIONS, temperature: 0, seed: 7 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.usedOptions).toEqual({ model: 'claude-opus-5-5', effort: 'high' });
      expect(result.data.ignoredOptions).toEqual(['temperature', 'seed', 'maxTokens']);
      expect(result.data.model).toBe('claude-opus-5-5');
      expect(result.data.usage).toEqual({ inputTokens: 2 + 1732, outputTokens: 309 });
    }
    const judge = runner.calls.find((c) => c.args[0] === '-p' && !c.args.includes('stream-json'));
    expect(judge?.args.join(' ')).not.toMatch(/temperature|seed|max-tokens|8192/);
    p.dispose();
  });

  it('describe() names the provider, model, effort and, once prepared, the CLI version', async () => {
    const p = provider(new StubRunner());
    expect(p.describe()).toEqual({ provider: 'claude-cli', model: 'claude-opus-5-5', effort: 'high' });
    await p.prepare();
    expect(p.describe()).toEqual({ provider: 'claude-cli', model: 'claude-opus-5-5', effort: 'high', cliVersion: F.PINNED_CLI_VERSION });
    expect(p.requestArgvFlags(OPTIONS, { runIndex: 0, repetition: 0, functionId: 'f' })).toContain('--tools=');
    p.dispose();
  });

  it('prepare() runs once per provider; dispose() removes the neutral cwd', async () => {
    const runner = new StubRunner();
    const p = provider(runner);
    await p.evaluate('a', OPTIONS);
    await p.evaluate('b', OPTIONS);
    expect(runner.calls.filter((c) => c.args[0] === '--version')).toHaveLength(1);
    expect(runner.calls.filter((c) => c.args.includes('stream-json'))).toHaveLength(1);
    const cwd = p.isolationResult()?.neutralCwd ?? '';
    expect(fs.existsSync(cwd)).toBe(true);
    p.dispose();
    expect(fs.existsSync(cwd)).toBe(false);
  });
});

describe('OPS-05 error mapping (T14, D-U0-7)', () => {
  const secrets = ['parent-known-secret-value'];

  it('PROCESS_SPAWN_FAILED → LLM_CLI_NOT_FOUND', async () => {
    const p = provider(new StubRunner({ judge: [spawnFailed()] }));
    const result = await p.evaluate('x', OPTIONS);
    expect(result.success ? null : result.errors[0]?.code).toBe('LLM_CLI_NOT_FOUND');
    p.dispose();
    const missing = await checkJudgeIsolation({ runner: new StubRunner({ version: spawnFailed() }), judgeConfigDir: cleanConfigDir(), parentEnv: {}, tmpRoot: tmpDir() });
    expect(missing.success ? null : missing.errors[0]?.code).toBe('LLM_CLI_NOT_FOUND');
  });

  it('timeout → LLM_CLI_TIMEOUT; non-zero exit → LLM_CLI_EXIT; unparsable output → LLM_CLI_BAD_ENVELOPE', () => {
    expect(classifyProcessResult(proc('', { timedOut: true, exitCode: -1 }), secrets).error?.code).toBe('LLM_CLI_TIMEOUT');
    expect(classifyProcessResult(proc('', { exitCode: 2, stderr: 'boom' }), secrets).error?.code).toBe('LLM_CLI_EXIT');
    expect(classifyProcessResult(proc('not json'), secrets).error?.code).toBe('LLM_CLI_BAD_ENVELOPE');
    expect(classifyProcessResult(proc(JSON.stringify(ENVELOPE)), secrets).error).toBeNull();
  });

  it('a token in stderr and a known parent secret are scrubbed from the message and context', () => {
    const stderr = 'request failed: Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789 and parent-known-secret-value';
    const { error } = classifyProcessResult(proc('', { exitCode: 1, stderr }), secrets);
    const text = JSON.stringify(error);
    expect(error?.code).toBe('LLM_CLI_EXIT');
    expect(text).not.toContain('abcdefghijklmnopqrstuvwxyz0123456789');
    expect(text).not.toContain('parent-known-secret-value');
    expect(text).toContain('[REDACTED]');
  });

  it('the provider scrubs known parent secrets from failures', async () => {
    const parentEnv = { PATH: '/bin', MY_API_TOKEN: 'tok-parent-secret-123456' };
    const p = provider(new StubRunner({ judge: [DomainResult.ok(proc('', { exitCode: 1, stderr: 'leaked tok-parent-secret-123456' }))] }), { parentEnv });
    const result = await p.evaluate('x', OPTIONS);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain('tok-parent-secret-123456');
    p.dispose();
  });
});

describe('OPS-03 auth and usage-limit stops (ADR-018 item 5)', () => {
  it('the auth fixture (is_error, subtype success, exit 1) → LLM_AUTH, never keyed on subtype', () => {
    const auth = fixture('auth-error.json');
    expect(auth.subtype).toBe('success');
    expect(classifyProcessResult(proc(JSON.stringify(auth), { exitCode: 1 }), []).error?.code).toBe('LLM_AUTH');
  });

  it('usage-limit text or HTTP 429 → LLM_USAGE_LIMIT; other errors → LLM_CLI_EXIT', () => {
    const limit = { is_error: true, subtype: 'success', result: "You've hit your limit · resets 5pm" };
    expect(classifyProcessResult(proc(JSON.stringify(limit), { exitCode: 1 }), []).error?.code).toBe('LLM_USAGE_LIMIT');
    expect(classifyStop('x', 429)).toBe('LLM_USAGE_LIMIT');
    expect(classifyStop('Usage limit reached for today')).toBe('LLM_USAGE_LIMIT');
    expect(classifyStop('OAuth token has expired')).toBe('LLM_AUTH');
    const other = { is_error: true, subtype: 'error_during_execution', result: 'Internal error' };
    expect(classifyProcessResult(proc(JSON.stringify(other), { exitCode: 1 }), []).error?.code).toBe('LLM_CLI_EXIT');
  });

  it('through the decorator, auth is a stop: not retried and not recorded', async () => {
    const auth = fixture('auth-error.json');
    const runner = new StubRunner({ judge: [DomainResult.ok(proc(JSON.stringify(auth), { exitCode: 1 }))] });
    const inner = provider(runner);
    const dir = tmpDir('u4-cas-');
    const cassette = new CassetteLLMProvider(inner, { mode: 'record', dir, knownSecrets: [], interpret: inner.interpret });
    const result = await cassette.judge('p', OPTIONS, { runIndex: 0, repetition: 0, functionId: 'FF-N02' });
    expect(result.kind === 'stop' ? result.stop : null).toBe('AUTH');
    expect(runner.judgeCallCount()).toBe(1);
    expect(listCassetteKeys(dir)).toEqual([]);
    inner.dispose();
  });

  it('a timeout is retried once under the same key and recorded invalid', async () => {
    const runner = new StubRunner({ judge: [DomainResult.ok(proc('', { timedOut: true, exitCode: -1 }))] });
    const inner = provider(runner);
    const dir = tmpDir('u4-cas-');
    const cassette = new CassetteLLMProvider(inner, { mode: 'record', dir, knownSecrets: [], interpret: inner.interpret });
    const result = await cassette.judge('p', OPTIONS, { runIndex: 0, repetition: 0, functionId: 'FF-N02' });
    expect(result.kind === 'final' ? result.outcome : null).toEqual({ kind: 'invalid', cause: 'TIMEOUT' });
    expect(runner.judgeCallCount()).toBe(2);
    const key = listCassetteKeys(dir)[0] ?? '';
    expect(readCassetteEntry(dir, key)?.attempts).toBe(2);
    inner.dispose();
  });

  it('a recorded valid call stores the reduced envelope, the resolved model and the verdict', async () => {
    const inner = provider(new StubRunner());
    const dir = tmpDir('u4-cas-');
    const cassette = new CassetteLLMProvider(inner, { mode: 'record', dir, knownSecrets: [], interpret: inner.interpret });
    const result = await cassette.judge('p', OPTIONS, { runIndex: 1, repetition: 0, functionId: 'FF-N02', unitId: 'src/a.ts' });
    expect(result.kind).toBe('final');
    if (result.kind === 'final') {
      expect(result.outcome).toEqual({ kind: 'valid' });
      expect(result.entry.resolvedModel).toBe('claude-opus-5-5');
      expect(result.entry.response).not.toMatch(/session_id|uuid/);
      expect(result.entry.ignoredOptions).toEqual(['maxTokens']);
      expect(result.verdict?.confidence).toBe(0.95);
    }
    inner.dispose();
  });
});
