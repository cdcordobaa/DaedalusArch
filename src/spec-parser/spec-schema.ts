/**
 * JSON Schema v1.0.0 for AoC YAML specification.
 * Validates structural shape only — business rules validated separately in spec-validator.ts.
 */
export const SPEC_SCHEMA_V1 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['spec_version', 'architecture', 'scoring', 'confidence_thresholds'],
  additionalProperties: true,
  properties: {
    spec_version: { type: 'string' },
    architecture: {
      type: 'object',
      required: ['layers'],
      properties: {
        style: { type: 'string' },
        layers: {
          type: 'array',
          minItems: 2,
          items: {
            type: 'object',
            required: ['name', 'directories', 'roles'],
            properties: {
              name: { type: 'string', minLength: 1 },
              directories: { type: 'array', items: { type: 'string' }, minItems: 1 },
              roles: { type: 'array', items: { type: 'string' }, minItems: 1 },
              decorators: { type: 'array', items: { type: 'string' } },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    fitness_functions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'dimension', 'severity', 'route'],
        properties: {
          id: { type: 'string', pattern: '^FF-[A-Z]{1,3}[0-9]{2}$' },
          name: { type: 'string', minLength: 1 },
          dimension: { type: 'string', enum: ['structural', 'coupling', 'pattern', 'solid', 'convention', 'semantic', 'intent'] },
          severity: { type: 'string', enum: ['critical', 'major', 'minor', 'advisory'] },
          route: { type: 'string', enum: ['symbolic', 'neuronal', 'hybrid'] },
          threshold: { type: 'number' },
          validated: { type: 'boolean' },
          semantic_criteria: {
            type: 'object',
            required: ['rule', 'rubric'],
            properties: {
              rule: { type: 'string', minLength: 1 },
              adr_ref: { type: 'string' },
              rubric: {
                type: 'object',
                required: ['pass', 'fail', 'evidence_required'],
                properties: {
                  pass: { type: 'string', minLength: 1 },
                  fail: { type: 'string', minLength: 1 },
                  evidence_required: { type: 'string', minLength: 1 },
                },
                additionalProperties: false,
              },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: true,
      },
    },
    scoring: {
      type: 'object',
      required: ['weights', 'thresholds'],
      properties: {
        weights: {
          type: 'object',
          required: ['structural', 'coupling', 'pattern', 'solid', 'convention'],
          properties: {
            structural: { type: 'number', minimum: 0, maximum: 1 },
            coupling: { type: 'number', minimum: 0, maximum: 1 },
            pattern: { type: 'number', minimum: 0, maximum: 1 },
            solid: { type: 'number', minimum: 0, maximum: 1 },
            convention: { type: 'number', minimum: 0, maximum: 1 },
          },
          additionalProperties: false,
        },
        full_mode_weights: {
          type: 'object',
          required: ['structural', 'coupling', 'pattern', 'solid', 'convention', 'semantic', 'intent'],
          properties: {
            structural: { type: 'number', minimum: 0, maximum: 1 },
            coupling: { type: 'number', minimum: 0, maximum: 1 },
            pattern: { type: 'number', minimum: 0, maximum: 1 },
            solid: { type: 'number', minimum: 0, maximum: 1 },
            convention: { type: 'number', minimum: 0, maximum: 1 },
            semantic: { type: 'number', minimum: 0, maximum: 1 },
            intent: { type: 'number', minimum: 0, maximum: 1 },
          },
          additionalProperties: false,
        },
        thresholds: {
          type: 'object',
          required: ['pass', 'warning', 'soft_block'],
          properties: {
            pass: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1 },
            warning: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1 },
            soft_block: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1 },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    confidence_thresholds: {
      type: 'object',
      required: ['high', 'medium', 'icc_minimum'],
      properties: {
        high: { type: 'number', minimum: 0, maximum: 1 },
        medium: { type: 'number', minimum: 0, maximum: 1 },
        icc_minimum: { type: 'number', minimum: 0, maximum: 1 },
      },
      additionalProperties: false,
    },
  },
} as const;
