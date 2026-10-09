// ADR-019 item 4 as amended; ADR-021 SO3-1, SO3-4; FR-27; BR-U5b-31, 36, 44. Runner stub and the
// committed agy probe fixtures only; no process is spawned and no live call is made.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import type { LLMCallContext, LLMOptions } from '../../../src/shared/interfaces/llm-provider.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import {
  AGY_ENV_SET, AGY_LABELLER_MODEL, AGY_PINNED_VERSION, AGY_REQUIRED_DENY, AgyCliProvider, answerText, buildAgyArgs,
  buildAgyChildEnv, checkAgyHome, checkAgyIsolation, checkAgySettings, classifyAgyResult, composeAgyPrompt,
  createAgyNeutralCwd, deniedToolCount, executedTools, findAgyAncestorContext, parseAgyVersion, readAgyStream,
} from '../../../src/llm-critic/agy-cli-provider.js';
import { CassetteLLMProvider, buildJudgeRequest } from '../../../src/llm-critic/cassette-provider.js';
import { canonicalJSON } from '../../../src/llm-critic/canonical-json.js';
import { LABEL_SCHEMA_TEXT, main } from '../../../scripts/llm-label.js';

const FIX = path.resolve(__dirname, '../../fixtures/agy-cli');
const REPO = path.resolve(__dirname, '../../..');
const text = (name: string): string => fs.readFileSync(path.join(FIX, name), 'utf8');

function firstError<T>(r: DomainResult<T>): { code: string; message: string } | undefined {
  return r.success ? undefined : r.errors[0];
}
function dataOf<T>(r: DomainResult<T>): T {
  if (!r.success) throw new Error(`expected success, got ${r.errors[0]?.code ?? '?'}`);
  return r.data;
}

const roots: string[] = [];
function tmpDir(prefix = 'agy-test-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(dir);
  return dir;
}
afterAll(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

function proc(stdout: string, extra: Partial<ProcessResult> = {}): ProcessResult {
  return { exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 10, ...extra };
}

interface Seen { command: string; args: readonly string[]; options: ProcessRunOptions; cwdExisted: boolean }
function stubRunner(answers: readonly ((args: readonly string[]) => ProcessResult)[]): ProcessRunner & { seen: Seen[] } {
  const seen: Seen[] = [];
  let i = 0;
  return {
    seen,
    run(command, args, options) {
      seen.push({ command, args, options, cwdExisted: options.cwd !== undefined && fs.existsSync(options.cwd) });
      const answer = answers[Math.min(i, answers.length - 1)];
      i += 1;
      return Promise.resolve(DomainResult.ok((answer ?? (() => proc('')))(args)));
    },
  };
}

/** The pre-flight answers: version, MCP list, plugin list. */
const VERSION_OK = (): ProcessResult => proc(`${AGY_PINNED_VERSION}\n`);
const PREFLIGHT = [
  VERSION_OK,
  (): ProcessResult => proc('No MCP servers configured.\n'),
  (): ProcessResult => proc('No imported plugins.\n'),
];

function cleanHome(): string {
  const home = tmpDir('agy-home-');
  fs.chmodSync(home, 0o700);
  fs.mkdirSync(path.join(home, '.gemini/antigravity-cli/builtin/skills/agy-customizations'), { recursive: true });
  fs.mkdirSync(path.join(home, '.gemini/config/projects'), { recursive: true });
  fs.mkdirSync(path.join(home, '.gemini/antigravity-cli/conversations'), { recursive: true });
  fs.writeFileSync(path.join(home, '.gemini/config/mcp_config.json'), '');
  fs.writeFileSync(path.join(home, '.gemini/antigravity-cli/settings.json'), text('labeller-settings.json'));
  return home;
}

const OPTIONS: LLMOptions = { model: AGY_LABELLER_MODEL, maxTokens: 1024, temperature: 0 };
const CALL: LLMCallContext = { runIndex: 0, repetition: 0, functionId: 'label:violation:x', systemPrompt: 'PERSONA', responseSchema: LABEL_SCHEMA_TEXT };

describe('agy argv, env and prompt', () => {
  it('builds the frozen argv with the prompt off argv and non-content flags for the key', () => {
    const a = buildAgyArgs({ model: 'gemini-3.1-pro-high', schema: '{"type":"object"}', printTimeoutS: 240 });
    expect(a.binary).toBe('agy');
    expect(a.args).toEqual(['--output-format', 'stream-json', '--model', 'gemini-3.1-pro-high', '--json-schema', '{"type":"object"}',
      '--sandbox', '--disable-slash-commands', '--print-timeout', '240s']);
    expect(a.argvFlags).not.toContain('gemini-3.1-pro-high');
    expect(a.args).not.toContain('-p');
  });

  it('passes only the allow-listed names, the dedicated HOME and the auto-update switch set to true', () => {
    const env = buildAgyChildEnv({ PATH: '/bin', HOME: '/real', GEMINI_API_KEY: 'k', ANTHROPIC_API_KEY: 'k', TMPDIR: '/t' }, '/agy-home');
    expect(env).toEqual({ PATH: '/bin', HOME: '/agy-home', TMPDIR: '/t', LANG: 'en_US.UTF-8', AGY_CLI_DISABLE_AUTO_UPDATE: 'true' });
    expect(AGY_ENV_SET.AGY_CLI_DISABLE_AUTO_UPDATE).toBe('true');
  });

  it('prepends the persona because agy has no system channel', () => {
    expect(composeAgyPrompt('Q', 'P')).toBe('P\n\nQ');
    expect(composeAgyPrompt('Q', undefined)).toBe('Q');
    expect(parseAgyVersion('1.3.2\n')).toBe('1.3.2');
  });
});

describe('agy stream reading and classification (probe fixtures)', () => {
  it('reads the init model, the tool count and structured_output', () => {
    const s = readAgyStream(text('stream-json-clean.ndjson'));
    expect(s.init?.model).toBe('gemini-3.1-pro-high');
    expect(s.init?.tools).toHaveLength(60);
    expect(s.result?.structured_output).toBeDefined();
    expect(answerText(s.result ?? {})).toBe(canonicalJSON(s.result?.structured_output));
    expect(classifyAgyResult(proc(text('stream-json-clean.ndjson')), 'gemini-3.1-pro-high', []).error).toBeNull();
  });

  it('reads a single json envelope as the result', () => {
    const s = readAgyStream(text('envelope-json-schema.json'));
    expect(s.result?.status).toBe('SUCCESS');
    expect(s.init).toBeNull();
  });

  it('treats denied tool attempts as harmless and completed tools as an isolation stop', () => {
    const denied = readAgyStream(text('stream-tools-denied.ndjson'));
    expect(executedTools(denied)).toEqual([]);
    expect(deniedToolCount(denied)).toBe(6);
    expect(classifyAgyResult(proc(text('stream-tools-denied.ndjson')), 'gemini-3.1-pro-high', []).error).toBeNull();
    const strictOnly = proc(text('stream-tools-strict-only.ndjson'), { stderr: text('stderr-c04-tools-strict.txt') });
    expect(executedTools(readAgyStream(strictOnly.stdout))).toEqual(['view_file', 'view_file', 'run_command', 'read_url_content', 'write_to_file']);
    expect(classifyAgyResult(strictOnly, 'gemini-3.1-pro-high', []).error?.code).toBe('LLM_CLI_ISOLATION');
    for (const f of ['stream-memory-plant.ndjson', 'stream-memory-probe.ndjson', 'stream-canary-negative.ndjson']) {
      expect(classifyAgyResult(proc(text(f)), 'gemini-3.1-pro-high', []).error).toBeNull();
    }
  });

  it('classifies the observed error classes without trusting the exit code', () => {
    const c = (stdout: string, extra: Partial<ProcessResult> = {}): string | undefined => classifyAgyResult(proc(stdout, extra), 'gemini-3.1-pro-high', []).error?.code;
    expect(c(text('envelope-print-timeout.json'), { stderr: text('stderr-c09-timeout.txt') })).toBe('LLM_CLI_TIMEOUT');
    expect(c('', { timedOut: true, exitCode: -1 })).toBe('LLM_CLI_TIMEOUT');
    expect(c(text('envelope-auth.json'), { exitCode: 1, stderr: text('stderr-c10-noauth.txt') })).toBe('LLM_AUTH');
    expect(c(text('envelope-unknown-model.json'), { exitCode: 1, stderr: text('stderr-c08-badmodel.txt') })).toBe('LLM_NOT_CONFIGURED');
    expect(c(text('envelope-denied-read.json'), { stderr: text('stderr-c03-config-as-prompt.txt') })).toBe('LLM_CLI_EXIT');
    expect(c('{"status":"ERROR","error":"RESOURCE_EXHAUSTED: quota"}', { exitCode: 1 })).toBe('LLM_USAGE_LIMIT');
    expect(c('{"status":"ERROR","error":"boom"}', { exitCode: 1 })).toBe('LLM_CLI_EXIT');
    expect(c('not json')).toBe('LLM_CLI_BAD_ENVELOPE');
    const other = text('stream-json-clean.ndjson').replace(/"model": ?"gemini-3\.1-pro-high"/, '"model": "gemini-3.8-flash-high"');
    expect(other).not.toBe(text('stream-json-clean.ndjson'));
    expect(c(other)).toBe('LLM_CLI_ISOLATION');
  });

  it('scrubs known secrets from messages', () => {
    const r = classifyAgyResult(proc('{"status":"ERROR","error":"tok-SECRET1 failed"}', { exitCode: 1, stderr: 'tok-SECRET1' }), 'm', ['tok-SECRET1']);
    expect(JSON.stringify(r.error)).not.toContain('tok-SECRET1');
  });
});

describe('agy home and cwd checks', () => {
  it('accepts the committed labeller settings and rejects weakened ones', () => {
    expect(checkAgySettings(text('labeller-settings.json'))).toEqual([]);
    const base = JSON.parse(text('labeller-settings.json')) as Record<string, unknown>;
    const weaker = (patch: Record<string, unknown>): readonly string[] => checkAgySettings(JSON.stringify({ ...base, ...patch }));
    expect(weaker({ toolPermission: 'request-review' })).toHaveLength(1);
    expect(weaker({ permissions: { deny: AGY_REQUIRED_DENY.slice(1) } })[0]).toMatch(/permissions.deny lacks/);
    expect(weaker({ permissions: { deny: [...AGY_REQUIRED_DENY], allow: ['read_file(/x)'] } })[0]).toMatch(/permissions.allow/);
    expect(weaker({ allowNonWorkspaceAccess: true })).toHaveLength(1);
    expect(weaker({ disableSlashCommands: false })).toHaveLength(1);
    expect(checkAgySettings('{')).toEqual(['settings.json is not valid JSON']);
  });

  it('passes a clean home and fails closed on rule files, MCP servers and loose permissions', () => {
    const home = cleanHome();
    expect(checkAgyHome(home).problems).toEqual([]);
    fs.writeFileSync(path.join(home, '.gemini/GEMINI.md'), 'rule');
    fs.writeFileSync(path.join(home, '.gemini/config/mcp_config.json'), '{"mcpServers":{"x":{}}}');
    fs.chmodSync(home, 0o755);
    const problems = checkAgyHome(home).problems;
    expect(problems).toEqual(expect.arrayContaining([
      'forbidden entry .gemini/GEMINI.md', 'mcp_config.json is not empty', 'dedicated agy home is accessible to group or others',
    ]));
    expect(checkAgyHome(path.join(home, 'missing')).problems).toEqual(['dedicated agy home does not exist']);
  });

  it('refuses a neutral cwd under a rule file or a repository', () => {
    const root = tmpDir('agy-anc-');
    expect(findAgyAncestorContext(root)).toBeNull();
    const ok = createAgyNeutralCwd(root);
    expect(ok.success).toBe(true);
    fs.writeFileSync(path.join(root, 'AGENTS.md'), 'rule');
    const bad = createAgyNeutralCwd(root);
    expect(bad.success).toBe(false);
    expect(firstError(bad)?.code).toBe('LLM_CLI_ISOLATION');
    expect(fs.readdirSync(root).filter((n) => n.startsWith('daedalus-labeller-'))).toHaveLength(1);
  });
});

describe('agy pre-flight', () => {
  it('passes on the pin, a clean home and empty MCP and plugin listings', async () => {
    const r = await checkAgyIsolation({ runner: stubRunner(PREFLIGHT), home: cleanHome(), parentEnv: { PATH: '/bin' }, tmpRoot: tmpDir() });
    expect(r.success).toBe(true);
    expect(dataOf(r).cliVersion).toBe(AGY_PINNED_VERSION);
    expect(dataOf(r).isolationProbeSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('stops on version drift, a bad home and configured MCP servers', async () => {
    const env = { PATH: '/bin' };
    const drift = await checkAgyIsolation({ runner: stubRunner([() => proc('1.4.0\n')]), home: cleanHome(), parentEnv: env, tmpRoot: tmpDir() });
    expect(firstError(drift)?.code).toBe('LLM_CLI_VERSION_DRIFT');
    const home = cleanHome();
    fs.writeFileSync(path.join(home, '.gemini/AGENTS.md'), 'rule');
    const bad = await checkAgyIsolation({ runner: stubRunner(PREFLIGHT), home, parentEnv: env, tmpRoot: tmpDir() });
    expect(firstError(bad)?.code).toBe('LLM_CLI_ISOLATION');
    const mcp = await checkAgyIsolation({ runner: stubRunner([VERSION_OK, () => proc('x  stdio  on\n')]), home: cleanHome(), parentEnv: env, tmpRoot: tmpDir() });
    expect(firstError(mcp)?.message).toMatch(/mcp list/);
  });
});

describe('AgyCliProvider', () => {
  it('answers with the structured output, on stdin, in a removed neutral cwd, reporting unsent options', async () => {
    const runner = stubRunner([...PREFLIGHT, () => proc(text('stream-json-clean.ndjson'))]);
    const p = new AgyCliProvider({ home: cleanHome() }, { runner, parentEnv: { PATH: '/bin' }, tmpRoot: tmpDir() });
    const r = await p.evaluate('QUESTION', OPTIONS, CALL);
    expect(r.success).toBe(true);
    expect(JSON.parse(dataOf(r).content)).toHaveProperty('option', 1);
    expect(dataOf(r).model).toBe('gemini-3.1-pro-high');
    expect(dataOf(r).ignoredOptions).toEqual(['temperature', 'maxTokens']);
    const call = runner.seen[3];
    if (call === undefined) throw new Error('no model call was made');
    expect(call.options.stdin).toBe('PERSONA\n\nQUESTION');
    expect(call.args).not.toContain('QUESTION');
    expect(call.cwdExisted).toBe(true);
    expect(fs.existsSync(call.options.cwd ?? '')).toBe(false);
    expect(p.describe()).toEqual({ provider: 'agy', model: AGY_LABELLER_MODEL, cliVersion: AGY_PINNED_VERSION });
  });

  it('returns the pre-flight stop and never spawns a model call in replay mode', async () => {
    const runner = stubRunner([() => proc('9.9.9\n')]);
    const p = new AgyCliProvider({ home: cleanHome() }, { runner, tmpRoot: tmpDir() });
    expect(firstError(await p.evaluate('Q', OPTIONS, CALL))?.code).toBe('LLM_CLI_VERSION_DRIFT');
    const replay = new AgyCliProvider({ home: cleanHome(), mode: 'replay' }, { runner: stubRunner([]), tmpRoot: tmpDir() });
    expect((await replay.prepare()).success).toBe(false);
  });

  it('keys cassettes on provider agy with its argv flags and no effort', () => {
    const p = new AgyCliProvider({ home: '/h' }, { runner: stubRunner([]) });
    const flags = p.requestArgvFlags(OPTIONS, CALL);
    const req = buildJudgeRequest('agy', 'Q', OPTIONS, CALL, flags);
    expect(req.provider).toBe('agy');
    expect(req.effort).toBeNull();
    expect(req.argvFlags).toEqual([...flags].sort());
    expect(new CassetteLLMProvider(p, { mode: 'replay', dir: tmpDir() }).keyOf('Q', OPTIONS, CALL)?.key).toMatch(/-r0-0$/);
  });

  it('records through the cassette decorator and replays without the provider', async () => {
    const dir = tmpDir('agy-cas-');
    const runner = stubRunner([...PREFLIGHT, () => proc(text('stream-json-clean.ndjson'))]);
    const p = new AgyCliProvider({ home: cleanHome() }, { runner, parentEnv: { PATH: '/bin' }, tmpRoot: tmpDir() });
    const rec = await new CassetteLLMProvider(p, { mode: 'record', dir, knownSecrets: [] }).judge('Q', OPTIONS, CALL);
    expect(rec.kind).toBe('final');
    const replayed = await new CassetteLLMProvider(new AgyCliProvider({ home: '/none', mode: 'replay' }, { runner: stubRunner([]) }), { mode: 'replay', dir, knownSecrets: [] }).judge('Q', OPTIONS, CALL);
    expect(replayed.kind === 'final' && replayed.hit).toBe(true);
    expect(runner.seen).toHaveLength(4);
  });
});

describe('llm-label --provider agy', () => {
  const io = (): { out: string[]; err: string[]; files: Map<string, string>; io: { out: (t: string) => void; err: (t: string) => void; writeFile: (f: string, t: string) => void } } => {
    const out: string[] = [];
    const err: string[] = [];
    const files = new Map<string, string>();
    return { out, err, files, io: { out: (t) => out.push(t), err: (t) => err.push(t), writeFile: (f, t) => files.set(f, t) } };
  };
  const base = ['--plan', 'tests/fixtures/agy-cli/smoke-plan.json', '--model', AGY_LABELLER_MODEL, '--cassette-dir', 'tests/fixtures/agy-cli/cassettes'];

  it('replays the committed live smoke cassettes to the committed labels without building a provider', async () => {
    const t = io();
    const code = await main([...base, '--mode', 'replay', '--provider', 'agy', '--out', 'out.json'], REPO, t.io, {
      agy: () => {
        throw new Error('replay must not build the agy provider');
      },
    });
    expect(t.err.join('')).toBe('');
    expect(code).toBe(0);
    const written = [...t.files.values()][0] ?? '';
    expect(JSON.parse(written)).toEqual(JSON.parse(text('smoke-labels.json')));
  });

  it('misses every committed cassette when replayed as another provider', async () => {
    const t = io();
    const code = await main([...base, '--mode', 'replay', '--provider', 'gemini', '--out', 'out.json'], REPO, t.io);
    expect(code).toBe(1);
    expect(t.err.join('')).toMatch(/CASSETTE_MISS/);
  });

  it('refuses an unknown provider and stops when the agy pre-flight fails', async () => {
    const t = io();
    expect(await main([...base, '--mode', 'record', '--provider', 'claude-cli', '--out', 'o.json'], REPO, t.io)).toBe(2);
    const s = io();
    const code = await main([...base, '--mode', 'record', '--provider', 'agy', '--out', 'o.json'], REPO, s.io, {
      agy: (model) => new AgyCliProvider({ model, home: cleanHome() }, { runner: stubRunner([() => proc('1.0.0\n')]), tmpRoot: tmpDir() }),
    });
    expect(code).toBe(1);
    expect(s.err.join('')).toMatch(/LABELLER_STOPPED: LLM_CLI_VERSION_DRIFT/);
  });
});
