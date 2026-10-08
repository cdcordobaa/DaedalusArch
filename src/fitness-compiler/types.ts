import type { FitnessFunction, ADRRule, LayerModel, ScoringWeights } from '../shared/types/spec.js';
import type { DomainWarning, PipelineError } from '../shared/errors/domain-result.js';
import type { LayerKind, TemplateTag } from '../shared/types/enums.js';

export interface CompilerInput {
  readonly fitnessFunctions: readonly FitnessFunction[];
  readonly adrRules: readonly ADRRule[];
  readonly layerModel: LayerModel;
  readonly scoringWeights: ScoringWeights;
  readonly style?: string; // FR-20; nothing sets it in U0
}

/**
 * Role -> layer name(s) used to bind template parameters (FR-19). Derived inside C4 from
 * LayerDefinition.kind; provenance lives in LayerDefinition.kindSource.
 */
export interface LayerKindBinding {
  readonly domainLayer?: string;
  readonly applicationLayers: readonly string[]; // bound as $applicationLayers; [] = no application layer
  readonly infraLayer?: string;
  readonly presentationLayer?: string;
  readonly controllerLayer?: string; // presentationLayer ?? infraLayer; bound as $controllerLayer (ADR-016 a, BR-U1-46)
}

export type CompilerErrorCode =
  | 'MISSING_REQUIRED_PARAM'
  | 'DUPLICATE_FUNCTION_ID'
  | 'COMPILATION_FAILED';

export interface CompilerError extends PipelineError {
  readonly code: CompilerErrorCode;
  readonly stage: 'fitness-compiler';
  readonly critical: true;
}

export type CompilerWarningCode =
  | 'COMPILER_001'   // neuronal-only, no Cypher template (expected)
  | 'COMPILER_002'   // unknown function name, no built-in template
  | 'COMPILER_003'   // shadow mode eligible but no handcrafted Cypher
  | 'COMPILER_004';  // fitness function auto-disabled (e.g. too few layers)

export interface CompilerWarning extends DomainWarning {
  readonly code: CompilerWarningCode;
  readonly functionId?: string;
}

export interface ResultMapping {
  readonly filePathColumn: string;
  readonly messageTemplate: string;
  readonly metadataColumns?: readonly string[];
  // Location, target and id-discriminator columns (FR-12; T-MAP, U3 business-rules.md §3).
  readonly lineColumn?: string;
  readonly linesColumn?: string;
  readonly targetColumn?: string;
  readonly isTypeOnlyColumn?: string;
  readonly discriminatorColumns: readonly string[]; // required (pre-agreed D-U0-4, C10 row 11); [] allowed
  readonly evidenceColumns?: readonly string[];     // measured values; never part of the violation id (C10 row 11)
  readonly cycleColumn?: string; // only for no-cyclic-deps (FR-35)
}

export interface CypherTemplate {
  readonly functionName: string;
  readonly template: string;
  readonly requiredParams: readonly string[];
  readonly optionalParams: readonly string[];
  readonly description: string;
  readonly resultMapping: ResultMapping;
  // Operational tag (FR-29, BR-U1-27; business-rules.md §4.1). Required from U1 K11.
  readonly tag: TemplateTag;
  // Layer kinds the template needs bound; [] = none (FR-19, BR-U1-15). Required from U1 K1.
  readonly requiredLayerKinds: readonly LayerKind[];
  readonly applicableStyles?: readonly string[]; // undefined = every style (FR-20)
}
