/**
 * Tool defect T1 of the v1.3 loop pilot (`Docs/DiagnosticRuns/v1.3-loop-pilot-2026-10-16.md`): a `ddd` spec whose
 * `architecture.ddd.aggregates` is empty but which keeps FF-DT01 (aggregate-boundary) and FF-DT02
 * (repository-aggregate-root). The spec validator accepts it, the compiler rejects it (BR-SPEC-10 `aggregates`).
 *
 * The construct choice is the author's (`Docs/DiagnosticRuns/v1.3-pilot-t1-options-2026-10-16.md`). Each option is
 * a policy here, opt-in; the default `fail` is the status quo (the compile fails, BR-SPEC-10), so nothing changes
 * unless a caller names another policy:
 * - `not-applicable` (option a): the compile disables the aggregate rules and records each as a COMPILER_004
 *   "not-applicable" warning; they stay declared, so the report counts them as declared and dropped;
 * - `exclude` (option c): the scorer removes the aggregate rules from the spec before the compile, and records the
 *   exclusion (COMPILER_006); they are not declared, compiled or scored;
 * - `vacuous` (option d): the rules compile with the empty list and run; `UNWIND []` yields no row, so each passes
 *   with 0 violations and nothing records that it checked nothing.
 * Option b (reject up front) is a validator option, `SpecValidationOptions.rejectEmptyAggregates`.
 */
import type { CompilerInput } from './types.js';
import type { FitnessFunction } from '../shared/types/spec.js';

export const EMPTY_AGGREGATE_POLICIES = ['fail', 'not-applicable', 'exclude', 'vacuous'] as const;
export type EmptyAggregatePolicy = (typeof EMPTY_AGGREGATE_POLICIES)[number];

export function parseEmptyAggregatePolicy(value: string): EmptyAggregatePolicy | undefined {
  return (EMPTY_AGGREGATE_POLICIES as readonly string[]).includes(value) ? value as EmptyAggregatePolicy : undefined;
}

/** The DDD templates that read `$aggregates` (FF-DT01, FF-DT02 in the preset). */
export const AGGREGATE_TEMPLATE_NAMES: readonly string[] = ['aggregate-boundary', 'repository-aggregate-root'];

/** The `not-applicable` reason, also the COMPILER_004 message tail. */
export const EMPTY_AGGREGATES_REASON = 'not-applicable: architecture.ddd.aggregates is empty, so the rule has no aggregate to check (T1 option a)';

/** The warning code of the `exclude` policy. */
export const EXCLUDED_AGGREGATE_RULES = 'COMPILER_006';

/** The enabled aggregate rules of a `ddd` input that declares no aggregate; [] for any other input. */
export function aggregateRulesWithoutAggregates(input: CompilerInput): readonly FitnessFunction[] {
  if (input.style?.toLowerCase() !== 'ddd') return [];
  const ddd = input.layerModel.ddd;
  if (ddd === undefined || ddd.aggregates.length > 0) return [];
  return input.fitnessFunctions.filter((f) => f.enabled && AGGREGATE_TEMPLATE_NAMES.includes(f.name));
}

/** The `exclude` policy: the input without the aggregate rules, and the ids it removed (empty when nothing applies). */
export function excludeAggregateRules(input: CompilerInput): { readonly input: CompilerInput; readonly excluded: readonly string[] } {
  const rules = aggregateRulesWithoutAggregates(input);
  if (rules.length === 0) return { input, excluded: [] };
  const ids = new Set(rules.map((f) => String(f.id)));
  return { input: { ...input, fitnessFunctions: input.fitnessFunctions.filter((f) => !ids.has(String(f.id))) }, excluded: [...ids] };
}

export function excludedAggregateRulesMessage(excluded: readonly string[]): string {
  return `${excluded.join(', ')} excluded from scoring: architecture.ddd.aggregates is empty (T1 option c)`;
}
