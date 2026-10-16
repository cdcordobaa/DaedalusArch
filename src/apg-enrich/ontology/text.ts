/** Ontology v0: deterministic, embedding-free text matching (tokens, Jaccard, decimal-scale equality). */

const STOP = new Set([
  'a', 'an', 'the', 'of', 'and', 'or', 'for', 'to', 'in', 'on', 'at', 'by', 'is', 'are', 'be', 'when', 'if', 'than',
  'with', 'its', 'it', 'that', 'this', 'from', 'as', 'least', 'most', 'more', 'less', 'equal', 'equals', 'over', 'under',
  'above', 'below', 'per', 'each', 'all', 'any', 'no', 'not',
]);

/** Lower-case word tokens: camelCase and non-alphanumerics split, stop words dropped, a plural `s` stripped. */
export function tokens(text: string): string[] {
  const words = text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== '' && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
  return [...new Set(words)].sort();
}

export function jaccard<T>(a: readonly T[] | ReadonlySet<T>, b: readonly T[] | ReadonlySet<T>): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** The normalised form of a name: its tokens joined by one space. */
export function normName(text: string): string {
  return tokens(text).join(' ');
}

/** True when `a` and `b` are equal up to a decimal scale 10^k, 0 <= k <= maxPower (currency minor units, per cent). */
export function equalUpToDecimalScale(a: number, b: number, maxPower = 3): boolean {
  if (a === b) return true;
  if (a === 0 || b === 0 || Math.sign(a) !== Math.sign(b)) return false;
  const [lo, hi] = Math.abs(a) < Math.abs(b) ? [Math.abs(a), Math.abs(b)] : [Math.abs(b), Math.abs(a)];
  for (let k = 1; k <= maxPower; k++) {
    if (Math.abs(lo * 10 ** k - hi) < 1e-9 * hi) return true;
  }
  return false;
}
