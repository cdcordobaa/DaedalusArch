import { canonicalJSON } from './canonical-json.js';

/**
 * Verdict JSON schema (U4 DE §6, BR-U4-VRD-01). Passed as `--json-schema` to the
 * Claude CLI and as `responseSchema` to Gemini; its canonical JSON is part of every
 * cassette request key (BR-U4-CAS-01). Frozen (BR §11, ADR-015 item 2).
 */
export const VERDICT_JSON_SCHEMA = deepFreeze({
  type: 'object',
  additionalProperties: false,
  required: ['pass', 'confidence', 'reasoning', 'evidence', 'violations'],
  properties: {
    pass: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string', maxLength: 2000 },
    evidence: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 500 } },
    violations: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['filePath', 'message'],
        properties: {
          filePath: { type: 'string' },
          message: { type: 'string', maxLength: 500 },
        },
      },
    },
  },
} as const);

/** Canonical JSON text of the schema: what the request key hashes and the CLI receives. */
export const VERDICT_SCHEMA_TEXT: string = canonicalJSON(VERDICT_JSON_SCHEMA);

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}
