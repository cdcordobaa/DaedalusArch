/**
 * Held-out rules for the gate arm (`Docs/v1.3/gate-heldout-rules.md`): the repair prompt lists only the shown rules'
 * findings, a withheld-only step gets no repair, the records tag every finding, and nothing changes when the plan sets
 * no held-out rules. Stub evaluator with a second, made-up blocking rule; no model, no Neo4j.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { RUN_JSON, runDirFor, runLoop } from '../../../../scripts/lib/loop/loop.js';
import type { LoopContext } from '../../../../scripts/lib/loop/loop.js';
import { loopRunId, validatePlan } from '../../../../scripts/lib/loop/plan.js';
import { stubEvaluator } from '../../../../scripts/lib/loop/stub.js';
import type { BlockingFinding, RunRecord, StepEvaluator, StepRecord, TurnInput } from '../../../../scripts/lib/loop/types.js';
import { context, spec, stubAgent, tmpRoot } from './helpers.js';

const HELD = 'STUB-HELD';
const HELD_FILE = 'src/withheld-only-marker.ts';
const HELD_MESSAGE = 'withheld-marker message';

/** The stub firewall plus one made-up blocking rule that fires wherever `STUB-DEP` fires, on another file. */
function twoRuleEvaluator(): StepEvaluator {
  const base = stubEvaluator();
  return {
    id: 'two-rule-stub',
    evaluate: async (dir, runId) => {
      const r = await base.evaluate(dir, runId);
      if (!r.success) return r;
      const held: BlockingFinding[] = r.data.blockingFindings.map(() => ({ ruleId: HELD, ruleName: 'held rule (stub)', filePath: HELD_FILE, target: 'withheld-target', message: HELD_MESSAGE }));
      const blocking = r.data.blockingViolationCount + held.length;
      return DomainResult.ok({
        ...r.data,
        blockingViolationCount: blocking,
        violationCount: r.data.violationCount + held.length,
        blockingByRule: held.length > 0 ? { ...r.data.blockingByRule, [HELD]: held.length } : r.data.blockingByRule,
        blockingFindings: [...held, ...r.data.blockingFindings],
      });
    },
  };
}

let out: string;
beforeEach(() => {
  out = tmpRoot('heldout-');
});
afterEach(() => {
  fs.rmSync(out, { recursive: true, force: true });
});

async function gateRun(root: string, over: Partial<LoopContext>): Promise<{ steps: readonly StepRecord[]; prompts: TurnInput[]; run: RunRecord }> {
  const agent = stubAgent();
  const r = await runLoop(context(root, agent, { evaluator: twoRuleEvaluator(), ...over }), spec('gate'));
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
  if (r.data.kind !== 'completed') throw new Error('expected a completed run');
  const run = JSON.parse(fs.readFileSync(path.join(runDirFor(root, loopRunId(spec('gate'))), RUN_JSON), 'utf8')) as RunRecord;
  return { steps: r.data.steps, prompts: agent.turns.filter((t) => t.kind === 'repair'), run };
}

describe('gate held-out rules', () => {
  it('withheld findings never reach the repair prompt; the count is the shown count', async () => {
    const { steps, prompts, run } = await gateRun(out, { gateShownRules: ['STUB-DEP'] });
    expect(prompts).toHaveLength(1);
    const p = prompts[0]?.prompt ?? '';
    expect(p).toContain('STUB-DEP');
    expect(p).toContain('reported 1 blocking violation(s)');
    for (const leak of [HELD, HELD_FILE, HELD_MESSAGE, 'withheld-target', 'held rule (stub)']) expect(p).not.toContain(leak);
    // The step record keeps every finding, tagged.
    const s2 = steps[1];
    const before = s2?.turns[0]?.snapshot.evaluation?.blockingFindings ?? [];
    expect(before.map((f) => [f.ruleId, f.shown])).toEqual([
      [HELD, false],
      ['STUB-DEP', true],
    ]);
    expect(s2?.heldOut).toEqual({ shownBefore: 1, withheldBefore: 1, shownAfter: 0, withheldAfter: 0 });
    expect(s2?.repair).toEqual({ attempted: true, blockingBefore: 2, blockingAfter: 0, cleared: true });
    expect(s2?.repairOutcome?.findings.map((f) => [f.ruleId, f.shown])).toEqual([
      [HELD, false],
      ['STUB-DEP', true],
    ]);
    expect(steps[0]?.heldOut).toEqual({ shownBefore: 0, withheldBefore: 0, shownAfter: null, withheldAfter: null });
    expect(run.heldOutRules).toEqual({ shownRuleIds: ['STUB-DEP'], withheldRuleIds: [HELD] });
  });

  it('a step whose blocking findings are all withheld gets no repair turn', async () => {
    const { steps, prompts, run } = await gateRun(out, { gateShownRules: ['SOME-OTHER-RULE'] });
    expect(prompts).toHaveLength(0);
    expect(steps.every((s) => s.turns.length === 1)).toBe(true);
    expect(steps[1]?.repair).toEqual({ attempted: false, blockingBefore: 2, blockingAfter: null, cleared: null });
    expect(steps[1]?.heldOut).toEqual({ shownBefore: 0, withheldBefore: 2, shownAfter: null, withheldAfter: null });
    expect(run.heldOutRules).toEqual({ shownRuleIds: ['SOME-OTHER-RULE'], withheldRuleIds: ['STUB-DEP', HELD].sort() });
  });

  it('showing every rule gives the same repair prompt as no held-out rules', async () => {
    const all = await gateRun(out, { gateShownRules: [HELD, 'STUB-DEP'] });
    const other = tmpRoot('heldout-none-');
    try {
      const none = await gateRun(other, {});
      expect(all.prompts.map((t) => t.prompt)).toEqual(none.prompts.map((t) => t.prompt));
      expect(all.run.heldOutRules).toEqual({ shownRuleIds: ['STUB-DEP', HELD].sort(), withheldRuleIds: [] });
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it('without held-out rules no record carries a new key', async () => {
    const { steps, run } = await gateRun(out, {});
    expect(run.heldOutRules).toBeUndefined();
    const text = JSON.stringify(steps);
    expect(text).not.toContain('"heldOut"');
    for (const s of steps) {
      for (const t of s.turns) for (const f of t.snapshot.evaluation?.blockingFindings ?? []) expect('shown' in f).toBe(false);
    }
  });

  it('a resumed run must keep the shown rules it was created with', async () => {
    await gateRun(out, { gateShownRules: ['STUB-DEP'] });
    const r = await runLoop(context(out, stubAgent(), { evaluator: twoRuleEvaluator(), gateShownRules: [HELD] }), spec('gate'));
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.errors[0]?.code).toBe('LOOP_HELDOUT_MISMATCH');
  });
});

describe('plan: gate.shownRules', () => {
  const ok = {
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
    evaluatorSpec: 'specs/clean-arch.yaml',
  };

  it('accepts a non-empty list of distinct rule ids with the gate arm, and no gate block', () => {
    expect(validatePlan(ok).success).toBe(true);
    expect(validatePlan({ ...ok, gate: { shownRules: ['FF-S01', 'FF-S02'] } }).success).toBe(true);
    expect(validatePlan({ ...ok, gate: {} }).success).toBe(true);
  });

  it.each([
    ['not an object', 'x'],
    ['an unknown key', { shownRules: ['A'], heldOut: ['B'] }],
    ['an empty list', { shownRules: [] }],
    ['a non-array', { shownRules: 'A' }],
    ['a blank id', { shownRules: [' '] }],
    ['a duplicate', { shownRules: ['A', 'A'] }],
  ])('rejects %s', (_name, gate) => {
    expect(validatePlan({ ...ok, gate }).success).toBe(false);
  });

  it('rejects shownRules without the gate arm', () => {
    expect(validatePlan({ ...ok, arms: ['none'], gate: { shownRules: ['A'] } }).success).toBe(false);
  });
});
