/**
 * C11 scored-report slot (U0 Step 26, FR-13, FR-14 contract): set-once setter,
 * throwing getter, and an unchanged snapshot shape.
 */
import { FirewallContext } from '../../../../src/shared/context/firewall-context.js';
import { ahsScore, runId } from '../../../../src/shared/types/value-objects.js';
import type { ScoredReport } from '../../../../src/shared/types/evaluation.js';

const scored: ScoredReport = {
  runId: runId('scored-run-001'),
  projectPath: '/tmp/project',
  specVersion: '1.0',
  ahsDeterministic: ahsScore(0.85),
  verdict: 'pass',
  perDimensionScores: [],
  violations: [],
  universalMetrics: {
    cyclicDependencyCount: 0,
    maxFanOut: 0,
    maxFanIn: 0,
    abstractionRatio: 0,
    averageInstability: 0,
    orphanFileCount: 0,
  },
  evaluationMode: 'symbolic-only',
  durationMs: 1,
};

function makeContext(): FirewallContext {
  return new FirewallContext(runId('scored-run-001'));
}

describe('FirewallContext — ScoredReport slot (C11)', () => {
  it('returns the ScoredReport after it is set', () => {
    const ctx = makeContext();
    ctx.setScoredReport(scored);
    expect(ctx.getScoredReport()).toBe(scored);
  });

  it('throws on a second setScoredReport call', () => {
    const ctx = makeContext();
    ctx.setScoredReport(scored);
    expect(() => { ctx.setScoredReport(scored); }).toThrow('ScoredReport already set on FirewallContext — cannot overwrite');
  });

  it('getScoredReport throws before set with the exact message', () => {
    expect(() => makeContext().getScoredReport()).toThrow(
      new Error('ScoredReport not available — Scoring Engine stage has not run'),
    );
  });

  it('snapshot() keys are unchanged by setting a ScoredReport', () => {
    const before = makeContext();
    const after = makeContext();
    after.setScoredReport(scored);
    expect(Object.keys(after.snapshot()).sort()).toEqual(Object.keys(before.snapshot()).sort());
    expect(Object.keys(after.snapshot()).sort()).toEqual(['auditLog', 'runId', 'startedAt', 'warnings']);
  });
});
