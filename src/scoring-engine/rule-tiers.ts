/**
 * v1.3 rule tiers (FR-V6). The a priori table of `Docs/v1.3/rule-tiers.md` (sealed in `Docs/v1.3/sealed-hashes.md`),
 * held here as data keyed by rule id and style. It is kept out of the frozen registries
 * (`TEMPLATE_REGISTRY`, `CYPHER_TEMPLATES`, the `FitnessFunction.severity` field), so the v1.2E instrument and
 * its registered artefacts are unchanged. A tier change needs an ADR (rule-tiers.md, first paragraph); the unit
 * test `tests/unit/scoring-engine/rule-tiers.test.ts` parses the document and fails when the two disagree.
 */

export type RuleTier = 'blocking' | 'advisory';

/** Path of the binding tier document (reported in `report.tiers.tierTable`). */
export const RULE_TIERS_DOC = 'Docs/v1.3/rule-tiers.md';

/** A rule whose violations are partly not applicable (rule-tiers.md, FF-P06). */
export interface PartialRule {
  /** Rows with this `relType` (the third discriminator of `domain-state-purity`) are reported N/A. */
  readonly naRelType: 'FLOWS_TO';
  /** The part reported N/A, as the report names it. */
  readonly naPart: string;
  readonly reason: string;
}

export interface RuleTierEntry {
  readonly ruleId: string;
  /** The tier for every style not listed in `byStyle`. */
  readonly tier: RuleTier;
  /** Style-dependent tiers (FF-S03: blocking only for `layered`). */
  readonly byStyle?: Readonly<Record<string, RuleTier>>;
  /** LLM judge dimension: reported and non-blocking in v1.3 (FF-N01, FF-N02). */
  readonly judge?: true;
  readonly partial?: PartialRule;
  /** The construct reason of rule-tiers.md, shortened. */
  readonly reason: string;
}

const entry = (ruleId: string, tier: RuleTier, reason: string, extra: Partial<RuleTierEntry> = {}): RuleTierEntry =>
  ({ ruleId, tier, reason, ...extra });

const metric = 'Metric threshold';
const proxy = 'Proxy';
const convention = 'Convention';

/**
 * The existing rules of the v1.2E registry (rule-tiers.md, first table). The hexagonal library re-uses the same ids
 * for its graph templates (`src/spec-parser/hexagonal-template.ts`); the second table's tiers agree with these rows
 * (`HEXAGONAL_RULE_TIERS` below, checked by the unit test), so one id-keyed table serves every style.
 */
export const RULE_TIERS: ReadonlyMap<string, RuleTierEntry> = new Map([
  entry('FF-S01', 'blocking', 'The dependency rule: dependencies point inward or downward'),
  entry('FF-S02', 'blocking', 'Acyclic dependencies principle; a structural fact'),
  entry('FF-S03', 'advisory', 'Only strict layering forbids skipping; Clean and Hexagonal allow skipping inward', { byStyle: { layered: 'blocking' } }),
  entry('FF-S04', 'blocking', 'Core isolation'),
  entry('FF-P01', 'blocking', 'The domain is framework-free'),
  entry('FF-P02', 'advisory', 'A ratio with a threshold (0.85), so a proxy'),
  entry('FF-P03', 'blocking', 'Port in the core, implementation in infrastructure: a structural placement fact'),
  entry('FF-P04', 'advisory', 'Design guideline, not a defining constraint'),
  entry('FF-P05', 'advisory', 'Guideline (DTOs at boundaries); styles differ on it'),
  entry('FF-P06', 'blocking', 'Core isolation of state; only the constructor-injection half is valid', {
    partial: {
      naRelType: 'FLOWS_TO',
      naPart: 'FLOWS_TO field rows',
      reason: 'The field half needs FLOWS_TO, which is near-empty (rule-tiers.md, finding 9); reported N/A with its denominator',
    },
  }),
  entry('FF-C01', 'advisory', metric),
  entry('FF-C02', 'advisory', metric),
  entry('FF-C03', 'advisory', metric),
  entry('FF-C04', 'advisory', metric),
  entry('FF-C05', 'advisory', metric),
  entry('FF-C06', 'advisory', metric),
  entry('FF-SO01', 'advisory', proxy),
  entry('FF-SO02', 'advisory', proxy),
  entry('FF-SO03', 'advisory', proxy),
  entry('FF-CV01', 'advisory', convention),
  entry('FF-CV02', 'advisory', convention),
  entry('FF-CV03', 'advisory', convention),
  entry('FF-CV04', 'advisory', convention),
  entry('FF-CV05', 'advisory', convention),
  entry('FF-CV06', 'advisory', convention),
  entry('FF-N01', 'advisory', 'LLM judgement; reported, non-blocking in v1.3', { judge: true }),
  entry('FF-N02', 'advisory', 'LLM judgement; reported, non-blocking in v1.3', { judge: true }),
].map((e): [string, RuleTierEntry] => [e.ruleId, e]));

/**
 * The hexagonal templates (rule-tiers.md, second table), keyed by template name, with the id the hexagonal library
 * gives each. `port-dependency-inversion` is advisory: its Cypher computes a ratio of injected interfaces against
 * `$threshold` (src/fitness-compiler/hexagonal-templates.ts), not a pure edge fact (Docs/v1.3-hexagonal-notes.md §8).
 */
export const HEXAGONAL_RULE_TIERS: ReadonlyMap<string, { readonly ruleId: string; readonly tier: RuleTier }> = new Map([
  ['dependency-direction-graph', { ruleId: 'FF-S01', tier: 'blocking' }],
  ['core-isolation', { ruleId: 'FF-S04', tier: 'blocking' }],
  ['port-adapter-pattern', { ruleId: 'FF-P03', tier: 'blocking' }],
  ['port-dependency-inversion', { ruleId: 'FF-P02', tier: 'advisory' }],
  ['layer-skip-graph', { ruleId: 'FF-S03', tier: 'advisory' }],
]);

export interface ResolvedTier {
  readonly tier: RuleTier;
  /** `table`: from rule-tiers.md; `untiered-default`: an id the table does not list (ADR-derived, custom). */
  readonly source: 'table' | 'untiered-default';
  readonly entry?: RuleTierEntry;
}

/**
 * The v1.3 tier of a rule under a style. An id the table does not list (an ADR-derived or custom function, a v1.3
 * example template under a user id) is advisory by default: only rules the sealed table names blocking can fail a
 * v1.3 verdict. The source is reported so an untiered rule is visible.
 */
export function ruleTier(ruleId: string, style?: string): ResolvedTier {
  const e = RULE_TIERS.get(ruleId);
  if (e === undefined) return { tier: 'advisory', source: 'untiered-default' };
  const byStyle = style !== undefined ? e.byStyle?.[style.toLowerCase()] : undefined;
  return { tier: byStyle ?? e.tier, source: 'table', entry: e };
}
