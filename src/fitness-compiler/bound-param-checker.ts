import type { FunctionId } from '../shared/types/value-objects.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { FIELD_TO_YAML_KEY } from '../spec-parser/function-fields.js';
import type { CompilerError, CompilerInput } from './types.js';
import { CYPHER_TEMPLATES } from './cypher-templates.js';
import { bindLayerParams } from './layer-binding.js';
import { isTemplateApplicable } from './template-applicability.js';
import { buildParams, filterEnabled } from './fitness-compiler.js';

/** One required template parameter that `buildParams` leaves unbound (BR-SPEC-10, BR-U1-09). */
export interface UnboundParameter {
  readonly functionId: FunctionId;
  readonly parameter: string;
  readonly yamlKey?: string;
}

/** List parameters for which an empty list counts as unbound (BR-U1-07). */
const EMPTY_LIST_UNBOUND: ReadonlySet<string> = new Set(['forbiddenImports', 'applicationLayers']);

function isBound(parameter: string, value: unknown): boolean {
  if (value == null) return false;
  if (EMPTY_LIST_UNBOUND.has(parameter) && Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Probe form of BR-SPEC-10 (C6): every enabled `symbolic`/`hybrid` function with a template that survives
 * applicability (C5, BR-U1-10) must have each `requiredParams` entry bound by `buildParams`.
 * Sorted by function id, then by `requiredParams` order. Uses the compiler's own `buildParams` and
 * `isTemplateApplicable`, so the checker and the compiler cannot disagree.
 */
export function findUnboundParameters(input: CompilerInput): readonly UnboundParameter[] {
  const { enabled } = filterEnabled(input.fitnessFunctions);
  const binding = bindLayerParams(input.layerModel.layers);
  const perFunction: { id: string; unbound: UnboundParameter[] }[] = [];

  for (const ff of enabled) {
    if (ff.route === 'neuronal') continue;
    const template = CYPHER_TEMPLATES.get(ff.name);
    if (!template) continue;
    if (!isTemplateApplicable(template, input.style, binding, input.layerModel).applicable) continue;

    const params = buildParams(ff, input.layerModel, binding);
    const unbound: UnboundParameter[] = [];
    for (const parameter of template.requiredParams) {
      if (isBound(parameter, params[parameter])) continue;
      const yamlKey = FIELD_TO_YAML_KEY[parameter];
      unbound.push({ functionId: ff.id, parameter, ...(yamlKey != null ? { yamlKey } : {}) });
    }
    if (unbound.length > 0) perFunction.push({ id: String(ff.id), unbound });
  }

  perFunction.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return perFunction.flatMap((f) => f.unbound);
}

/**
 * Fatal form of BR-SPEC-10: one `MISSING_REQUIRED_PARAM` error per unbound pair, message
 * `BR-SPEC-10 <id>: <parameter>`. Always fatal, independent of strict mode (FR-08).
 */
export function checkBoundParameters(input: CompilerInput): DomainResult<undefined> {
  const unbound = findUnboundParameters(input);
  if (unbound.length === 0) return DomainResult.ok(undefined);
  return DomainResult.fail<undefined>(unbound.map((u): CompilerError => ({
    code: 'MISSING_REQUIRED_PARAM',
    message: `BR-SPEC-10 ${String(u.functionId)}: ${u.parameter}`,
    stage: 'fitness-compiler',
    critical: true,
  })));
}
