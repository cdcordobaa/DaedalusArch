/**
 * Diff-aware gate: sorting two commits' findings into new, fixed and unchanged (src/ci-gate/match.ts).
 */
import { applyRenames, classifyFindings, cycleFileSet, findingKey } from '../../../src/ci-gate/match.js';
import type { GateFinding } from '../../../src/ci-gate/types.js';

function f(ruleId: string, file: string, extra: Partial<GateFinding> = {}): GateFinding {
  return { ruleId, ruleName: ruleId.toLowerCase(), tier: 'blocking', file, message: `${ruleId} in ${file}`, ...extra };
}

describe('findingKey', () => {
  it('is rule + file + target, without the line', () => {
    expect(findingKey(f('FF-S01', 'src/a.ts', { target: 'src/b.ts', line: 3 }))).toBe('FF-S01|src/a.ts|src/b.ts');
    expect(findingKey(f('FF-P03', 'src/a.ts'))).toBe('FF-P03|src/a.ts|');
  });

  it('keys a cycle by its set of files, whatever file it starts from', () => {
    const a = f('FF-S02', 'src/a.ts,src/b.ts,src/a.ts', { target: 'src/b.ts' });
    const b = f('FF-S02', 'src/b.ts,src/a.ts,src/b.ts', { target: 'src/a.ts' });
    expect(cycleFileSet(a)).toBe('src/a.ts,src/b.ts');
    expect(findingKey(a)).toBe(findingKey(b));
  });
});

describe('classifyFindings', () => {
  it('reports rows only in head as new, only in base as fixed, in both as unchanged', () => {
    const kept = f('FF-S01', 'src/a.ts', { target: 'src/x.ts' });
    const gone = f('FF-S03', 'src/b.ts', { target: 'src/y.ts' });
    const added = f('FF-P01', 'src/c.ts', { target: 'typeorm' });
    const r = classifyFindings([kept, gone], [kept, added]);
    expect(r.new).toEqual([added]);
    expect(r.fixed).toEqual([gone]);
    expect(r.unchanged).toEqual([{ base: kept, head: kept }]);
  });

  it('tolerates line drift: a row whose line moved is unchanged', () => {
    const base = f('FF-S01', 'src/a.ts', { target: 'src/x.ts', line: 4 });
    const head = { ...base, line: 9 };
    const r = classifyFindings([base], [head]);
    expect(r.new).toEqual([]);
    expect(r.fixed).toEqual([]);
    expect(r.unchanged).toEqual([{ base, head }]);
  });

  it('reports only the surplus of a key: a second row of the same rule, file and target is new', () => {
    const one = f('FF-CV01', 'src/a.ts', { line: 10, tier: 'advisory' });
    const moved = { ...one, line: 12 };
    const second = { ...one, line: 30 };
    const r = classifyFindings([one], [moved, second]);
    expect(r.unchanged).toHaveLength(1);
    expect(r.new).toHaveLength(1);
    expect(r.fixed).toEqual([]);
  });

  it('pairs rows on the same line first', () => {
    const a = f('FF-CV01', 'src/a.ts', { line: 5, tier: 'advisory' });
    const b = { ...a, line: 20 };
    const r = classifyFindings([a, b], [b]);
    expect(r.unchanged).toEqual([{ base: b, head: b }]);
    expect(r.fixed).toEqual([a]);
  });

  it('matches a cycle reported from another starting file', () => {
    const base = f('FF-S02', 'src/a.ts,src/b.ts,src/a.ts', { target: 'src/b.ts' });
    const head = f('FF-S02', 'src/b.ts,src/a.ts,src/b.ts', { target: 'src/a.ts' });
    const r = classifyFindings([base], [head]);
    expect(r.new).toEqual([]);
    expect(r.fixed).toEqual([]);
  });

  it('re-keys base rows through renames, so a moved file keeps its findings unchanged', () => {
    const base = f('FF-S01', 'src/old/a.ts', { target: 'src/x.ts' });
    const head = f('FF-S01', 'src/new/a.ts', { target: 'src/x.ts' });
    const renames = { 'src/old/a.ts': 'src/new/a.ts' };
    expect(classifyFindings([base], [head]).new).toHaveLength(1);
    const r = classifyFindings([base], [head], renames);
    expect(r.new).toEqual([]);
    expect(r.fixed).toEqual([]);
    expect(r.unchanged).toEqual([{ base, head }]);
  });

  it('renames targets and every file of a cycle path', () => {
    const row = f('FF-S02', 'src/a.ts,src/b.ts,src/a.ts', { target: 'src/b.ts' });
    expect(applyRenames(row, { 'src/b.ts': 'src/c.ts' })).toMatchObject({ file: 'src/a.ts,src/c.ts,src/a.ts', target: 'src/c.ts' });
  });

  it('lists blocking rows before advisory ones', () => {
    const adv = f('FF-A01', 'src/a.ts', { tier: 'advisory' });
    const blk = f('FF-Z01', 'src/z.ts');
    expect(classifyFindings([], [adv, blk]).new.map((x) => x.tier)).toEqual(['blocking', 'advisory']);
  });

  it('reports nothing for identical inputs', () => {
    const rows = [f('FF-S01', 'src/a.ts', { target: 'src/b.ts' }), f('FF-P03', 'src/c.ts')];
    const r = classifyFindings(rows, rows);
    expect(r.new).toEqual([]);
    expect(r.fixed).toEqual([]);
    expect(r.unchanged).toHaveLength(2);
  });
});
