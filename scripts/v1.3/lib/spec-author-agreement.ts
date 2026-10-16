/**
 * v1.3 K2 statistics (scripts/v1.3/spec-author-agreement.ts): Cohen's kappa, Spearman's rho, and the blocking summary
 * of a `firewall evaluate --format json --scoring v1.3` report. Pure.
 */
/** Cohen's kappa of two label vectors; `null` when expected agreement is 1 (a single label). */
export function cohenKappa(a: readonly string[], b: readonly string[]): { kappa: number | null; po: number; pe: number; n: number } {
  const n = a.length;
  if (n === 0) return { kappa: null, po: 0, pe: 0, n };
  let agree = 0;
  const ca = new Map<string, number>();
  const cb = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) agree++;
    ca.set(a[i]!, (ca.get(a[i]!) ?? 0) + 1);
    cb.set(b[i]!, (cb.get(b[i]!) ?? 0) + 1);
  }
  const po = agree / n;
  let pe = 0;
  for (const [k, v] of ca) pe += (v / n) * ((cb.get(k) ?? 0) / n);
  return { kappa: pe >= 1 ? null : (po - pe) / (1 - pe), po, pe, n };
}

function ranks(xs: readonly number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++;
    for (let k = i; k <= j; k++) r[idx[k]![1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
function pearson(x: readonly number[], y: readonly number[]): number | null {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i]! - mx) * (y[i]! - my); sxx += (x[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}
export function spearman(x: readonly number[], y: readonly number[]): number | null { return pearson(ranks(x), ranks(y)); }

export interface EvalSummary { blocking: number; perRule: Record<string, number>; verdict: string }
/** Blocking count, per-rule blocking and v1.3 verdict from a `firewall evaluate --format json --scoring v1.3` output. */
export function summariseEvaluation(json: unknown): EvalSummary {
  const r = json as { tiers?: { verdict?: string; blocking?: { rules?: { functionId: string; violationCount: number }[] } } };
  if (r.tiers === undefined) throw new Error('evaluation output has no `tiers` block (not --scoring v1.3?)');
  const perRule: Record<string, number> = {};
  let blocking = 0;
  for (const rule of r.tiers.blocking?.rules ?? []) {
    if (rule.violationCount > 0) perRule[rule.functionId] = rule.violationCount;
    blocking += rule.violationCount;
  }
  return { blocking, perRule, verdict: String(r.tiers.verdict ?? 'unknown') };
}
