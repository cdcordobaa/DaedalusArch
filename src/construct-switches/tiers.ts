/**
 * Tier overrides of the construct switches (v1.3 only). The sealed table (`Docs/v1.3/rule-tiers.md`, held as data in
 * `RULE_TIERS`) is never edited: an option that moves a tier is applied here, on top of `ruleTier`, and only while its
 * switch is set. Each override names the ADR the author must write and sign before the answer is sealed
 * (`rule-tiers.md`, first paragraph: a tier move needs an ADR with a construct reason).
 */
import type { LayerModel } from '../shared/types/spec.js';
import type { ConstructAnswers } from '../shared/construct-switches.js';
import { isStatusQuo } from '../shared/construct-switches.js';
import { ruleTier } from '../scoring-engine/rule-tiers.js';
import type { ResolvedTier, RuleTier, RuleTierEntry } from '../scoring-engine/rule-tiers.js';
import { cycleFiles, cycleInOneComponent, fileLayerAssigner } from './layer-view.js';
import { ADAPTER_ISOLATION_ID, BARREL_APPLICATION_ID } from './overlays.js';

const HEX_DDD = new Set(['hexagonal', 'ddd']);

function override(base: ResolvedTier, ruleId: string, tier: RuleTier, reason: string): ResolvedTier {
  const entry: RuleTierEntry = { ...(base.entry ?? { ruleId, tier }), ruleId, tier, reason };
  return { tier, source: 'table', entry };
}

/** The v1.3 tier of a rule under a style with the switches applied (`ruleTier` when no switch moves it). */
export function constructRuleTier(ruleId: string, style: string | undefined, answers: ConstructAnswers): ResolvedTier {
  const base = ruleTier(ruleId, style);
  if (isStatusQuo(answers)) return base;
  const s = style?.toLowerCase();
  // TODO(ADR-V13-03, Q1 B): the author must write and sign the tier ADR "FF-P06 advisory in layered" before sealing.
  if (answers.Q1 === 'B' && ruleId === 'FF-P06' && s === 'layered') {
    return override(base, ruleId, 'advisory', 'Construct switch Q1 B: FF-P06 advisory in layered (ADR-V13-03, unsigned)');
  }
  // TODO(ADR-V13-03, Q5 B): tier ADR "FF-S03 blocking in hexagonal and ddd" (Cockburn 2005).
  if (answers.Q5 === 'B' && ruleId === 'FF-S03' && s !== undefined && HEX_DDD.has(s)) {
    return override(base, ruleId, 'blocking', 'Construct switch Q5 B: adapter isolation is defining (ADR-V13-03, unsigned)');
  }
  // TODO(ADR-V13-03, Q5 D): new tier row "FF-S05 adapter-isolation blocking in hexagonal and ddd".
  if (answers.Q5 === 'D' && ruleId === ADAPTER_ISOLATION_ID) {
    const tier: RuleTier = s !== undefined && HEX_DDD.has(s) ? 'blocking' : 'advisory';
    return override(base, ruleId, tier, 'Construct switch Q5 D: adapters talk only through ports (ADR-V13-03, unsigned)');
  }
  // TODO(ADR-V13-03, Q14 B): tier ADR "FF-DT03 advisory until the member facts are recorded".
  if (answers.Q14 === 'B' && ruleId === 'FF-DT03') {
    return override(base, ruleId, 'advisory', 'Construct switch Q14 B: FF-DT03 advisory (ADR-V13-03, unsigned)');
  }
  // TODO(ADR-V13-03, Q15 B): tier ADR giving FF-DS01 its own advisory row.
  if (answers.Q15 === 'B' && ruleId === 'FF-DS01') {
    return override(base, ruleId, 'advisory', 'Construct switch Q15 B: FF-DS01 advisory (ADR-V13-03, unsigned)');
  }
  // TODO(ADR-V13-03, Q17 C): new tier row "FF-DS03 barrel-publishes-application advisory".
  if (answers.Q17 === 'C' && ruleId === BARREL_APPLICATION_ID) {
    return override(base, ruleId, 'advisory', 'Construct switch Q17 C: new advisory rule (ADR-V13-03, unsigned)');
  }
  // TODO(ADR-V13-03, Q21 B): tier ADR "FF-DT05 blocking" (Vernon ch. 8).
  if (answers.Q21 === 'B' && ruleId === 'FF-DT05') {
    return override(base, ruleId, 'blocking', 'Construct switch Q21 B: FF-DT05 blocking (ADR-V13-03, unsigned)');
  }
  return base;
}

/** A row-level tier: a rule whose rows are split between two tiers by a switch (Q3 C, Q24 B). */
export interface RowTierResolver {
  /** The tier of one row of `ruleId`, or undefined when the rule's tier applies. */
  readonly tierOf: (ruleId: string, row: { readonly filePath: string; readonly target?: string; readonly discriminator?: readonly string[] }) => RuleTier | undefined;
  /** How the moved part is named in a report. */
  readonly label: (ruleId: string) => string;
}

/** Q24 B: the discriminator head of an inward-bypass row (`rows.ts`, q24InwardBypass). */
export const Q24_BYPASS_DISCRIMINATOR = 'bypass';

/**
 * Q3 C: a file cycle inside one layer and one module is advisory (a proxy for ADP); a cycle across layers or modules
 * keeps the FF-S02 tier. Layers are assigned from the declared globs, as ingestion does for File nodes.
 * TODO(ADR-V13-03, Q3 C): the author must write and sign the tier ADR "FF-S02 split by component".
 */
export function constructRowTiers(
  style: string | undefined, layerModel: LayerModel, answers: ConstructAnswers, layerOf: (file: string) => string | null = fileLayerAssigner(layerModel),
): RowTierResolver | undefined {
  const q3 = answers.Q3 === 'C';
  // Q24 B adds its rows to FF-S03 as advisory rows (catalogue: "an advisory FF-S03 row"). They keep that tier when
  // another switch makes the rule blocking (Q5 B in hexagonal), instead of turning blocking with it (R10).
  const q24 = answers.Q24 === 'B';
  if (!q3 && !q24) return undefined;
  const s = style?.toLowerCase();
  return {
    tierOf: (ruleId, row) => {
      if (q3 && ruleId === 'FF-S02' && cycleInOneComponent(cycleFiles(row.filePath, row.target), layerOf, s, layerModel)) return 'advisory';
      if (q24 && ruleId === 'FF-S03' && row.discriminator?.[0] === Q24_BYPASS_DISCRIMINATOR) return 'advisory';
      return undefined;
    },
    label: (ruleId) => (ruleId === 'FF-S03' ? 'inward-bypass rows (construct switch Q24 B)' : 'in-component cycles (construct switch Q3 C)'),
  };
}
