/**
 * Compile-time construct switches (v1.3 only, `CompileOptions.constructSwitches`): preset additions, a preset's layer
 * order, rule applicability, and the carrier functions of rules that have no template of their own. With every
 * question at its status quo `applyConstructCompileOverlays` returns its input (same object) and
 * `constructInapplicableReason` returns undefined, so the compiled text is byte-identical.
 *
 * A carrier is a declared function whose query returns no row (`CONSTRUCT_CARRIER_TEMPLATE`); the row stage
 * (`rows.ts`) fills its rows from the in-memory graph. It makes a new rule a compiled and executed function, so the
 * report's identities (declared, compiled, executed) count it like any other rule.
 */
import type { CypherTemplate } from '../fitness-compiler/types.js';
import type { CompilerInput } from '../fitness-compiler/types.js';
import type { FitnessFunction, LayerDefinition } from '../shared/types/spec.js';
import type { ConstructAnswers } from '../shared/construct-switches.js';
import { isStatusQuo } from '../shared/construct-switches.js';
import { functionId } from '../shared/types/value-objects.js';
import {
  ADAPTER_ISOLATION_ID, BARREL_APPLICATION_ID, CONSTRUCT_COMPOSITION_ROOT_GLOBS, CONSTRUCT_LAYER_RULE_TEMPLATES,
} from './overlays.js';

export const CONSTRUCT_CARRIER_NAME = 'construct-switch-carrier';

/** Returns no row; its rows come from the row stage. The exclude anchor lets a carrier keep its function's excludes. */
export const CONSTRUCT_CARRIER_TEMPLATE: CypherTemplate = {
  functionName: CONSTRUCT_CARRIER_NAME,
  template: `MATCH (f:File)
WHERE false /*EXCLUDE:f*/
RETURN f.filePath AS filePath`,
  requiredParams: [],
  optionalParams: [],
  description: 'Construct-switch carrier: the rows of this function come from the v1.3 row stage (src/construct-switches/rows.ts)',
  resultMapping: { filePathColumn: 'filePath', messageTemplate: 'Violation in {filePath}', discriminatorColumns: [] },
  tag: 'structural',
  requiredLayerKinds: [],
};

export const CONSTRUCT_TEMPLATES: ReadonlyMap<string, CypherTemplate> = new Map([[CONSTRUCT_CARRIER_NAME, CONSTRUCT_CARRIER_TEMPLATE]]);

/** True when the compile hook has something to do. */
export function constructSwitchesActive(answers: ConstructAnswers | undefined): answers is ConstructAnswers {
  return answers !== undefined && !isStatusQuo(answers);
}

const carrier = (id: string, name: string, dimension: FitnessFunction['dimension'], severity: FitnessFunction['severity']): FitnessFunction => ({
  id: functionId(id), name, dimension, severity, route: 'symbolic', isBuiltIn: false, validated: false, enabled: true, excludePaths: [],
});

/** Q13 C: the Clean order (inner to outer): domain, application, presentation, infrastructure. */
function cleanOrder(layers: readonly LayerDefinition[]): LayerDefinition[] {
  const rank = (l: LayerDefinition): number => ({ domain: 0, application: 1, presentation: 2, infrastructure: 3 } as const)[l.kind ?? 'application'];
  return layers.map((l, i) => ({ l, i })).sort((x, y) => rank(x.l) - rank(y.l) || x.i - y.i).map((x) => x.l);
}

/**
 * The spec as the chosen options declare it. Every change is an addition or re-declaration the question names:
 * - Q5 D: FF-S05 adapter-isolation (carrier) in hexagonal and ddd;
 * - Q13 C: the nestjs layers in the Clean order;
 * - Q16 B: FF-S02 no-cyclic-deps in the ddd preset;
 * - Q17 C: FF-DS03 barrel-publishes-application (carrier) in ddd;
 * - Q24 B: FF-S03 runs as a carrier in clean-architecture and nestjs, where no-layer-skip does not apply;
 * - Q25 B: the composition-root globs are excluded from the layer rules.
 */
export function applyConstructCompileOverlays(input: CompilerInput, answers: ConstructAnswers | undefined): CompilerInput {
  if (!constructSwitchesActive(answers)) return input;
  const style = input.style?.toLowerCase();
  let functions: FitnessFunction[] = [...input.fitnessFunctions];
  let layerModel = input.layerModel;
  const has = (id: string): boolean => functions.some((f) => String(f.id) === id);

  if (answers.Q5 === 'D' && (style === 'hexagonal' || style === 'ddd') && !has(ADAPTER_ISOLATION_ID)) {
    functions.push(carrier(ADAPTER_ISOLATION_ID, CONSTRUCT_CARRIER_NAME, 'structural', 'critical'));
  }
  if (answers.Q13 === 'C' && style === 'nestjs') {
    layerModel = { ...layerModel, layers: cleanOrder(layerModel.layers) };
  }
  if (answers.Q16 === 'B' && style === 'ddd' && !has('FF-S02')) {
    functions.push({ ...carrier('FF-S02', 'no-cyclic-deps', 'structural', 'critical'), isBuiltIn: true });
  }
  if (answers.Q17 === 'C' && style === 'ddd' && !has(BARREL_APPLICATION_ID)) {
    functions.push(carrier(BARREL_APPLICATION_ID, CONSTRUCT_CARRIER_NAME, 'structural', 'minor'));
  }
  if (answers.Q24 === 'B' && (style === 'clean-architecture' || style === 'nestjs')) {
    functions = functions.map((f) => (String(f.id) === 'FF-S03' && f.name === 'no-layer-skip' ? { ...f, name: CONSTRUCT_CARRIER_NAME } : f));
  }
  if (answers.Q25 === 'B') {
    functions = functions.map((f) => (CONSTRUCT_LAYER_RULE_TEMPLATES.includes(f.name)
      ? { ...f, excludePaths: [...f.excludePaths, ...CONSTRUCT_COMPOSITION_ROOT_GLOBS.filter((g) => !f.excludePaths.includes(g))] }
      : f));
  }
  return { ...input, fitnessFunctions: functions, layerModel };
}

/**
 * Switch-dependent v1.3 applicability, on top of `V13_STYLE_APPLICABILITY`:
 * - Q1 B or C: FF-P06 domain-state-purity applies to layered again (ADR-V13-02 withdrawn);
 * - Q10 C or D: FF-P01 domain-purity is not applicable to layered (P1).
 * Returns `{ lift: true }` to lift a v1.3 inapplicability, a reason to disable, or undefined (no switch decides).
 */
export function constructApplicability(templateName: string, style: string | undefined, answers: ConstructAnswers | undefined): { readonly lift: true } | string | undefined {
  if (!constructSwitchesActive(answers) || style === undefined) return undefined;
  const s = style.toLowerCase();
  if ((answers.Q1 === 'B' || answers.Q1 === 'C') && templateName === 'domain-state-purity' && s === 'layered') return { lift: true };
  if ((answers.Q10 === 'C' || answers.Q10 === 'D') && templateName === 'domain-purity' && s === 'layered') {
    return 'not applicable to style layered (construct switch Q10: the layered sources state no purity rule, P1)';
  }
  return undefined;
}
