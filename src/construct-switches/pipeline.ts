/**
 * Pipeline wiring of the construct switches (v1.3 scoring mode only; `createPipeline` adds it when a switch is set).
 * - `constructRowTransform`: the row stage, run by the evaluate commands on their symbolic results before they are
 *   stored, over the APG of the run and the layer model of the spec.
 * - `constructTierResolver`: the switch-aware tier lookup the v1.3 tiered scoring reads.
 */
import type { SymbolicFunctionResult } from '../shared/types/evaluation.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import type { LayerModel } from '../shared/types/spec.js';
import type { ConstructAnswers } from '../shared/construct-switches.js';
import { compilerInputFromSpec } from '../fitness-compiler/compiler-input.js';
import type { ResolvedTier } from '../scoring-engine/rule-tiers.js';
import { applyConstructCompileOverlays, constructSwitchesActive } from './compile.js';
import { constructGraphFromApg } from './graph.js';
import { applyConstructRows } from './rows.js';
import type { RowChange } from './rows.js';
import { constructRowTiers, constructRuleTier } from './tiers.js';
import type { RowTierResolver } from './tiers.js';

export type SymbolicTransform = (results: readonly SymbolicFunctionResult[], context: FirewallContext) => readonly SymbolicFunctionResult[];

/** The row stage as an evaluate-command hook; undefined at the status quo (nothing to do). */
export function constructRowTransform(answers: ConstructAnswers, onChanges?: (changes: readonly RowChange[]) => void): SymbolicTransform | undefined {
  if (!constructSwitchesActive(answers)) return undefined;
  return (results, context) => {
    const snap = context.snapshot();
    const spec = snap.parsedSpec;
    const apg = snap.apgResult;
    if (spec === undefined || apg === undefined) return results;
    const input = applyConstructCompileOverlays(compilerInputFromSpec(spec), answers);
    const out = applyConstructRows(results, {
      answers,
      ...(spec.style !== undefined ? { style: spec.style } : {}),
      layerModel: input.layerModel,
      functions: input.fitnessFunctions,
      // Layers are assigned with the spec's own model, as ingestion assigned them.
      graph: constructGraphFromApg(apg, spec.layerModel),
    });
    onChanges?.(out.changes);
    return out.results;
  };
}

export interface ConstructTierResolver {
  readonly rule: (ruleId: string, style: string | undefined) => ResolvedTier;
  readonly row?: RowTierResolver;
}

/** The switch-aware tier lookup; undefined at the status quo (`ruleTier` applies unchanged). */
export function constructTierResolver(answers: ConstructAnswers, style: string | undefined, layerModel: LayerModel): ConstructTierResolver | undefined {
  if (!constructSwitchesActive(answers)) return undefined;
  const row = constructRowTiers(style, layerModel, answers);
  return { rule: (id, s) => constructRuleTier(id, s, answers), ...(row !== undefined ? { row } : {}) };
}
