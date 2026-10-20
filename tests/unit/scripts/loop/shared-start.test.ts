/**
 * Shared step-1 start (U13, `scripts/lib/loop/shared-start.ts`): a dry-run Stage A with the committed Stage A plan, then
 * dry-run Stage B grids from the `experiments/exploratory-study/stage-b/` templates branching from it at step 2. Checks
 * the step-1 snapshots are the source's, the step numbering, the run.json provenance, the frames, resume and every
 * refusal; and, at the loop level, that identities inherited from step 1 never count as new. Stubs only: no model.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  RESTARTS_LOG,
  RUN_JSON,
  readStepRecords,
  runDirFor,
  runLoop,
  stepRecordPath,
} from '../../../../scripts/lib/loop/loop.js';
import type { TaskProfile } from '../../../../scripts/lib/loop/loop.js';
import { LOOP_SCHEDULE_JSON, main, sharedStartContext } from '../../../../scripts/lib/loop/main.js';
import type { LoopMainDeps } from '../../../../scripts/lib/loop/main.js';
import {
  loadLoopPlan,
  loopRunId,
  planCallBudget,
  scheduleLoopRuns,
  validatePlan,
} from '../../../../scripts/lib/loop/plan.js';
import { runOutcomes } from '../../../../scripts/lib/loop/pilot-metrics.js';
import { parseCell } from '../../../../scripts/lib/loop/shared-start.js';
import { SNAPSHOT_GIT_DIR } from '../../../../scripts/lib/loop/snapshot.js';
import { demoStubScript, stubEvaluator } from '../../../../scripts/lib/loop/stub.js';
import { styleFrame } from '../../../../scripts/lib/loop/style.js';
import type { RunRecord, StepRecord } from '../../../../scripts/lib/loop/types.js';
import { DEMO_TASK, context, spec, steppingClock, stubAgent, tmpRoot } from './helpers.js';

const REPO = path.resolve(__dirname, '../../../..');
const STAGE_A_PLAN = 'experiments/exploratory-study/stage-a/plan.json';
const STAGE_B = 'experiments/exploratory-study/stage-b';
const TASKS = ['ice-rink', 'youth-league', 'hive-health'];
const MODEL = 'claude-code-cli/claude-sonnet-5-5';

let tmp: string;
beforeEach(() => {
  tmp = tmpRoot('shared-start-');
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

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

async function grid(
  plan: string,
  outRoot: string,
  from: readonly string[] = [],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const d = deps();
  const argv = [
    '--plan',
    plan,
    '--dry-run',
    '--out-root',
    outRoot,
    '--binary',
    '/bin/false',
    '--harness-root',
    path.join(tmp, 'h'),
    ...from.flatMap((f) => ['--shared-start-from', f]),
  ];
  const code = await main(argv, REPO, d);
  return { code, stdout: d.stdout.join(''), stderr: d.stderr.join('') };
}

function git(gitDir: string, args: readonly string[]): string {
  const r = spawnSync('git', [`--git-dir=${gitDir}`, ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

function runIdOf(task: string, arm: string, r: number): string {
  return `${MODEL}/${task}/${arm}/run-${String(r)}`;
}

/** Every file under a directory with its sha256 (to show a source grid is left untouched). */
function treeHash(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile())
        out[path.relative(dir, p)] = createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  };
  walk(dir);
  return out;
}

describe('Stage A then Stage B (dry run, the committed plan and the stage-b templates)', () => {
  let A: string;
  let B: string;
  beforeEach(async () => {
    A = path.join(tmp, 'stage-a');
    B = path.join(tmp, 'rep2');
    const a = await grid(STAGE_A_PLAN, A);
    expect(a.stderr).toBe('');
    expect(a.code).toBe(0);
    const b = await grid(`${STAGE_B}/plan-none-L2-rep2.template.json`, B);
    expect(b.stderr).toBe('');
    expect(b.code).toBe(0);
  });

  it('replicate 2 of none@L2 runs run index 1 alone, steps 1..5', () => {
    const schedule = readJson(path.join(B, LOOP_SCHEDULE_JSON)) as { runs: string[] };
    expect(schedule.runs).toEqual(TASKS.map((t) => runIdOf(t, 'none', 1)));
    for (const t of TASKS) {
      const recs = readStepRecords(runDirFor(B, runIdOf(t, 'none', 1)), 5);
      expect(recs.map((r) => r.stepIndex)).toEqual([0, 1, 2, 3, 4]);
      expect(recs.every((r) => r.inherited === undefined)).toBe(true);
    }
  });

  const cells: readonly (readonly [file: string, arm: string, rung: string])[] = [
    ['plan-none-L3.template.json', 'none', 'L3'],
    ['plan-mcp-L2.template.json', 'daedalus-mcp', 'L2'],
  ];
  for (const [file, arm, rung] of cells)
    it(`${file} branches every block at step 2 from its none@L2 step-1 tree`, async () => {
      const C = path.join(tmp, 'cell');
      const before = { A: treeHash(A), B: treeHash(B) };
      const c = await grid(`${STAGE_B}/${file}`, C, [A, B]);
      expect(c.stderr).toBe('');
      expect(c.code).toBe(0);
      // 3 tasks x 2 replicates x steps 2..5: no step-1 turn is drawn.
      expect(c.stdout).toContain('"step": 24');
      expect(c.stdout).toContain('"stepTurns": 24');
      for (const [r, src] of [
        [0, A],
        [1, B],
      ] as const) {
        for (const t of TASKS) {
          const id = runIdOf(t, arm, r);
          const dir = runDirFor(C, id);
          const srcDir = runDirFor(src, runIdOf(t, 'none', r));
          const srcRun = readJson(path.join(srcDir, RUN_JSON)) as RunRecord;
          const srcStep1 = readJson(stepRecordPath(srcDir, 0)) as StepRecord;
          const run = readJson(path.join(dir, RUN_JSON)) as RunRecord;
          // Provenance: the source run, its commits, the record hash, the tasks and spec hashes; no absolute path.
          expect(run.sharedStart).toEqual({
            fromCell: 'none@L2',
            step: 1,
            sourceRunId: runIdOf(t, 'none', r),
            sourceCommit: srcStep1.finalCommit,
            sourceBaseCommit: srcRun.baseCommit,
            sourceStepRecordSha256: createHash('sha256')
              .update(fs.readFileSync(stepRecordPath(srcDir, 0)))
              .digest('hex'),
            tasksSha256: (readJson(path.join(A, LOOP_SCHEDULE_JSON)) as { tasksSha256: string })
              .tasksSha256,
            specSha256: srcStep1.evaluatorSpec?.sha256,
          });
          expect(JSON.stringify(run.sharedStart)).not.toContain(tmp);
          expect(run.baseCommit).toBe(srcRun.baseCommit);
          expect(run.frame).toEqual({ specRung: rung, attention: true });
          expect(run.completedAt).toBeDefined();
          // Step numbering: step 1 inherited, steps 2..5 drawn here.
          const recs = readStepRecords(dir, 5);
          expect(recs.map((s) => s.stepIndex)).toEqual([0, 1, 2, 3, 4]);
          expect(recs.map((s) => s.stepId)).toEqual(
            readStepRecords(srcDir, 5).map((s) => s.stepId),
          );
          const [s1, s2] = recs;
          expect(s1?.inherited).toEqual({
            sourceRunId: runIdOf(t, 'none', r),
            sourceSpec: srcStep1.spec,
            sourceStepRecordSha256: run.sharedStart?.sourceStepRecordSha256,
          });
          expect({
            ...s1,
            runId: srcStep1.runId,
            spec: srcStep1.spec,
            inherited: undefined,
          }).toEqual({ ...srcStep1, inherited: undefined });
          expect(s1?.runId).toBe(id);
          expect(s1?.spec.arm).toBe(arm);
          expect(recs.slice(1).every((s) => s.inherited === undefined && s.spec.arm === arm)).toBe(
            true,
          );
          // Snapshots: the step-1 commit is the source's, tree for tree, and step 2 is its child.
          const gitDir = path.join(dir, SNAPSHOT_GIT_DIR);
          const srcGit = path.join(srcDir, SNAPSHOT_GIT_DIR);
          expect(git(gitDir, ['ls-tree', '-r', srcStep1.finalCommit])).toBe(
            git(srcGit, ['ls-tree', '-r', srcStep1.finalCommit]),
          );
          expect(git(gitDir, ['rev-parse', `${s2?.finalCommit ?? ''}^`]).trim()).toBe(
            srcStep1.finalCommit,
          );
          expect(s2?.turns[0]?.snapshot.diff.added).toBeGreaterThan(0);
          // The step-1 history is the source's (prompt and envelope copied); step 2 has its own prompt.
          expect(
            fs.readFileSync(path.join(dir, 'turns', 'step-01', 'prompt-step-01.txt'), 'utf8'),
          ).toBe(
            fs.readFileSync(path.join(srcDir, 'turns', 'step-01', 'prompt-step-01.txt'), 'utf8'),
          );
          expect(fs.existsSync(path.join(dir, 'turns', 'step-02', 'prompt-step-02.txt'))).toBe(
            true,
          );
        }
      }
      // The source grids are never written.
      expect(treeHash(A)).toEqual(before.A);
      expect(treeHash(B)).toEqual(before.B);

      // The step-2 frame is the one a run of the same cell drawn from step 1 sees.
      const plain = path.join(tmp, 'plain-plan.json');
      const raw = readJson(path.join(REPO, STAGE_B, file)) as Record<string, unknown>;
      const { sharedStart: _drop, callBudget: _budget, ...rest } = raw;
      fs.writeFileSync(plain, JSON.stringify(rest));
      const P = path.join(tmp, 'plain');
      expect((await grid(plain, P)).code).toBe(0);
      for (const t of TASKS) {
        for (const r of [0, 1]) {
          const id = runIdOf(t, arm, r);
          for (const n of ['02', '03', '05']) {
            const f = (root: string): string =>
              fs.readFileSync(
                path.join(runDirFor(root, id), 'turns', `step-${n}`, `prompt-step-${n}.txt`),
                'utf8',
              );
            expect(f(C)).toBe(f(P));
          }
        }
      }

      // Resume: a complete grid is skipped; a run stopped after step 3 redraws only steps 4..5.
      const again = await grid(`${STAGE_B}/${file}`, C, [A, B]);
      expect(again.code).toBe(0);
      expect(again.stdout).toContain('"skipped": 6');
      const id = runIdOf('youth-league', arm, 1);
      const dir = runDirFor(C, id);
      const run = readJson(path.join(dir, RUN_JSON)) as RunRecord;
      const { completedAt: _done, ...open } = run;
      fs.writeFileSync(path.join(dir, RUN_JSON), JSON.stringify(open));
      const step1 = fs.readFileSync(stepRecordPath(dir, 0), 'utf8');
      fs.rmSync(stepRecordPath(dir, 3));
      fs.rmSync(stepRecordPath(dir, 4));
      fs.writeFileSync(path.join(dir, 'work', 'stray.txt'), 'partial step 4\n');
      const resumed = await grid(`${STAGE_B}/${file}`, C, [A, B]);
      expect(resumed.stderr).toBe('');
      expect(resumed.code).toBe(0);
      expect(resumed.stdout).toContain('"step": 2');
      expect(fs.readFileSync(stepRecordPath(dir, 0), 'utf8')).toBe(step1);
      expect(readStepRecords(dir, 5)).toHaveLength(5);
      const lines = fs.readFileSync(path.join(dir, RESTARTS_LOG), 'utf8').trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({ reason: 'redraw', resumeAtStep: 4 });
    });

  describe('refusals (no run directory is created)', () => {
    const L3 = `${STAGE_B}/plan-none-L3.template.json`;

    /** The first scheduled run (ice-rink, replicate 1) is the one refused, so nothing is created. */
    async function refused(from: readonly string[], firstRunRefused = true): Promise<string> {
      const C = path.join(tmp, `refused-${String(Math.random()).slice(2)}`);
      const r = await grid(L3, C, from);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('LOOP_SHARED_START_SOURCE');
      if (firstRunRefused) expect(fs.existsSync(path.join(C, 'runs'))).toBe(false);
      return r.stderr;
    }

    function copyOf(src: string, name: string): string {
      const dst = path.join(tmp, name);
      fs.cpSync(src, dst, { recursive: true, verbatimSymlinks: true });
      return dst;
    }

    it('a missing source grid or source run', async () => {
      const empty = path.join(tmp, 'empty');
      fs.mkdirSync(empty);
      expect(await refused([empty, B])).toContain('schedule.json');
      const noRun = copyOf(A, 'no-run');
      fs.rmSync(runDirFor(noRun, runIdOf('ice-rink', 'none', 0)), { recursive: true });
      expect(await refused([noRun, B])).toContain('the source run is missing');
      // Replicate 2 has no source in the Stage A grid (it holds run index 0 only).
      expect(await refused([A, A], false)).toContain('run-1: the source run is missing');
    });

    it('a missing step-1 record or commit', async () => {
      const noStep = copyOf(A, 'no-step');
      fs.rmSync(stepRecordPath(runDirFor(noStep, runIdOf('ice-rink', 'none', 0)), 0));
      expect(await refused([noStep, B])).toContain('no step-1 record');
      const noCommit = copyOf(A, 'no-commit');
      const f = stepRecordPath(runDirFor(noCommit, runIdOf('ice-rink', 'none', 0)), 0);
      fs.writeFileSync(
        f,
        JSON.stringify({ ...(readJson(f) as StepRecord), finalCommit: '0'.repeat(40) }),
      );
      expect(await refused([noCommit, B])).toContain(
        `commit ${'0'.repeat(40)} is not in the source snapshots.git`,
      );
      const noStore = copyOf(A, 'no-store');
      fs.rmSync(path.join(runDirFor(noStore, runIdOf('ice-rink', 'none', 0)), SNAPSHOT_GIT_DIR), {
        recursive: true,
      });
      expect(await refused([noStore, B])).toContain('is not in the source snapshots.git');
    });

    it('a tasks or spec hash that differs', async () => {
      const tasks = copyOf(A, 'tasks');
      const sf = path.join(tasks, LOOP_SCHEDULE_JSON);
      fs.writeFileSync(
        sf,
        JSON.stringify({
          ...(readJson(sf) as Record<string, unknown>),
          tasksSha256: 'f'.repeat(64),
        }),
      );
      expect(await refused([tasks, B])).toContain('tasks sha256');
      const specs = copyOf(A, 'specs');
      const f = stepRecordPath(runDirFor(specs, runIdOf('ice-rink', 'none', 0)), 0);
      const rec = readJson(f) as StepRecord;
      fs.writeFileSync(
        f,
        JSON.stringify({ ...rec, evaluatorSpec: { ...rec.evaluatorSpec, sha256: 'e'.repeat(64) } }),
      );
      expect(await refused([specs, B])).toContain('spec sha256');
    });

    it('a source of another cell, or a live source for a dry run', async () => {
      const rung = copyOf(A, 'rung');
      const rf = path.join(runDirFor(rung, runIdOf('ice-rink', 'none', 0)), RUN_JSON);
      fs.writeFileSync(
        rf,
        JSON.stringify({
          ...(readJson(rf) as RunRecord),
          frame: { specRung: 'L3', attention: true },
        }),
      );
      expect(await refused([rung, B])).toContain('the source ran at L3');
      const live = copyOf(A, 'live');
      const lf = path.join(runDirFor(live, runIdOf('ice-rink', 'none', 0)), RUN_JSON);
      fs.writeFileSync(lf, JSON.stringify({ ...(readJson(lf) as RunRecord), dryRun: false }));
      expect(await refused([live, B])).toContain('a live run');
    });

    it('a resume with another source, or a run whose inherited step 1 is gone', async () => {
      const C = path.join(tmp, 'cell');
      expect((await grid(L3, C, [A, B])).code).toBe(0);
      const dir = runDirFor(C, runIdOf('ice-rink', 'none', 0));
      const rf = path.join(dir, RUN_JSON);
      const run = readJson(rf) as RunRecord;
      const { completedAt: _c, ...open } = run;
      fs.writeFileSync(
        rf,
        JSON.stringify({ ...open, sharedStart: { ...run.sharedStart, sourceRunId: 'elsewhere' } }),
      );
      let r = await grid(L3, C, [A, B]);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('LOOP_SHARED_START_MISMATCH');
      fs.writeFileSync(rf, JSON.stringify(open));
      fs.rmSync(stepRecordPath(dir, 0));
      r = await grid(L3, C, [A, B]);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('LOOP_SHARED_START_BROKEN');
    });

    it('an out-root inside a source out-root, or a wrong number of --shared-start-from', async () => {
      const inside = await grid(L3, path.join(A, 'stage-b'), [A, B]);
      expect(inside.code).toBe(2);
      expect(inside.stderr).toContain('outside sharedStart.fromOutRoot');
      const one = await grid(L3, path.join(tmp, 'c1'), [A]);
      expect(one.code).toBe(2);
      expect(one.stderr).toContain('--shared-start-from given 1 time(s)');
    });
  });
});

describe('plan rules', () => {
  const base = readJson(path.join(REPO, STAGE_B, 'plan-none-L3.template.json')) as Record<
    string,
    unknown
  >;
  const ss = { fromOutRoot: ['/a', '/b'], fromCell: 'none@L2', step: 1 };
  const filled: Record<string, unknown> = {
    ...base,
    outRoot: '/o',
    binary: '/b',
    harnessRoot: '/h',
    sharedStart: ss,
  };
  const codes = (raw: unknown): string[] => {
    const v = validatePlan(raw);
    return v.success ? [] : v.errors.map((e) => e.message);
  };

  it('accepts the template once filled, and refuses malformed blocks', () => {
    expect(codes(filled)).toEqual([]);
    expect(codes({ ...filled, sharedStart: { ...ss, step: 2 } }).join()).toContain(
      'step must be 1',
    );
    expect(
      codes({ ...filled, sharedStart: { ...ss, fromCell: 'none-L2' } }).join(),
    ).toContain('fromCell');
    expect(
      codes({ ...filled, sharedStart: { ...ss, fromOutRoot: 'relative' } }).join(),
    ).toContain('absolute');
    expect(
      codes({ ...filled, sharedStart: { ...ss, fromOutRoot: ['/a'] } }).join(),
    ).toContain('run index 1');
    expect(codes({ ...filled, frame: { specRung: 'L4', attention: true } }).join()).toContain('L4');
    const { taskProfiles: _p, ...noProfiles } = filled;
    expect(codes({ ...noProfiles, evaluatorSpec: 'presets/layered.yaml' }).join()).toContain(
      'static taskProfiles',
    );
    expect(codes({ ...filled, firstRun: -1 }).join()).toContain('firstRun');
  });

  it('parses cells, and builds no context without sharedStart', () => {
    expect(parseCell('none@L2')).toEqual({ arm: 'none', rung: 'L2' });
    expect(parseCell('mcp@L2')).toEqual({ arm: 'daedalus-mcp', rung: 'L2' });
    expect(parseCell('nope@L2')).toBeUndefined();
    expect(sharedStartContext({}, 'x')).toBeUndefined();
    expect(
      sharedStartContext(
        { sharedStart: { fromOutRoot: ['/a', '/b'], fromCell: 'none@L2', step: 1 } },
        'x',
      )?.fromOutRootFor(1),
    ).toBe('/b');
  });

  it('counts steps 2..k in the budget, and firstRun keeps the arm order of the longer plan', () => {
    const tasks = [DEMO_TASK];
    const plan = {
      adapters: [{ adapterId: 'claude-code-cli' as const, modelId: 'm' }],
      arms: ['none', 'gate'] as const,
      runs: 2,
      orderSeed: 7,
    };
    expect(planCallBudget({ ...plan, arms: [...plan.arms] }, tasks).stepTurns).toBe(12);
    expect(
      planCallBudget(
        {
          ...plan,
          arms: [...plan.arms],
          sharedStart: { fromOutRoot: '/a', fromCell: 'none@L2', step: 1 },
        },
        tasks,
      ),
    ).toEqual({ runs: 4, stepTurns: 8, maxRepairTurns: 4, maxCalls: 12 });
    const long = scheduleLoopRuns({ ...plan, arms: [...plan.arms], runs: 3 }, tasks);
    const tail = scheduleLoopRuns({ ...plan, arms: [...plan.arms], firstRun: 1 }, tasks);
    expect(tail).toEqual(long.filter((s) => s.runIndex >= 1));
  });

  it('the Stage B templates load filled, with the budget they imply (15 + 24 + 24 calls)', () => {
    const local = {
      binary: '/opt/claude/bin/claude',
      harnessRoot: '/tmp/explore-h',
      outRoot: '/tmp/explore-b',
    };
    const budgets = (
      [
        ['plan-none-L2-rep2.template.json', []],
        ['plan-none-L3.template.json', ['/tmp/explore-a', '/tmp/explore-r2']],
        ['plan-mcp-L2.template.json', ['/tmp/explore-a', '/tmp/explore-r2']],
      ] as const
    ).map(([file, from]) => {
      const l = loadLoopPlan(path.join(REPO, STAGE_B, file), REPO, {
        ...local,
        sharedStartFrom: from,
      });
      if (!l.success) throw new Error(l.errors.map((e) => e.message).join('; '));
      expect(l.data.plan.adapters).toEqual([
        { adapterId: 'claude-code-cli', modelId: 'claude-sonnet-5-5', cliVersion: '2.1.304' },
      ]);
      expect(l.data.plan.generatorIsolation).toBeUndefined();
      expect(l.data.tasks.tasks.map((t) => t.id)).toEqual(TASKS);
      expect(l.data.plan.callBudget).toEqual(planCallBudget(l.data.plan, l.data.tasks.tasks));
      return l.data.plan.callBudget?.maxCalls;
    });
    expect(budgets).toEqual([15, 24, 24]);
  });

  it("the committed Stage A step-1 records match today's tasks file and spec (Stage B would not be refused on hashes)", () => {
    const schedule = readJson(
      path.join(REPO, 'results/v1.4-exploratory/stage-a/schedule.json'),
    ) as { tasksSha256: string };
    const sha = (f: string): string =>
      createHash('sha256')
        .update(fs.readFileSync(path.join(REPO, f)))
        .digest('hex');
    expect(sha('experiments/exploratory-study/stage-a/tasks.json')).toBe(schedule.tasksSha256);
    for (const t of TASKS) {
      const s1 = readJson(
        path.join(REPO, 'results/v1.4-exploratory/stage-a', t, 'steps', 'step-01.json'),
      ) as StepRecord;
      expect(s1.evaluatorSpec?.sha256).toBe(sha('presets/layered.yaml'));
      expect(s1.runId).toBe(runIdOf(t, 'none', 0));
    }
  });
});

describe('identities inherited from step 1 never count as new (loop level)', () => {
  it('a step-1 finding kept at step 2 is not new; a finding first seen at step 2 is', async () => {
    const A = path.join(tmp, 'a');
    const C = path.join(tmp, 'c');
    // The source plants one violation at step 1 (the demo stub plants one at step 2 on its own).
    const planted = stubAgent({
      script: (input, task) => ({
        ...demoStubScript(input, task),
        ...(input.kind === 'step' && input.stepIndex === 0
          ? {
              'src/infrastructure/legacy-store.ts': 'export class LegacyStore {}\n',
              'src/domain/legacy.ts':
                "import { LegacyStore } from '../infrastructure/legacy-store';\nexport const s = new LegacyStore();\n",
            }
          : {}),
      }),
    });
    const profile: TaskProfile = {
      frame: styleFrame(REPO, 'clean'),
      evaluation: {
        kind: 'static',
        specPath: 'presets/clean.yaml',
        specSha256: 'a'.repeat(64),
        evaluator: stubEvaluator(),
      },
    };
    const profiles = new Map([[DEMO_TASK.id, profile]]);
    const src = await runLoop(context(A, planted, { profiles }), spec('none'));
    if (!src.success) throw new Error(src.errors.map((e) => e.message).join());
    fs.writeFileSync(
      path.join(A, LOOP_SCHEDULE_JSON),
      JSON.stringify({ tasksSha256: 't'.repeat(64) }),
    );

    const agent = stubAgent();
    const shared = {
      fromCell: 'none@L2',
      fromArm: 'none' as const,
      fromRung: 'L2' as const,
      tasksSha256: 't'.repeat(64),
      fromOutRootFor: () => A,
    };
    const r = await runLoop(context(C, agent, { profiles, sharedStart: shared }), spec('none'));
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join());
    expect(agent.turns.map((t) => t.stepIndex)).toEqual([1, 2]);
    const steps = readStepRecords(runDirFor(C, loopRunId(spec('none'))), 3);
    const step1 = steps[0]?.turns[0]?.snapshot.evaluation?.blockingFindings ?? [];
    expect(step1.map((f) => f.filePath)).toEqual(['src/domain/legacy.ts']);
    const step2 = steps[1]?.turns[0]?.snapshot.evaluation?.blockingFindings ?? [];
    expect(step2.map((f) => f.filePath).sort()).toEqual([
      'src/domain/legacy.ts',
      'src/domain/tags.ts',
    ]);
    const out = runOutcomes(steps);
    expect(out.newBlocking[0]?.findings.map((f) => f.filePath)).toEqual(['src/domain/tags.ts']);
    expect(out.newBlocking[0]?.findings.some((f) => f.filePath === 'src/domain/legacy.ts')).toBe(
      false,
    );

    // A spec hash that differs from the source's step-1 spec refuses the branch.
    const other: TaskProfile = {
      ...profile,
      evaluation: {
        ...profile.evaluation,
        specSha256: 'b'.repeat(64),
      } as TaskProfile['evaluation'],
    };
    const refused = await runLoop(
      context(path.join(tmp, 'd'), stubAgent(), {
        profiles: new Map([[DEMO_TASK.id, other]]),
        sharedStart: shared,
      }),
      spec('none'),
    );
    expect(refused.success ? [] : refused.errors.map((e) => e.code)).toEqual([
      'LOOP_SHARED_START_SOURCE',
    ]);
  });
});
