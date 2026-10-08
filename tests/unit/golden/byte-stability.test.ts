/**
 * BR-U3-61 / BR-U3-70 item 7: the byte-stability normaliser replaces exactly five paths.
 */
import { BYTE_STABILITY_PATHS, BYTE_STABILITY_PLACEHOLDER, normaliseForByteStability } from '../../golden/byte-stability.js';

describe('byte-stability normaliser (BR-U3-61)', () => {
  it('the path list is exactly the five frozen paths', () => {
    expect([...BYTE_STABILITY_PATHS]).toEqual([
      'runId',
      'durationMs',
      'timings.totalMs',
      'timings.stages[*].durationMs',
      'functionResults[*].executionTimeMs',
    ]);
  });

  it('replaces those paths and nothing else', () => {
    const report = {
      runId: 'r-1', durationMs: 12, ahsDeterministic: 0.5,
      timings: { totalMs: 30, stages: [{ name: 'a', durationMs: 1, status: 'ok' }, { name: 'b', durationMs: 2, status: 'ok' }] },
      functionResults: [{ functionId: 'FF-S01', executionTimeMs: 4, violationCount: 1 }],
      violations: [{ id: 'v-1', executionTimeMs: 9 }],
    };
    const out = JSON.parse(normaliseForByteStability(report)) as typeof report & Record<string, unknown>;
    const P = BYTE_STABILITY_PLACEHOLDER;
    expect(out).toEqual({
      runId: P, durationMs: P, ahsDeterministic: 0.5,
      timings: { totalMs: P, stages: [{ name: 'a', durationMs: P, status: 'ok' }, { name: 'b', durationMs: P, status: 'ok' }] },
      functionResults: [{ functionId: 'FF-S01', executionTimeMs: P, violationCount: 1 }],
      violations: [{ id: 'v-1', executionTimeMs: 9 }],
    });
  });

  it('two reports that differ only in the five paths normalise to the same bytes; any other difference remains', () => {
    const a = { runId: 'a', durationMs: 1, timings: { totalMs: 1, stages: [{ durationMs: 1 }] }, functionResults: [{ executionTimeMs: 1 }], verdict: 'pass' };
    const b = { runId: 'b', durationMs: 2, timings: { totalMs: 2, stages: [{ durationMs: 2 }] }, functionResults: [{ executionTimeMs: 2 }], verdict: 'pass' };
    expect(normaliseForByteStability(a)).toBe(normaliseForByteStability(b));
    expect(normaliseForByteStability({ ...a, verdict: 'warning' })).not.toBe(normaliseForByteStability(b));
  });
});
