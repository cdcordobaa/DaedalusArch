import { FirewallContext } from '../../../../src/shared/context/firewall-context.js';
import { runId } from '../../../../src/shared/types/value-objects.js';
import type { APGResult } from '../../../../src/shared/types/apg.js';

const mockApgResult: APGResult = {
  nodes: [],
  edges: [],
  parseCoverage: { total: 0, parsed: 0, percentage: 100, skipped: [] },
  warnings: [],
};

function makeContext(): FirewallContext {
  return new FirewallContext(runId('test-run-001'));
}

describe('FirewallContext — identity', () => {
  it('exposes runId and startedAt on construction', () => {
    const ctx = makeContext();
    expect(ctx.runId).toBe('test-run-001');
    expect(ctx.startedAt).toBeTruthy();
  });
});

describe('FirewallContext — set-once invariant', () => {
  it('allows setting APGResult once', () => {
    const ctx = makeContext();
    expect(() => ctx.setApgResult(mockApgResult)).not.toThrow();
  });

  it('throws on second setApgResult call', () => {
    const ctx = makeContext();
    ctx.setApgResult(mockApgResult);
    expect(() => ctx.setApgResult(mockApgResult)).toThrow('already set');
  });
});

describe('FirewallContext — getters throw before set', () => {
  it('getApgResult throws before set', () => {
    expect(() => makeContext().getApgResult()).toThrow('has not run');
  });

  it('getParsedSpec throws before set', () => {
    expect(() => makeContext().getParsedSpec()).toThrow('has not run');
  });

  it('getIngestionResult throws before set', () => {
    expect(() => makeContext().getIngestionResult()).toThrow('has not run');
  });

  it('getCompiledFunctions throws before set', () => {
    expect(() => makeContext().getCompiledFunctions()).toThrow('has not run');
  });

  it('getEvaluationResults throws before set', () => {
    expect(() => makeContext().getEvaluationResults()).toThrow('has not run');
  });

  it('getReport throws before set', () => {
    expect(() => makeContext().getReport()).toThrow('has not run');
  });
});

describe('FirewallContext — warnings', () => {
  it('starts with empty warnings', () => {
    expect(makeContext().warnings).toHaveLength(0);
  });

  it('accumulates warnings', () => {
    const ctx = makeContext();
    ctx.addWarning({ code: 'W1', message: 'first', stage: 'test' });
    ctx.addWarning({ code: 'W2', message: 'second', stage: 'test' });
    expect(ctx.warnings).toHaveLength(2);
  });
});

describe('FirewallContext — snapshot', () => {
  it('returns a snapshot with current state', () => {
    const ctx = makeContext();
    ctx.setApgResult(mockApgResult);
    const snap = ctx.snapshot();
    expect(snap.runId).toBe('test-run-001');
    expect(snap.apgResult).toEqual(mockApgResult);
    expect(snap.parsedSpec).toBeUndefined();
  });

  it('snapshot warnings are a copy, not a reference', () => {
    const ctx = makeContext();
    const snap = ctx.snapshot();
    ctx.addWarning({ code: 'W1', message: 'after snapshot', stage: 'test' });
    expect(snap.warnings).toHaveLength(0);
    expect(ctx.warnings).toHaveLength(1);
  });
});
