/**
 * Snapshots (git store outside the work dir), the plan and tasks files, the seeded schedule, the evaluator mapping and
 * the CLI dry run. Made-up demo tasks only; no model, no Neo4j.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { WorkTreeSnapshots } from '../../../../scripts/lib/loop/snapshot.js';
import { LOCAL, loadLoopPlan, loopRunId, scheduleLoopRuns, validatePlan, validateTasks } from '../../../../scripts/lib/loop/plan.js';
import { toStepEvaluation } from '../../../../scripts/lib/loop/evaluator.js';
import { LOOP_SCHEDULE_JSON, LOOP_USAGE, main, parseLoopArgs } from '../../../../scripts/lib/loop/main.js';
import type { LoopMainDeps } from '../../../../scripts/lib/loop/main.js';
import { readStepRecords, runDirFor } from '../../../../scripts/lib/loop/loop.js';
import type { EvaluateProjectResult } from '../../../../src/mcp-server/types.js';
import { DEMO_TASK, steppingClock, tmpRoot } from './helpers.js';

const REPO = process.cwd();
const DEMO_PLAN = 'experiments/loop-demo/plan.dry-run.json';

let tmp: string;
beforeEach(() => {
  tmp = tmpRoot();
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('WorkTreeSnapshots', () => {
  function fresh(): WorkTreeSnapshots {
    const work = path.join(tmp, 'work');
    fs.mkdirSync(work, { recursive: true });
    fs.writeFileSync(path.join(work, 'package.json'), '{}\n');
    fs.mkdirSync(path.join(tmp, 'install', 'node_modules'), { recursive: true });
    fs.symlinkSync(path.join(tmp, 'install', 'node_modules'), path.join(work, 'node_modules'), 'dir');
    const s = new WorkTreeSnapshots(path.join(tmp, 'snapshots.git'), work);
    const init = s.init();
    if (!init.success) throw new Error(init.errors[0]?.message);
    return s;
  }

  it('commits outside the work tree, excludes node_modules and restores exactly', () => {
    const s = fresh();
    expect(s.exists()).toBe(true);
    const base = s.commit('base');
    if (!base.success) throw new Error('commit');
    expect(fs.existsSync(path.join(s.workTree, '.git'))).toBe(false);
    fs.mkdirSync(path.join(s.workTree, 'src'));
    fs.writeFileSync(path.join(s.workTree, 'src', 'a.ts'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(s.workTree, 'package.json'), '{"changed":true}\n');
    expect(s.changedCount()).toBe(2);
    const c1 = s.commit('one');
    if (!c1.success) throw new Error('commit');
    expect(s.changedCount()).toBe(0);
    const files = s.files(c1.data);
    expect(files.success && files.data).toEqual(['package.json', 'src/a.ts']);
    const diff = s.diff(base.data, c1.data);
    expect(diff.success && diff.data).toEqual({ added: 1, modified: 1, deleted: 0 });
    // An agent-written .gitignore does not hide files from the snapshot or from a restore.
    fs.writeFileSync(path.join(s.workTree, '.gitignore'), 'dist/\n');
    fs.mkdirSync(path.join(s.workTree, 'dist'));
    fs.writeFileSync(path.join(s.workTree, 'dist', 'out.js'), '1\n');
    expect(s.changedCount()).toBe(2);
    const c2 = s.commit('two');
    if (!c2.success) throw new Error('commit');
    const f2 = s.files(c2.data);
    expect(f2.success && f2.data).toContain('dist/out.js');
    // Restore to c1: tracked files reset, untracked (ignored or not) removed, node_modules kept.
    fs.writeFileSync(path.join(s.workTree, 'src', 'b.ts'), 'export {};\n');
    const r = s.restore(c1.data);
    expect(r.success).toBe(true);
    expect(fs.existsSync(path.join(s.workTree, 'dist'))).toBe(false);
    expect(fs.existsSync(path.join(s.workTree, '.gitignore'))).toBe(false);
    expect(fs.existsSync(path.join(s.workTree, 'src', 'b.ts'))).toBe(false);
    expect(fs.lstatSync(path.join(s.workTree, 'node_modules')).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(path.join(s.workTree, 'package.json'), 'utf8')).toBe('{"changed":true}\n');
    const head = s.head();
    expect(head.success && head.data).toBe(c1.data);
  });

  it('a git failure is a DomainResult failure', () => {
    const s = fresh();
    const r = s.restore('0'.repeat(40));
    expect(r.success ? [] : r.errors.map((e) => e.code)).toEqual(['LOOP_SNAPSHOT_GIT']);
  });
});

describe('plan and tasks files', () => {
  it('the shipped demo files are valid, marked demo-only, and need the local fields', () => {
    const missing = loadLoopPlan(path.join(REPO, DEMO_PLAN), REPO);
    expect(missing.success).toBe(true);
    const loaded = loadLoopPlan(path.join(REPO, DEMO_PLAN), REPO, { outRoot: tmp, binary: '/bin/false', harnessRoot: path.join(tmp, 'h') });
    if (!loaded.success) throw new Error(loaded.errors.map((e) => e.message).join('\n'));
    expect(loaded.data.plan.description).toMatch(/^DEMO ONLY/);
    expect(loaded.data.tasks.description).toMatch(/^DEMO ONLY/);
    expect(loaded.data.tasks.tasks.map((t) => [t.id, t.steps.length])).toEqual([['todo-list', 3]]);
    expect(loaded.data.plan.outRoot).toBe(tmp);
    const pinned = loadLoopPlan(path.join(REPO, DEMO_PLAN), REPO, { outRoot: tmp });
    expect(pinned.success).toBe(true);
    const raw = JSON.parse(fs.readFileSync(path.join(REPO, DEMO_PLAN), 'utf8')) as Record<string, unknown>;
    expect(raw.outRoot).toBe(LOCAL);
  });

  it('rejects bad tasks: empty steps, repeated or invalid ids, blank requests', () => {
    expect(validateTasks({ description: 'x', tasks: [] }).success).toBe(false);
    const bad = validateTasks({
      description: 'x',
      tasks: [
        { id: 'a', title: 'A', steps: [] },
        { id: 'a', title: 'A2', steps: [{ id: 's', request: 'go' }, { id: 's', request: 'again' }] },
        { id: 'B!', title: 'B', steps: [{ id: 's', request: '  ' }] },
      ],
    });
    // a: no steps; a: repeated id and repeated step id; B!: invalid id, blank request, so no steps left.
    expect(bad.success ? 0 : bad.errors.length).toBe(6);
    expect(validateTasks({ description: 'x', tasks: [DEMO_TASK] }).success).toBe(true);
  });

  it('rejects bad plans', () => {
    const ok = {
      description: 'd',
      tasksFile: 't.json',
      adapters: [{ adapterId: 'claude-code-cli', modelId: 'm' }],
      arms: ['none', 'gate'],
      runs: 2,
      orderSeed: 7,
      outRoot: '/o',
      binary: '/b',
      harnessRoot: '/h',
      allowBash: true,
      evaluatorSpec: 'specs/clean-arch.yaml',
    };
    expect(validatePlan(ok).success).toBe(true);
    const codes = (p: unknown): number => {
      const r = validatePlan(p);
      return r.success ? 0 : r.errors.length;
    };
    expect(codes({ ...ok, arms: ['none', 'none'] })).toBe(1);
    expect(codes({ ...ok, arms: ['context-graph'] })).toBe(1);
    expect(codes({ ...ok, arms: ['daedalus-mcp'] })).toBe(1);
    expect(codes({ ...ok, adapters: [{ adapterId: 'other', modelId: 'm' }] })).toBe(1);
    expect(codes({ ...ok, runs: 0, orderSeed: -1 })).toBe(2);
    expect(codes({ ...ok, cassette: { dir: 'c', mode: 'live' } })).toBe(1);
    expect(codes([])).toBe(1);
  });

  it('the schedule is seeded and blocked: every block holds every arm once, in a seed-dependent order', () => {
    const plan = { adapters: [{ adapterId: 'claude-code-cli' as const, modelId: 'm' }], arms: ['none', 'daedalus-mcp', 'gate'] as const, runs: 4, orderSeed: 11 };
    const tasks = [DEMO_TASK, { ...DEMO_TASK, id: 'notes' }];
    const a = scheduleLoopRuns(plan, tasks);
    expect(a).toHaveLength(4 * 2 * 3);
    expect(scheduleLoopRuns(plan, tasks)).toEqual(a);
    for (let b = 0; b < a.length; b += 3) {
      const block = a.slice(b, b + 3);
      expect(new Set(block.map((s) => `${s.taskId}/${String(s.runIndex)}`)).size).toBe(1);
      expect(block.map((s) => s.arm).sort()).toEqual(['daedalus-mcp', 'gate', 'none']);
    }
    const orders = new Set(a.map((_s, i) => (i % 3 === 0 ? a.slice(i, i + 3).map((x) => x.arm).join(',') : '')).filter((x) => x !== ''));
    expect(orders.size).toBeGreaterThan(1);
    expect(scheduleLoopRuns({ ...plan, orderSeed: 12 }, tasks)).not.toEqual(a);
    expect(loopRunId(a[0] ?? { adapterId: 'claude-code-cli', modelId: '', taskId: '', arm: 'none', runIndex: 0 })).toMatch(/^claude-code-cli\/m\/todo-list\/(none|daedalus-mcp|gate)\/run-0$/);
  });
});

describe('evaluator mapping (v1.3 scoring)', () => {
  it('keeps the counted blocking findings only and fails without tiers or violations', () => {
    const row = (id: string, tier: 'blocking' | 'advisory', n: number): Record<string, unknown> => ({ functionId: id, name: id, dimension: 'structural', tier, tierSource: 'table', violationCount: n, violated: n > 0 });
    const result = {
      projectPath: '/p',
      specPath: '/s',
      evaluationMode: 'symbolic-only',
      ahs: 0.8,
      verdict: 'warning',
      violationCount: 3,
      byRule: [
        { ruleId: 'FF-S01', ruleName: 'layers', count: 2, truncated: false, violations: [{ filePath: 'src/domain/a.ts', line: 3, target: 'src/infra/x.ts', message: 'm1', severity: 'high' }, { filePath: 'src/domain/b.ts', message: 'm2', severity: 'high' }] },
        { ruleId: 'FF-CV05', ruleName: 'tests', count: 1, truncated: false, violations: [{ filePath: 'src/a.ts', message: 'm3', severity: 'low' }] },
      ],
      durationMs: 12,
      scoringMode: 'v1.3',
      tiers: {
        scoringMode: 'v1.3',
        tierTable: 't',
        style: 'clean-architecture',
        verdict: 'fail',
        verdictRule: 'any-blocking-violation',
        v12eVerdict: 'warning',
        blockingAhs: 0.7,
        blocking: { rules: [row('FF-S01', 'blocking', 2), row('FF-S04', 'blocking', 0)], violatedRules: 1, violationCount: 2 },
        advisory: { rules: [row('FF-CV05', 'advisory', 1)], violatedRules: 1, violationCount: 1 },
        notApplicable: [],
        blockingNotExecuted: [],
      },
    } as unknown as EvaluateProjectResult;
    // The report's violations (the live evaluator asks for them): every counted blocking row, uncapped, with its
    // template and id, and the violations handed on for the loop to write beside the turn.
    const violations = [
      { id: 'v2', type: 'LAYER_VIOLATION', functionId: 'FF-S01', route: 'symbolic', filePath: 'src/domain/b.ts', message: 'm2' },
      { id: 'v3', type: 'MISSING_TEST', functionId: 'FF-CV05', route: 'symbolic', filePath: 'src/a.ts', message: 'm3' },
      { id: 'v1', type: 'CUSTOM_core-isolation', functionId: 'FF-S01', route: 'symbolic', filePath: 'src/domain/a.ts', line: 3, target: 'src/infra/x.ts', message: 'm1' },
    ];
    const full = toStepEvaluation({ ...result, violations } as unknown as EvaluateProjectResult);
    if (!full.success) throw new Error('mapping failed');
    expect(full.data).toEqual({
      scoringMode: 'v1.3',
      ahs: 0.8,
      blockingAhs: 0.7,
      verdict: 'fail',
      violationCount: 3,
      blockingViolationCount: 2,
      advisoryViolationCount: 1,
      blockingByRule: { 'FF-S01': 2 },
      advisoryByRule: { 'FF-CV05': 1 },
      blockingFindings: [
        { ruleId: 'FF-S01', ruleName: 'layers', template: 'dependency-direction', violationId: 'v2', filePath: 'src/domain/b.ts', message: 'm2' },
        { ruleId: 'FF-S01', ruleName: 'layers', template: 'core-isolation', violationId: 'v1', filePath: 'src/domain/a.ts', line: 3, target: 'src/infra/x.ts', message: 'm1' },
      ],
      durationMs: 12,
      reportViolations: violations,
    });
    expect(full.data.reportViolations).toBe(violations);
    // Without the violations (a capped per-rule listing) the counted rows cannot be told apart: no evaluation.
    const capped = toStepEvaluation(result);
    expect(capped.success ? [] : capped.errors.map((e) => e.code)).toEqual(['LOOP_EVAL_NO_VIOLATIONS']);
    const { tiers: _drop, ...noTiers } = result;
    const fail = toStepEvaluation(noTiers);
    expect(fail.success ? [] : fail.errors.map((e) => e.code)).toEqual(['LOOP_EVAL_NO_TIERS']);
  });
});

describe('CLI (--dry-run)', () => {
  function deps(): LoopMainDeps & { stdout: string[]; stderr: string[] } {
    const stdout: string[] = [];
    const stderr: string[] = [];
    return {
      stdout,
      stderr,
      runner: { run: () => Promise.reject(new Error('the dry run spawns nothing')) },
      clock: { now: () => 0 },
      sleep: () => Promise.resolve(),
      now: steppingClock(),
      parentEnv: {},
      out: (t) => stdout.push(t),
      err: (t) => stderr.push(t),
    };
  }

  it('runs the demo grid with the stubs, resumes as a no-op, and refuses a different plan on the same outRoot', async () => {
    const outRoot = path.join(tmp, 'out');
    const argv = ['--plan', DEMO_PLAN, '--dry-run', '--out-root', outRoot, '--binary', '/bin/false', '--harness-root', path.join(tmp, 'h')];
    const d1 = deps();
    expect(await main(argv, REPO, d1)).toBe(0);
    expect(d1.stdout.join('')).toContain('"completed": 3');
    const schedule = JSON.parse(fs.readFileSync(path.join(outRoot, LOOP_SCHEDULE_JSON), 'utf8')) as { runs: string[]; dryRun: boolean };
    expect(schedule.dryRun).toBe(true);
    expect([...schedule.runs].sort()).toEqual(['daedalus-mcp', 'gate', 'none'].map((a) => `claude-code-cli/stub-model/todo-list/${a}/run-0`));
    for (const id of schedule.runs) expect(readStepRecords(runDirFor(outRoot, id), 3)).toHaveLength(3);

    const d2 = deps();
    expect(await main(argv, REPO, d2)).toBe(0);
    expect(d2.stdout.join('')).toContain('"skipped": 3');

    const other = path.join(tmp, 'other-plan.json');
    const raw = JSON.parse(fs.readFileSync(path.join(REPO, DEMO_PLAN), 'utf8')) as Record<string, unknown>;
    fs.writeFileSync(other, JSON.stringify({ ...raw, orderSeed: 1 }));
    const d3 = deps();
    expect(await main(['--plan', other, ...argv.slice(2)], REPO, d3)).toBe(2);
    expect(d3.stderr.join('')).toContain('LOOP_SCHEDULE_MISMATCH');
  });

  it('--help prints usage; a missing --plan or an unknown flag exits 2', async () => {
    const d = deps();
    expect(await main(['--help'], REPO, d)).toBe(0);
    expect(d.stdout.join('')).toBe(LOOP_USAGE);
    expect(await main([], REPO, deps())).toBe(2);
    expect(await main(['--plan', DEMO_PLAN, '--bogus'], REPO, deps())).toBe(2);
    const parsed = parseLoopArgs(['--plan', 'p.json', '--codex-home', '/c', '--codex-user-home', '/u']);
    expect(parsed.success && parsed.data.codexHomes).toEqual({ codexHome: '/c', userHome: '/u' });
  });
});
