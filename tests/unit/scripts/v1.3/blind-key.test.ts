/**
 * The blind-expanded key helpers moved unchanged out of `scripts/v1.3/blind-misses-rescore.ts` (U6 plan Step 3), on toy
 * rows: cycle canonicalisation, exact targets first, one-to-one matching, and the blocking counts of `scoreBlind`.
 */
import { canon, fkey, match, parseCsv, scoreBlind } from '../../../../scripts/v1.3/lib/blind-key.js';
import type { BlindKey, F } from '../../../../scripts/v1.3/lib/blind-key.js';
import type { LoadedReference } from '../../../../scripts/v1.3/lib/reference-model.js';

const ref = (style: string, variants: string[]): LoadedReference => ({ style, variants: variants.map((variant) => ({ manifest: { variant } })) }) as unknown as LoadedReference;

describe('canon', () => {
  it('keys a cycle on its sorted file set, whatever the order and duplicates', () => {
    expect(canon({ ruleId: 'FF-S02', file: 'b.ts', target: 'a.ts' })).toEqual({ ruleId: 'FF-S02', file: 'a.ts', target: 'b.ts' });
    expect(canon({ ruleId: 'FF-S02', file: 'c.ts,a.ts', target: 'b.ts, a.ts' })).toEqual({ ruleId: 'FF-S02', file: 'a.ts', target: 'b.ts,c.ts' });
  });

  it('leaves other rules as they are and drops an empty target', () => {
    expect(canon({ ruleId: 'FF-S01', file: 'b.ts', target: 'a.ts' })).toEqual({ ruleId: 'FF-S01', file: 'b.ts', target: 'a.ts' });
    expect(canon({ ruleId: 'FF-S01', file: 'b.ts', target: '' })).toEqual({ ruleId: 'FF-S01', file: 'b.ts' });
    expect(fkey({ ruleId: 'FF-S01', file: 'b.ts' })).toBe('FF-S01|b.ts|');
  });
});

describe('match', () => {
  it('matches exact targets first, then a row without a target, one to one', () => {
    const expected: F[] = [{ ruleId: 'FF-S01', file: 'x.ts' }, { ruleId: 'FF-S01', file: 'x.ts', target: 'b.ts' }];
    const actual: F[] = [{ ruleId: 'FF-S01', file: 'x.ts', target: 'a.ts' }, { ruleId: 'FF-S01', file: 'x.ts', target: 'b.ts' }];
    const m = match(expected, actual);
    expect(m.pairs).toEqual([[0, 0], [1, 1]]); // row 1 took b.ts in the exact pass, so row 0 got a.ts after
    expect(m.fnIdx).toEqual([]);
    expect(m.fpIdx).toEqual([]);
  });

  it('never reuses an actual row and never matches across rules or files', () => {
    const expected: F[] = [{ ruleId: 'FF-S01', file: 'x.ts' }, { ruleId: 'FF-S01', file: 'x.ts' }, { ruleId: 'FF-S04', file: 'x.ts' }];
    const actual: F[] = [{ ruleId: 'FF-S01', file: 'x.ts', target: 'a.ts' }, { ruleId: 'FF-S01', file: 'y.ts' }];
    const m = match(expected, actual);
    expect(m.pairs).toEqual([[0, 0]]);
    expect(m.fnIdx).toEqual([1, 2]);
    expect(m.fpIdx).toEqual([1]);
  });

  it('a different explicit target is no match', () => {
    expect(match([{ ruleId: 'FF-S01', file: 'x.ts', target: 'a.ts' }], [{ ruleId: 'FF-S01', file: 'x.ts', target: 'b.ts' }]).pairs).toEqual([]);
  });
});

describe('parseCsv', () => {
  it('reads quoted cells with commas, doubled quotes and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([{ a: 'x, y', b: 'say "hi"' }]);
  });
});

describe('scoreBlind', () => {
  it('counts blocking and all-rule TP, FN and FP, with renames and drops applied to the key', () => {
    const key: BlindKey = new Map([['s/v1', [
      { ruleId: 'FF-S01', file: 'a.ts', target: 'b.ts' },
      { ruleId: 'FF-S03', file: 'c.ts', target: 'd.ts' },
      { ruleId: 'FF-P06', file: 'e.ts', target: 'f.ts' },
      { ruleId: 'FF-P02', file: 'g.ts' },
    ]]]);
    const actual: F[] = [{ ruleId: 'FF-S01', file: 'a.ts', target: 'b.ts' }, { ruleId: 'FF-S01', file: 'c.ts', target: 'd.ts' }, { ruleId: 'FF-S04', file: 'z.ts' }];
    const scope = new Set(['FF-S01', 'FF-S03', 'FF-S04', 'FF-P06', 'FF-P02']);
    const blocking = new Set(['FF-S01', 'FF-S04', 'FF-P06']);
    const rename = (_v: string, f: F): F => (f.ruleId === 'FF-S03' ? { ...f, ruleId: 'FF-S01' } : f);
    const drop = (_v: string, f: F): boolean => f.ruleId === 'FF-P06';
    const s = scoreBlind(ref('s', ['v1']), key, () => actual, scope, blocking, rename, drop);
    expect(s.blocking).toEqual({ tp: 2, fn: 0, fp: 1 });
    expect(s.all).toEqual({ tp: 2, fn: 1, fp: 1 });
    expect(s.fp).toEqual(['v1 FF-S04 z.ts']);
  });
});
