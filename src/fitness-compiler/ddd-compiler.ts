/**
 * Compile path of the `ddd` style (v1.3, FR-V4). `compileFunctions` hands a ddd input here. A function whose name is
 * a DDD template compiles from `DDD_TEMPLATES` with the bound `architecture.ddd` declarations; a function whose name is
 * a hexagonal template (the composed layering, FF-S01 and FF-S03 in the preset) compiles from `HEXAGONAL_TEMPLATES`
 * with the hexagonal binding of the same layer model; every other function goes through the unchanged core compiler
 * with the style kept, so the Clean-Architecture-only templates stay disabled for it.
 */
import type { CompiledFunctions, CypherQuery } from '../shared/types/evaluation.js';
import type { FitnessFunction } from '../shared/types/spec.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import type { CompilerError, CompilerInput, CompilerWarning, CypherTemplate } from './types.js';
import { bindDddModel, buildDddParams, DDD_LITERAL_VIEW_TEMPLATES, DDD_TEMPLATES } from './ddd-templates.js';
import { bindHexagonalLayers, buildHexagonalParams, HEXAGONAL_TEMPLATES } from './hexagonal-templates.js';
import { globToRegex } from './glob-to-regex.js';
import { replaceExcludeMarkers } from './exclude-injector.js';
import { applyV13Rewrites, NO_V13_REWRITES } from './v13-rewrites.js';
import type { V13RewriteFlags } from './v13-rewrites.js';

type CoreCompile = (input: CompilerInput) => DomainResult<CompiledFunctions>;

function compilerError(message: string): CompilerError {
  return { code: 'COMPILATION_FAILED', message, stage: 'fitness-compiler', critical: true };
}

function toQuery(ff: FitnessFunction, template: CypherTemplate | undefined, params: Record<string, unknown>, rewrites: V13RewriteFlags): CypherQuery | CompilerError {
  if (template === undefined) return compilerError(`${String(ff.id)}: no template ${ff.name}`);
  for (const name of template.requiredParams) {
    const value = params[name];
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      return { ...compilerError(`BR-SPEC-10 ${String(ff.id)}: ${name}`), code: 'MISSING_REQUIRED_PARAM' };
    }
  }
  const excludePatterns = ff.excludePaths.map((g) => globToRegex(g));
  const withExcludes = excludePatterns.length > 0 ? { ...params, excludePatterns } : params;
  // v1.3: under the edge views a DDD template may read the literal barrel edge directly (DDD_LITERAL_VIEW_TEMPLATES).
  const text = rewrites.edgeViews ? DDD_LITERAL_VIEW_TEMPLATES.get(template.functionName) ?? template.template : template.template;
  const cypher = replaceExcludeMarkers(text, excludePatterns.length > 0);
  return {
    functionId: ff.id,
    name: ff.name,
    // v1.3 edge views (ADR-V13-01, `edge-views.ts`), selected by template name.
    cypher: applyV13Rewrites(template.functionName, cypher, rewrites),
    params: withExcludes,
    dimension: ff.dimension,
    severity: ff.severity,
    ...(ff.threshold != null ? { threshold: ff.threshold } : {}),
    route: 'symbolic',
    source: 'template' as const,
  };
}

export function compileDddFunctions(input: CompilerInput, core: CoreCompile, rewrites: V13RewriteFlags = NO_V13_REWRITES): DomainResult<CompiledFunctions> {
  const enabled = input.fitnessFunctions.filter((f) => f.enabled);
  const own = enabled.filter((f) => DDD_TEMPLATES.has(f.name));
  const hex = enabled.filter((f) => HEXAGONAL_TEMPLATES.has(f.name));

  const ddd = bindDddModel(input.layerModel);
  if (!ddd.ok) return DomainResult.fail<CompiledFunctions>(ddd.errors.map((m) => compilerError(m)));
  const hexBound = hex.length > 0 ? bindHexagonalLayers(input.layerModel) : undefined;
  if (hexBound !== undefined && !hexBound.ok) return DomainResult.fail<CompiledFunctions>(hexBound.errors.map((m) => compilerError(m)));

  const ownIds = new Set([...own, ...hex].map((f) => String(f.id)));
  const rest = core({ ...input, fitnessFunctions: input.fitnessFunctions.filter((f) => !ownIds.has(String(f.id))) });
  if (!rest.success) return rest;

  const queries: CypherQuery[] = [];
  const errors: CompilerError[] = [];
  for (const ff of own) {
    const q = toQuery(ff, DDD_TEMPLATES.get(ff.name), buildDddParams(ff, ddd.binding), rewrites);
    if ('cypher' in q) queries.push(q); else errors.push(q);
  }
  if (hexBound?.ok) {
    for (const ff of hex) {
      const q = toQuery(ff, HEXAGONAL_TEMPLATES.get(ff.name), buildHexagonalParams(ff, hexBound.binding), rewrites);
      if ('cypher' in q) queries.push(q); else errors.push(q);
    }
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
