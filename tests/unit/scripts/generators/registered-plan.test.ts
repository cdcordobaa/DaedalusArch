/**
 * The registered E1 generator plan (ADR-021 SO5-03, THR-8): the committed file, the placeholder resolution, the
 * protocol comparisons, and the generator-side guard in `generate-main`. Hand-computed fixtures; no real CLI.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { main } from '../../../../scripts/lib/generators/generate-main.js';
import type { GenerateMainDeps } from '../../../../scripts/lib/generators/generate-main.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import {
  E1_GENERATOR_PLAN, E1_ORDER_SEED, LOCAL_PLACEHOLDER, e1GridMismatches, generatorPlanPathFor, guardE1Plan,
  outcomeProtocolMismatches, protocolMismatches, readRegisteredPlan, resolvePlanFields,
} from '../../../../scripts/lib/generators/registered-plan.js';
import { loadGeneratorPlanFile, scheduleGrid } from '../../../../scripts/lib/generators/schedule.js';
import { isRegisteredPath } from '../../../../scripts/lib/prereg.js';
import { loadPlan } from '../../../../scripts/run-experiment.js';
import { FakeGeneratorRunner, REPO } from './fake-generator-runner.js';

const REG_FILE = path.join(REPO, E1_GENERATOR_PLAN);

describe('the committed E1 generator plan (THR-8)', () => {
  it('is registered, pins the three full model ids in schedule order, orderSeed 20261008, allowBash, 20 min, local placeholders', () => {
    expect(isRegisteredPath(E1_GENERATOR_PLAN)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(REG_FILE, 'utf8')) as Record<string, unknown>;
    expect(raw).toEqual({
      adapters: [
        { adapterId: 'claude-code-cli', modelId: 'claude-opus-5-5' },
        { adapterId: 'claude-code-cli', modelId: 'claude-sonnet-5-5' },
        { adapterId: 'claude-code-cli', modelId: 'claude-haiku-4-5' },
      ],
      tasks: ['task-management', 'order-fulfilment'],
      style: 'clean-architecture',
      levels: ['none', 'minimal-prose', 'full-aac'],
      runs: 3,
      orderSeed: 20261008,
      outRoot: '../daedalus-e1-outcomes',
      binary: LOCAL_PLACEHOLDER,
      harnessRoot: LOCAL_PLACEHOLDER,
      timeoutMs: 1_200_000,
      allowBash: true,
    });
    expect(E1_ORDER_SEED).toBe(20261008);
  });

  it('agrees with experiments/e1-grid/plan.json and loads as a 54-cell grid once the local paths are given', () => {
    const plan = loadPlan(path.join(REPO, 'experiments/e1-grid/plan.json'), REPO);
    if (!plan.ok || plan.plan.e1 === undefined) throw new Error('e1 plan');
    const reg = readRegisteredPlan(REG_FILE, REPO);
    if (!reg.ok) throw new Error(reg.detail);
    // ADR-029: the e1 block also lists the Codex arm's model; the Claude arm agrees with the block minus that arm.
    const claudeModels = reg.plan.adapters.map((a) => a.modelId);
    expect(e1GridMismatches(reg.plan, { ...plan.plan.e1, models: plan.plan.e1.models.filter((m) => claudeModels.includes(m)) }, REPO)).toEqual([]);
    expect(e1GridMismatches(reg.plan, plan.plan.e1, REPO)).toEqual(['models']);
    expect(generatorPlanPathFor('experiments/e1-grid/plan.json')).toBe(E1_GENERATOR_PLAN);
    const tmp = fs.realpathSync(os.tmpdir());
    const loaded = loadGeneratorPlanFile(REG_FILE, REPO, { binary: '/usr/local/bin/claude', harnessRoot: path.join(tmp, 'h') });
    if (!loaded.success) throw new Error(loaded.errors.map((e) => e.message).join('; '));
    expect(loaded.data.outRoot).toBe(path.resolve(REPO, '../daedalus-e1-outcomes'));
    expect(scheduleGrid(loaded.data)).toHaveLength(54);
    const missing = loadGeneratorPlanFile(REG_FILE, REPO);
    expect(missing.success ? [] : missing.errors.map((e) => e.message)).toEqual(expect.arrayContaining([expect.stringContaining('pass --binary'), expect.stringContaining('pass --harness-root')]));
  });
});

describe('resolvePlanFields', () => {
  it('fills placeholders, resolves a relative outRoot, and refuses a local value for a concrete field', () => {
    const r = resolvePlanFields({ binary: '<local>', harnessRoot: '<local>', outRoot: 'out' }, '/repo', { binary: '/b', harnessRoot: '/h' });
    expect(r).toEqual({ plan: { binary: '/b', harnessRoot: '/h', outRoot: '/repo/out' }, problems: [] });
    const c = resolvePlanFields({ binary: '/b', harnessRoot: '<local>', outRoot: '/abs' }, '/repo', { binary: '/x', harnessRoot: '/h' });
    expect(c.plan.outRoot).toBe('/abs');
    expect(c.problems).toEqual(['binary is set in the plan file; --binary applies only to a <local> field']);
  });
});

const BASE = {
  adapters: [{ adapterId: 'claude-code-cli' as const, modelId: 'a' }, { adapterId: 'claude-code-cli' as const, modelId: 'b' }],
  tasks: ['task-management', 'order-fulfilment'] as ('task-management' | 'order-fulfilment')[],
  style: 'clean-architecture',
  levels: ['none', 'full-aac'] as ('none' | 'full-aac')[],
  runs: 3,
  outRoot: '/o',
  orderSeed: 20261008,
  allowBash: true,
};

describe('protocol comparisons', () => {
  it('protocolMismatches names each differing frozen field; order counts; an absent timeoutMs equals the 20 min default', () => {
    expect(protocolMismatches(BASE, { ...BASE, timeoutMs: 1_200_000 })).toEqual([]);
    expect(protocolMismatches({ ...BASE, adapters: [...BASE.adapters].reverse() }, BASE)).toEqual(['adapters']);
    expect(protocolMismatches({ ...BASE, orderSeed: 0, allowBash: false, timeoutMs: 60_000, outRoot: '/p' }, BASE)).toEqual(['orderSeed', 'allowBash', 'timeoutMs', 'outRoot']);
    expect(protocolMismatches({ ...BASE, tasks: ['task-management'], levels: ['none'], style: 'x', runs: 1 }, BASE)).toEqual(['tasks', 'levels', 'style', 'runs']);
  });

  it('e1GridMismatches compares sets (not order) and outRoot with the resolved outcomesRoot', () => {
    const grid = { outcomesRoot: '../o', style: 'clean-architecture', models: ['b', 'a'], specLevels: ['full-aac', 'none'], tasks: [{ taskId: 'order-fulfilment' }, { taskId: 'task-management' }], runs: 3 };
    expect(e1GridMismatches(BASE, grid, '/repo')).toEqual([]);
    expect(e1GridMismatches(BASE, { ...grid, models: ['a'], runs: 2, outcomesRoot: 'o' }, '/repo')).toEqual(['models', 'runs', 'outRoot']);
  });

  it('outcomeProtocolMismatches lists every breach of a generation.json; a conforming one gives []', () => {
    const exp = { modelId: 'a', taskId: 'task-management', specLevel: 'none', runIndex: 1, orderSeed: 20261008, adapterId: 'claude-code-cli', promptTemplateSha256: 'c'.repeat(64) };
    const good = { orderSeed: 20261008, pilot: false, adapterId: 'claude-code-cli', requestedModelId: 'a', taskId: 'task-management', specLevel: 'none', runIndex: 1, promptTemplateId: 'none/task-management', promptTemplateSha256: 'c'.repeat(64) };
    expect(outcomeProtocolMismatches(good, exp)).toEqual([]);
    expect(outcomeProtocolMismatches({ ...good, orderSeed: 0, pilot: true, requestedModelId: 'b' }, exp)).toEqual(['orderSeed 0 != 20261008', 'pilot true != false', 'requestedModelId "b" != "a"']);
    expect(outcomeProtocolMismatches({ ...good, promptTemplateSha256: undefined }, exp)).toEqual([`promptTemplateSha256 null != "${'c'.repeat(64)}"`]);
    expect(outcomeProtocolMismatches(good, { ...exp, promptTemplateSha256: undefined })).toEqual(['promptTemplateSha256: the committed template is unreadable']);
  });
});

describe('guardE1Plan and generate-main (SO5-03)', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u6-guard-')));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  const reg = (): ReturnType<typeof loadGeneratorPlanFile> => loadGeneratorPlanFile(REG_FILE, REPO, { binary: '/b/claude', harnessRoot: path.join(tmp, 'h') });
  const sha = (): string => 'f'.repeat(64);

  it('a plan outside the E1 outRoot passes; a copy of the plan targeting it is refused; the registered file warns until P-U6', () => {
    const r = reg();
    if (!r.success) throw new Error('load');
    expect(guardE1Plan(path.join(tmp, 'p.json'), { ...r.data, outRoot: path.join(tmp, 'out') }, REPO, undefined, sha)).toEqual({ ok: true, e1: false });
    const copy = guardE1Plan(path.join(tmp, 'p.json'), r.data, REPO, undefined, sha);
    expect(copy.ok ? '' : copy.detail).toContain(`start the grid from ${E1_GENERATOR_PLAN}`);
    const pilotCopy = guardE1Plan(path.join(tmp, 'p.json'), { ...r.data, outRoot: path.join(r.data.outRoot, 'pilot') }, REPO, undefined, sha);
    expect(pilotCopy.ok).toBe(false);
    const unregistered = guardE1Plan(REG_FILE, r.data, REPO, undefined, sha);
    expect(unregistered).toMatchObject({ ok: true, e1: true });
    expect(unregistered.ok ? unregistered.warning : '').toContain('not yet listed in corpus/prereg.json');
    expect(guardE1Plan(REG_FILE, r.data, REPO, 'f'.repeat(64), sha)).toEqual({ ok: true, e1: true });
    const changed = guardE1Plan(REG_FILE, r.data, REPO, 'a'.repeat(64), sha);
    expect(changed.ok ? '' : changed.detail).toContain('changed since its registration');
  });

  it('generate-main refuses a scratch plan aimed at the E1 outRoot with exit 2 before any CLI call', async () => {
    const r = reg();
    if (!r.success) throw new Error('load');
    const scratch = path.join(tmp, 'scratch.json');
    fs.writeFileSync(scratch, JSON.stringify({ ...JSON.parse(fs.readFileSync(REG_FILE, 'utf8')) as object, orderSeed: 0, binary: '/b/claude', harnessRoot: path.join(tmp, 'h') }));
    const runner = new FakeGeneratorRunner('/b/claude');
    const err: string[] = [];
    const deps: GenerateMainDeps = {
      runner, prompts: () => DomainResult.fail([{ code: 'X', message: 'no prompt' }]), clock: { now: () => 0 }, sleep: () => Promise.resolve(),
      parentEnv: {}, out: () => undefined, err: (t) => err.push(t),
    };
    expect(await main(['--plan', scratch, '--pilot'], REPO, deps)).toBe(2);
    expect(err.join('')).toContain('GEN_PLAN_UNREGISTERED');
    expect(runner.cliCalls).toHaveLength(0);
    expect(await main(['--plan', E1_GENERATOR_PLAN, '--binary'], REPO, deps)).toBe(2);
  });
});
