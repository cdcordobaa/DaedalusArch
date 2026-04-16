import type { CypherQuery, SymbolicFunctionResult } from '../shared/types/evaluation.js';
import type { Violation, ViolationType } from '../shared/taxonomy/violation-types.js';
import type { PipelineWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import type { ResultMapping } from '../fitness-compiler/types.js';
import { CYPHER_TEMPLATES } from '../fitness-compiler/cypher-templates.js';
import type { SymbolicEvalInput } from './types.js';
import { functionId as makeFunctionId } from '../shared/types/value-objects.js';

export interface SymbolicEvalOutput {
  readonly results: readonly SymbolicFunctionResult[];
  readonly warnings: readonly PipelineWarning[];
}

/**
 * Execute all symbolic Cypher queries against Neo4j and collect results.
 */
export async function evaluateSymbolic(input: SymbolicEvalInput): Promise<DomainResult<SymbolicEvalOutput>> {
  const results: SymbolicFunctionResult[] = [];
  const warnings: PipelineWarning[] = [];

  for (const query of input.queries) {
    const start = Date.now();

    const queryResult = await input.graphRepository.executeQuery(query.cypher, query.params as Record<string, unknown>);
    if (!queryResult.success) {
      warnings.push({ code: 'EVAL_001', message: `Query failed for ${query.name}: ${queryResult.errors[0]?.message}`, stage: 'evaluation-engine' });
      continue;
    }

    const template = CYPHER_TEMPLATES.get(query.name);
    const mapping = template?.resultMapping ?? { filePathColumn: 'filePath', messageTemplate: 'Violation in {filePath}' };

    const violations = mapResultsToViolations(queryResult.data.records, mapping, query);
    const passed = computePassFail(violations, query, queryResult.data.records);

    results.push({
      functionId: query.functionId,
      dimension: query.dimension,
      passed,
      violations,
      executionTimeMs: Date.now() - start,
      deterministic: true,
    });
  }

  return DomainResult.ok({ results, warnings });
}

let violationCounter = 0;

function mapResultsToViolations(
  records: readonly Record<string, unknown>[],
  mapping: ResultMapping,
  query: CypherQuery,
): Violation[] {
  return records.map((record) => {
    const filePath = String(record[mapping.filePathColumn] ?? 'unknown');
    let message = mapping.messageTemplate;
    for (const [key, value] of Object.entries(record)) {
      message = message.replace(`{${key}}`, String(value));
    }

    return {
      id: `v-${String(query.functionId)}-${++violationCounter}`,
      type: dimensionToViolationType(query.name),
      dimension: query.dimension,
      severity: query.severity,
      functionId: makeFunctionId(String(query.functionId)),
      route: query.route === 'hybrid' ? 'symbolic' as const : 'symbolic' as const,
      filePath,
      message,
      deterministic: true,
    };
  });
}

function dimensionToViolationType(name: string): ViolationType {
  const mapping: Record<string, ViolationType> = {
    'dependency-direction': 'LAYER_VIOLATION',
    'no-cyclic-deps': 'CYCLIC_DEPENDENCY',
    'no-layer-skip': 'LAYER_SKIP',
    'no-domain-outward-dep': 'DOMAIN_OUTWARD_DEP',
    'domain-purity': 'DOMAIN_PURITY_VIOLATION',
    'dependency-inversion': 'DEPENDENCY_INVERSION_VIOLATION',
    'repository-pattern': 'REPOSITORY_PATTERN_VIOLATION',
    'use-case-isolation': 'USE_CASE_ISOLATION_VIOLATION',
    'controller-no-entity': 'CONTROLLER_ENTITY_VIOLATION',
    'domain-stability': 'INSTABILITY_VIOLATION',
    'module-fan-out': 'FAN_OUT_EXCEEDED',
    'max-fan-in': 'FAN_IN_EXCEEDED',
    'component-instability': 'INSTABILITY_VIOLATION',
    'no-orphan-files': 'ORPHAN_FILE',
    'abstraction-ratio': 'LOW_ABSTRACTION_RATIO',
    'single-responsibility-proxy': 'SRP_VIOLATION',
    'interface-segregation-proxy': 'ISP_VIOLATION',
    'inheritance-depth': 'INHERITANCE_DEPTH_EXCEEDED',
    'naming-conventions': 'NAMING_CONVENTION',
    'naming-services': 'NAMING_CONVENTION',
    'naming-repos': 'NAMING_CONVENTION',
    'naming-controllers': 'NAMING_CONVENTION',
    'test-file-pairing': 'MISSING_TEST_FILE',
    'no-index-logic': 'INDEX_LOGIC_VIOLATION',
  };
  return mapping[name] ?? `CUSTOM_${name}` as ViolationType;
}

function computePassFail(
  violations: Violation[],
  query: CypherQuery,
  records: readonly Record<string, unknown>[],
): boolean {
  // For metric queries that return a ratio/count with a threshold
  if (query.threshold != null && records.length > 0) {
    const firstRecord = records[0];
    // Check for 'violation' boolean column (used by some templates)
    if (firstRecord && 'violation' in firstRecord) {
      return !records.some((r) => r['violation'] === true);
    }
    // Check for 'ratio' column
    if (firstRecord && 'ratio' in firstRecord) {
      return Number(firstRecord['ratio']) >= query.threshold;
    }
  }

  // Default: pass if no violation records
  return violations.length === 0;
}
