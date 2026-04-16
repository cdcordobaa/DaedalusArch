export { SpecParserStage, parseSpec, parseADRs } from './spec-parser.js';
export { resolveTemplate, TEMPLATE_REGISTRY } from './template-registry.js';
export { validateSpecSchema, validateBusinessRules, validateSpecAgainstProject } from './spec-validator.js';
export { loadPreset, mergeSpecs, listPresets } from './preset-loader.js';
export type { SpecOverrides, LayerOverride, FFOverride } from './preset-loader.js';
export type {
  SpecInput, SpecParserOptions, SpecParserError, SpecParserErrorCode,
  ValidationResult, ValidationError, ValidationWarning, SpecWarningCode,
  ADRParserStrategy, BuiltInTemplate,
} from './types.js';
