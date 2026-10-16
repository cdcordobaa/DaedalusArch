import { ValidationError } from '../../../application/errors';

type Fields = Readonly<Record<string, unknown>>;

export function fieldsOf(body: unknown): Fields {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Expected a JSON object');
  }
  return body as Fields;
}

export function str(f: Fields, name: string): string {
  const v = f[name];
  if (typeof v !== 'string') throw new ValidationError(`${name} must be a string`);
  return v;
}

export function num(f: Fields, name: string): number {
  const v = f[name];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ValidationError(`${name} must be a number`);
  return v;
}

export function bool(f: Fields, name: string): boolean {
  return f[name] === true;
}

export function strings(f: Fields, name: string): string[] {
  const v = f[name];
  if (!Array.isArray(v) || !v.every((x): x is string => typeof x === 'string')) throw new ValidationError(`${name} must be a list of strings`);
  return v;
}
