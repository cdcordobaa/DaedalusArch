import type { Dimension, Severity, Route, ADRFormat, JudgeUnitKind, LayerKind } from './enums.js';
import type { FunctionId } from './value-objects.js';

export interface FitnessFunction {
  readonly id: FunctionId;
  readonly name: string;
  readonly dimension: Dimension;
  readonly severity: Severity;
  readonly threshold?: number;
  readonly route: Route;
  readonly semanticCriteria?: SemanticCriteria;
  readonly isBuiltIn: boolean;
  readonly validated: boolean;
  readonly enabled: boolean;
  readonly excludePaths: readonly string[];
  readonly disabledReason?: string;
  // Function-specific fields (FR-07); the parser does not fill them yet (U1).
  readonly forbiddenImports?: readonly string[];
  readonly maxPublicMethods?: number;
  readonly maxDependencies?: number;
  readonly maxInterfaceMethods?: number;
  readonly maxDepth?: number;
  readonly pattern?: string;
  // Judge unit for neuronal/hybrid functions (FR-33); default per dimension is set by U4.
  readonly judgeUnit?: JudgeUnitKind;
}

/** The six YAML keys FR-07 maps, as one typed bag. */
export type FunctionSpecificFields = Pick<
  FitnessFunction,
  'forbiddenImports' | 'maxPublicMethods' | 'maxDependencies' | 'maxInterfaceMethods' | 'maxDepth' | 'pattern'
>;

export interface DisabledFunction {
  readonly id: FunctionId;
  readonly name: string;
  readonly reason?: string;
}

export interface SemanticCriteria {
  readonly rule: string;
  readonly adrRef?: string;
  readonly rubric: EvalRubric;
}

export interface EvalRubric {
  readonly pass: string;
  readonly fail: string;
  readonly evidenceRequired: string;
}

export interface LayerModel {
  readonly layers: readonly LayerDefinition[];
}

export interface LayerDefinition {
  readonly name: string;
  readonly directories: readonly string[];
  readonly naming: readonly string[];
  readonly decorators?: readonly string[];
  readonly filePatterns?: readonly string[];
  readonly role: string;
  // Resolved layer kind and the precedence step that produced it (FR-19); not filled in U0.
  readonly kind?: LayerKind;
  readonly kindSource?: 'explicit' | 'name' | 'position';
}

// Keyed by the Dimension union (FR-22): every literal carries 'integrity'. 'intent' is no longer a
// Dimension member (U3-R7, BR-U3-30); it survives only as a deprecated YAML alias (BR-U1-20/21).
export type ScoringWeights = Readonly<Record<Dimension, number>>;

export interface ConfidenceThresholds {
  readonly high: number;
  readonly medium: number;
  readonly iccMinimum: number;
}

export interface VerdictThresholds {
  readonly pass: number;
  readonly warning: number;
  readonly softBlock: number;
}

export interface ParsedSpec {
  readonly specVersion: string;
  readonly style?: string; // FR-20; not filled in U0
  readonly layerModel: LayerModel;
  readonly fitnessFunctions: readonly FitnessFunction[];
  readonly scoringWeights: ScoringWeights;
  readonly fullModeWeights?: ScoringWeights;
  readonly verdictThresholds: VerdictThresholds;
  readonly confidenceThresholds: ConfidenceThresholds;
  readonly adrRules: readonly ADRRule[];
}

export interface ADRRule {
  readonly id: string;
  readonly title: string;
  readonly format: ADRFormat;
  readonly symbolicRule?: CypherRule;
  readonly semanticCriterion?: SemanticCriteria;
  readonly rawContent: string;
}

export interface CypherRule {
  readonly query: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly description: string;
}
