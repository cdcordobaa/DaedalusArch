/**
 * Compile path of the `hexagonal` style (v1.3). `compileFunctions` hands a hexagonal input here; the functions whose
 * name is a hexagonal template compile from `HEXAGONAL_TEMPLATES`, every other function goes through the unchanged
 * core compiler with the style kept, so the Clean-Architecture-only templates stay disabled for it.
 */
import type { CompiledFunctions, CypherQuery } from '../shared/types/evaluation.js';
import type { FitnessFunction } from '../shared/types/spec.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import type { CompilerError, CompilerInput, CompilerWarning } from './types.js';
import { buildHexagonalParams, bindHexagonalLayers, HEXAGONAL_TEMPLATES } from './hexagonal-templates.js';
import type { HexagonalBinding } from './hexagonal-templates.js';
import { globToRegex } from './glob-to-regex.js';
import { replaceExcludeMarkers } from './exclude-injector.js';
import { applyV13Rewrites, NO_V13_REWRITES } from './v13-rewrites.js';
import type { V13RewriteFlags } from './v13-rewrites.js';

type CoreCompile = (input: CompilerInput) => DomainResult<CompiledFunctions>;

function compilerError(message: string): CompilerError {
  return { code: 'COMPILATION_FAILED', message, stage: 'fitness-compiler', critical: true };
}

function compileTemplateFunction(ff: FitnessFunction, binding: HexagonalBinding, rewrites: V13RewriteFlags): CypherQuery | CompilerError {
  const template = HEXAGONAL_TEMPLATES.get(ff.name);
  if (!template) return compilerError(`${String(ff.id)}: no hexagonal template ${ff.name}`);
  const params = buildHexagonalParams(ff, binding);
  for (const name of template.requiredParams) {
    const value = params[name];
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      return { ...compilerError(`BR-SPEC-10 ${String(ff.id)}: ${name}`), code: 'MISSING_REQUIRED_PARAM' };
    }
  }
  const excludePatterns = ff.excludePaths.map((g) => globToRegex(g));
  if (excludePatterns.length > 0) params.excludePatterns = excludePatterns;
  const cypher = replaceExcludeMarkers(template.template, excludePatterns.length > 0);
  return {
    functionId: ff.id,
    name: ff.name,
    cypher: applyV13Rewrites(template.functionName, cypher, rewrites),
    params,
    dimension: ff.dimension,
    severity: ff.severity,
    ...(ff.threshold != null ? { threshold: ff.threshold } : {}),
    route: 'symbolic',
    source: 'template' as const,
  };
}

export function compileHexagonalFunctions(input: CompilerInput, core: CoreCompile, rewrites: V13RewriteFlags = NO_V13_REWRITES): DomainResult<CompiledFunctions> {
  const bound = bindHexagonalLayers(input.layerModel);
  if (!bound.ok) {
    return DomainResult.fail<CompiledFunctions>(bound.errors.map((m) => compilerError(m)));
  }

  const own = input.fitnessFunctions.filter((f) => f.enabled && HEXAGONAL_TEMPLATES.has(f.name));
  const ownIds = new Set(own.map((f) => String(f.id)));
  const rest = core({ ...input, fitnessFunctions: input.fitnessFunctions.filter((f) => !ownIds.has(String(f.id))) });
  if (!rest.success) return rest;

  const queries: CypherQuery[] = [];
  const errors: CompilerError[] = [];
  for (const ff of own) {
    const q = compileTemplateFunction(ff, bound.binding, rewrites);
    if ('cypher' in q) queries.push(q); else errors.push(q);
  }
  if (errors.length > 0) return DomainResult.fail<CompiledFunctions>(errors);

  const order = new Map(input.fitnessFunctions.map((f, i) => [String(f.id), i]));
  const symbolicQueries = [...rest.data.symbolicQueries, ...queries]
    .sort((a, b) => (order.get(String(a.functionId)) ?? 0) - (order.get(String(b.functionId)) ?? 0));
  const warnings: CompilerWarning[] = [...rest.data.warnings] as CompilerWarning[];
  return DomainResult.ok<CompiledFunctions>({
    ...rest.data,
    symbolicQueries,
    totalCompiled: rest.data.totalCompiled + queries.length,
    warnings,
  });
}
