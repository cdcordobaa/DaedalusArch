/**
 * v1.3 scoring mode (FR-V6; Docs/v1.3/rule-tiers.md). Computed beside the v1.2E scoring, never instead of it: the
 * v1.2E dimension rows and AHS fields are produced by `scoreDimensions` exactly as before, and this module only adds
 * the tiered reading.
 *
 * Verdict rule (`any-blocking-violation`): the v1.3 verdict is `fail` iff at least one blocking rule has at least one
 * applicable violation, else `pass`. Advisory rules (metrics, proxies, conventions, the judge) never change it. The
 * blocking-only AHS is reported, but no threshold is applied to it: a blocking rule is a structural fact, and every
 * blocking AHS below 1 already implies a blocking violation, so a threshold clause could never change the verdict.
 *
 * Partial rule (FF-P06): its FLOWS_TO rows are reported N/A with their denominator (all FF-P06 rows, and the FLOWS_TO
 * edge count of the graph when the APG is available); only the CONSTRUCTOR_INJECTS rows count.
 */
import type {
  EvaluationResults, NotApplicablePart, ScoringMode, SymbolicFunctionResult, TierGroup, TierRuleRow, TieredScoring,
} from '../shared/types/evaluation.js';
import type { Violation } from '../shared/taxonomy/violation-types.js';
import type { Dimension, OverallVerdict } from '../shared/types/enums.js';
import { SYMBOLIC_DIMENSIONS } from '../shared/types/enums.js';
import type { ConfidenceThresholds, FitnessFunction, ScoringWeights } from '../shared/types/spec.js';
import type { FunctionId } from '../shared/types/value-objects.js';
import type { APGResult } from '../shared/types/apg.js';
import { RULE_TIERS_DOC, ruleTier } from './rule-tiers.js';
import type { PartialRule, ResolvedTier, RuleTier } from './rule-tiers.js';
import { avrOf, tallyDimensions } from './score-computer.js';
import { ahsFromEffectiveWeights, renormaliseWeights } from './renormaliser.js';

export interface TieredScoringInput {
  readonly evaluationResults: EvaluationResults;
  readonly fitnessFunctions: readonly FitnessFunction[];
  /** The spec's `architecture.style` (lower-cased by the parser); tiers can depend on it (FF-S03). */
  readonly style?: string;
  readonly scoringWeights: ScoringWeights;
  readonly confidenceThresholds?: ConfidenceThresholds;
  /** The v1.2E verdict of the same run, carried for comparison. */
  readonly v12eVerdict: OverallVerdict;
  readonly apg?: APGResult;
  /** v1.3 construct switches (`src/construct-switches/tiers.ts`); absent at the status quo, where `ruleTier` applies. */
  readonly tierResolver?: TierResolver;
}

/**
 * A switch-aware tier lookup. `rule` replaces `ruleTier`; `row`, when present, gives single rows of a rule another
 * tier (Q3 C: in-component cycles of FF-S02 advisory), reported as a second row of the same function in that tier.
 */
export interface TierResolver {
  readonly rule: (ruleId: string, style: string | undefined) => ResolvedTier;
  readonly row?: {
    readonly tierOf: (ruleId: string, row: { readonly filePath: string; readonly target?: string }) => RuleTier | undefined;
    readonly label: (ruleId: string) => string;
  };
}

/** `relType` of a `domain-state-purity` row: its third discriminator (`class, targetName, relType, field`). */
export function relTypeOf(v: Violation): string | undefined {
  const fromDiscriminator = v.discriminator?.[2];
  if (fromDiscriminator !== undefined) return fromDiscriminator;
  const m = / via (FLOWS_TO|HOLDS_STATE_OF|CONSTRUCTOR_INJECTS) /.exec(v.message);
  return m?.[1];
}

/** The rows of a partial rule that count, and those reported N/A. */
export function splitPartial(violations: readonly Violation[], partial: PartialRule): { counted: Violation[]; na: Violation[] } {
  const counted: Violation[] = [];
  const na: Violation[] = [];
  for (const v of violations) (partial.naRelTypes.includes(relTypeOf(v) ?? '') ? na : counted).push(v);
  return { counted, na };
}

/**
 * Where one violation row counts in the v1.3 scoring: `not-applicable` for the N/A part of a partial rule (FF-P06),
 * else the row's tier under the construct switches, else its rule's tier. This is the placement `computeTieredScoring`
 * makes row by row, for callers that list findings beside the tier counts (the loop harness); such a caller checks
 * that its blocking rows add up to `tiers.blocking.violationCount`.
 */
export function countedTierOf(v: Violation, style: string | undefined, resolver?: TierResolver): RuleTier | 'not-applicable' {
  const id = String(v.functionId);
  const resolved = (resolver?.rule ?? ruleTier)(id, style);
  const partial = resolved.entry?.partial;
  if (partial !== undefined && v.route !== 'neuronal' && splitPartial([v], partial).na.length > 0) return 'not-applicable';
  return resolver?.row?.tierOf(id, v) ?? resolved.tier;
}

interface Executed {
  readonly id: string;
  dimension: Dimension;
  symbolic?: SymbolicFunctionResult;
  neuralViolations?: readonly Violation[];
  neuralFailed?: boolean;
}

function executedById(results: EvaluationResults): Map<string, Executed> {
  const failed = new Set((results.failures ?? []).map((f) => String(f.functionId)));
  const byId = new Map<string, Executed>();
  for (const r of results.symbolicResults) {
    const id = String(r.functionId);
    if (failed.has(id)) continue;
    byId.set(id, { ...byId.get(id), id, dimension: r.dimension, symbolic: r });
  }
  for (const r of results.neuronalResults) {
    const id = String(r.functionId);
    if (failed.has(id)) continue;
    const prior = byId.get(id);
    if (prior?.symbolic?.neuralSkipped !== undefined) continue;
    byId.set(id, { ...prior, id, dimension: prior?.dimension ?? r.dimension, neuralViolations: r.violations, neuralFailed: r.verdict === 'fail' });
  }
  return byId;
}

function group(rules: readonly TierRuleRow[]): TierGroup {
  return {
    rules,
    violatedRules: rules.filter((r) => r.violated).length,
    violationCount: rules.reduce((sum, r) => sum + r.violationCount, 0),
  };
}

const byId = (a: { functionId: FunctionId }, b: { functionId: FunctionId }): number =>
  String(a.functionId) < String(b.functionId) ? -1 : String(a.functionId) > String(b.functionId) ? 1 : 0;

export function computeTieredScoring(input: TieredScoringInput): TieredScoring {
  const names = new Map(input.fitnessFunctions.map((f) => [String(f.id), f.name]));
  const flowsToEdges = input.apg !== undefined ? input.apg.edges.filter((e) => e.type === 'FLOWS_TO').length : null;
  const executed = executedById(input.evaluationResults);

  const blockingRows: TierRuleRow[] = [];
  const advisoryRows: TierRuleRow[] = [];
  const notApplicable: NotApplicablePart[] = [];
  const blockingSymbolic: SymbolicFunctionResult[] = [];

  const tierOf = input.tierResolver?.rule ?? ruleTier;
  const rowTier = input.tierResolver?.row;

  for (const fn of executed.values()) {
    const resolved = tierOf(fn.id, input.style);
    const symbolicViolations = fn.symbolic?.violations ?? [];
    let counted: readonly Violation[] = [...symbolicViolations, ...(fn.neuralViolations ?? [])];
    let violated = (fn.symbolic !== undefined && !fn.symbolic.passed) || fn.neuralFailed === true;

    const partial = resolved.entry?.partial;
    if (partial !== undefined && fn.symbolic !== undefined) {
      const split = splitPartial(symbolicViolations, partial);
      counted = split.counted;
      violated = split.counted.length > 0;
      notApplicable.push({
        functionId: fn.symbolic.functionId,
        part: partial.naPart,
        reason: partial.reason,
        naRows: split.na.length,
        totalRows: symbolicViolations.length,
        flowsToEdges,
      });
    }

    const functionId = (fn.symbolic?.functionId ?? fn.id) as FunctionId;

    // v1.3 construct switches (Q3 C): rows of this rule in another tier are reported as a second row of that tier.
    let moved: Violation[] = [];
    let movedTier: RuleTier | undefined;
    if (rowTier !== undefined) {
      const keep: Violation[] = [];
      for (const v of counted) {
        const t = rowTier.tierOf(fn.id, v);
        if (t !== undefined && t !== resolved.tier) {
          moved.push(v);
          movedTier = t;
        } else keep.push(v);
      }
      if (moved.length > 0) {
        counted = keep;
        violated = keep.length > 0;
      } else moved = [];
    }
    if (movedTier !== undefined && moved.length > 0) {
      const extra: TierRuleRow = {
        functionId,
        name: `${names.get(fn.id) ?? fn.id} (${rowTier?.label(fn.id) ?? 'moved part'})`,
        dimension: fn.dimension,
        tier: movedTier,
        tierSource: resolved.source,
        violationCount: moved.length,
        violated: true,
      };
      (movedTier === 'blocking' ? blockingRows : advisoryRows).push(extra);
    }

    const row: TierRuleRow = {
      functionId,
      name: names.get(fn.id) ?? fn.id,
      dimension: fn.dimension,
      tier: resolved.tier,
      tierSource: resolved.source,
      ...(resolved.entry?.judge === true ? { judge: true as const } : {}),
      violationCount: counted.length,
      violated,
    };
    if (resolved.tier === 'blocking') {
      blockingRows.push(row);
      // Blocking rules are symbolic: the judge rules are advisory in the table (rule-tiers.md).
      if (fn.symbolic !== undefined) {
        blockingSymbolic.push(partial !== undefined || moved.length > 0 ? { ...fn.symbolic, passed: !violated, violations: counted } : fn.symbolic);
      }
    } else {
      advisoryRows.push(row);
    }
  }

  // Blocking-only AHS: the v1.2E AVR and renormalisation over the dimensions the blocking rules ran in.
  const tallies = tallyDimensions({ symbolicResults: blockingSymbolic, neuronalResults: [] }, input.confidenceThresholds);
  const counts: Partial<Record<Dimension, number>> = {};
  const avr: Partial<Record<Dimension, number>> = {};
  for (const [d, t] of tallies) {
    counts[d] = t.functionCount;
    avr[d] = Number(avrOf(t));
  }
  const weights = renormaliseWeights(input.scoringWeights, counts, {}, {}, SYMBOLIC_DIMENSIONS);
  const blockingAhs = weights.executedWeight > 0 ? ahsFromEffectiveWeights(weights.effectiveWeights, avr) : null;

  const failed = new Set((input.evaluationResults.failures ?? []).map((f) => String(f.functionId)));
  const blockingNotExecuted = input.fitnessFunctions
    .filter((f) => failed.has(String(f.id)) && tierOf(String(f.id), input.style).tier === 'blocking')
    .map((f) => f.id)
    .sort((a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));

  const blocking = group(blockingRows.sort(byId));
  return {
    scoringMode: 'v1.3',
    tierTable: RULE_TIERS_DOC,
    style: input.style ?? null,
    verdict: blocking.violatedRules > 0 ? 'fail' : 'pass',
    verdictRule: 'any-blocking-violation',
    v12eVerdict: input.v12eVerdict,
    blockingAhs,
    blocking,
    advisory: group(advisoryRows.sort(byId)),
    notApplicable: notApplicable.sort(byId),
    blockingNotExecuted,
  };
}

/**
 * The report's `verdict` in the v1.3 mode, in the existing four-level structure: `pass` (exit 0) for a v1.3 pass,
 * `hard-block` (exit 1) for a v1.3 fail. The v1.2E reading stays in `tiers.v12eVerdict`.
 */
export function overallVerdictOf(tiers: TieredScoring): OverallVerdict {
  return tiers.verdict === 'fail' ? 'hard-block' : 'pass';
}

/** The scoring modes, in CLI order. */
export const SCORING_MODES: readonly ScoringMode[] = ['v1.3', 'v1.2e'];

/** `--scoring` value: `v1.3` or `v1.2e` (case-insensitive); anything else is undefined. */
export function parseScoringMode(value: string): ScoringMode | undefined {
  const v = value.toLowerCase();
  return (SCORING_MODES as readonly string[]).includes(v) ? (v as ScoringMode) : undefined;
}
