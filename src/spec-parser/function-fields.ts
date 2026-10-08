import type { FunctionSpecificFields } from '../shared/types/spec.js';
import type { ValidationError } from './types.js';

/**
 * The six FR-07 YAML keys and the FitnessFunction field each maps to (BR-U1-03).
 * The insertion order is the iteration order.
 */
export const FUNCTION_FIELD_KEYS: Readonly<Record<string, keyof FunctionSpecificFields>> = {
  forbidden_imports: 'forbiddenImports',
  max_public_methods: 'maxPublicMethods',
  max_dependencies: 'maxDependencies',
  max_interface_methods: 'maxInterfaceMethods',
  max_depth: 'maxDepth',
  pattern: 'pattern',
};

/** Reverse map: template parameter / field name -> YAML key (UnboundParameter.yamlKey, SPEC_001 text). */
export const FIELD_TO_YAML_KEY: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(FUNCTION_FIELD_KEYS).map(([yamlKey, field]) => [field, yamlKey]),
);

const LIST_FIELDS: ReadonlySet<string> = new Set(['forbiddenImports']);
const STRING_FIELDS: ReadonlySet<string> = new Set(['pattern']);

function isValidValue(field: string, v: unknown): boolean {
  if (LIST_FIELDS.has(field)) return Array.isArray(v) && v.every((s) => typeof s === 'string');
  if (STRING_FIELDS.has(field)) return typeof v === 'string';
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/**
 * Map the FR-07 keys of one raw fitness-function declaration to typed fields.
 * Presence is `!= null`, so `0` and `[]` are values; absent keys are omitted (never `undefined`).
 * The `errors` channel is defensive only: the schema has already type-checked every value.
 */
export function mapFunctionSpecificFields(
  raw: Readonly<Record<string, unknown>>,
  path: string,
): { fields: FunctionSpecificFields; errors: readonly ValidationError[] } {
  const fields: Record<string, unknown> = {};
  const errors: ValidationError[] = [];

  for (const [yamlKey, field] of Object.entries(FUNCTION_FIELD_KEYS)) {
    const v = raw[yamlKey];
    if (v == null) continue;
    if (!isValidValue(field, v)) {
      errors.push({
        path: `${path}.${yamlKey}`,
        message: `Field "${yamlKey}" has an invalid value`,
        rule: 'FR-07',
      });
      continue;
    }
    fields[field] = Array.isArray(v) ? [...(v as string[])] : v;
  }

  return { fields, errors };
}
