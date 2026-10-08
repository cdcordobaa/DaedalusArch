/**
 * Retries, usage limits and timeouts of one generation run (FR-v1.2E-28; Q19; risk R5; BR-U5a-50).
 *
 * `runWithRetries(hooks, policy, clock, sleep)` drives the CLI calls of one cell:
 * - **usage or rate limit** (`AttemptDisposition.kind = 'usage-limit'`): consumes **no** attempt; the interrupted
 *   directory is moved away by `hooks.onInterruption` (to `interruptions/`, listed in `interruptions[]`), the grid
 *   pauses until the reported reset time plus a margin (or `defaultUsagePauseMs` when none is reported), and the same
 *   cell resumes. More than `maxInterruptions` interruptions of one cell stop the grid (`GEN_USAGE_LIMIT_PERSISTS`)
 *   rather than record a model failure.
 * - **infrastructure failure** (spawn failure, timeout with zero files, exit before the first turn): recorded in
 *   `attempts[]`, retried at most `maxInfrastructureRetries` (2) times after a back-off, the cell directory reset by
 *   `hooks.onRetry`; after that the result is `exhausted` and the outcome is `failed-agent`, reason `infrastructure`.
 * - **final** (anything the model produced, including a timeout with files): recorded in `attempts[]` and returned;
 *   never retried (BR-U5a-49).
 * The per-call wall-clock limit is `GeneratorCliConfig.timeoutMs` (default 20 min), enforced by the process runner;
 * `--max-budget-usd` is not used. Clock and sleeper are injectable.
 */
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { AttemptDisposition } from './outcome.js';
import type { GenerationAttempt, GenerationInterruption } from './types.js';

export interface RetryPolicy {
  /** BR-U5a-50: at most two infrastructure retries (three attempts in all). */
  readonly maxInfrastructureRetries: number;
  /** Back-off before retry i (0-based); the last value repeats. */
  readonly backoffMs: readonly number[];
  /** Pause when a usage limit reports no reset time. */
  readonly defaultUsagePauseMs: number;
  /** Added to a reported reset time. */
  readonly usageResumeMarginMs: number;
  /** Interruptions of one cell before the grid stops. */
  readonly maxInterruptions: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxInfrastructureRetries: 2,
  backoffMs: Object.freeze([30_000, 120_000]),
  defaultUsagePauseMs: 30 * 60 * 1000,
  usageResumeMarginMs: 60 * 1000,
  maxInterruptions: 48,
});

export interface Clock {
  now(): number;
}

export type Sleeper = (ms: number) => Promise<void>;

export const systemClock: Clock = { now: () => Date.now() };

export const realSleep: Sleeper = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export interface AttemptReport<T> {
  readonly disposition: AttemptDisposition;
  readonly value: T;
}

export interface RetryHooks<T> {
  /** One CLI call in the cell directory. A failure here is a harness failure and stops the cell. */
  runAttempt(): Promise<DomainResult<AttemptReport<T>>>;
  /** Moves the interrupted directory away and re-prepares the cell; returns `movedTo` (POSIX, relative to outRoot). */
  onInterruption(index: number): DomainResult<string>;
  /** Resets the cell directory before an infrastructure retry. */
  onRetry(): DomainResult<void>;
}

export interface RetryResult<T> {
  readonly last: AttemptReport<T>;
  /** True when infrastructure failures used up every retry (outcome row 1). */
  readonly exhausted: boolean;
  readonly attempts: readonly GenerationAttempt[];
  readonly interruptions: readonly GenerationInterruption[];
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function backoffFor(policy: RetryPolicy, retryIndex: number): number {
  const list = policy.backoffMs;
  if (list.length === 0) return 0;
  return list[Math.min(retryIndex, list.length - 1)] ?? 0;
}

export function usagePauseMs(policy: RetryPolicy, now: number, resetAt: number | undefined): number {
  if (resetAt === undefined) return policy.defaultUsagePauseMs;
  return Math.max(0, resetAt - now) + policy.usageResumeMarginMs;
}

export async function runWithRetries<T>(
  hooks: RetryHooks<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  clock: Clock = systemClock,
  sleep: Sleeper = realSleep,
): Promise<DomainResult<RetryResult<T>>> {
  const attempts: GenerationAttempt[] = [];
  const interruptions: GenerationInterruption[] = [];
  for (;;) {
    const startedAt = clock.now();
    const r = await hooks.runAttempt();
    if (!r.success) return DomainResult.fail(r.errors);
    const report = r.data;
    const d = report.disposition;
    if (d.kind === 'usage-limit') {
      if (interruptions.length >= policy.maxInterruptions) {
        return DomainResult.fail([
          {
            code: 'GEN_USAGE_LIMIT_PERSISTS',
            message: `usage limit still reported after ${String(policy.maxInterruptions)} pauses; the grid stops at this cell`,
            context: { interruptions: interruptions.length },
          },
        ]);
      }
      const moved = hooks.onInterruption(interruptions.length);
      if (!moved.success) return DomainResult.fail(moved.errors);
      interruptions.push({ at: iso(startedAt), subtype: d.usage.subtype, movedTo: moved.data });
      await sleep(usagePauseMs(policy, clock.now(), d.usage.resetAt));
      continue;
    }
    attempts.push({ startedAt: iso(startedAt), outcome: d.label });
    if (d.kind === 'infrastructure') {
      const retriesUsed = attempts.length - 1;
      if (retriesUsed < policy.maxInfrastructureRetries) {
        await sleep(backoffFor(policy, retriesUsed));
        const reset = hooks.onRetry();
        if (!reset.success) return DomainResult.fail(reset.errors);
        continue;
      }
      return DomainResult.ok({ last: report, exhausted: true, attempts, interruptions });
    }
    return DomainResult.ok({ last: report, exhausted: false, attempts, interruptions });
  }
}
