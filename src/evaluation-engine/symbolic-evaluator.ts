import type { CypherQuery, SymbolicFunctionResult } from '../shared/types/evaluation.js';
import type { Violation, ViolationType } from '../shared/taxonomy/violation-types.js';
import type { PipelineWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import type { ResultMapping } from '../fitness-compiler/types.js';
import { CYPHER_TEMPLATES, getTemplateTag } from '../fitness-compiler/cypher-templates.js';
import type { SymbolicEvalInput } from './types.js';
import { functionId as makeFunctionId } from '../shared/types/value-objects.js';
import { computeViolationId, discriminatorValues, toFiniteNumber } from './violation-id.js';
import { formatEvidence, mergeById } from './evidence.js';

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
    const mapping = template?.resultMapping ?? FALLBACK_MAPPING;

    // FR-12: ids hash the row's own identity values; rows sharing an id merge (BR-U3-05, BR-U3-07).
    const violations = [...mergeById(mapResultsToViolations(queryResult.data.records, mapping, query))];
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

/** Mapping of a query without a built-in template (ADR queries, unknown names). */
const FALLBACK_MAPPING: ResultMapping = { filePathColumn: 'filePath', messageTemplate: 'Violation in {filePath}', discriminatorColumns: [] };

/** `row[column]` as a string, or absent when the column is unmapped or the value is null/missing. */
function optionalText(record: Readonly<Record<string, unknown>>, column: string | undefined): string | undefined {
  if (column === undefined) return undefined;
  const value = record[column];
  if (value === null || value === undefined) return undefined;
  return typeof value === 'string' ? value : String(value);
}

/** Finite numbers of a list cell; absent when the column is unmapped or the cell is not a list. */
function optionalLines(record: Readonly<Record<string, unknown>>, column: string | undefined): number[] | undefined {
  if (column === undefined) return undefined;
  const value = record[column];
  if (!Array.isArray(value)) return undefined;
  return value.map(toFiniteNumber).filter((n): n is number => n !== undefined);
}

/**
 * Row mapping (FR-12, BR-U3-04; T-MAP of U3 business-rules.md §3): file path, target, line, lines,
 * isTypeOnly, discriminator, evidence and tag per the template's `ResultMapping`; the id is
 * `computeViolationId` over the identity values (BR-U3-05), never a counter.
 */
function mapResultsToViolations(
  records: readonly Record<string, unknown>[],
  mapping: ResultMapping,
  query: CypherQuery,
): Violation[] {
  const tag = query.source === 'template' ? getTemplateTag(query.name) : undefined;
  const evidenceColumns = mapping.evidenceColumns ?? [];
  return records.map((record) => {
    const filePath = String(record[mapping.filePathColumn] ?? 'unknown');
    let message = mapping.messageTemplate;
    for (const [key, value] of Object.entries(record)) {
      message = message.replace(`{${key}}`, String(value));
    }

    const target = optionalText(record, mapping.targetColumn);
    const line = mapping.lineColumn !== undefined ? toFiniteNumber(record[mapping.lineColumn]) : undefined;
    const lines = optionalLines(record, mapping.linesColumn);
    const discriminator = discriminatorValues(record, mapping.discriminatorColumns);

    return {
      id: computeViolationId({ functionId: query.functionId, filePath, target, line, discriminator }),
      type: dimensionToViolationType(query.name),
      dimension: query.dimension,
      severity: query.severity,
      functionId: makeFunctionId(String(query.functionId)),
      route: 'symbolic' as const,
      filePath,
      message,
      deterministic: true,
      ...(target !== undefined ? { target } : {}),
      ...(line !== undefined ? { line } : {}),
      ...(lines !== undefined ? { lines } : {}),
      ...(mapping.isTypeOnlyColumn !== undefined ? { isTypeOnly: record[mapping.isTypeOnlyColumn] === true } : {}),
      discriminator,
      ...(evidenceColumns.length > 0 ? { evidence: formatEvidence(record, evidenceColumns) } : {}),
      ...(tag !== undefined ? { tag } : {}),
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
