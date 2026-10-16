import { classifySeed, cleanUnitPass, diffBody, majorityFail, newFindings, symbolicFindings, touches } from '../../../../scripts/v1.3/complementarity.js';
import type { SymFinding } from '../../../../scripts/v1.3/complementarity.js';

const f = (functionId: string, filePath: string, tier: SymFinding['tier'], target?: string): SymFinding => ({ functionId, filePath, tier, ...(target !== undefined ? { target } : {}) });

describe('complementarity classification rule', () => {
  it('reads symbolic findings with their tier and drops neural ones', () => {
    const rep = {
      violations: [
        { functionId: 'FF-P01', filePath: 'src/a.ts', target: 'typeorm' },
        { functionId: 'FF-C03', filePath: 'src/a.ts' },
        { functionId: 'FF-X99', filePath: 'src/a.ts' },
        { functionId: 'FF-N01', filePath: 'src/a.ts' },
      ],
      tiers: { blocking: { rules: [{ functionId: 'FF-P01' }] }, advisory: { rules: [{ functionId: 'FF-C03' }] } },
    };
    expect(symbolicFindings(rep).map((x) => `${x.functionId}:${x.tier}`)).toEqual(['FF-P01:blocking', 'FF-C03:advisory', 'FF-X99:none']);
  });

  it('subtracts the base as a multiset', () => {
    const base = [f('FF-P01', 'src/a.ts', 'blocking', 'typeorm')];
    const seeded = [f('FF-P01', 'src/a.ts', 'blocking', 'typeorm'), f('FF-P01', 'src/a.ts', 'blocking', 'typeorm')];
    expect(newFindings(base, seeded)).toHaveLength(1);
    expect(newFindings(seeded, base)).toHaveLength(0);
  });

  it('counts a finding on an edited file or naming it as target', () => {
    expect(touches(f('FF-C01', 'src/b.ts', 'advisory', 'src/a'), ['src/a.ts'])).toBe(true);
    expect(touches(f('FF-C01', 'src/a.ts', 'advisory'), ['src/a.ts'])).toBe(true);
    expect(touches(f('FF-C01', 'src/b.ts', 'advisory', 'src/c.ts'), ['src/a.ts'])).toBe(false);
  });

  it('is visible only for a new blocking or advisory finding on the seed', () => {
    const base = [f('FF-C03', 'src/a.ts', 'advisory')];
    expect(classifySeed(base, base, ['src/a.ts']).visible).toBe(false);
    expect(classifySeed(base, [...base, f('FF-X', 'src/a.ts', 'none')], ['src/a.ts']).visible).toBe(false);
    expect(classifySeed(base, [...base, f('FF-P01', 'src/z.ts', 'blocking')], ['src/a.ts']).visible).toBe(false);
    const adv = classifySeed(base, [...base, f('FF-C04', 'src/a.ts', 'advisory')], ['src/a.ts']);
    expect([adv.visible, adv.visibleBlocking]).toEqual([true, false]);
    const blk = classifySeed(base, [...base, f('FF-P01', 'src/a.ts', 'blocking')], ['src/a.ts']);
    expect([blk.visible, blk.visibleBlocking]).toEqual([true, true]);
  });

  it('passes a clean unit without a blocking finding on its files', () => {
    const base = [f('FF-C03', 'src/a.ts', 'advisory'), f('FF-P01', 'src/b.ts', 'blocking')];
    expect(cleanUnitPass(base, ['src/a.ts'])).toEqual({ pass: true, passAll: false });
    expect(cleanUnitPass(base, ['src/b.ts'])).toEqual({ pass: false, passAll: false });
    expect(cleanUnitPass(base, ['src/c.ts'])).toEqual({ pass: true, passAll: true });
  });

  it('takes the majority of valid runs', () => {
    expect(majorityFail([{ valid: true, pass: false }, { valid: true, pass: true }, { valid: true, pass: false }])).toBe(true);
    expect(majorityFail([{ valid: true, pass: false }, { valid: true, pass: true }])).toBe(false);
    expect(majorityFail([{ valid: false }])).toBeNull();
  });

  it('compares diffs on hunks only', () => {
    const a = 'diff -ruN a/x b/x\n--- a/x\t2026-10-15 12:00\n+++ b/x\t2026-10-15 12:01\n@@ -1 +1 @@\n-a\n+b\n';
    const b = 'diff -ruN -x node_modules a/x b/x\n--- a/x\t2026-10-16 09:00\n+++ b/x\t2026-10-16 09:00\n@@ -1 +1 @@\n-a\n+b';
    expect(diffBody(a)).toBe(diffBody(b));
  });
});
