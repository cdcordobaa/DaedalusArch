/**
 * T-ISO and the session status order (design DR-12, DR-13, DR-17 to DR-22, DR-24a, DR-26; A1 DR-A1-3). Zero calls:
 * every spawn goes to the stub or a scripted runner; every test injects a fake clock and a zero-wait sleeper.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { DomainResult } from '../../../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../../../../src/shared/interfaces/process-runner.js';
import { TOOL_NAMES } from '../../../../../src/mcp-server/server.js';
import { callLogPathOf, sessionKeyOf } from '../../../../../scripts/v1.3/lib/eff01/argv.js';
import { architectureBlock } from '../../../../../scripts/v1.3/lib/eff01/inputs.js';
import { buildPrompt, CALIBRATION_PROMPT } from '../../../../../scripts/v1.3/lib/eff01/prompt.js';
import { redactRoots } from '../../../../../scripts/v1.3/lib/eff01/redact.js';
import { normaliseKey } from '../../../../../scripts/v1.3/lib/eff01/score.js';
import { createSpawnBudget, eff01Disposition, runSession, sessionDirOf } from '../../../../../scripts/v1.3/lib/eff01/session.js';
import type { SessionContext } from '../../../../../scripts/v1.3/lib/eff01/session.js';
import { StubEff01Runner } from '../../../../../scripts/v1.3/lib/eff01/stub-runner.js';
import type { StubBehaviour } from '../../../../../scripts/v1.3/lib/eff01/stub-runner.js';
import { treeFingerprint } from '../../../../../scripts/v1.3/lib/eff01/trees.js';
import type { Eff01Block, Eff01Condition, SessionSpec } from '../../../../../scripts/v1.3/lib/eff01/types.js';
import { allStoredText, fakeClock, FIXTURE_TREE, inputs, REPO, tmpDir, zeroSleep } from './helpers.js';

const MODEL = 'claude-sonnet-5-5';
const ins = inputs();
const SPEC_PATH = path.join(REPO, 'results/v1.3-external/specs/ddd-forum.yaml');
const ARCH = (() => {
  const r = architectureBlock(fs.readFileSync(SPEC_PATH, 'utf8'));
  if (!r.success) throw new Error('arch');
  return r.data;
})();

function spec(condition: Eff01Condition, block: Eff01Block = 'main', questionId: string | null = 'DF-Q03'): SessionSpec {
  return { sessionId: `${block}/ddd-forum/${questionId ?? 'calib'}/${condition}/run-1`, block, repoId: 'ddd-forum', questionId, condition, run: 1, rerun: false, lane: 0, orderIndex: 0 };
}

function promptOf(s: SessionSpec): string {
  const q = s.questionId === null ? undefined : ins.questionById.get(s.questionId);
  return q === undefined ? CALIBRATION_PROMPT : buildPrompt({ condition: s.condition, archBlock: ARCH, conventions: ins.conventions, question: q });
}

function stub(behaviour: StubBehaviour, outsidePath?: string): StubEff01Runner {
  const lookup = new Map<string, { repoId: string; questionId: string | null }>();
  for (const c of ['R', 'G', 'N'] as const) for (const qid of ['DF-Q03']) lookup.set(promptOf(spec(c, 'main', qid)), { repoId: 'ddd-forum', questionId: qid });
  return new StubEff01Runner({
    fixtureTree: FIXTURE_TREE,
    pins: {},
    lookup: (p) => lookup.get(p) ?? { repoId: 'ddd-forum', questionId: null },
    keyFor: (qid) => {
      const q = ins.questionById.get(qid);
      return q === undefined ? undefined : normaliseKey(q.template, ins.keys.get(qid)?.answer);
    },
    model: MODEL,
    behaviour,
    ...(outsidePath !== undefined ? { outsidePath } : {}),
  });
}

interface Setup {
  readonly ctx: SessionContext;
  readonly harness: string;
  readonly runDir: string;
  readonly tree: string;
  readonly sleep: ReturnType<typeof zeroSleep>;
}

function setup(runner: ProcessRunner, over: Partial<SessionContext> = {}): Setup {
  const harness = tmpDir('h');
  const runDir = tmpDir('run');
  const tree = path.join(harness, 'trees', 'ddd-forum');
  fs.mkdirSync(path.dirname(tree), { recursive: true });
  fs.cpSync(FIXTURE_TREE, tree, { recursive: true });
  const configDir = path.join(harness, 'dry-config');
  fs.mkdirSync(configDir);
  const sleep = zeroSleep();
  const parentEnv = { PATH: '/usr/bin:/bin', HOME: '/Users/someone', ANTHROPIC_API_KEY: 'sk-ant-should-never-pass-0000', LANG: 'C' };
  const ctx: SessionContext = {
    runner,
    parentEnv,
    clock: fakeClock(),
    sleep,
    claudeBinary: '/stub/claude',
    model: MODEL,
    configDir,
    harnessRoot: harness,
    runDir,
    nodeBinary: process.execPath,
    serverEntry: path.join(REPO, 'dist/mcp-server/main.js'),
    knownSecrets: [],
    redact: redactRoots({ harnessRoot: harness, repoRoot: REPO, configDir, nodeBinary: process.execPath, home: parentEnv.HOME }),
    cliVersionStart: '2.1.301',
    dryRun: true,
    hashes: { questions: ins.sha256.questions, answers: ins.sha256.answers },
    budget: createSpawnBudget(Number.POSITIVE_INFINITY),
    ...over,
  };
  return { ctx, harness, runDir, tree, sleep };
}

async function run(s: SessionSpec, st: Setup) {
  const r = await runSession({ spec: s, prompt: promptOf(s), treeDir: st.tree, specPath: SPEC_PATH, specSha256: 'a'.repeat(64), treeFingerprint: treeFingerprint(st.tree) }, st.ctx);
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
  return r.data;
}

/** Returns scripted results in order; `onRun` can touch the cwd. */
class ScriptedRunner implements ProcessRunner {
  readonly calls: { command: string; args: readonly string[]; options: ProcessRunOptions }[] = [];
  constructor(private readonly results: (ProcessResult | null)[], private readonly onRun?: (o: ProcessRunOptions) => void) {}
  run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    this.calls.push({ command, args, options });
    this.onRun?.(options);
    const r = this.results[Math.min(this.calls.length - 1, this.results.length - 1)] ?? null;
    return Promise.resolve(r === null ? DomainResult.fail([{ code: 'PROCESS_SPAWN_FAILED', message: 'no binary' }]) : DomainResult.ok(r));
  }
}

interface TOpts {
  readonly condition?: Eff01Condition;
  readonly leak?: boolean;
  readonly aux?: number;
  readonly subtype?: string;
  readonly turns?: number;
  readonly tokens?: number;
  readonly result?: boolean;
}

function transcript(o: TOpts = {}): string {
  const c = o.condition ?? 'R';
  const own = TOOL_NAMES.map((t) => `mcp__daedalus-arch__${t}`);
  const lines = [
    JSON.stringify({ type: 'system', subtype: 'init', model: MODEL, tools: c === 'N' ? [] : c === 'R' ? ['Read', 'Grep', 'Glob'] : ['Read', 'Grep', 'Glob', ...own], mcp_servers: c === 'G' ? [{ name: 'daedalus-arch', status: 'connected' }] : [] }),
    JSON.stringify({ type: 'assistant', message: { id: 'm1', model: MODEL, content: [{ type: 'text', text: 'ANSWER: {"files":[]}' }, ...(o.leak === true ? [{ type: 'tool_use', id: 't', name: 'mcp__daedalus-arch__which_layer', input: {} }] : [])], usage: { input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: 3, output_tokens: 4 } } }),
  ];
  if (o.result !== false) {
    const mu: Record<string, Record<string, number>> = { [MODEL]: { inputTokens: o.tokens ?? 10, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, outputTokens: 50 } };
    if (o.aux !== undefined) mu['claude-aux'] = { inputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, outputTokens: o.aux };
    lines.push(JSON.stringify({ type: 'result', subtype: o.subtype ?? 'success', is_error: o.subtype === 'error_max_turns', num_turns: o.turns ?? 2, result: 'ANSWER: {"files":[]}', modelUsage: mu, total_cost_usd: 0.5 }));
  }
  return `${lines.join('\n')}\n`;
}

function res(stdout: string, extra: Partial<ProcessResult> = {}): ProcessResult {
  return { exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 3, ...extra };
}

describe('EFF-01 session isolation (T-ISO)', () => {
  it('spawns with a per-session HOME, the config dir and no denied variable', async () => {
    const runner = stub('key');
    const st = setup(runner);
    const rec = await run(spec('R'), st);
    expect(rec.status).toBe('completed');
    const env = runner.calls[0]?.options.env ?? {};
    expect(env.HOME).toBe(path.join(st.harness, 'homes', sessionKeyOf(spec('R').sessionId)));
    expect(env.CLAUDE_CONFIG_DIR).toBe(st.ctx.configDir);
    expect(env.DISABLE_AUTOUPDATER).toBe('1');
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(runner.calls[0]?.options.timeoutMs).toBe(600_000);
  });

  it('runs R and G in the tree (A1) and N in a fresh empty directory', async () => {
    const runner = stub('key');
    const st = setup(runner);
    await run(spec('R'), st);
    await run(spec('G'), st);
    await run(spec('N'), st);
    expect(runner.calls.map((c) => c.options.cwd)).toEqual([st.tree, st.tree, path.join(st.harness, 'empty', sessionKeyOf(spec('N').sessionId))]);
  });

  it('refuses a non-empty N cwd', async () => {
    const st = setup(stub('key'));
    const cwd = path.join(st.harness, 'empty', sessionKeyOf(spec('N').sessionId));
    fs.mkdirSync(cwd, { recursive: true });
    fs.writeFileSync(path.join(cwd, 'x'), 'x');
    const r = await runSession({ spec: spec('N'), prompt: promptOf(spec('N')), treeDir: st.tree, specPath: SPEC_PATH, specSha256: 'a', treeFingerprint: 'f' }, st.ctx);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors[0]?.code).toBe('EFF01_CWD_NOT_EMPTY');
  });

  it('writes G\'s MCP config 0600 and refuses a G session whose call log already exists', async () => {
    const st = setup(stub('key'));
    const rec = await run(spec('G'), st);
    expect(rec.mcpCallLog).toEqual({ lines: 1, byTool: { evaluate_project: 1 } });
    const cfg = path.join(st.harness, 'mcp', `${sessionKeyOf(spec('G').sessionId)}.json`);
    expect(fs.statSync(cfg).mode & 0o777).toBe(0o600);
    expect(fs.existsSync(path.join(sessionDirOf(st.runDir, spec('G').sessionId), 'calls.jsonl'))).toBe(true);
    const again = await runSession({ spec: spec('G'), prompt: promptOf(spec('G')), treeDir: st.tree, specPath: SPEC_PATH, specSha256: 'a', treeFingerprint: treeFingerprint(st.tree) }, st.ctx);
    expect(again.success).toBe(false);
    expect(fs.existsSync(callLogPathOf(st.harness, sessionKeyOf(spec('G').sessionId)))).toBe(true);
  });
});

describe('EFF-01 session status (DR-22)', () => {
  it('orders infrastructure > envelope-unreadable > model-mismatch > confinement-leak > tree-changed > caps > completed', async () => {
    const st = (r: ProcessRunner) => setup(r);
    const infra = await run(spec('R'), st(new ScriptedRunner([null])));
    expect(infra.status).toBe('infrastructure');
    expect(infra.attempts).toHaveLength(3);

    expect((await run(spec('R'), st(new ScriptedRunner([res(transcript({ aux: 999 }), { truncated: true })])))).statusReason).toBe('output-truncated');
    expect((await run(spec('R'), st(new ScriptedRunner([res(transcript({ result: false }))])))).status).toBe('envelope-unreadable');
    expect((await run(spec('R'), st(new ScriptedRunner([res(transcript({ aux: 999, leak: true }))])))).status).toBe('model-mismatch');

    const touch = (o: ProcessRunOptions): void => {
      fs.writeFileSync(path.join(o.cwd ?? '', 'TOUCHED'), 'x');
    };
    expect((await run(spec('R'), st(new ScriptedRunner([res(transcript({ leak: true }))], touch)))).status).toBe('confinement-leak');
    expect((await run(spec('R'), st(new ScriptedRunner([res(transcript({ subtype: 'error_max_turns' }))], touch)))).status).toBe('tree-changed');

    expect((await run(spec('R'), st(new ScriptedRunner([res(transcript({ subtype: 'error_max_turns', tokens: 500_000 }))])))).status).toBe('cap-turns');
    expect((await run(spec('R'), st(new ScriptedRunner([res(transcript({ turns: 31 }))])))).status).toBe('cap-turns');
    expect((await run(spec('R'), st(new ScriptedRunner([res(transcript({ tokens: 400_001 }))])))).status).toBe('cap-tokens');
    const ok = await run(spec('R'), st(new ScriptedRunner([res(transcript())])));
    expect(ok.status).toBe('completed');
    expect(ok.valid).toBe(true);
  });

  it('does not retry a timeout; it is cap-wall with partial tokens and a transcript model check', async () => {
    const runner = new ScriptedRunner([res(transcript({ result: false }), { timedOut: true, exitCode: -1 })]);
    const st = setup(runner);
    const rec = await run(spec('R'), st);
    expect(runner.calls).toHaveLength(1);
    expect(rec.status).toBe('cap-wall');
    expect(rec.valid).toBe(true);
    expect(rec.modelSource).toBe('transcript');
    expect(rec.tokensSource).toBe('transcript-partial');
    expect(rec.tokens?.processed).toBe(10);
    expect(eff01Disposition(res('', { timedOut: true }), null)).toEqual({ kind: 'final', label: 'cap-wall' });
  });

  it('archives a usage-limit attempt, waits through the injected sleeper and completes on retry', async () => {
    const runner = stub('usage-limit-once');
    const st = setup(runner);
    const rec = await run(spec('R'), st);
    expect(rec.status).toBe('completed');
    expect(rec.interruptions).toHaveLength(1);
    expect(st.sleep.calls).toEqual([30 * 60 * 1000 + 0]);
    const dir = sessionDirOf(st.runDir, spec('R').sessionId);
    expect(fs.existsSync(path.join(dir, 'interrupted-0', 'transcript.jsonl.gz'))).toBe(true);
    expect(rec.modelReachingAttempts).toBe(1);
  });

  it('tolerates pinned-not-dominant in calibration only', async () => {
    const cal = await run(spec('R', 'calibration', null), setup(new ScriptedRunner([res(transcript({ aux: 999 }))])));
    expect(cal.status).toBe('completed');
    expect((cal.model.verdict as { reason?: string }).reason).toBe('pinned-not-dominant');
    const main = await run(spec('R'), setup(new ScriptedRunner([res(transcript({ aux: 999 }))])));
    expect(main.status).toBe('model-mismatch');
  });

  it('stops before an attempt once the spawn budget is used up (DR-24a)', async () => {
    const st = setup(stub('key'), { budget: createSpawnBudget(0) });
    const r = await runSession({ spec: spec('R'), prompt: promptOf(spec('R')), treeDir: st.tree, specPath: SPEC_PATH, specSha256: 'a', treeFingerprint: treeFingerprint(st.tree) }, st.ctx);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors[0]?.code).toBe('EFF01_SPAWN_BUDGET');
  });

  it('stores the session files scrubbed, cost-free and path-redacted', async () => {
    const st = setup(stub('read-outside-tree', path.join(REPO, 'experiments/eff-01/answers.json')));
    const rec = await run(spec('R'), st);
    expect(rec.status).toBe('confinement-leak');
    expect(rec.statusReason).toBe('read-outside-tree:<REPO>/experiments/eff-01/answers.json');
    const dir = sessionDirOf(st.runDir, spec('R').sessionId);
    expect(fs.readdirSync(dir).sort()).toEqual(['envelope.json', 'record.json', 'transcript.jsonl.gz']);
    const text = allStoredText(st.runDir);
    expect(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'transcript.jsonl.gz'))).toString()).toContain('<H>/trees/ddd-forum/README.md');
    for (const bad of [st.harness, REPO, '/Users/someone', 'costUSD', 'total_cost_usd']) expect(text).not.toContain(bad);
    expect(rec.argv[1]).toBe('<prompt>');
  });
});
