import type { Dimension, Severity, Route } from '../types/enums.js';
import type { FunctionId } from '../types/value-objects.js';

export const BUILT_IN_VIOLATION_TYPES = [
  'LAYER_VIOLATION',
  'CYCLIC_DEPENDENCY',
  'LAYER_SKIP',
  'DOMAIN_OUTWARD_DEP',
  'DOMAIN_PURITY_VIOLATION',
  'DEPENDENCY_INVERSION_VIOLATION',
  'REPOSITORY_PATTERN_VIOLATION',
  'USE_CASE_ISOLATION_VIOLATION',
  'CONTROLLER_ENTITY_VIOLATION',
  'FAN_OUT_EXCEEDED',
  'FAN_IN_EXCEEDED',
  'INSTABILITY_VIOLATION',
  'ORPHAN_FILE',
  'LOW_ABSTRACTION_RATIO',
  'SRP_VIOLATION',
  'ISP_VIOLATION',
  'INHERITANCE_DEPTH_EXCEEDED',
  'NAMING_CONVENTION',
  'PLACEMENT_CONVENTION',
  'MISSING_TEST_FILE',
  'INDEX_LOGIC_VIOLATION',
  'SEMANTIC_RULE_VIOLATION',
  'INTENT_VIOLATION',
] as const;

export type BuiltInViolationType = (typeof BUILT_IN_VIOLATION_TYPES)[number];

export type ViolationType = BuiltInViolationType | `CUSTOM_${string}`;

export interface Violation {
  readonly id: string;
  readonly type: ViolationType;
  readonly dimension: Dimension;
  readonly severity: Severity;
  readonly functionId: FunctionId;
  readonly route: Route;
  readonly filePath: string;
  readonly sourceLayer?: string;
  readonly targetLayer?: string;
  readonly message: string;
  readonly evidence?: readonly string[];
  readonly deterministic: boolean;
}
