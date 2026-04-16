import type { Violation, ActionableViolation } from '../shared/taxonomy/violation-types.js';
import type { FitnessFunction } from '../shared/types/spec.js';
import type { BaselineResult } from '../shared/types/baseline.js';
import type { BaselineStatus } from '../shared/types/baseline.js';

const VIOLATION_EXPLANATIONS: Record<string, string> = {
  LAYER_VIOLATION: 'A file in one architectural layer depends on a file in a layer it should not access.',
  CYCLIC_DEPENDENCY: 'A circular dependency chain exists between modules, making the codebase harder to reason about.',
  LAYER_SKIP: 'A file skips an intermediate layer, violating the layered architecture rule.',
  DOMAIN_OUTWARD_DEP: 'A domain layer file depends on an outer layer (infrastructure or framework), violating dependency inversion.',
  DOMAIN_PURITY_VIOLATION: 'The domain layer contains framework or infrastructure concerns that should be kept separate.',
  DEPENDENCY_INVERSION_VIOLATION: 'A high-level module depends directly on a low-level module instead of an abstraction.',
  REPOSITORY_PATTERN_VIOLATION: 'Data access logic is not properly encapsulated behind the repository pattern.',
  USE_CASE_ISOLATION_VIOLATION: 'A use case (application service) has direct dependencies it should not have.',
  CONTROLLER_ENTITY_VIOLATION: 'A controller or adapter directly accesses domain entities instead of going through use cases.',
  FAN_OUT_EXCEEDED: 'This file imports from too many modules, indicating it has too many responsibilities.',
  FAN_IN_EXCEEDED: 'Too many modules depend on this file, making it a fragile bottleneck.',
  INSTABILITY_VIOLATION: 'The module instability metric is outside the expected range for its role.',
  ORPHAN_FILE: 'This file is not imported by any other module and may be dead code.',
  LOW_ABSTRACTION_RATIO: 'The codebase has too few abstractions (interfaces/abstract classes) relative to concrete implementations.',
  SRP_VIOLATION: 'A class or module has too many responsibilities, violating the Single Responsibility Principle.',
  ISP_VIOLATION: 'An interface is too broad, forcing implementors to depend on methods they do not use.',
  INHERITANCE_DEPTH_EXCEEDED: 'The inheritance chain is too deep, making the code harder to understand and maintain.',
  NAMING_CONVENTION: 'A file or symbol does not follow the project naming conventions defined in the spec.',
  PLACEMENT_CONVENTION: 'A file is placed in a directory that does not match the layer or role conventions.',
  MISSING_TEST_FILE: 'A source file has no corresponding test file.',
  INDEX_LOGIC_VIOLATION: 'An index/barrel file contains business logic instead of just re-exports.',
  SEMANTIC_RULE_VIOLATION: 'An LLM-evaluated semantic rule was violated.',
  INTENT_VIOLATION: 'An architectural intent expressed in an ADR was violated.',
};

const FIX_SUGGESTIONS: Record<string, string> = {
  LAYER_VIOLATION: 'Move the dependency behind an interface in the correct layer, or restructure the import to respect layer boundaries.',
  CYCLIC_DEPENDENCY: 'Break the cycle by extracting a shared interface or moving shared logic to a common module.',
  LAYER_SKIP: 'Route the dependency through the intermediate layer by creating an appropriate abstraction.',
  DOMAIN_OUTWARD_DEP: 'Move the infrastructure dependency behind an interface defined in the domain layer.',
  DOMAIN_PURITY_VIOLATION: 'Extract framework-specific code to an infrastructure or adapter layer.',
  DEPENDENCY_INVERSION_VIOLATION: 'Introduce an interface (port) in the higher-level module and have the lower-level module implement it.',
  REPOSITORY_PATTERN_VIOLATION: 'Encapsulate data access behind a repository interface.',
  USE_CASE_ISOLATION_VIOLATION: 'Inject dependencies through constructor parameters (ports) instead of importing directly.',
  CONTROLLER_ENTITY_VIOLATION: 'Route the data access through a use case or application service.',
  FAN_OUT_EXCEEDED: 'Extract a facade, service factory, or use dependency injection to reduce direct imports.',
  FAN_IN_EXCEEDED: 'Consider splitting this module or introducing an intermediary to reduce coupling.',
  INSTABILITY_VIOLATION: 'Adjust the module boundaries or introduce abstractions to bring instability within range.',
  ORPHAN_FILE: 'Remove the file if unused, or add an import from the appropriate module.',
  LOW_ABSTRACTION_RATIO: 'Introduce interfaces or abstract classes to define contracts between layers.',
  SRP_VIOLATION: 'Split the class into smaller, focused classes, each with a single responsibility.',
  ISP_VIOLATION: 'Break the interface into smaller, role-specific interfaces.',
  INHERITANCE_DEPTH_EXCEEDED: 'Prefer composition over inheritance — extract shared behavior into mixins or helper classes.',
  NAMING_CONVENTION: 'Rename the file or symbol to match the naming pattern defined in the spec.',
  PLACEMENT_CONVENTION: 'Move the file to the directory that matches its architectural role.',
  MISSING_TEST_FILE: 'Create a test file following the project test naming convention.',
  INDEX_LOGIC_VIOLATION: 'Move business logic out of the index file into a dedicated module.',
  SEMANTIC_RULE_VIOLATION: 'Review the semantic rule and refactor the code to comply.',
  INTENT_VIOLATION: 'Review the referenced ADR and align the implementation with the stated intent.',
};

/**
 * Determine baseline status for a violation.
 */
function resolveBaselineStatus(
  violation: Violation,
  baselineResult: BaselineResult | undefined,
): BaselineStatus {
  if (!baselineResult) return 'none';

  const isBaseline = baselineResult.baselineViolations.some(
    (bv) => bv.filePath === violation.filePath && bv.functionId === violation.functionId,
  );

  return isBaseline ? 'baseline' : 'new';
}

/**
 * Build the "what" field: [severity] functionId — rule name (dimension)
 */
function buildWhat(violation: Violation, fitnessFunction: FitnessFunction | undefined): string {
  const name = fitnessFunction?.name ?? violation.type.toLowerCase().replace(/_/g, '-');
  return `[${violation.severity}] ${String(violation.functionId)} — ${name} (${violation.dimension})`;
}

/**
 * Build the "where" field: file path + evidence if available.
 */
function buildWhere(violation: Violation): string {
  const evidence = violation.evidence;
  if (evidence && evidence.length > 0) {
    const lineMatch = evidence[0]!.match(/line\s*(\d+)/i);
    if (lineMatch) {
      return `${violation.filePath}:${lineMatch[1]}`;
    }
  }
  return violation.filePath;
}

/**
 * Build the "why" field using the violation type explanation.
 */
function buildWhy(violation: Violation): string {
  const base = VIOLATION_EXPLANATIONS[violation.type] ?? violation.message;
  if (violation.sourceLayer && violation.targetLayer) {
    return `${base} (${violation.sourceLayer} → ${violation.targetLayer})`;
  }
  return base;
}

/**
 * Build the "fix" field using the violation type suggestion.
 */
function buildFix(violation: Violation): string {
  return FIX_SUGGESTIONS[violation.type] ?? 'Review the violation and refactor the code to comply with the architectural rule.';
}

/**
 * Transform a raw Violation into an ActionableViolation with What/Where/Why/Fix.
 */
export function formatActionableViolation(
  violation: Violation,
  fitnessFunctions: readonly FitnessFunction[],
  baselineResult?: BaselineResult | undefined,
): ActionableViolation {
  const fitnessFunction = fitnessFunctions.find((ff) => ff.id === violation.functionId);

  return {
    ...violation,
    what: buildWhat(violation, fitnessFunction),
    where: buildWhere(violation),
    why: buildWhy(violation),
    fix: buildFix(violation),
    baselineStatus: resolveBaselineStatus(violation, baselineResult),
  };
}

/**
 * Transform all violations in a report to actionable format.
 */
export function formatAllActionableViolations(
  violations: readonly Violation[],
  fitnessFunctions: readonly FitnessFunction[],
  baselineResult?: BaselineResult | undefined,
): ActionableViolation[] {
  return violations.map((v) => formatActionableViolation(v, fitnessFunctions, baselineResult));
}
