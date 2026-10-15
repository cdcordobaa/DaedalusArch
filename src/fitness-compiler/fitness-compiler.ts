import type { FitnessFunction, DisabledFunction, ADRRule, ParsedSpec, LayerModel } from '../shared/types/spec.js';
import type {
  CompiledFunctions, CypherQuery, NeuronalInstruction, HybridPair,
  ContextAssemblyInstruction,
} from '../shared/types/evaluation.js';
import type { PipelineStage } from '../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import type { CompilerInput, CompilerError, CompilerWarning, CypherTemplate, LayerKindBinding } from './types.js';
import { CYPHER_TEMPLATES } from './cypher-templates.js';
import { V13_CYPHER_TEMPLATES } from './v13-templates.js';
import { bindLayerParams } from './layer-binding.js';
import { isTemplateApplicable } from './template-applicability.js';
import { hasExcludeMarker, replaceExcludeMarkers } from './exclude-injector.js';
import { globToRegex } from './glob-to-regex.js';
import { INSTRUMENT_VERSION, roleExemptionPatterns } from './role-exemptions.js';
import type { InstrumentVersion } from './role-exemptions.js';
import { compilerInputFromSpec } from './compiler-input.js';
import { compilePattern } from './pattern-compiler.js';
import { checkBoundParameters } from './bound-param-checker.js';
import { compileHexagonalFunctions } from './hexagonal-compiler.js';
import { HEXAGONAL_STYLE } from './hexagonal-templates.js';
import { applyV13Rewrites } from './v13-rewrites.js';
import type { V13RewriteFlags } from './v13-rewrites.js';
import { v13InapplicableReason } from './v13-applicability.js';
import { compileDddFunctions } from './ddd-compiler.js';
import { DDD_STYLE } from './ddd-templates.js';

// ── Standalone Function ───────────────────────────────────────────────────────

export function filterEnabled(
  functions: readonly FitnessFunction[],
): { enabled: FitnessFunction[]; disabled: DisabledFunction[] } {
  const enabled: FitnessFunction[] = [];
  const disabled: DisabledFunction[] = [];

  for (const ff of functions) {
    if (ff.enabled === false) {
      disabled.push({ id: ff.id, name: ff.name, ...(ff.disabledReason != null ? { reason: ff.disabledReason } : {}) });
    } else {
      enabled.push(ff);
    }
  }

  return { enabled, disabled };
}

/** Compiler options: `instrumentVersion` 1 drops the role exemptions (ADR-026); default `INSTRUMENT_VERSION`. */
export interface CompileOptions {
  readonly instrumentVersion?: InstrumentVersion;
  /** v1.3, OFF by default: also resolve the `V13_CYPHER_TEMPLATES` (module-wiring examples). */
  readonly v13Templates?: boolean;
  /**
   * v1.3 (ADR-V13-01), OFF by default so the compiled text of the frozen catalogue stays byte-identical: rewrite each
   * query to read its template's edge view (literal or resolved, `edge-views.ts`, `Docs/v1.3/edge-views.md`). On a
   * graph extracted with `reExportEdges: 'resolved-only'` the rewrite does not change any row.
   */
  readonly edgeViews?: boolean;
  /**
   * v1.3 fix round, OFF by default: the v1.3 style-applicability table (`v13-applicability.ts`, ADR-V13-02 draft):
   * FF-P06 domain-state-purity applies only to styles with an isolated domain (not `layered`).
   */
  readonly styleApplicability?: boolean;
  /** v1.3 fix round, OFF by default: role detection by the class name's last camel-case token(s) (`v13-role-names.ts`). */
  readonly roleTokens?: boolean;
  /**
   * v1.3, OFF by default: FF-DT03 value-object-immutability (ddd style) reads the extractor's class-member facts
   * (`ExtractorOptions.memberFacts`) instead of the setter-name proxy (`DDD_MEMBER_FACT_TEMPLATES`).
   */
  readonly memberFacts?: boolean;
}

/** The v1.3 compile options for the pipeline (the frozen v1.2E reproduction passes `{}`). */
export const V13_COMPILE_OPTIONS: Readonly<CompileOptions> = Object.freeze({ edgeViews: true, styleApplicability: true, roleTokens: true, memberFacts: true });

function rewriteFlags(options: CompileOptions): V13RewriteFlags {
  return { edgeViews: options.edgeViews === true, roleTokens: options.roleTokens === true, memberFacts: options.memberFacts === true };
}

type TemplateCatalogue = ReadonlyMap<string, CypherTemplate>;

export function compileFunctions(input: CompilerInput, options: CompileOptions = {}): DomainResult<CompiledFunctions> {
  // v1.3: the hexagonal style has its own graph-based templates; every other style takes the path below unchanged.
  if (input.style === HEXAGONAL_STYLE) {
    return compileHexagonalFunctions(input, (rest) => compileFunctionsCore(rest, options), rewriteFlags(options));
  }
  if (input.style === DDD_STYLE) {
    return compileDddFunctions(input, (rest) => compileFunctionsCore(rest, options), rewriteFlags(options));
  }
  return compileFunctionsCore(input, options);
}

function compileFunctionsCore(input: CompilerInput, options: CompileOptions): DomainResult<CompiledFunctions> {
  const instrumentVersion = options.instrumentVersion ?? INSTRUMENT_VERSION;
  const templates: TemplateCatalogue = options.v13Templates === true
    ? new Map([...CYPHER_TEMPLATES, ...V13_CYPHER_TEMPLATES])
    : CYPHER_TEMPLATES;
  const { fitnessFunctions, adrRules, layerModel } = input;
  const symbolicQueries: CypherQuery[] = [];
  const neuronalInstructions: NeuronalInstruction[] = [];
  const hybridPairs: HybridPair[] = [];
  const warnings: CompilerWarning[] = [];

  // Filter out disabled functions
  const { enabled: enabledFunctions, disabled: disabledFunctions } = filterEnabled(fitnessFunctions);

  // Check for duplicate function IDs
  const seenIds = new Set<string>();
  for (const ff of enabledFunctions) {
    const id = String(ff.id);
    if (seenIds.has(id)) {
      return DomainResult.fail<CompiledFunctions>([
        compilerError('DUPLICATE_FUNCTION_ID', `Duplicate function ID: ${id}`),
      ]);
    }
    seenIds.add(id);
  }

  // C6 BR-SPEC-10 (FR-08, BR-U1-09): every required parameter of every applicable function must be bound.
  // Runs the same applicability (C5) and buildParams as below; always fatal, independent of strictMode.
  const bound = checkBoundParameters(input);
  if (!bound.success) return DomainResult.fail<CompiledFunctions>(bound.errors);

  // C4: bind layer parameters by resolved kind (FR-19). Reads only LayerDefinition.kind.
  const binding = bindLayerParams(layerModel.layers);

  // C7: exclude_paths needs an exclude anchor in the template (BR-U1-32); always fatal.
  const anchorErrors = checkExcludeAnchors(enabledFunctions, input.style, binding, layerModel, templates);
  if (anchorErrors.length > 0) return DomainResult.fail<CompiledFunctions>(anchorErrors);

  // Compile enabled fitness functions by route
  for (const ff of enabledFunctions) {
    // C5: applicability (style, layer kinds, no-layer-skip layer count) for symbolic/hybrid functions
    // with a template; a disabled function is skipped downstream (BR-U1-10, BR-U1-15, BR-U1-18).
    const template = ff.route === 'neuronal' ? undefined : templates.get(ff.name);
    if (template) {
      const applicability = isTemplateApplicable(template, input.style, binding, layerModel);
      // v1.3 (ADR-V13-02 draft): the style-applicability table, after the frozen checks.
      const v13Reason = applicability.applicable && options.styleApplicability === true
        ? v13InapplicableReason(template.functionName, input.style)
        : undefined;
      const reason = !applicability.applicable ? applicability.reason : v13Reason;
      if (reason !== undefined) {
        disabledFunctions.push({ id: ff.id, name: ff.name, reason });
        warnings.push({
          code: 'COMPILER_004',
          message: `${String(ff.id)} (${ff.name}) disabled: ${reason}`,
          functionId: String(ff.id),
        });
        continue;
      }
    }

    switch (ff.route) {
      case 'symbolic': {
        const result = compileSymbolic(ff, layerModel, binding, warnings, instrumentVersion, templates, rewriteFlags(options));
        if (result) symbolicQueries.push(result);
        break;
      }
      case 'neuronal': {
        const result = compileNeuronal(ff, false);
        if (result) neuronalInstructions.push(result);
        break;
      }
      case 'hybrid': {
        const sym = compileSymbolic(ff, layerModel, binding, warnings, instrumentVersion, templates, rewriteFlags(options));
        const neur = compileNeuronal(ff, false);
        if (sym && neur) {
          hybridPairs.push({ functionId: ff.id, symbolicQuery: sym, neuronalInstruction: neur });
        } else if (sym) {
          symbolicQueries.push(sym);
        } else if (neur) {
          neuronalInstructions.push(neur);
        }
        break;
      }
    }
  }

  // Compile ADR rules
  for (const adr of adrRules) {
    const adrId = adr.id;
    if (seenIds.has(adrId)) continue; // skip if conflicts with function ID
    seenIds.add(adrId);

    const neur = compileADRNeuronal(adr);
    if (adr.symbolicRule) {
      const sym = compileADRSymbolic(adr);
      hybridPairs.push({ functionId: adr.id as import('../shared/types/value-objects.js').FunctionId, symbolicQuery: sym, neuronalInstruction: neur });
    } else {
      neuronalInstructions.push(neur);
      warnings.push({
        code: 'COMPILER_003',
        message: `ADR "${adr.title}" is shadow-mode eligible but has no handcrafted Cypher for comparison`,
        functionId: adrId,
      });
    }
  }

  const totalCompiled = symbolicQueries.length + neuronalInstructions.length + hybridPairs.length;

  return DomainResult.ok<CompiledFunctions>({
    symbolicQueries,
    neuronalInstructions,
    hybridPairs,
    totalCompiled,
    disabledFunctions,
    warnings,
  });
}

/**
 * C7 (BR-U1-32): every applicable symbolic or hybrid function with `exclude_paths` must use a template
 * that holds an exclude anchor. One error per offending function, in declaration order.
 */
function checkExcludeAnchors(
  functions: readonly FitnessFunction[],
  style: string | undefined,
  binding: LayerKindBinding,
  layerModel: LayerModel,
  templates: TemplateCatalogue = CYPHER_TEMPLATES,
): CompilerError[] {
  const errors: CompilerError[] = [];
  for (const ff of functions) {
    if (ff.route === 'neuronal' || ff.excludePaths.length === 0) continue;
    const template = templates.get(ff.name);
    if (!template || !isTemplateApplicable(template, style, binding, layerModel).applicable) continue;
    if (!hasExcludeMarker(template.template)) {
      errors.push(compilerError('COMPILATION_FAILED', `${String(ff.id)}: exclude_paths not supported by template ${template.functionName}`));
    }
  }
  return errors;
}

// ── Symbolic Compilation ──────────────────────────────────────────────────────

function compileSymbolic(
  ff: FitnessFunction,
  layerModel: LayerModel,
  binding: LayerKindBinding,
  warnings: CompilerWarning[],
  instrumentVersion: InstrumentVersion = INSTRUMENT_VERSION,
  templates: TemplateCatalogue = CYPHER_TEMPLATES,
  rewrites: V13RewriteFlags = { edgeViews: false, roleTokens: false },
): CypherQuery | undefined {
  const template = templates.get(ff.name);

  if (!template) {
    if (ff.route === 'neuronal') {
      warnings.push({ code: 'COMPILER_001', message: `No Cypher template for neuronal function "${ff.name}" (expected)` });
    } else {
      warnings.push({ code: 'COMPILER_002', message: `No Cypher template for function "${ff.name}"`, functionId: String(ff.id) });
    }
    return undefined;
  }

  const params = buildParams(ff, layerModel, binding, templates);
  // C9: excludePatterns is appended to the map last (BR-U1-32, NFR-02): the function's own exclude_paths, then
  // the template's instrument v2 role exemptions (ADR-026).
  const excludePatterns = [...ff.excludePaths.map((g) => globToRegex(g)), ...roleExemptionPatterns(template.functionName, instrumentVersion)];
  if (excludePatterns.length > 0) params.excludePatterns = excludePatterns;
  const instantiated = instantiateTemplate(template, params);
  const cypher = applyV13Rewrites(template.functionName, instantiated, rewrites);

  return {
    functionId: ff.id,
    name: ff.name,
    cypher,
    params,
    dimension: ff.dimension,
    severity: ff.severity,
    ...(ff.threshold != null ? { threshold: ff.threshold } : {}),
    route: ff.route === 'hybrid' ? 'hybrid' : 'symbolic',
    source: 'template' as const,
  };
}

// ── Neuronal Compilation ──────────────────────────────────────────────────────

function compileNeuronal(
  ff: FitnessFunction,
  shadowEligible: boolean,
): NeuronalInstruction | undefined {
  if (!ff.semanticCriteria) return undefined;

  return {
    functionId: ff.id,
    name: ff.name,
    dimension: ff.dimension,
    severity: ff.severity,
    route: ff.route === 'hybrid' ? 'hybrid' : 'neuronal',
    semanticCriteria: ff.semanticCriteria,
    contextAssembly: defaultContextAssembly(ff),
    shadowModeEligible: shadowEligible,
    source: 'fitness-function',
    // FR-33 (BR-U1-26): the declared judge unit, else module for integrity and file otherwise; U4 iterates it.
    judgeUnit: ff.judgeUnit ?? (ff.dimension === 'integrity' ? 'module' : 'file'),
  };
}

// ── ADR Compilation ───────────────────────────────────────────────────────────

function compileADRSymbolic(adr: ADRRule): CypherQuery {
  const rule = adr.symbolicRule!;
  return {
    functionId: adr.id as import('../shared/types/value-objects.js').FunctionId,
    name: `adr:${adr.title}`,
    cypher: rule.query,
    params: rule.params as Record<string, unknown>,
    dimension: 'semantic', // FR-22 (BR-U1-22): nothing compiled carries intent
    severity: 'major',
    route: 'hybrid',
    source: 'adr',
  };
}

function compileADRNeuronal(adr: ADRRule): NeuronalInstruction {
  const criteria = adr.semanticCriterion ?? {
    rule: adr.rawContent.slice(0, 500),
    rubric: {
      pass: `Code adheres to: ${adr.title}`,
      fail: `Code violates: ${adr.title}`,
      evidenceRequired: 'Cite specific code that confirms or violates the decision',
    },
  };

  return {
    functionId: adr.id as import('../shared/types/value-objects.js').FunctionId,
    name: `adr:${adr.title}`,
    dimension: 'semantic', // FR-22 (BR-U1-22): nothing compiled carries intent
    severity: 'major',
    route: adr.symbolicRule ? 'hybrid' : 'neuronal',
    semanticCriteria: criteria,
    contextAssembly: {
      includeAPGSubgraph: true,
      includeSourceCode: true,
      maxNodes: 50,
    },
    shadowModeEligible: true,
    shadowPrompt: `Based on the following ADR decision, generate a Cypher query that checks compliance against the project's Architectural Property Graph:\n\nADR: ${adr.title}\nDecision: ${criteria.rule}`,
    source: 'adr',
    judgeUnit: 'file', // FR-33 (BR-U1-26): ADR instructions judge per file
  };
}

// ── Template Instantiation ────────────────────────────────────────────────────

/**
 * Template text for one function (C9). Values stay `$param` placeholders (passed at execution time);
 * every exclude anchor becomes the `$excludePatterns` predicate when the map holds a non-empty
 * `excludePatterns`, else the empty string (BR-U1-32).
 */
export function instantiateTemplate(
  template: CypherTemplate,
  params: Readonly<Record<string, unknown>>,
): string {
  const patterns = params.excludePatterns;
  return replaceExcludeMarkers(template.template, Array.isArray(patterns) && patterns.length > 0);
}

// ── Parameter Building ────────────────────────────────────────────────────────

/**
 * Template parameters for one function (C8). Layers come from the kind binding (FR-19); FR-07 fields are
 * read typed with `!= null` presence, so `0` and `[]` are values (BR-U1-03, BR-U1-07); `pattern` is
 * compiled to an anchored regex (BR-U1-06). The map is restricted to the template's bound
 * `requiredParams ∪ optionalParams`, keys in template-declared order, required first (BR-U1-33, NFR-02);
 * `excludePatterns` is appended later by the caller. BR-SPEC-10 (`bound-param-checker.ts`) judges boundness.
 */
export function buildParams(
  ff: FitnessFunction,
  layerModel: LayerModel,
  binding: LayerKindBinding,
  templates: TemplateCatalogue = CYPHER_TEMPLATES,
): Record<string, unknown> {
  const candidates: Record<string, unknown> = {};
  const layers = layerModel.layers;

  // Layer params, bound by kind (FR-19, BR-U1-14): scalars for domain and infrastructure, the list
  // $applicationLayers for application (BR-U1-37).
  if (binding.domainLayer != null) candidates.domainLayer = binding.domainLayer;
  candidates.applicationLayers = [...binding.applicationLayers];
  if (binding.infraLayer != null) candidates.infraLayer = binding.infraLayer;
  // Controllers live in the presentation layer when one is bound, else in infrastructure (ADR-016 a, BR-U1-46).
  if (binding.controllerLayer != null) candidates.controllerLayer = binding.controllerLayer;

  // Layer ordering for dependency-direction
  // Layers are listed bottom-up in the spec: domain (0), ..., application (N-1)
  // Violation = lower-index layer file importing from higher-index layer
  const layerOrder = layers.map((l) => l.name);
  candidates.layerOrder = layerOrder;

  // Allowed layer transitions for no-layer-skip
  // Layers are listed inner-to-outer: [infrastructure, application, presentation]
  // Dependencies flow inward: outer layer imports from adjacent inner layer.
  // So allowed transitions are: layer[i+1] → layer[i] (next-outer imports next-inner)
  const allowedTransitions: string[] = [];
  for (let i = 0; i < layerOrder.length - 1; i++) {
    allowedTransitions.push(`${String(layerOrder[i + 1])}>${String(layerOrder[i])}`);
  }
  candidates.allowedTransitions = allowedTransitions;

  // Function-specific params: threshold and the typed FR-07 fields (BR-U1-03)
  if (ff.threshold != null) candidates.threshold = ff.threshold;
  if (ff.forbiddenImports != null) candidates.forbiddenImports = ff.forbiddenImports;
  if (ff.maxPublicMethods != null) candidates.maxPublicMethods = ff.maxPublicMethods;
  if (ff.maxDependencies != null) candidates.maxDependencies = ff.maxDependencies;
  if (ff.maxInterfaceMethods != null) candidates.maxInterfaceMethods = ff.maxInterfaceMethods;
  if (ff.maxDepth != null) candidates.maxDepth = ff.maxDepth;
  if (ff.pattern != null) candidates.pattern = compilePattern(ff.pattern);

  // Default role patterns
  candidates.useCaseRoles = ['UseCase', 'Service', 'Handler'];
  candidates.entityRoles = ['Entity', 'Aggregate', 'ValueObject'];

  // Default naming patterns per layer
  candidates.domainPattern = '.*';
  candidates.applicationPattern = '.*';
  candidates.infraPattern = '.*';

  // Restriction (BR-U1-33): only the template's declared parameters, required first, in declared order.
  const template = templates.get(ff.name);
  const params: Record<string, unknown> = {};
  if (!template) return params;
  for (const name of [...template.requiredParams, ...template.optionalParams]) {
    if (name in params) continue;
    const value = candidates[name];
    if (value != null) params[name] = value;
  }
  return params;
}

function defaultContextAssembly(ff: FitnessFunction): ContextAssemblyInstruction {
  return {
    includeAPGSubgraph: true,
    includeSourceCode: ff.route === 'neuronal' || ff.route === 'hybrid',
    ...(ff.dimension === 'solid' ? { nodeFilter: 'type:Class', maxNodes: 20 } : {}),
    ...(ff.dimension === 'semantic' ? { maxNodes: 50 } : {}), // FR-22: was the intent branch (BR-U1-22)
  };
}

// ── PipelineStage Implementation ──────────────────────────────────────────────

export class FitnessCompilerStage implements PipelineStage<ParsedSpec, CompiledFunctions> {
  readonly name = 'fitness-compiler';

  async execute(input: ParsedSpec, context: FirewallContext): Promise<DomainResult<CompiledFunctions>> {
    const start = Date.now();
    const result = compileFunctions(compilerInputFromSpec(input));

    if (result.success) {
      context.setCompiledFunctions(result.data);
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: 'fitness-compiler',
        event: 'Functions compiled successfully',
        durationMs: Date.now() - start,
        metadata: {
          symbolicCount: result.data.symbolicQueries.length,
          neuronalCount: result.data.neuronalInstructions.length,
          hybridCount: result.data.hybridPairs.length,
          totalCompiled: result.data.totalCompiled,
          warningCount: result.data.warnings.length,
        },
      });
    } else {
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: 'fitness-compiler',
        event: `Compilation failed: ${result.errors[0]?.message}`,
        durationMs: Date.now() - start,
      });
    }

    return result;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function compilerError(code: CompilerError['code'], message: string): CompilerError {
  return { code, message, stage: 'fitness-compiler', critical: true };
}
