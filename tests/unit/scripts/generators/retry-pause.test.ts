/**
 * Gate S1 (pause time recorded): every usage-limit pause is stored on its interruption with its start, end, planned
 * and measured duration; a run with no pause records no `pause` and its interruptions stay `[]`.
 */
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { AttemptDisposition } from '../../../../scripts/lib/generators/outcome.js';
import { DEFAULT_RETRY_POLICY, runWithRetries } from '../../../../scripts/lib/generators/retry.js';
import type { AttemptReport, Clock, RetryHooks } from '../../../../scripts/lib/generators/retry.js';

const T0 = Date.parse('2026-10-19T10:00:00.000Z');

function fakeTime(): { clock: Clock; sleep: (ms: number) => Promise<void>; advance: (ms: number) => void } {
  let now = T0;
  return {
    clock: { now: () => now },
    // The fake sleeper overshoots by 250 ms, so measured and planned durations differ and both are checked.
    sleep: (ms) => {
      now += ms + 250;
      return Promise.resolve();
    },
    advance: (ms) => {
      now += ms;
    },
  };
}

function hooks(dispositions: readonly AttemptDisposition[], advance: (ms: number) => void): RetryHooks<null> {
  let i = 0;
  return {
    runAttempt: () => {
      const d = dispositions[i++] ?? { kind: 'final', label: 'completed' };
      advance(1000);
      return Promise.resolve(DomainResult.ok<AttemptReport<null>>({ disposition: d, value: null }));
    },
    onInterruption: (n) => DomainResult.ok(`interruptions/run/${String(n)}`),
    onRetry: () => DomainResult.ok(undefined),
  };
}

const LIMIT: AttemptDisposition = { kind: 'usage-limit', usage: { subtype: 'usage-limit' }, label: 'usage-limit' };

describe('S1 pause durations', () => {
  it('records start, end, planned and measured duration of each pause', async () => {
    const t = fakeTime();
    const resetAt = T0 + 10 * 60 * 1000;
    const r = await runWithRetries(hooks([{ ...LIMIT, usage: { subtype: 'usage-limit', resetAt } }, LIMIT], t.advance), DEFAULT_RETRY_POLICY, t.clock, t.sleep);
    if (!r.success) throw new Error('retry failed');
    expect(r.data.attempts.map((a) => a.outcome)).toEqual(['completed']);
    const [p0, p1] = r.data.interruptions.map((i) => i.pause);
    // First: reset 10 min after T0, call ended at T0 + 1 s → planned 10 min − 1 s + 60 s margin.
    expect(p0).toEqual({
      startedAt: '2026-10-19T10:00:01.000Z',
      endedAt: new Date(T0 + 1000 + 659_000 + 250).toISOString(),
      plannedMs: 659_000,
      ms: 659_250,
    });
    // Second: no reset time → the default pause.
    expect(p1?.plannedMs).toBe(DEFAULT_RETRY_POLICY.defaultUsagePauseMs);
    expect(p1?.ms).toBe(DEFAULT_RETRY_POLICY.defaultUsagePauseMs + 250);
    expect(Date.parse(p1?.startedAt ?? '')).toBeGreaterThan(Date.parse(p0?.endedAt ?? ''));
  });

  it('a run with no pause has no interruptions (records unchanged)', async () => {
    const t = fakeTime();
    const r = await runWithRetries(hooks([], t.advance), DEFAULT_RETRY_POLICY, t.clock, t.sleep);
    if (!r.success) throw new Error('retry failed');
    expect(r.data.interruptions).toEqual([]);
    expect(JSON.stringify(r.data.attempts)).toBe('[{"startedAt":"2026-10-19T10:00:00.000Z","outcome":"completed"}]');
  });
});
