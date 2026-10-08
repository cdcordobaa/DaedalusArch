import type { CypherQuery, FunctionFailure, SymbolicFunctionResult } from '../shared/types/evaluation.js';
import type { Violation, ViolationType } from '../shared/taxonomy/violation-types.js';
import type { PipelineWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { scrubSecrets } from '../shared/errors/scrub.js';
import type { ResultMapping } from '../fitness-compiler/types.js';
import { CYCLE_ROW_CAP, CYPHER_TEMPLATES, getTemplateTag } from '../fitness-compiler/cypher-templates.js';
import type { SymbolicEvalInput } from './types.js';
import { functionId as makeFunctionId } from '../shared/types/value-objects.js';
import { computeViolationId, discriminatorValues, scalarText, toFiniteNumber } from './violation-id.js';
import { formatEvidence, mergeById } from './evidence.js';
import { applyCycleCap, dedupeCycleRecords } from './cycle-canonicaliser.js';
import { CYCLE_STRATEGY, SCC_TEMPLATE_NAME, findSccViolations } from './scc-cycles.js';

export interface SymbolicEvalOutput {
  readonly results: readonly SymbolicFunctionResult[];
  /** One entry per query that failed to run (FR-13, BR-U3-01); always present, `[]` when none failed. */
  readonly failures: readonly FunctionFailure[];
  readonly warnings: readonly PipelineWarning[];
}

/** Neo4j 5 timeout status codes both contain this text (BR-U3-02). */
const TIMEOUT_CODE_MARKER = 'TransactionTimedOut';

/** BR-U3-02: `EVAL_002` for a transaction timeout, `EVAL_001` for every other repository failure. */
export function failureCodeOf(repositoryCode: string | undefined): 'EVAL_001' | 'EVAL_002' {
  return repositoryCode?.includes(TIMEOUT_CODE_MARKER) === true ? 'EVAL_002' : 'EVAL_001';
}

/**
 * Execute all symbolic Cypher queries against Neo4j and collect results.
 */
export async function evaluateSymbolic(input: SymbolicEvalInput): Promise<DomainResult<SymbolicEvalOutput>> {
  const results: SymbolicFunctionResult[] = [];
  const failures: FunctionFailure[] = [];
  const warnings: PipelineWarning[] = [];

  for (const query of input.queries) {
    const start = Date.now();

    // BR-U3-45: with the SCC strategy, FF-S02 is answered from the APG instead of its Cypher query.
    if (CYCLE_STRATEGY === 'scc' && query.name === SCC_TEMPLATE_NAME && query.source === 'template') {
      if (input.apg === undefined) {
        const message = `Query failed for ${String(query.functionId)} (${query.name}): APG missing for the SCC cycle strategy`;
        failures.push({ functionId: query.functionId, name: query.name, code: 'EVAL_001', message });
        warnings.push({ code: 'EVAL_001', message, stage: 'evaluation-engine', context: { functionId: String(query.functionId), code: 'APG_MISSING' } });
        continue;
      }
      const excludePatterns = query.params.excludePatterns;
      const violations = findSccViolations(input.apg, {
        functionId: String(query.functionId),
        dimension: query.dimension,
        severity: query.severity,
        ...(Array.isArray(excludePatterns) ? { excludePatterns: excludePatterns.map(String) } : {}),
      });
      results.push({
        functionId: query.functionId,
        dimension: query.dimension,
        passed: computePassFail(violations),
        violations,
        executionTimeMs: Date.now() - start,
        deterministic: true,
      });
      continue;
    }

    // BR-U3-03: no timeout of C6's own; the repository default applies unless the caller sets one.
    const queryResult = input.queryTimeoutMs !== undefined
      ? await input.graphRepository.executeQuery(query.cypher, query.params, { timeoutMs: input.queryTimeoutMs })
      : await input.graphRepository.executeQuery(query.cypher, query.params);
    if (!queryResult.success) {
      // BR-U3-01: a failed query is a function failure: one FunctionFailure, one warning with the same
      // code and message, no result row; evaluation continues with the next query.
      const error = queryResult.errors[0];
      const code = failureCodeOf(error?.code);
      const message = scrubSecrets(`Query failed for ${String(query.functionId)} (${query.name}): ${error?.message ?? 'unknown error'}`, input.knownSecrets ?? []);
      failures.push({ functionId: query.functionId, name: query.name, code, message });
      warnings.push({ code, message, stage: 'evaluation-engine', context: { functionId: String(query.functionId) } });
      continue;
    }

    const template = CYPHER_TEMPLATES.get(query.name);
    const mapping = template?.resultMapping ?? FALLBACK_MAPPING;

    // FR-35 cycle sentinel (BR-U3-08, BR-U3-09): `truncated` is decided on the raw rows, before the
    // defensive canonicaliser and de-duplicator run on the kept rows, so they can never hide it.
    let records = queryResult.data.records;
    let truncated = false;
    if (mapping.cycleColumn !== undefined) {
      const capped = applyCycleCap(records, CYCLE_ROW_CAP);
      truncated = capped.truncated;
      records = dedupeCycleRecords(capped.kept, mapping.cycleColumn);
      if (truncated) {
        warnings.push({
          code: 'EVAL_003',
          message: `Cycle result for ${String(query.functionId)} truncated at ${String(CYCLE_ROW_CAP)} rows`,
          stage: 'evaluation-engine',
          context: { functionId: String(query.functionId), cap: CYCLE_ROW_CAP },
        });
      }
    }

    // FR-12: ids hash the row's own identity values; rows sharing an id merge (BR-U3-05, BR-U3-07).
    const violations = [...mergeById(mapResultsToViolations(records, mapping, query))];
    const passed = computePassFail(violations);

    results.push({
      functionId: query.functionId,
      dimension: query.dimension,
      passed,
      violations,
      executionTimeMs: Date.now() - start,
      deterministic: true,
      ...(truncated ? { truncated: true as const } : {}),
    });
  }

  return DomainResult.ok({ results, failures, warnings });
}

/** Mapping of a query without a built-in template (ADR queries, unknown names). */
const FALLBACK_MAPPING: ResultMapping = { filePathColumn: 'filePath', messageTemplate: 'Violation in {filePath}', discriminatorColumns: [] };

/** `row[column]` as a string, or absent when the column is unmapped or the value is null/missing. */
function optionalText(record: Readonly<Record<string, unknown>>, column: string | undefined): string | undefined {
  if (column === undefined) return undefined;
  const value = record[column];
  if (value === null || value === undefined) return undefined;
  return scalarText(value);
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
    'domain-state-purity': 'DOMAIN_STATE_PURITY_VIOLATION', // FR-21 (BR-U3-14)
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

/** Single pass rule (FR-14, BR-U1-40, BR-U3-10): a symbolic function passes exactly when it has no violation. */
function computePassFail(violations: readonly Violation[]): boolean {
  return violations.length === 0;
}
