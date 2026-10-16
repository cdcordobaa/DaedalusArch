/**
 * Narrowing for the v1.3 scripts: the value, or an error that names what was missing. Replaces non-null assertions
 * on lookups the code knows are present (a map filled for every key, a non-empty list), so a broken invariant fails
 * loudly at the lookup instead of later on an `undefined`.
 */
export function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`missing ${what}`);
  return value;
}
