/**
 * Canonical JSON serialisation (FR-25; BR-U5b-26; U5b domain-entities §3).
 *
 * `canonicalize(value)` is the byte form on which a `GoldenScore` (and every other U5b artefact
 * compared byte for byte) is written:
 * - object keys sorted by code-unit order; fields whose value is `undefined` omitted; `null` kept;
 * - a `Map` becomes an array of `[key, value]` pairs sorted by the canonical JSON encoding of the key
 *   (string comparison), so key tuples such as `baselineMatchKey` (BR-U5b-02) sort stably;
 * - a stored ratio is wrapped with `ratio(x)` and written with `toFixed(6)` (`0.1 + 0.2` → `0.300000`);
 *   plain numbers are written as `JSON.stringify` writes them, so integers stay integers;
 * - two-space indentation, no trailing whitespace, a final `\n`; `canonicalBytes` gives the UTF-8 bytes.
 * Values that JSON cannot carry faithfully (non-finite numbers, bigint, functions, symbols, `Set`) throw.
 */

/** Tagged wrapper for a stored ratio; resolved to a `toFixed(6)` number token at write time. */
export class Ratio {
  constructor(readonly value: number) {
    if (!Number.isFinite(value)) throw new RangeError(`canonical-json: ratio must be finite, got ${String(value)}`);
  }
}

/** Marks `value` as a stored ratio (written with six decimals). */
export function ratio(value: number): Ratio {
  return new Ratio(value);
}

const INDENT = '  ';

function fail(what: string, path: string): never {
  throw new TypeError(`canonical-json: cannot serialise ${what} at ${path === '' ? '/' : path}`);
}

function isPlainObject(v: object): v is Record<string, unknown> {
  const proto = Object.getPrototypeOf(v) as unknown;
  return proto === Object.prototype || proto === null;
}

function encodeNumber(n: number, path: string): string {
  if (!Number.isFinite(n)) fail(`non-finite number ${String(n)}`, path);
  return JSON.stringify(n);
}

function write(value: unknown, depth: number, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return encodeNumber(value, path);
    case 'object':
      break;
    default:
      return fail(typeof value, path);
  }
  if (value instanceof Ratio) return value.value.toFixed(6);
  const pad = INDENT.repeat(depth + 1);
  const close = INDENT.repeat(depth);
  if (Array.isArray(value)) {
    const items = value.map((item: unknown, i) => write(item, depth + 1, `${path}/${String(i)}`) ?? 'null');
    return items.length === 0 ? '[]' : `[\n${items.map((s) => pad + s).join(',\n')}\n${close}]`;
  }
  if (value instanceof Map) {
    const pairs = [...(value as Map<unknown, unknown>).entries()].map(([k, v], i) => {
      const keyText = write(k, 0, `${path}/<key ${String(i)}>`) ?? 'null';
      return { sortKey: keyText.replace(/\n\s*/g, ''), k, v, i };
    });
    pairs.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
    return write(pairs.map((p) => [p.k, p.v]), depth, path);
  }
  if (value instanceof Set) return fail('Set', path);
  if (!isPlainObject(value)) return fail(`object of class ${value.constructor.name}`, path);
  const fields: string[] = [];
  for (const key of Object.keys(value).sort()) {
    const text = write(value[key], depth + 1, `${path}/${key}`);
    if (text !== undefined) fields.push(`${pad}${JSON.stringify(key)}: ${text}`);
  }
  return fields.length === 0 ? '{}' : `{\n${fields.join(',\n')}\n${close}}`;
}

/** Canonical JSON text of `value`, ending with `\n`. */
export function canonicalize(value: unknown): string {
  const text = write(value, 0, '');
  if (text === undefined) fail('undefined', '');
  return `${text}\n`;
}

/** UTF-8 bytes of `canonicalize(value)`. */
export function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(canonicalize(value), 'utf8');
}
