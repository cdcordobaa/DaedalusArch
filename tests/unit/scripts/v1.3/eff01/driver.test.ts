/**
 * T-DRY and T-GUARD (design DR-3, DR-5, DR-24 to DR-30; A1). Zero calls: dry runs construct only the stub, and the
 * live-path tests inject the same stub through `runnerFactory`. Every run gets a fake clock and a zero-wait sleeper.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner } from '../../../../../src/shared/interfaces/process-runner.js';
import { makeStubRunner, runEff01, sessionPrompts } from '../../../../../scripts/v1.3/lib/eff01/driver.js';
import type { DriverOptions } from '../../../../../scripts/v1.3/lib/eff01/driver.js';
import { parseRunFlags } from '../../../../../scripts/v1.3/lib/eff01/cli.js';
import { planSessions } from '../../../../../scripts/v1.3/lib/eff01/plan.js';
import { readRecord, scoreRun } from '../../../../../scripts/v1.3/lib/eff01/score.js';
import type { StubBehaviour } from '../../../../../scripts/v1.3/lib/eff01/stub-runner.js';
import { treeFingerprint } from '../../../../../scripts/v1.3/lib/eff01/trees.js';
import type { Eff01Condition, SessionRecord } from '../../../../../scripts/v1.3/lib/eff01/types.js';
import { allStoredText, fakeClock, FIXTURE_TREE, inputs, REPO, tmpDir, zeroSleep } from './helpers.js';

const ins = inputs();
const HOME = os.homedir();

function opts(over: Partial<DriverOptions> = {}): DriverOptions & { out: string; harness: string } {
  const harness = tmpDir('h');
  const out = path.join(tmpDir('out'), 'run');
  return {
    repoRoot: REPO,
    out,
    harness,
    clones: tmpDir('clones'),
    blocks: 'all',
    clock: fakeClock(),
    sleep: zeroSleep(),
    parentEnv: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME },
    ...over,
  };
}

function records(runDir: string): SessionRecord[] {
  const out: SessionRecord[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name === 'record.json') out.push(JSON.parse(fs.readFileSync(path.join(d, e.name), 'utf8')) as SessionRecord);
    }
  };
  if (fs.existsSync(path.join(runDir, 'sessions'))) walk(path.join(runDir, 'sessions'));
  return out;
}

const only = (pred: (id: string, c: Eff01Condition) => boolean, b: StubBehaviour) => (id: string, c: Eff01Condition): StubBehaviour => (pred(id, c) ? b : 'key');

describe('EFF-01 dry run (T-DRY)', () => {
  const o = opts();
  let first: Awaited<ReturnType<typeof runEff01>>;

  beforeAll(async () => {
    first = await runEff01(o);
  });

  it('runs all 150 sessions valid and marked dryRun, and the scorer gives acc = 1 on every item', () => {
    expect(first.exitCode).toBe(0);
    expect(first.sessionsRun).toBe(150);
    const recs = records(o.out);
    expect(recs).toHaveLength(150);
    expect(recs.every((r) => r.valid && r.status === 'completed' && r.dryRun)).toBe(true);
    const scored = scoreRun({ runDir: o.out, repoRoot: REPO });
    if (!scored.success) throw new Error(scored.errors[0]?.message);
    expect(scored.data.items).toHaveLength(60);
    expect(scored.data.items.filter((r) => r.condition === 'N')).toHaveLength(20);
    expect(scored.data.items.every((r) => r.acc === 1)).toBe(true);
    // A1: every G row used and cited the graph.
    expect(scored.data.items.filter((r) => r.condition === 'G').every((r) => r.graphUnusedRuns === 0 && r.graphUncitedRuns === 0)).toBe(true);
    // R answered with absolute paths, so the strict variant fails on path items only.
    expect(scored.data.items.find((r) => r.questionId === 'DF-Q03' && r.condition === 'R')?.accStrict).toBe(0);
    for (const f of ['scores.json', 'items.json', 'items.csv', 'pilot-scores.json']) expect(fs.existsSync(path.join(o.out, f))).toBe(true);
    const gate = JSON.parse(fs.readFileSync(path.join(o.out, 'pilot-gate.json'), 'utf8')) as { pass: boolean; sessions: number };
    expect(gate).toMatchObject({ pass: true, sessions: 8 });
  });

  it('stores no cost field and no personal path', () => {
    const text = allStoredText(o.out);
    for (const bad of ['costUSD', 'total_cost_usd', o.harness, REPO, `${HOME}/`]) expect(text).not.toContain(bad);
    expect(text).toContain('<H>/trees/');
  });

  it('resumes: a second invocation reproduces plan.json byte for byte and repeats no session', async () => {
    const before = fs.readFileSync(path.join(o.out, 'plan.json'));
    const again = await runEff01({ ...o, clock: fakeClock(), sleep: zeroSleep() });
    expect(again.exitCode).toBe(0);
    expect(again.sessionsRun).toBe(0);
    expect(fs.readFileSync(path.join(o.out, 'plan.json')).equals(before)).toBe(true);
    expect(fs.readFileSync(path.join(o.out, 'invocations.jsonl'), 'utf8').trim().split('\n')).toHaveLength(2);
    const changed = await runEff01({ ...o, runs: 2, clock: fakeClock(), sleep: zeroSleep() });
    expect(changed.exitCode).toBe(2);
  });

  it('rescores against a corrected key into new files and refuses a changed question set', () => {
    const fake = tmpDir('repo');
    fs.mkdirSync(path.join(fake, 'experiments/eff-01'), { recursive: true });
    for (const f of ['questions.json', 'repos.json']) fs.copyFileSync(path.join(REPO, 'experiments/eff-01', f), path.join(fake, 'experiments/eff-01', f));
    const answers = JSON.parse(fs.readFileSync(path.join(REPO, 'experiments/eff-01/answers.json'), 'utf8')) as { repos: Record<string, { answers: Record<string, { answer: unknown }> }> };
    const df = answers.repos['ddd-forum']?.answers['DF-Q02'];
    if (df === undefined) throw new Error('DF-Q02');
    df.answer = 51;
    fs.writeFileSync(path.join(fake, 'experiments/eff-01/answers.json'), JSON.stringify(answers));
    const scoresBefore = fs.readFileSync(path.join(o.out, 'scores.json'));
    expect(scoreRun({ runDir: o.out, repoRoot: fake }).success).toBe(false);
    const re = scoreRun({ runDir: o.out, repoRoot: fake, rescoreWithCurrentKey: true });
    if (!re.success) throw new Error(re.errors[0]?.message);
    expect(re.data.written.map((f) => path.basename(f)).every((f) => /-key-[0-9a-f]{8}\./.test(f))).toBe(true);
    expect(re.data.items.find((r) => r.questionId === 'DF-Q02' && r.condition === 'R')?.acc).toBe(0);
    expect(fs.readFileSync(path.join(o.out, 'scores.json')).equals(scoresBefore)).toBe(true);
    fs.writeFileSync(path.join(fake, 'experiments/eff-01/questions.json'), `${fs.readFileSync(path.join(REPO, 'experiments/eff-01/questions.json'), 'utf8')} `);
    expect(scoreRun({ runDir: o.out, repoRoot: fake, rescoreWithCurrentKey: true }).success).toBe(false);
  });
});

describe('EFF-01 dry-run gates and failures (T-DRY)', () => {
  it('a pilot R session with an mcp__ call stops before main (exit 1)', async () => {
    const o = opts({ behaviour: only((id, c) => id.startsWith('pilot/') && c === 'R', 'leak-mcp-in-R') });
    const r = await runEff01(o);
    expect(r.exitCode).toBe(1);
    expect(records(o.out).some((x) => x.block === 'main')).toBe(false);
    const gate = JSON.parse(fs.readFileSync(path.join(o.out, 'pilot-gate.json'), 'utf8')) as { pass: boolean; leaks: string[] };
    expect(gate.pass).toBe(false);
    expect(gate.leaks).toHaveLength(4);
  });

  it('two pilot sessions without an ANSWER line fail the gate; one does not', async () => {
    const two = opts({ blocks: ['calibration', 'pilot'], behaviour: only((id) => id === 'pilot/ddd-forum/DF-Q02/R/run-1' || id === 'pilot/ddd-forum/DF-Q06/G/run-1', 'no-answer') });
    expect((await runEff01(two)).exitCode).toBe(1);
    const one = opts({ blocks: ['calibration', 'pilot'], behaviour: only((id) => id === 'pilot/ddd-forum/DF-Q02/R/run-1', 'no-answer') });
    expect((await runEff01(one)).exitCode).toBe(0);
  });

  it('an R read outside the tree is a leak; leaking again on the re-run stops the run', async () => {
    const target = 'main/event-sourcing-ddd/ES-Q05/R/run-2';
    const o = opts({ blocks: ['main'], behaviour: only((id) => id.startsWith(target), 'read-outside-tree'), outsidePath: path.join(REPO, 'experiments/eff-01/answers.json') });
    const r = await runEff01(o);
    expect(r.exitCode).toBe(1);
    const rec = readRecord(o.out, target);
    expect(rec?.status).toBe('confinement-leak');
    expect(rec?.confinement.reasons).toEqual(['read-outside-tree:<REPO>/experiments/eff-01/answers.json']);
    expect(readRecord(o.out, `${target}-rerun`)?.status).toBe('confinement-leak');
  });

  it('usage-limit-once recovers; truncated is envelope-unreadable, re-run once, then recorded as missing', async () => {
    const o = opts({
      blocks: ['main'],
      behaviour: (id) => (id.startsWith('main/ddd-forum/DF-Q01/G/run-1') ? 'usage-limit-once' : id.startsWith('main/ddd-forum/DF-Q02/R/run-1') ? 'truncated' : 'key'),
    });
    const r = await runEff01(o);
    expect(r.exitCode).toBe(0);
    const ul = readRecord(o.out, 'main/ddd-forum/DF-Q01/G/run-1');
    expect(ul?.status).toBe('completed');
    expect(ul?.interruptions).toHaveLength(1);
    expect(readRecord(o.out, 'main/ddd-forum/DF-Q02/R/run-1')?.status).toBe('envelope-unreadable');
    expect(readRecord(o.out, 'main/ddd-forum/DF-Q02/R/run-1-rerun')?.status).toBe('envelope-unreadable');
    expect(r.messages.some((m) => m.includes('recorded as missing'))).toBe(true);
    expect(records(o.out)).toHaveLength(121);
  });

  it('a timeout is cap-wall, valid and not retried', async () => {
    const o = opts({ blocks: ['main'], behaviour: only((id) => id === 'main/ddd-forum/DF-Q04/G/run-3', 'timeout') });
    expect((await runEff01(o)).exitCode).toBe(0);
    const rec = readRecord(o.out, 'main/ddd-forum/DF-Q04/G/run-3');
    expect(rec).toMatchObject({ status: 'cap-wall', valid: true, tokensSource: 'transcript-partial' });
    expect(rec?.attempts).toHaveLength(1);
  });

  it('two lanes write one call log per G session', async () => {
    const o = opts({ blocks: ['main'], lanes: 2 });
    expect((await runEff01(o)).exitCode).toBe(0);
    const calls = fs.readdirSync(path.join(o.harness, 'calls'));
    expect(calls).toHaveLength(60);
    for (const f of calls) expect(fs.readFileSync(path.join(o.harness, 'calls', f), 'utf8').trim().split('\n')).toHaveLength(1);
    expect(records(o.out).filter((r) => r.lane === 1)).toHaveLength(60);
  });

  it('DR-16: a tree-changed session stops the whole run (exit 1) on the first occurrence, with no re-run', async () => {
    const target = 'main/ddd-forum/DF-Q03/R/run-1';
    const o = opts({ blocks: ['main'], behaviour: only((id) => id === target, 'tree-write') });
    const r = await runEff01(o);
    expect(r.exitCode).toBe(1);
    expect(readRecord(o.out, target)?.status).toBe('tree-changed');
    expect(readRecord(o.out, `${target}-rerun`)).toBeFalsy();
    expect(r.messages.some((m) => m.includes('the tree changed'))).toBe(true);
  });

  it('DR-25/DR-A1-4: a G built-in leak or a disconnected MCP server in the pilot fails the gate before main', async () => {
    for (const b of ['leak-builtin-in-G', 'mcp-not-connected'] as StubBehaviour[]) {
      const o = opts({ behaviour: only((id, c) => id.startsWith('pilot/') && c === 'G', b) });
      expect((await runEff01(o)).exitCode).toBe(1);
      expect(records(o.out).some((x) => x.block === 'main')).toBe(false);
      const gate = JSON.parse(fs.readFileSync(path.join(o.out, 'pilot-gate.json'), 'utf8')) as { pass: boolean; leaks: string[] };
      expect(gate.pass).toBe(false);
      expect(gate.leaks.length).toBeGreaterThan(0);
      expect(gate.leaks.every((id) => id.includes('/G/'))).toBe(true);
    }
  });

  it('wrong and no-graph: a wrong answer scores below 1, and an unused graph shows in graphUnusedRuns (DR-A1-5)', async () => {
    const o = opts({
      blocks: ['main'],
      behaviour: (id, c) => (id.startsWith('main/ddd-forum/DF-Q02/R/') ? 'wrong' : id.startsWith('main/ddd-forum/DF-Q01/G/run-1') && c === 'G' ? 'no-graph' : 'key'),
    });
    expect((await runEff01(o)).exitCode).toBe(0);
    const scored = scoreRun({ runDir: o.out, repoRoot: REPO });
    if (!scored.success) throw new Error(scored.errors[0]?.message);
    expect(scored.data.items.find((r) => r.questionId === 'DF-Q02' && r.condition === 'R')?.acc).toBeLessThan(1);
    const g = scored.data.items.find((r) => r.questionId === 'DF-Q01' && r.condition === 'G');
    expect(g?.graphUnusedRuns).toBe(1);
    expect(g?.graphUncitedRuns).toBe(1);
    expect(scored.data.items.find((r) => r.questionId === 'DF-Q01' && r.condition === 'R')?.graphUnusedRuns).toBeNull();
  });

  it('a dry run refuses --out inside experiments/, --claude, --config-dir and --confirm-sessions', async () => {
    expect((await runEff01(opts({ out: path.join(REPO, 'experiments/eff-01/run-dry') }))).exitCode).toBe(2);
    expect(fs.existsSync(path.join(REPO, 'experiments/eff-01/run-dry'))).toBe(false);
    expect((await runEff01(opts({ claude: '/usr/bin/claude' }))).exitCode).toBe(2);
    expect((await runEff01(opts({ configDir: '/tmp/x' }))).exitCode).toBe(2);
    expect((await runEff01(opts({ confirmSessions: 150 }))).exitCode).toBe(2);
  });
});

describe('EFF-01 live guard (T-GUARD)', () => {
  const planned = planSessions({ inputs: ins });
  if (!planned.success) throw new Error('plan');
  const prompts = sessionPrompts(REPO, ins, planned.data, false);
  if (!prompts.success) throw new Error('prompts');
  const stubPrompts = prompts.data;

  function live(
    over: Partial<DriverOptions> = {},
    behaviour?: StubBehaviour | ((id: string, c: Eff01Condition) => StubBehaviour),
    wrap: (r: ProcessRunner) => ProcessRunner = (r) => r,
    stubCliVersion?: string,
  ) {
    const factory = jest.fn((): ProcessRunner =>
      wrap(makeStubRunner(ins, stubPrompts, { fixtureTree: FIXTURE_TREE, model: 'claude-sonnet-5-5', ...(behaviour !== undefined ? { behaviour } : {}), ...(stubCliVersion !== undefined ? { cliVersion: stubCliVersion } : {}) })),
    );
    const config = tmpDir('config');
    const entry = path.join(tmpDir('dist'), 'main.js');
    fs.writeFileSync(entry, '// built server stand-in\n');
    const o = opts({
      live: true,
      blocks: ['calibration', 'pilot'],
      confirmSessions: 10,
      questionsSha256: ins.sha256.questions,
      claude: '/stub/claude',
      configDir: config,
      serverEntry: entry,
      runnerFactory: factory,
      ...over,
    });
    // The optional local check (design §6) on the fixture tree, which the stub exports for both repos.
    const fp = treeFingerprint(FIXTURE_TREE);
    fs.mkdirSync(o.out, { recursive: true });
    fs.writeFileSync(path.join(o.out, 'local-check.json'), JSON.stringify({ pass: true, trees: { 'event-sourcing-ddd': { fingerprint: fp }, 'ddd-forum': { fingerprint: fp } } }));
    return { o, factory };
  }

  it('exits 2 without spawning anything on a missing or wrong count or a wrong questions hash', async () => {
    for (const over of [{ confirmSessions: undefined }, { confirmSessions: 9 }, { questionsSha256: 'f'.repeat(64) }, { questionsSha256: undefined }] as Partial<DriverOptions>[]) {
      const { o, factory } = live(over);
      expect((await runEff01(o)).exitCode).toBe(2);
      expect(factory).not.toHaveBeenCalled();
    }
  });

  it('refuses --live --block all, the pilot with main, and main without a passing pilot gate', async () => {
    for (const over of [{ blocks: 'all', confirmSessions: 150 }, { blocks: ['pilot', 'main'], confirmSessions: 128 }, { blocks: ['main'], confirmSessions: 120 }] as Partial<DriverOptions>[]) {
      const { o, factory } = live(over);
      expect((await runEff01(o)).exitCode).toBe(2);
      expect(factory).not.toHaveBeenCalled();
    }
  });

  it('runs the live pilot (stub runner), writes the gate and exits; main then needs its own invocation', async () => {
    const { o, factory } = live();
    const r = await runEff01(o);
    expect(r.exitCode).toBe(0);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(records(o.out)).toHaveLength(10);
    expect(records(o.out).every((x) => !x.dryRun)).toBe(true);
    const main = await runEff01({ ...o, blocks: ['main'], confirmSessions: 120, clock: fakeClock(), sleep: zeroSleep() });
    expect(main.exitCode).toBe(0);
    expect(records(o.out)).toHaveLength(130);
  });

  it('stops (exit 1) when re-runs would exceed --confirm-sessions + --rerun-allowance', async () => {
    const { o } = live({ rerunAllowance: 2 }, (id) => (id.startsWith('pilot/') ? 'truncated' : 'key'));
    const r = await runEff01(o);
    expect(r.exitCode).toBe(1);
    expect(r.spawnBudgetUsed).toBe(12);
    expect(r.messages.some((m) => m.includes('spawn budget'))).toBe(true);
  });

  it('refuses a live run without a passing local check on the same trees (design §6)', async () => {
    const { o } = live();
    fs.writeFileSync(path.join(o.out, 'local-check.json'), JSON.stringify({ pass: true, trees: { 'ddd-forum': { fingerprint: 'other' } } }));
    const r = await runEff01(o);
    expect(r.exitCode).toBe(2);
    expect(records(o.out)).toHaveLength(0);
    fs.rmSync(path.join(o.out, 'local-check.json'));
    expect((await runEff01({ ...o, clock: fakeClock(), sleep: zeroSleep() })).exitCode).toBe(2);
  });

  /** Rewrites the ProcessResult of matching calls; everything else passes through. */
  const rewriting = (pick: (args: readonly string[], n: number) => boolean, edit: (r: ProcessResult) => ProcessResult) => (inner: ProcessRunner): ProcessRunner => {
    let n = 0;
    return {
      run: async (command, args, options) => {
        const r = await inner.run(command, args, options);
        if (!r.success || !pick(args, n++)) return r;
        return DomainResult.ok(edit(r.data));
      },
    } as ProcessRunner;
  };
  const isSession = (args: readonly string[]): boolean => args[0] === '-p' && args[1] !== 'Reply OK';

  it('DR-29: a claude --version that differs from the pin at start exits 2 and runs no session', async () => {
    const { o } = live({}, undefined, undefined, '9.9.9');
    const r = await runEff01(o);
    expect(r.exitCode).toBe(2);
    expect(r.messages.join('\n')).toContain('9.9.9');
    expect(records(o.out)).toHaveLength(0);
  });

  it('DR-29: a version change by the end marks every record of the invocation cliDrift: true', async () => {
    let versions = 0;
    const { o } = live({}, undefined, rewriting((args) => args[0] === '--version' && versions++ > 0, (p) => ({ ...p, stdout: '9.9.9 (Claude Code)\n' })));
    expect((await runEff01(o)).exitCode).toBe(0);
    const recs = records(o.out);
    expect(recs).toHaveLength(10);
    expect(recs.every((x) => (x as SessionRecord & { cliDrift?: boolean }).cliDrift === true)).toBe(true);
  });

  it('DR-25: a session that rejected --max-turns fails the pilot gate (exit 1)', async () => {
    const { o } = live({}, undefined, rewriting((args) => isSession(args), (p) => ({ ...p, stderr: "error: unknown option '--max-turns'\n" })));
    expect((await runEff01(o)).exitCode).toBe(1);
    const gate = JSON.parse(fs.readFileSync(path.join(o.out, 'pilot-gate.json'), 'utf8')) as { pass: boolean; maxTurnsRejected: string[] };
    expect(gate.pass).toBe(false);
    expect(gate.maxTurnsRejected.length).toBeGreaterThan(0);
  });

  it('DR-22: an is_error result that is not error_max_turns is completed with agentError: true', async () => {
    const target = 'pilot/ddd-forum/DF-Q02/R/run-1';
    const toError = (p: ProcessResult): ProcessResult => ({
      ...p,
      stdout: p.stdout.replace('"subtype":"success","is_error":false', '"subtype":"error_during_execution","is_error":true'),
    });
    const picked = live({}, undefined, (inner) => {
      const spec = planned.data.sessions.find((x) => x.sessionId === target);
      if (spec === undefined) throw new Error(target);
      const prompt = stubPrompts.promptOf(spec);
      return rewriting((args) => args[0] === '-p' && args[1] === prompt, toError)(inner);
    });
    expect((await runEff01(picked.o)).exitCode).toBeLessThan(2);
    const rec = readRecord(picked.o.out, target);
    expect(rec).toMatchObject({ status: 'completed', isError: true, agentError: true, resultSubtype: 'error_during_execution' });
  });

  it('a dry run with --behaviour is fine but --live refuses it', async () => {
    const { o, factory } = live({ behaviour: 'key' });
    expect((await runEff01(o)).exitCode).toBe(2);
    expect(factory).not.toHaveBeenCalled();
  });
});

describe('eff-01-run flags', () => {
  it('parses blocks, numbers and switches, and refuses unknown flags', () => {
    const p = parseRunFlags(['--block', 'calibration,pilot', '--runs', '2', '--no-n', '--lanes', '2', '--out', 'x', '--harness', '/h', '--clones', '/c'], '/cwd');
    expect(p.ok && p.options).toMatchObject({ blocks: ['calibration', 'pilot'], runs: 2, withN: false, lanes: 2, out: '/cwd/x', harness: '/h', live: false });
    expect(parseRunFlags(['--dry-run'], '/cwd').ok).toBe(false);
    expect(parseRunFlags(['--block', 'everything'], '/cwd').ok).toBe(false);
    expect(parseRunFlags(['--behaviour', 'explode'], '/cwd').ok).toBe(false);
  });
});
