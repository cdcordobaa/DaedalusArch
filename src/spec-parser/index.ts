export { SpecParserStage, parseSpec, parseADRs } from './spec-parser.js';
export { resolveTemplate, TEMPLATE_REGISTRY } from './template-registry.js';
export { validateSpecSchema, validateBusinessRules } from './spec-validator.js';
export type {
  SpecInput, SpecParserOptions, SpecParserError, SpecParserErrorCode,
  ValidationResult, ValidationError, ValidationWarning, SpecWarningCode,
  ADRParserStrategy, BuiltInTemplate,
} from './types.js';
