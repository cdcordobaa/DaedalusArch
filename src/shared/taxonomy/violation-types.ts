import type { Dimension, Severity, Route, TemplateTag } from '../types/enums.js';
import type { FunctionId } from '../types/value-objects.js';
import type { BaselineStatus } from '../types/baseline.js';

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
  'INTENT_VIOLATION',              // deprecated (FR-22, BR-U1-23): kept so older reports parse; no U1 producer; U3 removes it with the `intent` Dimension member
  'DOMAIN_STATE_PURITY_VIOLATION', // FR-21
  'INTEGRITY_VIOLATION',           // FR-22
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
  // Optional fields added by the C10 contract; nothing fills them in U0.
  readonly line?: number;                     // FR-12
  readonly lines?: readonly number[];         // FR-10
  readonly target?: string;                   // FR-12
  readonly isTypeOnly?: boolean;              // set on import-derived violations
  readonly tag?: TemplateTag;                 // FR-29
  readonly unitId?: string;                   // FR-33: judge unit for neuronal violations
  readonly discriminator?: readonly string[]; // FR-12: discriminator values hashed into `id`
}

export interface ActionableViolation extends Violation {
  readonly what: string;
  readonly where: string;
  readonly why: string;
  readonly fix: string;
  readonly baselineStatus: BaselineStatus;
}
