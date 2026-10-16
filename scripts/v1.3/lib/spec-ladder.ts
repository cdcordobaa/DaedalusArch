/**
 * v1.3 SO5 spec ladder statistics (scripts/v1.3/spec-ladder.ts): monotonicity of a per-level series and rule
 * switch-on/switch-off levels. Pure.
 */

export type Monotonicity = 'constant' | 'non-decreasing' | 'non-increasing' | 'neither';

/** Direction of a series ordered by ladder level (missing levels already removed). */
export function monotonicity(xs: readonly number[]): Monotonicity {
  let up = false;
  let down = false;
  for (let i = 1; i < xs.length; i++) {
    if (xs[i]! > xs[i - 1]!) up = true;
    if (xs[i]! < xs[i - 1]!) down = true;
  }
  if (up && down) return 'neither';
  if (up) return 'non-decreasing';
  if (down) return 'non-increasing';
  return 'constant';
}

export interface RuleTrace {
  /** First level (in ladder order) where the rule has a blocking finding, or null if never. */
  readonly firstOn: string | null;
  /** Whether the rule fires at the last level. */
  readonly onAtLast: boolean;
  /** Whether the rule fires at some level but not at the last level. */
  readonly switchedOff: boolean;
}

/** Trace one rule over levels: `counts[i]` is its blocking count at `levels[i]`. */
export function traceRule(levels: readonly string[], counts: readonly number[]): RuleTrace {
  if (levels.length !== counts.length || levels.length === 0) throw new Error('levels and counts must be non-empty and aligned');
  const i = counts.findIndex((c) => c > 0);
  const onAtLast = counts[counts.length - 1]! > 0;
  return { firstOn: i < 0 ? null : levels[i]!, onAtLast, switchedOff: i >= 0 && !onAtLast };
}
