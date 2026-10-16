/**
 * The loop evaluator's engine tee (`--engine both`, `Docs/v1.3/loop-engine-tee.md`): the parity rule, the tee with a
 * stub evaluator pair, the run.json counts, the engine wiring and the CLI/plan options. No model, no Neo4j.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { EvaluateDeps } from '../../../../src/mcp-server/evaluate-project.js';
import type { PipelineConfig } from '../../../../src/pipeline/types.js';
import { MemoryGraphRepository } from '../../../../src/cypher-interp/repository.js';
import { ORDER_ULP, compareEvaluations, engineDeps, engineEnv, evaluatorForEngine, teeEvaluator, ulpDistance } from '../../../../scripts/lib/loop/engine-tee.js';
import { RUN_JSON, runDirFor, runLoop, runParityCounts } from '../../../../scripts/lib/loop/loop.js';
import { claimSchedule, parseLoopArgs } from '../../../../scripts/lib/loop/main.js';
import { loopRunId, validatePlan } from '../../../../scripts/lib/loop/plan.js';
import { stubEvaluator } from '../../../../scripts/lib/loop/stub.js';
import type { EngineParity, RunRecord, StepEvaluation, StepEvaluator } from '../../../../scripts/lib/loop/types.js';
import { context, spec, stubAgent, tmpRoot } from './helpers.js';

function evaluation(over: Partial<StepEvaluation> = {}): StepEvaluation {
  return {
    scoringMode: 'v1.3',
    ahs: 0.9,
    blockingAhs: 1,
    verdict: 'fail',
    violationCount: 3,
    blockingViolationCount: 1,
    advisoryViolationCount: 2,
    blockingByRule: { 'FF-S01': 1 },
    advisoryByRule: { 'FF-CV05': 2 },
    blockingFindings: [{ ruleId: 'FF-S01', ruleName: 'deps', template: 'layer-dependency', filePath: 'src/domain/a.ts', line: 3, target: 'src/infra/b.ts', message: 'm' }],
    durationMs: 10,
    ...over,
  };
}

function fixed(e: StepEvaluation | 'fail', calls?: string[], label = ''): StepEvaluator {
  return {
    id: `fixed${label}`,
    evaluate: () => {
      calls?.push(label);
      return Promise.resolve(e === 'fail' ? DomainResult.fail([{ code: 'BOOM', message: 'engine down' }]) : DomainResult.ok(e));
    },
  };
}

function nextUp(x: number): number {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, x);
  v.setBigInt64(0, v.getBigInt64(0) + 1n);
  return v.getFloat64(0);
}

describe('compareEvaluations', () => {
  it('identical evaluations (durations aside) are identical, with no diff', () => {
    expect(compareEvaluations(evaluation(), evaluation({ durationMs: 999 }))).toEqual({ status: 'identical' });
  });

  it('compares blocking findings as multisets of (rule, template, file, target); line and message are not identity', () => {
    const a = evaluation();
    const [first] = a.blockingFindings;
    if (first === undefined) throw new Error('fixture has a finding');
    const b = evaluation({ blockingFindings: [{ ...first, line: 7, message: 'other', violationId: 'x' }] });
    expect(compareEvaluations(a, b).status).toBe('identical');
    const twice = evaluation({ blockingFindings: [first, first] });
    const r = compareEvaluations(twice, a);
    expect(r.status).toBe('divergent');
    expect(r.diff?.onlyRecordTotal).toBe(1);
    expect(r.diff?.onlyCheck).toBeUndefined();
  });

  it('a finding on one engine only, a per-rule count and a scalar field make it divergent with a compact diff', () => {
    const r = compareEvaluations(
      evaluation(),
      evaluation({
        blockingFindings: [{ ruleId: 'FF-S01', ruleName: 'deps', template: 'layer-dependency', filePath: 'src/domain/c.ts', message: 'm' }],
        advisoryByRule: { 'FF-CV05': 3 },
        advisoryViolationCount: 3,
      }),
    );
    expect(r.status).toBe('divergent');
    expect(r.diff?.onlyRecord).toEqual([{ ruleId: 'FF-S01', template: 'layer-dependency', filePath: 'src/domain/a.ts', target: 'src/infra/b.ts' }]);
    expect(r.diff?.onlyCheck).toEqual([{ ruleId: 'FF-S01', template: 'layer-dependency', filePath: 'src/domain/c.ts', target: null }]);
    expect(r.diff?.advisoryByRule).toEqual({ 'FF-CV05': [2, 3] });
    expect(r.diff?.blockingByRule).toBeUndefined();
    expect(r.diff?.fields).toEqual({ advisoryViolationCount: [2, 3] });
  });

  it('caps the listed findings at 20 per side and keeps the totals', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ ruleId: 'R', ruleName: 'r', filePath: `f${String(i)}.ts`, message: 'm' }));
    const r = compareEvaluations(evaluation({ blockingFindings: many }), evaluation({ blockingFindings: [] }));
    expect(r.diff?.onlyRecord).toHaveLength(20);
    expect(r.diff?.onlyRecordTotal).toBe(25);
  });

  it('AHS a few ULP apart with everything else equal is `order`; further apart, or with another difference, divergent', () => {
    const near = nextUp(nextUp(0.9));
    expect(ulpDistance(0.9, near)).toBe(2);
    expect(compareEvaluations(evaluation(), evaluation({ ahs: near })).status).toBe('order');
    expect(compareEvaluations(evaluation(), evaluation({ ahs: 0.91 })).status).toBe('divergent');
    expect(compareEvaluations(evaluation(), evaluation({ ahs: near, verdict: 'pass' })).status).toBe('divergent');
    expect(compareEvaluations(evaluation(), evaluation({ ahs: null })).status).toBe('divergent');
    expect(ORDER_ULP).toBe(4);
  });

  it('ulpDistance: 0 for equal values, Infinity across signs and for non-finite values', () => {
    expect(ulpDistance(1, 1)).toBe(0);
    expect(ulpDistance(1, -1)).toBe(Infinity);
    expect(ulpDistance(1, Number.NaN)).toBe(Infinity);
  });
});

describe('teeEvaluator', () => {
  it('records the engine of record and an identical parity block', async () => {
    const r = await teeEvaluator(fixed(evaluation()), fixed(evaluation({ durationMs: 3 }))).evaluate('/w', 'run');
    expect(r.success && r.data.engineOfRecord).toBe('neo4j');
    expect(r.success && r.data.parity).toEqual({ checkEngine: 'cypher-interp', status: 'identical', durationMs: 3 });
    expect(r.success && r.data.durationMs).toBe(10);
  });

  it('a divergent check never fails the snapshot: the evaluation of record is kept and the mismatch reported', async () => {
    const seen: EngineParity[] = [];
    const r = await teeEvaluator(fixed(evaluation()), fixed(evaluation({ verdict: 'pass' })), { onMismatch: (_r, _d, p) => seen.push(p) }).evaluate('/w', 'run');
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.verdict).toBe('fail');
    expect(r.data.parity?.status).toBe('divergent');
    expect(r.data.parity?.diff?.fields).toEqual({ verdict: ['fail', 'pass'] });
    expect(seen.map((p) => p.status)).toEqual(['divergent']);
  });

  it('a failed check is recorded as check-failed; a failed evaluation of record is returned and the check not run', async () => {
    const c = await teeEvaluator(fixed(evaluation()), fixed('fail')).evaluate('/w');
    expect(c.success && c.data.parity).toEqual({ checkEngine: 'cypher-interp', status: 'check-failed', checkError: { code: 'BOOM', message: 'engine down' } });
    const calls: string[] = [];
    const f = await teeEvaluator(fixed('fail', calls, 'record'), fixed(evaluation(), calls, 'check')).evaluate('/w');
    expect(f.success).toBe(false);
    expect(calls).toEqual(['record']);
  });
});

describe('the loop under the tee', () => {
  let out: string;
  beforeEach(() => {
    out = tmpRoot();
  });
  afterEach(() => {
    fs.rmSync(out, { recursive: true, force: true });
  });

  /** The stub evaluator with one extra advisory finding on the given turn number (1-based, in call order). */
  function skewedOn(turn: number): StepEvaluator {
    const inner = stubEvaluator();
    let n = 0;
    return {
      id: 'skewed',
      evaluate: async (dir, runId) => {
        n++;
        const r = await inner.evaluate(dir, runId);
        if (!r.success || n !== turn) return r;
        return DomainResult.ok({ ...r.data, advisoryViolationCount: r.data.advisoryViolationCount + 1 });
      },
    };
  }

  it('a divergence does not stop the run; run.json counts every snapshot (repair turns included)', async () => {
    const mismatches: string[] = [];
    const evaluator = teeEvaluator(stubEvaluator(), skewedOn(2), { onMismatch: (runId, _d, p) => mismatches.push(`${runId ?? ''} ${p.status}`) });
    const agent = stubAgent(); // the default stub script adds a blocking violation at step 2
    const r = await runLoop(context(out, agent, { evaluator }), spec('gate'));
    expect(r.success && r.data.kind).toBe('completed');
    if (!r.success || r.data.kind !== 'completed') return;
    const turns = r.data.steps.flatMap((s) => s.turns);
    expect(turns.length).toBe(4); // 3 steps + the gate's repair turn
    expect(turns.every((t) => t.snapshot.evaluation?.engineOfRecord === 'neo4j')).toBe(true);
    const run = JSON.parse(fs.readFileSync(path.join(runDirFor(out, loopRunId(spec('gate'))), RUN_JSON), 'utf8')) as RunRecord;
    expect(run.parity).toEqual({ snapshots: 4, identical: 3, order: 0, divergent: 1, checkFailed: 0 });
    expect(mismatches).toEqual([`${loopRunId(spec('gate'))} divergent`]);
  });

  it('default mode: no engine field, no parity block, no run.json parity', async () => {
    const r = await runLoop(context(out), spec('none'));
    expect(r.success && r.data.kind).toBe('completed');
    if (!r.success || r.data.kind !== 'completed') return;
    for (const t of r.data.steps.flatMap((s) => s.turns)) {
      expect(t.snapshot.evaluation).not.toHaveProperty('engineOfRecord');
      expect(t.snapshot.evaluation).not.toHaveProperty('parity');
    }
    const run = JSON.parse(fs.readFileSync(path.join(runDirFor(out, loopRunId(spec('none'))), RUN_JSON), 'utf8')) as RunRecord;
    expect(run).not.toHaveProperty('parity');
    expect(runParityCounts(r.data.steps)).toBeUndefined();
  });
});

describe('engine wiring', () => {
  function base(): { deps: EvaluateDeps; configs: PipelineConfig[] } {
    const configs: PipelineConfig[] = [];
    const deps: EvaluateDeps = {
      makeGraph: () => {
        throw new Error('neo4j graph');
      },
      makePipeline: (c) => {
        configs.push(c);
        return { executor: { execute: () => Promise.reject(new Error('stub')) }, cleanup: () => Promise.resolve() } as never;
      },
      graphEngine: 'cypher-interp',
      interp: () => Promise.reject(new Error('the MCP cache path must not be used')),
    };
    return { deps, configs };
  }

  it('neo4j: the pipeline path, without the MCP interpreter cache', () => {
    const d = engineDeps(base().deps, 'neo4j');
    expect(d.graphEngine).toBe('neo4j');
    expect(d.interp).toBeUndefined();
  });

  it('cypher-interp: the same pipeline path with graphEngine cypher-interp and an in-memory graph', () => {
    const b = base();
    const d = engineDeps(b.deps, 'cypher-interp');
    expect(d.graphEngine).toBe('neo4j');
    expect(d.interp).toBeUndefined();
    expect(d.makeGraph({ uri: '', user: '', password: '', apgStorePath: '' })).toBeInstanceOf(MemoryGraphRepository);
    d.makePipeline({ projectPath: '/p', tsconfigPath: '/t/tsconfig.json' } as PipelineConfig);
    expect(b.configs[0]).toMatchObject({ projectPath: '/p', tsconfigPath: '/t/tsconfig.json', graphEngine: 'cypher-interp' });
  });

  it('the interpreter-only env gets a placeholder password only when none is set', () => {
    expect(engineEnv({}, 'cypher-interp').NEO4J_PASSWORD).toBe('unused-by-cypher-interp');
    expect(engineEnv({ NEO4J_PASSWORD: 'p' }, 'cypher-interp').NEO4J_PASSWORD).toBe('p');
    expect(engineEnv({}, 'both')).toEqual({});
  });

  it('no engine: the builder receives the base wiring and env untouched', () => {
    const b = base().deps;
    const env = { A: '1' };
    const seen: unknown[] = [];
    evaluatorForEngine(undefined, b, env, (d, e) => {
      seen.push(d, e);
      return stubEvaluator();
    });
    expect(seen[0]).toBe(b);
    expect(seen[1]).toBe(env);
  });

  it('cypher-interp tags its evaluations; both builds two evaluators (record, check)', async () => {
    const built: string[] = [];
    const ev = evaluatorForEngine('cypher-interp', base().deps, {}, () => fixed(evaluation()));
    const r = await ev.evaluate('/w');
    expect(r.success && r.data.engineOfRecord).toBe('cypher-interp');
    evaluatorForEngine('both', base().deps, {}, (d) => {
      built.push(String(d.makeGraph === base().deps.makeGraph));
      return stubEvaluator();
    });
    expect(built).toHaveLength(2);
  });
});

describe('options', () => {
  it('--engine accepts neo4j, cypher-interp and both; anything else is a usage error', () => {
    const ok = parseLoopArgs(['--plan', 'p.json', '--engine', 'both']);
    expect(ok.success && ok.data.engine).toBe('both');
    const none = parseLoopArgs(['--plan', 'p.json']);
    expect(none.success && none.data).not.toHaveProperty('engine');
    expect(parseLoopArgs(['--plan', 'p.json', '--engine', 'memgraph']).success).toBe(false);
  });

  it('the plan may carry an engine; an unknown one is rejected', () => {
    const plan = {
      description: 'd',
      tasksFile: 't.json',
      adapters: [{ adapterId: 'claude-code-cli', modelId: 'm' }],
      arms: ['none'],
      runs: 1,
      orderSeed: 1,
      outRoot: '/o',
      binary: '/b',
      harnessRoot: '/h',
      allowBash: false,
      evaluatorSpec: 's.yaml',
    };
    expect(validatePlan({ ...plan, engine: 'both' }).success).toBe(true);
    const bad = validatePlan({ ...plan, engine: 'memory' });
    expect(!bad.success && bad.errors.map((e) => e.message)).toEqual(['engine must be neo4j, cypher-interp or both']);
  });

  it('a resume under another engine is refused (schedule.json records the engine when one is chosen)', () => {
    const out = tmpRoot();
    try {
      const s = { schema: 'loop-schedule/v1' as const, planSha256: 'p', tasksSha256: 't', dryRun: false, runs: ['r'] };
      expect(claimSchedule(out, { ...s, engine: 'both' }).success).toBe(true);
      expect(claimSchedule(out, { ...s, engine: 'both' }).success).toBe(true);
      expect(claimSchedule(out, s).success).toBe(false);
      const plain = tmpRoot();
      claimSchedule(plain, s);
      expect(fs.readFileSync(path.join(plain, 'schedule.json'), 'utf8')).not.toContain('engine');
      fs.rmSync(plain, { recursive: true, force: true });
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});
