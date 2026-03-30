import type { FitnessFunction, ADRRule, ParsedSpec, LayerModel } from '../shared/types/spec.js';
import type {
  CompiledFunctions, CypherQuery, NeuronalInstruction, HybridPair,
  ContextAssemblyInstruction,
} from '../shared/types/evaluation.js';
import type { PipelineStage } from '../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import type { CompilerInput, CompilerError, CompilerWarning, CypherTemplate } from './types.js';
import { CYPHER_TEMPLATES } from './cypher-templates.js';

// ── Standalone Function ───────────────────────────────────────────────────────

export function compileFunctions(input: CompilerInput): DomainResult<CompiledFunctions> {
  const { fitnessFunctions, adrRules, layerModel } = input;
  const symbolicQueries: CypherQuery[] = [];
  const neuronalInstructions: NeuronalInstruction[] = [];
  const hybridPairs: HybridPair[] = [];
  const warnings: CompilerWarning[] = [];

  // Check for duplicate function IDs
  const seenIds = new Set<string>();
  for (const ff of fitnessFunctions) {
    const id = String(ff.id);
    if (seenIds.has(id)) {
      return DomainResult.fail<CompiledFunctions>([
        compilerError('DUPLICATE_FUNCTION_ID', `Duplicate function ID: ${id}`),
      ]);
    }
    seenIds.add(id);
  }

  // Compile fitness functions by route
  for (const ff of fitnessFunctions) {
    switch (ff.route) {
      case 'symbolic': {
        const result = compileSymbolic(ff, layerModel, warnings);
        if (result) symbolicQueries.push(result);
        break;
      }
      case 'neuronal': {
        const result = compileNeuronal(ff, false);
        if (result) neuronalInstructions.push(result);
        break;
      }
      case 'hybrid': {
        const sym = compileSymbolic(ff, layerModel, warnings);
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
    warnings,
  });
}

// ── Symbolic Compilation ──────────────────────────────────────────────────────

function compileSymbolic(
  ff: FitnessFunction,
  layerModel: LayerModel,
  warnings: CompilerWarning[],
): CypherQuery | undefined {
  const template = CYPHER_TEMPLATES.get(ff.name);

  if (!template) {
    if (ff.route === 'neuronal') {
      warnings.push({ code: 'COMPILER_001', message: `No Cypher template for neuronal function "${ff.name}" (expected)` });
    } else {
      warnings.push({ code: 'COMPILER_002', message: `No Cypher template for function "${ff.name}"`, functionId: String(ff.id) });
    }
    return undefined;
  }

  const params = buildParams(ff, layerModel);
  const cypher = instantiateTemplate(template, params);

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
    dimension: 'intent',
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
    dimension: 'intent',
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
  };
}

// ── Template Instantiation ────────────────────────────────────────────────────

export function instantiateTemplate(
  template: CypherTemplate,
  _params: Record<string, unknown>,
): string {
  // Neo4j uses parameterized queries — template stays as-is with $param placeholders.
  // Params are passed separately at query execution time (U5).
  return template.template;
}

// ── Parameter Building ────────────────────────────────────────────────────────

function buildParams(
  ff: FitnessFunction,
  layerModel: LayerModel,
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const layers = layerModel.layers;

  // Common layer params
  const domainLayer = layers.find((l) => l.name === 'domain')?.name;
  const applicationLayer = layers.find((l) => l.name === 'application')?.name;
  const infraLayer = layers.find((l) => l.name === 'infrastructure')?.name;

  if (domainLayer) params['domainLayer'] = domainLayer;
  if (applicationLayer) params['applicationLayer'] = applicationLayer;
  if (infraLayer) params['infraLayer'] = infraLayer;

  // Layer ordering for dependency-direction
  const layerOrder = layers.map((l) => l.name);
  const outerLayers = layerOrder.slice(layerOrder.indexOf(infraLayer ?? '') >= 0 ? layerOrder.indexOf(infraLayer!) : layerOrder.length - 1);
  const innerLayers = layerOrder.slice(0, layerOrder.indexOf(domainLayer ?? '') + 1);
  params['outerLayers'] = outerLayers;
  params['innerLayers'] = innerLayers;

  // Allowed layer transitions for no-layer-skip
  const allowedTransitions: string[] = [];
  for (let i = 0; i < layerOrder.length - 1; i++) {
    allowedTransitions.push(`${layerOrder[i]}>${layerOrder[i + 1]}`);
  }
  params['allowedTransitions'] = allowedTransitions;

  // Function-specific params (from YAML custom fields)
  if (ff.threshold != null) params['threshold'] = ff.threshold;

  // Extract custom fields from the raw FF data
  // These come through as extra properties on the FitnessFunction object
  const ffAny = ff as unknown as Record<string, unknown>;
  if (ffAny['forbidden_imports']) params['forbiddenImports'] = ffAny['forbidden_imports'];
  if (ffAny['max_public_methods']) params['maxPublicMethods'] = ffAny['max_public_methods'];
  if (ffAny['max_dependencies']) params['maxDependencies'] = ffAny['max_dependencies'];
  if (ffAny['max_interface_methods']) params['maxInterfaceMethods'] = ffAny['max_interface_methods'];
  if (ffAny['max_depth']) params['maxDepth'] = ffAny['max_depth'];
  if (ffAny['pattern']) params['pattern'] = ffAny['pattern'];

  // Default role patterns
  params['useCaseRoles'] = ['UseCase', 'Service', 'Handler'];
  params['entityRoles'] = ['Entity', 'Aggregate', 'ValueObject'];

  // Default naming patterns per layer
  params['domainPattern'] = '.*';
  params['applicationPattern'] = '.*';
  params['infraPattern'] = '.*';

  return params;
}

function defaultContextAssembly(ff: FitnessFunction): ContextAssemblyInstruction {
  return {
    includeAPGSubgraph: true,
    includeSourceCode: ff.route === 'neuronal' || ff.route === 'hybrid',
    ...(ff.dimension === 'solid' ? { nodeFilter: 'type:Class', maxNodes: 20 } : {}),
    ...(ff.dimension === 'intent' ? { maxNodes: 50 } : {}),
  };
}

// ── PipelineStage Implementation ──────────────────────────────────────────────

export class FitnessCompilerStage implements PipelineStage<ParsedSpec, CompiledFunctions> {
  readonly name = 'fitness-compiler';

  async execute(input: ParsedSpec, context: FirewallContext): Promise<DomainResult<CompiledFunctions>> {
    const start = Date.now();
    const compilerInput: CompilerInput = {
      fitnessFunctions: input.fitnessFunctions,
      adrRules: input.adrRules,
      layerModel: input.layerModel,
      scoringWeights: input.scoringWeights,
    };

    const result = compileFunctions(compilerInput);

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
