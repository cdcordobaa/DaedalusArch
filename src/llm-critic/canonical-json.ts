import { createHash } from 'node:crypto';

/**
 * Canonical JSON (U4 DE §3.5): object keys sorted recursively by UTF-16 code unit
 * order, array order kept, `JSON.stringify` encoding for strings and numbers, no
 * whitespace. Properties whose value is `undefined` are omitted and `undefined`
 * array items become `null`, as `JSON.stringify` does. Non-finite numbers are
 * rejected, so a key never silently hashes `NaN` as `null`.
 */
export function canonicalJSON(value: unknown): string {
  return encode(value, new Set<object>());
}

/** Lower-case hex SHA-256 of a UTF-8 string (BR-U4-CAS-01, POL-01, SEL-04). */
export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function encode(value: unknown, ancestors: Set<object>): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError('canonicalJSON: non-finite number');
      }
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      throw new TypeError(`canonicalJSON: unsupported type ${typeof value}`);
  }
  if (ancestors.has(value)) {
    throw new TypeError('canonicalJSON: circular structure');
  }
  ancestors.add(value);
  let out: string;
  if (Array.isArray(value)) {
    const items = (value as readonly unknown[]).map((item) => (item === undefined ? 'null' : encode(item, ancestors)));
    out = `[${items.join(',')}]`;
  } else {
    const record = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (item === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${encode(item, ancestors)}`);
    }
    out = `{${parts.join(',')}}`;
  }
  ancestors.delete(value);
  return out;
}
