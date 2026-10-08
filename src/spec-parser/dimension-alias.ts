import type { Dimension } from '../shared/types/enums.js';
import type { ValidationWarning } from './types.js';

/**
 * FR-22 dimension alias (BR-U1-20): `intent` is accepted and mapped to `semantic` with SPEC_004.
 * Every other value passes through (the schema has already rejected unknown values).
 */
export function normaliseDimension(
  value: string, // schema-validated YAML value; the legacy alias is not a Dimension member (U3-R7)
  functionId: string,
): { dimension: Dimension; warning?: ValidationWarning } {
  if (value === 'intent') {
    return {
      dimension: 'semantic',
      warning: {
        code: 'SPEC_004',
        message: `Dimension "intent" of ${functionId} is deprecated; mapped to "semantic"`,
      },
    };
  }
  return { dimension: value as Dimension };
}
