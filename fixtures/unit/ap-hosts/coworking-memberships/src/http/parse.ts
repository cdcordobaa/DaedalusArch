import { ValidationError } from '../services/errors';

type Fields = Readonly<Record<string, unknown>>;

/** The JSON body as an object, or a 400. */
export function fieldsOf(body: unknown): Fields {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Expected a JSON object');
  }
  return body as Fields;
}

export function text(fields: Fields, name: string): string {
  const value = fields[name];
  if (typeof value !== 'string') {
    throw new ValidationError(`${name} must be a string`);
  }
  return value;
}

export function optionalText(fields: Fields, name: string): string | null {
  const value = fields[name];
  return value === undefined || value === null ? null : text(fields, name);
}

export function integer(fields: Fields, name: string): number {
  const value = fields[name];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`${name} must be a number`);
  }
  return value;
}
