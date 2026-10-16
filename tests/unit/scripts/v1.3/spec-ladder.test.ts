/**
 * v1.3 SO5 spec ladder statistics (scripts/v1.3/lib/spec-ladder.ts): series monotonicity and rule switch-on levels.
 */
import { monotonicity, traceRule } from '../../../../scripts/v1.3/lib/spec-ladder.js';

describe('monotonicity', () => {
  it('classifies constant, rising, falling and mixed series', () => {
    expect(monotonicity([3, 3, 3])).toBe('constant');
    expect(monotonicity([0])).toBe('constant');
    expect(monotonicity([0, 2, 2, 5])).toBe('non-decreasing');
    expect(monotonicity([9, 4, 4])).toBe('non-increasing');
    expect(monotonicity([0, 7, 3])).toBe('neither');
  });
});

describe('traceRule', () => {
  const levels = ['L1', 'L2', 'L3', 'L5'];
  it('finds the first level with a finding and whether it survives to the last level', () => {
    expect(traceRule(levels, [0, 4, 4, 6])).toEqual({ firstOn: 'L2', onAtLast: true, switchedOff: false });
    expect(traceRule(levels, [2, 0, 0, 0])).toEqual({ firstOn: 'L1', onAtLast: false, switchedOff: true });
    expect(traceRule(levels, [0, 0, 0, 0])).toEqual({ firstOn: null, onAtLast: false, switchedOff: false });
  });
  it('rejects misaligned input', () => {
    expect(() => traceRule(levels, [1])).toThrow();
  });
});
