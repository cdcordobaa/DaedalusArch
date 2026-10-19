/**
 * U5 Part B, plan and wiring: the `gemini` block (off by default), the regression that every committed loop plan
 * validates and schedules as before with the same adapters error text, the S4 guard refusing a live grid with ZERO
 * runner spawns (also with a Claude adapter listed first), the explicit Claude branch (`LOOP_ADAPTER_UNKNOWN`), and the
 * two stop codes ending the grid. Scripted runners only; no agy or claude process, no model call, no Neo4j.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import { agyGenConfigFromPlan, checkS4Result } from '../../../../scripts/lib/generators/agy-gen-plan.js';
import { GeminiStepAgent } from '../../../../scripts/lib/loop/agents.js';
import { liveAgentKind, main, prepareDryRunWorkDir, runLoopGrid } from '../../../../scripts/lib/loop/main.js';
import type { LoopMainDeps } from '../../../../scripts/lib/loop/main.js';
import { loadLoopPlan, loopRunId, scheduleLoopRuns, validatePlan, validateTasks } from '../../../../scripts/lib/loop/plan.js';
import { stubEvaluator, stubTypechecker } from '../../../../scripts/lib/loop/stub.js';

const REPO = process.cwd();
const MODEL = 'dry-run-gemini-model';

class CountingRunner implements ProcessRunner {
  readonly calls: { command: string; args: readonly string[] }[] = [];
  constructor(private readonly answer: (command: string, args: readonly string[], o: ProcessRunOptions) => ProcessResult = () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false, durationMs: 1 })) {}
  run(command: string, args: readonly string[], o: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    this.calls.push({ command, args });
    return Promise.resolve(DomainResult.ok(this.answer(command, args, o)));
  }
}

let tmp: string;
beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u5-plan-')));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function basePlan(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    description: 'test plan',
    tasksFile: path.join(REPO, 'experiments/loop-demo/demo-tasks.json'),
    adapters: [{ adapterId: 'agy-cli', modelId: MODEL, cliVersion: '0.0.0' }],
    arms: ['none'],
    runs: 1,
    orderSeed: 1,
    outRoot: path.join(tmp, 'out'),
    binary: path.join(tmp, 'bin', 'agy'),
    harnessRoot: path.join(tmp, 'h'),
    allowBash: true,
    evaluatorSpec: path.join(REPO, 'specs/clean-arch.yaml'),
    gemini: { enabled: true, cliVersion: '0.0.0', homes: { none: '<local>', 'daedalus-mcp': '<local>' } },
    ...over,
  };
}

const codes = (r: { success: boolean; errors?: readonly { message: string }[] }): string => (r.success ? '' : (r.errors ?? []).map((e) => e.message).join(' | '));

describe('the gemini block (off by default)', () => {
  it('agy-cli needs the block with enabled exactly true; the version pins must agree; the bounds hold', () => {
    expect(validatePlan(basePlan()).success).toBe(true);
    expect(codes(validatePlan(basePlan({ gemini: undefined })))).toMatch(/needs a gemini block/);
    expect(codes(validatePlan(basePlan({ gemini: { enabled: false, cliVersion: '0.0.0', homes: { none: '<local>', 'daedalus-mcp': '<local>' } } })))).toMatch(/off by default/);
    expect(codes(validatePlan(basePlan({ adapters: [{ adapterId: 'agy-cli', modelId: MODEL, cliVersion: '1.0.0' }] })))).toMatch(/differs from gemini\.cliVersion/);
    const g = (o: Record<string, unknown>) => basePlan({ gemini: { enabled: true, cliVersion: '0.0.0', homes: { none: '<local>', 'daedalus-mcp': '<local>' }, ...o } });
    expect(codes(validatePlan(g({ printTimeoutS: 1171 })))).toMatch(/printTimeoutS/);
    expect(codes(validatePlan(g({ s4Result: '/abs/s4.json' })))).toMatch(/repository-relative/);
    expect(codes(validatePlan(g({ extra: 1 })))).toMatch(/unknown keys/);
  });

  it('the adapters message names agy-cli only when a plan lists it', () => {
    const plain = basePlan({ adapters: [{ adapterId: 'nope', modelId: 'm' }], gemini: undefined });
    expect(codes(validatePlan(plain))).toContain('adapters must be [{ adapterId: claude-code-cli | codex-cli, modelId }]');
    const listed = basePlan({ adapters: [{ adapterId: 'agy-cli', modelId: MODEL }, { adapterId: 'nope', modelId: 'm' }] });
    expect(codes(validatePlan(listed))).toContain('claude-code-cli | codex-cli | agy-cli');
  });

  it('local homes come from the flags; a pinned home with a flag is refused', () => {
    const p = validatePlan(basePlan());
    if (!p.success) throw new Error('plan');
    const homes = { none: path.join(tmp, 'gn'), mcp: path.join(tmp, 'gm') };
    expect(agyGenConfigFromPlan(p.data, MODEL, REPO).success).toBe(false);
    const c = agyGenConfigFromPlan(p.data, MODEL, REPO, homes);
    expect(c.success ? c.data.homes : null).toEqual({ none: homes.none, 'daedalus-mcp': homes.mcp });
  });
});

describe('regression: every committed loop plan validates and schedules as before', () => {
  // The committed loop plans of the design (§3.6); there are no loop-plan*.json fixtures under tests/fixtures/.
  const PLANS = ['experiments/loop-demo/plan.dry-run.json', 'experiments/loop-pilot/plan.json', 'experiments/v1.3-floor-probe-3/plan.json', 'experiments/grid-scale/plan.json'];
  // sha256 of the newline-joined run ids, computed with the base commit's own plan.ts (6abc8f0a, before U5).
  const BASE_FINGERPRINTS: Readonly<Record<string, string>> = {
    'experiments/loop-demo/plan.dry-run.json': '8114e707026dc165ea5dd72dd1b503201ba9e8bb64630e52dfdf652045f9b73e',
    'experiments/loop-pilot/plan.json': '9c9a9ccd8be79228a972f098df532d52b4a3c4394a1ae400c8a16e311d63a696',
    'experiments/v1.3-floor-probe-3/plan.json': 'f3f2bc65402978f22431a6abf6077e90dc3900d2716cc8ebda4ba1631f2e06d3',
    // 2026-10-19 F23: recipe-box and gym-log replaced (sealed-list overlap), so the grid-scale schedule changed on purpose.
    'experiments/grid-scale/plan.json': '7cd106e5dca2005f1afd9ec6b59cbe8f582907a8874c6e60cf67b6ee9cba4584',
  };

  function planFiles(dir: string): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) out.push(...planFiles(rel));
      else if (/^plan.*\.json$/.test(e.name)) out.push(rel);
    }
    return out.sort();
  }

  it('the four named loop plans and every other loop plan of experiments/ still load, unchanged by validation', () => {
    const loaded = planFiles('experiments').filter((f) => loadLoopPlan(path.join(REPO, f), REPO).success);
    for (const f of PLANS) expect(loaded).toContain(f);
    for (const f of loaded) {
      const raw = JSON.parse(fs.readFileSync(path.join(REPO, f), 'utf8')) as Record<string, unknown>;
      const v = validatePlan(raw);
      expect(v.success).toBe(true);
      expect(v.success ? v.data : null).toBe(raw);
      expect(raw.gemini).toBeUndefined();
      const l = loadLoopPlan(path.join(REPO, f), REPO);
      if (!l.success) throw new Error(f);
      const ids = scheduleLoopRuns(l.data.plan, l.data.tasks.tasks).map(loopRunId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id) => !id.startsWith('agy-cli/'))).toBe(true);
    }
  });

  it('the schedules are byte-identical to the base commit (fingerprints taken on origin/main before U5)', () => {
    const fp = (f: string): string => {
      const l = loadLoopPlan(path.join(REPO, f), REPO);
      if (!l.success) throw new Error(f);
      return createHash('sha256').update(scheduleLoopRuns(l.data.plan, l.data.tasks.tasks).map(loopRunId).join('\n')).digest('hex');
    };
    expect(Object.fromEntries(PLANS.map((f) => [f, fp(f)]))).toEqual(BASE_FINGERPRINTS);
  });
});

describe('live wiring: the S4 guard and the explicit Claude branch', () => {
  function deps(runner: ProcessRunner, errs: string[]): LoopMainDeps {
    return {
      runner,
      clock: { now: () => 0 },
      sleep: () => Promise.resolve(),
      now: () => new Date(0),
      parentEnv: { PATH: '/bin' },
      out: () => undefined,
      err: (t) => {
        errs.push(t);
      },
      evaluateDeps: () => Promise.reject(new Error('never reached')),
    };
  }

  async function live(gemini: Record<string, unknown>, repoRoot = path.join(tmp, 'repo')): Promise<{ code: number; err: string; spawns: number }> {
    const plan = basePlan({ adapters: [{ adapterId: 'claude-code-cli', modelId: 'test-model-a' }, { adapterId: 'agy-cli', modelId: MODEL, cliVersion: '0.0.0' }], gemini: { enabled: true, cliVersion: '0.0.0', homes: { none: '<local>', 'daedalus-mcp': '<local>' }, ...gemini } });
    const file = path.join(tmp, 'plan.json');
    fs.writeFileSync(file, JSON.stringify(plan));
    const runner = new CountingRunner();
    const errs: string[] = [];
    const code = await main(['--plan', file, '--gemini-home-none', path.join(tmp, 'gn'), '--gemini-home-mcp', path.join(tmp, 'gm')], repoRoot, deps(runner, errs));
    return { code, err: errs.join(''), spawns: runner.calls.length };
  }

  function s4(name: string, body: Record<string, unknown>): string {
    fs.mkdirSync(path.join(tmp, 'repo', 'fx'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'repo', 'fx', name), JSON.stringify({ schema: 'agy-gen-s4/v1', cliVersion: '0.0.0', modelId: MODEL, arms: { none: 'pass' }, ...body }));
    return `fx/${name}`;
  }

  it('no s4Result, a fail verdict, another version or model, or the synthetic fixture: refused with zero spawns, Claude listed first', async () => {
    const cases: [Record<string, unknown>, string, string?][] = [
      [{}, 'LOOP_GEMINI_S4_MISSING'],
      [{ s4Result: s4('fail.json', { arms: { none: 'fail' } }) }, 'LOOP_GEMINI_S4_FAILED'],
      [{ s4Result: s4('version.json', { cliVersion: '9.9.9' }) }, 'LOOP_GEMINI_S4_MISMATCH'],
      [{ s4Result: s4('model.json', { modelId: 'other' }) }, 'LOOP_GEMINI_S4_MISMATCH'],
      [{ s4Result: 'tests/fixtures/agy-gen-cli/s4-result.synthetic.json' }, 'LOOP_GEMINI_S4_SYNTHETIC', REPO],
    ];
    for (const [g, code, root] of cases) {
      const r = await live(g, root ?? path.join(tmp, 'repo'));
      expect(r.code).toBe(2);
      expect(r.err).toContain(code);
      expect(r.spawns).toBe(0);
    }
  });

  it('a passing S4 result lets the guard through (the run then stops later, at the CLI probes)', () => {
    const p = validatePlan(basePlan({ gemini: { enabled: true, cliVersion: '0.0.0', homes: { none: '<local>', 'daedalus-mcp': '<local>' }, s4Result: s4('ok.json', {}) } }));
    if (!p.success) throw new Error('plan');
    expect(checkS4Result(path.join(tmp, 'repo'), p.data.gemini, MODEL, ['none', 'gate']).success).toBe(true);
    expect(checkS4Result(path.join(tmp, 'repo'), p.data.gemini, MODEL, ['daedalus-mcp']).success).toBe(false);
  });

  it('LOOP_ADAPTER_UNKNOWN: only the three ids get an agent, and agy-cli never gets the Claude agent', () => {
    expect(liveAgentKind('claude-code-cli')).toBe('claude');
    expect(liveAgentKind('codex-cli')).toBe('codex');
    expect(liveAgentKind('agy-cli')).toBe('gemini');
    expect(liveAgentKind('gemini-cli')).toBeNull();
  });
});

describe('the two stop codes end the grid', () => {
  async function grid(answer: (args: readonly string[], o: ProcessRunOptions) => ProcessResult): Promise<{ result: DomainResult<unknown>; calls: number }> {
    const H = path.join(tmp, 'h');
    const homes = { none: path.join(tmp, 'homes', 'none'), 'daedalus-mcp': path.join(tmp, 'homes', 'mcp') };
    for (const d of [H, ...Object.values(homes)]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
    for (const d of Object.values(homes)) fs.chmodSync(d, 0o700);
    const p = validatePlan(basePlan({ runs: 2, gemini: { enabled: true, cliVersion: '0.0.0', homes } }));
    if (!p.success) throw new Error(codes(p));
    const tasks = validateTasks(JSON.parse(fs.readFileSync(path.join(REPO, 'experiments/loop-demo/demo-tasks.json'), 'utf8')));
    if (!tasks.success) throw new Error('tasks');
    const c = agyGenConfigFromPlan(p.data, MODEL, REPO);
    if (!c.success) throw new Error(codes(c));
    // Design R3: the turn checks `agy --version` against the pin first; it is answered here and not counted as a call.
    const runner = new CountingRunner((_c, args, o) => (args[0] === '--version' ? { exitCode: 0, stdout: 'agy 0.0.0\n', stderr: '', timedOut: false, durationMs: 1 } : answer(args, o)));
    const agent = new GeminiStepAgent(c.data, { runner, parentEnv: { PATH: '/bin' }, sleep: () => Promise.resolve() });
    const result = await runLoopGrid(
      { plan: p.data, tasks: tasks.data, tasksPath: 'demo' },
      { agents: new Map([[`agy-cli/${MODEL}`, agent]]), evaluator: stubEvaluator(), typechecker: stubTypechecker(), prepareWorkDir: prepareDryRunWorkDir, skeletonIntact: () => true },
      { dryRun: true, now: () => new Date(0), planSha256: 'x', tasksSha256: 'x' },
    );
    return { result, calls: runner.calls.filter((c) => c.args[0] !== '--version').length };
  }

  it('LOOP_GEMINI_AUTH stops the grid after one call', async () => {
    const { result, calls } = await grid(() => ({ exitCode: 1, stdout: '', stderr: 'not logged in', timedOut: false, durationMs: 1 }));
    expect(result.success ? null : result.errors[0]?.code).toBe('LOOP_GEMINI_AUTH');
    expect(calls).toBe(1);
  });

  it('LOOP_GEMINI_TOOL_ESCAPE stops the grid after one call', async () => {
    const escape = fs.readFileSync(path.join(REPO, 'tests/fixtures/agy-gen-cli/stream-gen-tool-escape.ndjson'), 'utf8').replace(/dry-run-gemini-model/g, MODEL);
    const { result, calls } = await grid(() => ({ exitCode: 0, stdout: escape, stderr: '', timedOut: false, durationMs: 1 }));
    expect(result.success ? null : result.errors[0]?.code).toBe('LOOP_GEMINI_TOOL_ESCAPE');
    expect(calls).toBe(1);
  });
});
