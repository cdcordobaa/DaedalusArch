/**
 * MEAN-01 meaning analysis: the A × B table and the reason codes (design BR-30, BR-31; codebook §9.3, §9.4).
 */
import { cmp } from './load.js';
import type { Answer, CrossTab, ReasonCode, ReasonCounts, Sample, Sheet } from './types.js';
import { REASON_CODES } from './types.js';

/** Row and column order of the A × B table. */
export const CROSS_CATEGORIES = ['yes', 'no', 'unsure', 'blank'] as const;
const idx = (v: Answer | null): number => CROSS_CATEGORIES.indexOf(v ?? 'blank');

/** BR-30: the sheet's A (rows) by B (columns), 3×3 plus a blank row and column, over every sample item. */
export function crossTab(sample: Sample, sheet: Sheet): CrossTab {
  const table = CROSS_CATEGORIES.map(() => CROSS_CATEGORIES.map(() => 0));
  for (const it of sample.items) {
    const row = sheet.rows.get(it.itemId);
    const r = table[idx(row?.A ?? null)];
    const j = idx(row?.B ?? null);
    if (r !== undefined) r[j] = (r[j] ?? 0) + 1;
  }
  return {
    role: sheet.role,
    table,
    bYesANo: table[idx('no')]?.[idx('yes')] ?? 0,
    aYesBNo: table[idx('yes')]?.[idx('no')] ?? 0,
  };
}

type CodeCounts = Record<ReasonCode | 'blank', number>;
const zero = (): CodeCounts => ({ T: 0, W: 0, F: 0, M: 0, C: 0, X: 0, blank: 0 });

/** BR-31: among the sheet's items where A or B is `no`, the count of each reason code and blank, pooled and per rule. */
export function reasonCounts(sample: Sample, sheet: Sheet): ReasonCounts {
  const pooled = zero();
  const perRule = new Map<string, { items: number; c: CodeCounts }>();
  let items = 0;
  for (const it of sample.items) {
    const row = sheet.rows.get(it.itemId);
    if (row === undefined || (row.A !== 'no' && row.B !== 'no')) continue;
    const code = row.whyNot ?? 'blank';
    items += 1;
    pooled[code] += 1;
    const r = perRule.get(it.ruleId) ?? { items: 0, c: zero() };
    r.items += 1;
    r.c[code] += 1;
    perRule.set(it.ruleId, r);
  }
  return {
    role: sheet.role,
    items,
    pooled,
    perRule: [...perRule.keys()].sort(cmp).map((ruleId) => {
      const r = perRule.get(ruleId) ?? { items: 0, c: zero() };
      return { ruleId, items: r.items, ...r.c };
    }),
  };
}

export const CODE_COLUMNS: readonly (ReasonCode | 'blank')[] = [...REASON_CODES, 'blank'];
