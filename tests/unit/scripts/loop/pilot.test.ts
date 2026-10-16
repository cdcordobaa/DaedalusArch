/**
 * Loop pilot readiness (`Docs/v1.3/loop-pilot-readiness.md`): the style slot, per-task specs (static and the
 * ISE-assisted DDD spec frozen after step 1), the plain-language repair prompt and its finding-by-finding outcome, the
 * pilot plan and its call budget, and the pilot dry run end to end. No model, no Neo4j.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { ClaudeStepAgent } from '../../../../scripts/lib/loop/agents.js';
import { RUN_JSON, repairOutcome, runDirFor, runLoop, stepRecordPath } from '../../../../scripts/lib/loop/loop.js';
import type { TaskProfile } from '../../../../scripts/lib/loop/loop.js';
import { buildProfiles, main, stubLayoutFor } from '../../../../scripts/lib/loop/main.js';
import type { LoopMainDeps } from '../../../../scripts/lib/loop/main.js';
import { checkPlanAgainstTasks, loadLoopPlan, loopRunId, planCallBudget, validatePlan } from '../../../../scripts/lib/loop/plan.js';
import type { LoopPlanFile } from '../../../../scripts/lib/loop/plan.js';
import {
  FIRST_STEP_TEMPLATE,
  MAX_REPAIR_FINDINGS,
  NEXT_STEP_TEMPLATE,
  RULE_PLAIN,
  STYLED_FIRST_STEP_TEMPLATE,
  repairPrompt,
  stepPrompt,
  stepTemplate,
} from '../../../../scripts/lib/loop/prompts.js';
import { FROZEN_SPEC_FILE, FROZEN_SPEC_RECORD, SPEC_DIR, constrainDddSpec, freezeCheck } from '../../../../scripts/lib/loop/specs.js';
import type { FrozenSpec, FrozenSpecRecord, SpecFreezer } from '../../../../scripts/lib/loop/specs.js';
import { layoutSentence, styleFrame, styleSentence } from '../../../../scripts/lib/loop/style.js';
import type { LoopContextDecl } from '../../../../scripts/lib/loop/style.js';
import { stubEvaluator } from '../../../../scripts/lib/loop/stub.js';
import type { BlockingFinding, StepRecord } from '../../../../scripts/lib/loop/types.js';
import { FakeGeneratorRunner, MODEL, makeHarness } from '../generators/fake-generator-runner.js';
import { DEMO_TASK, context, spec, stubAgent, tmpRoot } from './helpers.js';

const REPO = path.resolve(__dirname, '../../../..');
const read = (rel: string): string => fs.readFileSync(path.join(REPO, rel), 'utf8');
const sha = (t: string | Buffer): string => crypto.createHash('sha256').update(t).digest('hex');
const CONTEXTS: readonly LoopContextDecl[] = [
  { root: 'src/registry/', part: 'the volunteer registry' },
  { root: 'src/deployment/', part: 'deployment planning' },
];
const PLAN = 'experiments/loop-pilot/plan.json';

describe('style slot', () => {
  it('the style sentences are those of pilot-tasks.md §3, word for word', () => {
    const md = read('Docs/v1.3/pilot-tasks.md');
    for (const s of [styleSentence('clean'), styleSentence('hexagonal'), styleSentence('ddd', CONTEXTS)]) expect(md).toContain(`"${s}"`);
  });

  it('the layout sentence comes from the preset; Clean reproduces the E1 sentence', () => {
    const e1 = /^Organise the source code under src\/ in exactly three folders.*$/m.exec(read('scripts/generator/prompts/none.md'))?.[0];
    expect(layoutSentence('clean', read('presets/clean-architecture.yaml'))).toBe(e1);
    expect(layoutSentence('hexagonal', read('presets/hexagonal.yaml'))).toBe(
      'Organise the source code under src/ in exactly five folders: src/domain, src/application, src/adapters/inbound, src/adapters/outbound and src/config.',
    );
    expect(layoutSentence('ddd', read('presets/ddd.yaml'), CONTEXTS)).toBe(
      'Inside each bounded context folder, organise the source code in the folders domain, application, infrastructure, acl and api (for example src/registry/domain), and put the composition root in src/main.ts.',
    );
    // The DDD preset's shared kernel is not named (part of the step-4 pressure).
    expect(layoutSentence('ddd', read('presets/ddd.yaml'), CONTEXTS)).not.toContain('shared');
  });

  it('without a style the frames are unchanged; with one, both frames carry the style and the layout', () => {
    expect(stepTemplate(0)).toBe(FIRST_STEP_TEMPLATE);
    expect(stepTemplate(1)).toBe(NEXT_STEP_TEMPLATE);
    expect(stepPrompt(DEMO_TASK, 0, 'TSC', undefined)).toBe(stepPrompt(DEMO_TASK, 0, 'TSC'));
    const clean = styleFrame(REPO, 'clean');
    const p1 = stepPrompt(DEMO_TASK, 0, 'TSC', clean);
    // Styled Clean = the original frame plus the E1 layout line.
    expect(p1.replace(`${clean.layoutSentence}\n`, '')).toBe(stepPrompt(DEMO_TASK, 0, 'TSC'));
    const ddd = styleFrame(REPO, 'ddd', CONTEXTS);
    const d1 = stepPrompt(DEMO_TASK, 0, 'TSC', ddd);
    const d2 = stepPrompt(DEMO_TASK, 1, 'TSC', ddd);
    expect(d1).toContain(`Put the source under src/. ${styleSentence('ddd', CONTEXTS)}\n${ddd.layoutSentence}\n`);
    expect(d2).toContain('follow the architecture the project already uses (Domain-Driven Design, one bounded context per part: src/registry/ for the volunteer registry and src/deployment/ for deployment planning).');
    expect(d2).toContain(ddd.layoutSentence);
    for (const p of [d1, d2, stepPrompt(DEMO_TASK, 1, 'TSC', styleFrame(REPO, 'hexagonal'))]) {
      expect(p).not.toContain('Clean Architecture');
      expect(p).not.toMatch(/\{\{[A-Z_]+\}\}/);
    }
    expect(STYLED_FIRST_STEP_TEMPLATE.split('{{TYPECHECK_COMMAND}}')).toHaveLength(2);
  });

  it('none arm: a styled prompt changes only the prompt value; the argv is the E1 argv byte for byte', () => {
    const h = makeHarness();
    try {
      const runId = `claude-code-cli/${MODEL}/relief-volunteers/none/run-0`;
      const cwd = path.join(h.outRoot, 'runs', ...runId.split('/'), 'work');
      fs.mkdirSync(cwd, { recursive: true });
      const agent = new ClaudeStepAgent(h.config, { runner: new FakeGeneratorRunner(h.binary) });
      const plain = agent.plan({ runId, cwd, prompt: 'PLAIN', arm: 'none' });
      const styled = stepPrompt(DEMO_TASK, 0, 'TSC', styleFrame(REPO, 'ddd', CONTEXTS));
      const s = agent.plan({ runId, cwd, prompt: styled, arm: 'none' });
      expect(plain.success && s.success).toBe(true);
      if (!plain.success || !s.success) return;
      expect(s.data.args).toEqual(plain.data.args.map((a) => (a === 'PLAIN' ? styled : a)));
      expect(s.data.prompt).toBe(styled);
    } finally {
      h.cleanup();
    }
  });
});

describe('gate repair: plain language and outcome', () => {
  const f = (ruleId: string, ruleName: string, file: string, line: number, target?: string): BlockingFinding => ({
    ruleId,
    ruleName,
    filePath: file,
    line,
    ...(target !== undefined ? { target } : {}),
    message: 'technical message',
  });

  it('says what each listed rule means, once per rule, and keeps the one-line findings', () => {
    const findings = [
      f('FF-S01', 'dependency-direction', 'src/domain/a.ts', 1, '../infrastructure/x'),
      f('FF-S01', 'dependency-direction', 'src/domain/b.ts', 2, '../infrastructure/y'),
      f('FF-DS02', 'context-isolation', 'src/deployment/domain/s.ts', 3, '../../registry/domain/v'),
    ];
    const p = repairPrompt(findings, 3, 'TSC');
    expect(p).toContain(`- ${RULE_PLAIN['dependency-direction'] ?? ''} (2 places; rule FF-S01 dependency-direction)`);
    expect(p).toContain(`- ${RULE_PLAIN['context-isolation'] ?? ''} (1 place; rule FF-DS02 context-isolation)`);
    expect(p).toContain('- [FF-S01 dependency-direction] src/domain/a.ts:1 (imports ../infrastructure/x): technical message');
    // An unknown rule falls back to its message.
    expect(repairPrompt([f('X-1', 'custom', 'src/a.ts', 1)], 1, 'TSC')).toContain('- technical message (1 place; rule X-1 custom)');
  });

  it('every blocking rule of the three pilot specs has a plain meaning', () => {
    const names = new Set<string>();
    for (const file of ['specs/clean-arch.yaml', 'presets/hexagonal.yaml', 'presets/ddd.yaml']) {
      for (const m of read(file).matchAll(/name: ([a-z-]+)\n(?:.*\n){0,5}?\s+tier: blocking/g)) names.add(m[1] ?? '');
    }
    // Clean and Hexagonal carry no `tier:` field; their blocking rules are those of rule-tiers.md.
    const clean = ['dependency-direction', 'no-cyclic-deps', 'no-domain-outward-dep', 'domain-purity', 'repository-pattern', 'domain-state-purity'];
    const hexagonal = ['dependency-direction-graph', 'core-isolation', 'port-adapter-pattern', 'port-dependency-inversion'];
    for (const n of [...clean, ...hexagonal]) names.add(n);
    expect(names.size).toBeGreaterThanOrEqual(15);
    for (const n of names) expect(RULE_PLAIN[n]).toBeDefined();
  });

  it('repairOutcome matches findings by rule, file and target (lines ignored), counts shown, removed and introduced', () => {
    const before = [
      f('FF-S01', 'd', 'src/domain/a.ts', 1, 'x'),
      f('FF-S01', 'd', 'src/domain/a.ts', 9, 'x'), // same identity, other line
      f('FF-S01', 'd', 'src/domain/b.ts', 2, 'y'),
      f('FF-S02', 'c', 'src/c.ts', 3),
    ];
    const after = [f('FF-S01', 'd', 'src/domain/b.ts', 7, 'y'), f('FF-S04', 'o', 'src/domain/new.ts', 1, 'z')];
    const o = repairOutcome(before, after);
    expect(o).toMatchObject({ before: 3, shown: 3, removed: 2, remaining: 1, introduced: 1 });
    expect(o.findings.map((x) => [x.filePath, x.removed])).toEqual([
      ['src/domain/a.ts', true],
      ['src/domain/b.ts', false],
      ['src/c.ts', true],
    ]);
    expect(o.introducedFindings).toEqual([{ ruleId: 'FF-S04', filePath: 'src/domain/new.ts', target: 'z' }]);
    const many = Array.from({ length: MAX_REPAIR_FINDINGS + 5 }, (_, i) => f('R', 'r', `src/f${String(i)}.ts`, 1));
    expect(repairOutcome(many, []).shown).toBe(MAX_REPAIR_FINDINGS);
  });

  it('the gate step record carries the outcome', async () => {
    const out = tmpRoot();
    const r = await runLoop(context(out), spec('gate'));
    expect(r.success).toBe(true);
    const step2 = JSON.parse(fs.readFileSync(stepRecordPath(runDirFor(out, loopRunId(spec('gate'))), 1), 'utf8')) as StepRecord;
    expect(step2.repairOutcome).toMatchObject({ before: 1, removed: 1, remaining: 0, introduced: 0 });
    const step1 = JSON.parse(fs.readFileSync(stepRecordPath(runDirFor(out, loopRunId(spec('gate'))), 0), 'utf8')) as StepRecord;
    expect(step1.repairOutcome).toBeUndefined();
  });
});

describe('per-task specs', () => {
  const ISE_YAML = [
    'architecture:',
    '  style: ddd',
    '  layers:',
    '    - name: domain',
    '      directories: [src/registry/domain/**, src/shared/**, src/people/domain/**]',
    '    - name: composition',
    '      directories: [src/main.ts]',
    '  ddd:',
    '    source_root: src/',
    '    contexts:',
    '      - { name: registry, root: src/registry/, public_api: [src/registry/api.ts], acl: [] }',
    '      - { name: people, root: src/people/, public_api: [], acl: [] }',
    '    outside_contexts: [src/main.ts, src/shared/**]',
    '    aggregates:',
    '      - { name: Volunteer, context: registry, module: src/registry/domain/volunteer/**, root: src/registry/domain/volunteer/Volunteer.ts, inner_entities: [] }',
    '      - { name: Person, context: people, module: src/people/domain/person/**, root: src/people/domain/person/Person.ts, inner_entities: [] }',
    '    value_objects: []',
    '    repositories: [src/registry/infrastructure/*Repo.ts]',
    '    domain_event_types: []',
    '    application_services: []',
    '',
  ].join('\n');

  it('constrainDddSpec keeps exactly the declared contexts, the preset composition root and the declared aggregates', () => {
    const { specYaml, report } = constrainDddSpec(ISE_YAML, read('presets/ddd.yaml'), CONTEXTS);
    expect(report).toEqual({
      declaredContexts: ['src/registry/', 'src/deployment/'],
      droppedContexts: ['src/people/'],
      addedContexts: ['src/deployment/'],
      droppedOutsideContexts: ['src/shared/**'],
      droppedLayerDirectories: ['src/shared/**', 'src/people/domain/**'],
      aggregates: ['Volunteer'],
    });
    expect(specYaml).toContain('- src/registry/api.ts');
    expect(specYaml).toContain('- src/deployment/contracts/**');
    expect(specYaml).toContain('- src/*/domain/**');
    expect(specYaml).toContain('- src/registry/infrastructure/*Repo.ts');
    expect(specYaml).toContain('- src/*/infrastructure/**/*Repository.ts');
    expect(specYaml).not.toContain('src/shared/**');
    expect(specYaml).not.toContain('Person');
  });

  it('freezeCheck keeps missing layer folders as warnings and other errors as errors', () => {
    expect(freezeCheck({ valid: false, errors: ['LAYER_DIR_NOT_FOUND: a'], warnings: ['w'] })).toEqual({ valid: true, errors: [], warnings: ['w', 'LAYER_DIR_NOT_FOUND: a'] });
    expect(freezeCheck({ valid: false, errors: ['SCHEMA: b', 'LAYER_DIR_NOT_FOUND: a'], warnings: [] }).valid).toBe(false);
  });

  function frozenProfile(freeze: SpecFreezer, seen: string[]): ReadonlyMap<string, TaskProfile> {
    return new Map([
      [
        DEMO_TASK.id,
        {
          frame: styleFrame(REPO, 'ddd', CONTEXTS),
          evaluation: {
            kind: 'frozen-after-step-1' as const,
            contexts: CONTEXTS,
            freeze,
            evaluatorFor: (file: string) => {
              seen.push(fs.readFileSync(file, 'utf8'));
              return stubEvaluator();
            },
          },
        },
      ],
    ]);
  }

  const FAKE: FrozenSpec = {
    specYaml: 'architecture: frozen\n',
    iseRawYaml: 'architecture: raw\n',
    ise: { classifiedBest: 'ddd', confidence: 1, style: 'ddd' },
    constraint: { declaredContexts: ['src/registry/'], droppedContexts: [], addedContexts: [], droppedOutsideContexts: [], droppedLayerDirectories: [], aggregates: [] },
    check: { valid: true, errors: [], warnings: [] },
  };

  it('the DDD spec is frozen once, on the step-1 snapshot, and used for every later snapshot', async () => {
    const out = tmpRoot();
    let calls = 0;
    const seen: string[] = [];
    const freeze: SpecFreezer = (workDir) => {
      calls++;
      expect(fs.existsSync(path.join(workDir, 'src', 'domain', 'todos.ts'))).toBe(true);
      return Promise.resolve(DomainResult.ok(FAKE));
    };
    const agent = stubAgent();
    const r = await runLoop(context(out, agent, { profiles: frozenProfile(freeze, seen) }), spec('gate'));
    expect(r.success).toBe(true);
    expect(calls).toBe(1);
    const runDir = runDirFor(out, loopRunId(spec('gate')));
    const rec = JSON.parse(fs.readFileSync(path.join(runDir, SPEC_DIR, FROZEN_SPEC_RECORD), 'utf8')) as FrozenSpecRecord;
    const step1 = JSON.parse(fs.readFileSync(stepRecordPath(runDir, 0), 'utf8')) as StepRecord;
    expect(rec).toMatchObject({ status: 'frozen', taskId: DEMO_TASK.id, sourceCommit: step1.turns[0]?.snapshot.commit, specSha256: sha(FAKE.specYaml) });
    expect(fs.readFileSync(path.join(runDir, SPEC_DIR, FROZEN_SPEC_FILE), 'utf8')).toBe(FAKE.specYaml);
    for (let i = 0; i < 3; i++) {
      const s = JSON.parse(fs.readFileSync(stepRecordPath(runDir, i), 'utf8')) as StepRecord;
      expect(s.evaluatorSpec).toEqual({ kind: 'frozen-after-step-1', path: 'spec/frozen-spec.yaml', sha256: sha(FAKE.specYaml) });
      for (const t of s.turns) expect(t.snapshot.evaluation).not.toBeNull();
    }
    // 3 step turns + 1 repair turn, each evaluated against the frozen file.
    expect(seen).toEqual(Array(agent.turns.length).fill(FAKE.specYaml));
    // The styled frame reached the agent.
    expect(agent.turns[0]?.prompt).toContain(styleSentence('ddd', CONTEXTS));
  });

  it('a spec frozen on a discarded step 1 is discarded on resume and frozen again', async () => {
    const out = tmpRoot();
    let calls = 0;
    const freeze: SpecFreezer = () => {
      calls++;
      return Promise.resolve(DomainResult.ok(FAKE));
    };
    const agent = stubAgent({
      onTurn: (t) => {
        if (calls === 1 && t.stepIndex === 1) throw new Error('stop');
      },
    });
    await expect(runLoop(context(out, agent, { profiles: frozenProfile(freeze, []) }), spec('none'))).rejects.toThrow('stop');
    // Simulate a crash inside step 1: drop the step-1 record so step 1 reruns.
    const runDir = runDirFor(out, loopRunId(spec('none')));
    fs.rmSync(stepRecordPath(runDir, 0));
    expect(fs.existsSync(path.join(runDir, SPEC_DIR, FROZEN_SPEC_RECORD))).toBe(true);
    const r = await runLoop(context(out, stubAgent(), { profiles: frozenProfile(freeze, []) }), spec('none'));
    expect(r.success).toBe(true);
    expect(calls).toBe(2);
  });

  it('a failed freeze is recorded and every snapshot of the run carries an evaluation error; the run then fails', async () => {
    const out = tmpRoot();
    const freeze: SpecFreezer = () => Promise.resolve(DomainResult.fail([{ code: 'LOOP_SPEC_FREEZE_FAILED', message: 'no src' }]));
    const r = await runLoop(context(out, stubAgent(), { profiles: frozenProfile(freeze, []) }), spec('gate'));
    expect(r.success ? [] : r.errors.map((e) => e.code)).toEqual(['LOOP_EVAL_ALL_FAILED']);
    const runDir = runDirFor(out, loopRunId(spec('gate')));
    expect((JSON.parse(fs.readFileSync(path.join(runDir, SPEC_DIR, FROZEN_SPEC_RECORD), 'utf8')) as FrozenSpecRecord).status).toBe('failed');
    for (let i = 0; i < 3; i++) {
      const s = JSON.parse(fs.readFileSync(stepRecordPath(runDir, i), 'utf8')) as StepRecord;
      expect(s.turns[0]?.snapshot.evaluationError?.code).toBe('LOOP_SPEC_FREEZE_FAILED');
      expect(s.repair).toMatchObject({ attempted: false });
      expect(s.evaluatorSpec?.sha256).toBeNull();
    }
  });

  it('a static profile evaluates with its own spec and records its path and sha256', () => {
    const loaded = loadLoopPlan(path.join(REPO, PLAN), REPO);
    expect(loaded.success).toBe(true);
    if (!loaded.success) return;
    const files: string[] = [];
    const built = buildProfiles(loaded.data, REPO, (f) => {
      files.push(f);
      return stubEvaluator();
    }, () => Promise.resolve(DomainResult.ok(FAKE)));
    expect(built.success).toBe(true);
    if (!built.success || built.data === undefined) return;
    expect(files).toEqual([path.join(REPO, 'specs/clean-arch.yaml'), path.join(REPO, 'presets/hexagonal.yaml')]);
    const clean = built.data.get('market-vendors')?.evaluation;
    expect(clean?.kind === 'static' ? [clean.specPath, clean.specSha256] : null).toEqual(['specs/clean-arch.yaml', sha(fs.readFileSync(path.join(REPO, 'specs/clean-arch.yaml')))]);
    expect(built.data.get('relief-volunteers')?.evaluation.kind).toBe('frozen-after-step-1');
    expect(built.data.get('shelter-adoptions')?.frame.style).toBe('hexagonal');
  });
});

describe('plans with task profiles', () => {
  const base = {
    description: 'd',
    tasksFile: 't.json',
    adapters: [{ adapterId: 'claude-code-cli', modelId: 'm' }],
    arms: ['none', 'gate'],
    runs: 1,
    orderSeed: 7,
    outRoot: '/o',
    binary: '/b',
    harnessRoot: '/h',
    allowBash: true,
  };
  const errs = (p: unknown): number => {
    const r = validatePlan(p);
    return r.success ? 0 : r.errors.length;
  };

  it('validates the profiles', () => {
    expect(errs({ ...base, taskProfiles: { a: { style: 'clean', evaluatorSpec: 's.yaml' } } })).toBe(0);
    expect(errs({ ...base, taskProfiles: { a: { style: 'ddd', specMode: 'ise-step1', contexts: CONTEXTS } } })).toBe(0);
    expect(errs(base)).toBe(1); // neither evaluatorSpec nor profiles
    expect(errs({ ...base, taskProfiles: { a: { style: 'layered', evaluatorSpec: 's' } } })).toBe(1);
    expect(errs({ ...base, taskProfiles: { a: { style: 'clean' } } })).toBe(1);
    expect(errs({ ...base, taskProfiles: { a: { style: 'clean', specMode: 'ise-step1' } } })).toBe(1);
    expect(errs({ ...base, taskProfiles: { a: { style: 'ddd', specMode: 'ise-step1' } } })).toBe(1);
    expect(errs({ ...base, taskProfiles: { a: { style: 'ddd', specMode: 'ise-step1', contexts: [{ root: 'registry', part: 'x' }] } } })).toBe(1);
    expect(errs({ ...base, taskProfiles: { a: { style: 'hexagonal', evaluatorSpec: 's', contexts: CONTEXTS } } })).toBe(1);
    expect(errs({ ...base, arms: ['none', 'daedalus-mcp'], daedalus: {}, taskProfiles: { a: { style: 'clean', evaluatorSpec: 's' } } })).toBe(1);
    expect(errs({ ...base, evaluatorSpec: 's', callBudget: { runs: 1 } })).toBe(1);
  });

  it('checks profiles and the call budget against the tasks', () => {
    const tasks = { description: 'd', tasks: [DEMO_TASK] };
    const plan = { ...base, taskProfiles: { 'todo-list': { style: 'clean', evaluatorSpec: 's' } } } as unknown as LoopPlanFile;
    expect(checkPlanAgainstTasks(plan, tasks)).toEqual([]);
    expect(checkPlanAgainstTasks({ ...plan, taskProfiles: { other: { style: 'clean', evaluatorSpec: 's' } } }, tasks)).toHaveLength(2);
    expect(planCallBudget(plan, tasks.tasks)).toEqual({ runs: 2, stepTurns: 6, maxRepairTurns: 3, maxCalls: 9 });
    expect(checkPlanAgainstTasks({ ...plan, callBudget: { runs: 2, stepTurns: 6, maxRepairTurns: 3, maxCalls: 9 } }, tasks)).toEqual([]);
    expect(checkPlanAgainstTasks({ ...plan, callBudget: { runs: 2, stepTurns: 6, maxRepairTurns: 0, maxCalls: 6 } }, tasks)).toHaveLength(1);
  });

  it('the dry-run stub writes each style layout', () => {
    expect(stubLayoutFor('hexagonal', [], 0).infrastructure).toBe('src/adapters/outbound');
    expect(stubLayoutFor('ddd', ['src/registry/', 'src/deployment/'], 1).domain).toBe('src/deployment/domain');
    expect(stubLayoutFor(undefined, [], 3).domain).toBe('src/domain');
  });
});

describe('pilot plan', () => {
  it('its tasks file is the hashed block of pilot-tasks.md, byte for byte, with the memo hashes', () => {
    const memo = read('Docs/v1.3/pilot-outcome-memo.md');
    const block = /```json\n([\s\S]*?)```/.exec(read('Docs/v1.3/pilot-tasks.md'))?.[1] ?? '';
    const file = read('experiments/loop-pilot/pilot-tasks.json');
    expect(file).toBe(block);
    expect(memo).toContain(sha(file));
    for (const t of (JSON.parse(file) as { tasks: unknown[] }).tasks) expect(memo).toContain(sha(JSON.stringify(t)));
  });

  it('loads: 3 tasks × none and gate × k=4 × claude-sonnet-5-5 × 1 run, budget 24 step + at most 12 repair turns', () => {
    const loaded = loadLoopPlan(path.join(REPO, PLAN), REPO);
    expect(loaded.success).toBe(true);
    if (!loaded.success) return;
    const { plan, tasks } = loaded.data;
    expect(tasks.tasks.map((t) => [t.id, t.steps.length])).toEqual([
      ['market-vendors', 4],
      ['shelter-adoptions', 4],
      ['relief-volunteers', 4],
    ]);
    expect(plan.adapters).toEqual([{ adapterId: 'claude-code-cli', modelId: 'claude-sonnet-5-5' }]);
    expect(plan.arms).toEqual(['none', 'gate']);
    expect(plan.runs).toBe(1);
    expect(planCallBudget(plan, tasks.tasks)).toEqual({ runs: 6, stepTurns: 24, maxRepairTurns: 12, maxCalls: 36 });
    expect(plan.callBudget).toEqual(planCallBudget(plan, tasks.tasks));
    expect(Object.fromEntries(Object.entries(plan.taskProfiles ?? {}).map(([k, v]) => [k, v.style]))).toEqual({
      'market-vendors': 'clean',
      'shelter-adoptions': 'hexagonal',
      'relief-volunteers': 'ddd',
    });
  });

  it('the dry run executes the whole plan end to end with stub generators', async () => {
    const out = tmpRoot('loop-pilot-');
    const lines: string[] = [];
    const deps: LoopMainDeps = {
      runner: new FakeGeneratorRunner('/none'),
      clock: { now: () => 0 },
      sleep: () => Promise.resolve(),
      now: () => new Date('2026-10-15T00:00:00Z'),
      parentEnv: {},
      out: (t) => lines.push(t),
      err: (t) => lines.push(t),
    };
    const code = await main(['--plan', PLAN, '--dry-run', '--out-root', out], REPO, deps);
    expect(code).toBe(0);
    const summary = JSON.parse(lines[lines.length - 1] ?? '{}') as Record<string, unknown>;
    expect(summary).toMatchObject({ dryRun: true, runs: 6, completed: 6, callBudget: { maxCalls: 36 }, turnsThisInvocation: { step: 24 } });
    const loaded = loadLoopPlan(path.join(REPO, PLAN), REPO, { outRoot: out });
    if (!loaded.success) throw new Error('plan');
    for (const task of loaded.data.tasks.tasks) {
      for (const arm of ['none', 'gate'] as const) {
        const runDir = runDirFor(out, loopRunId({ adapterId: 'claude-code-cli', modelId: 'claude-sonnet-5-5', taskId: task.id, arm, runIndex: 0 }));
        expect(JSON.parse(fs.readFileSync(path.join(runDir, RUN_JSON), 'utf8'))).toHaveProperty('completedAt');
        const steps = [0, 1, 2, 3].map((i) => JSON.parse(fs.readFileSync(stepRecordPath(runDir, i), 'utf8')) as StepRecord);
        const style = loaded.data.plan.taskProfiles?.[task.id]?.style;
        const prompt1 = fs.readFileSync(path.join(runDir, 'turns', 'step-01', 'prompt-step-01.txt'), 'utf8');
        expect(prompt1).toContain(styleSentence(style ?? 'clean', loaded.data.plan.taskProfiles?.[task.id]?.contexts ?? []));
        for (const s of steps) expect(s.turns[s.turns.length - 1]?.snapshot.evaluation).not.toBeNull();
        if (style === 'ddd') {
          const rec = JSON.parse(fs.readFileSync(path.join(runDir, SPEC_DIR, FROZEN_SPEC_RECORD), 'utf8')) as FrozenSpecRecord;
          expect(rec.status).toBe('frozen');
          expect(rec.constraint?.declaredContexts).toEqual(['src/registry/', 'src/deployment/']);
          for (const s of steps) expect(s.evaluatorSpec).toMatchObject({ kind: 'frozen-after-step-1', sha256: rec.specSha256 });
        } else {
          for (const s of steps) expect(s.evaluatorSpec?.kind).toBe('static');
        }
        if (arm === 'gate') {
          const repaired = steps.filter((s) => s.repair?.attempted === true);
          expect(repaired.length).toBeGreaterThan(0);
          for (const s of repaired) expect(s.repairOutcome).toMatchObject({ removed: 1, remaining: 0 });
        } else {
          expect(steps[3]?.turns[0]?.snapshot.evaluation?.blockingViolationCount).toBe(2);
        }
      }
    }
  }, 120_000);
});
