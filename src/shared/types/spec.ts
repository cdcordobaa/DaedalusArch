import type { Dimension, Severity, Route, ADRFormat } from './enums.js';
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
}

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
}

export interface ScoringWeights {
  readonly structural: number;
  readonly coupling: number;
  readonly pattern: number;
  readonly solid: number;
  readonly convention: number;
  readonly semantic: number;
  readonly intent: number;
}

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
