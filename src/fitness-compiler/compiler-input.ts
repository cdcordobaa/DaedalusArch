import type { ParsedSpec } from '../shared/types/spec.js';
import type { CompilerInput } from './types.js';

/**
 * The only builder of `CompilerInput` (BR-U1-11, FR-20). `style` is lower-cased and the
 * key is absent (not `undefined`) when the spec declares no style.
 */
export function compilerInputFromSpec(spec: ParsedSpec): CompilerInput {
  return {
    fitnessFunctions: spec.fitnessFunctions,
    adrRules: spec.adrRules,
    layerModel: spec.layerModel,
    scoringWeights: spec.scoringWeights,
    ...(spec.style != null ? { style: spec.style.toLowerCase() } : {}),
  };
}
