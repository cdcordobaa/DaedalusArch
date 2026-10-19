/**
 * T-LN (U4 design §5): the lineage builder on G08's split and merge cases S1–S4 and M1–M4 and the worked examples of
 * G08 §2.5 (`ops/notes/g08-violation-identity.md`), each under LEGACY_FIXES_MINED and G08_PROPOSED; a failed middle
 * snapshot (ID-13); a mass commit that keeps identity (ID-12); a context mismatch (ID-1); and a hand-built 6-point grid
 * where the legacy preset reproduces `lineages()` of `scripts/v1.3/fixes-mined-run.ts`. Expected outcomes are written
 * from G08 §2.3 and §2.4 before the code ran.
 */
import { buildLineages } from '../../../../scripts/lib/drift/lineage.js';
import { G08_PROPOSED, LEGACY_FIXES_MINED, type IdentityOptions, type Lineage, type Transition } from '../../../../scripts/lib/drift/types.js';
import { K, at, cyc, dep, snap } from './fixtures.js';

const by = (ls: readonly Lineage[], key: string): Lineage[] => ls.filter((l) => l.key === key);
const one = (ls: readonly Lineage[], key: string): Lineage => {
  const xs = by(ls, key);
  if (xs.length !== 1) throw new Error(`expected one lineage ${key}, got ${String(xs.length)}`);
  return at(xs, 0);
};
const tr = (rename: Record<string, string>, extra: Partial<Transition> = {}): Transition => ({ rename: new Map(Object.entries(rename)), ...extra });

describe('splits (G08 §2.3)', () => {
  it('S1 source file split: A → T continues, A2 → T is new (both presets)', () => {
    for (const o of [LEGACY_FIXES_MINED, G08_PROPOSED]) {
      const { lineages } = buildLineages([snap('t', [dep('A.ts', 'T.ts')]), snap('t1', [dep('A.ts', 'T.ts'), dep('A2.ts', 'T.ts')])], [], o);
      expect(one(lineages, K(dep('A.ts', 'T.ts')))).toMatchObject({ born: 0, ended: null });
      expect(one(lineages, K(dep('A2.ts', 'T.ts')))).toMatchObject({ born: 1, ended: null });
    }
  });

  const s2 = [snap('t', [dep('A.ts', 'T.ts')]), snap('t1', [dep('A1.ts', 'T.ts'), dep('A2.ts', 'T.ts')])];
  const s2t = [undefined, tr({ 'A.ts': 'A1.ts' })];
  it('S2 source renamed and split, legacy: A → T ends RENAMED, A1 → T and A2 → T are new', () => {
    const { lineages } = buildLineages(s2, s2t, LEGACY_FIXES_MINED);
    expect(one(lineages, K(dep('A.ts', 'T.ts')))).toMatchObject({ born: 0, ended: 1, cause: 'RENAMED' });
    expect(one(lineages, K(dep('A1.ts', 'T.ts')))).toMatchObject({ born: 1, ended: null });
    expect(one(lineages, K(dep('A2.ts', 'T.ts')))).toMatchObject({ born: 1, ended: null });
  });
  it('S2 under G08: A1 → T continues (it equals ρ), A2 → T is new', () => {
    const { lineages } = buildLineages(s2, s2t, G08_PROPOSED);
    expect(one(lineages, K(dep('A.ts', 'T.ts')))).toMatchObject({ born: 0, ended: null, finalKey: K(dep('A1.ts', 'T.ts')), renamedAt: [1] });
    expect(by(lineages, K(dep('A1.ts', 'T.ts')))).toEqual([]);
    expect(one(lineages, K(dep('A2.ts', 'T.ts')))).toMatchObject({ born: 1, ended: null });
  });

  const s3 = [snap('t', [dep('A.ts', 'T.ts')]), snap('t1', [dep('A.ts', 'T2.ts')], { extraFiles: ['T.ts'] })];
  it('S3 re-pointing, legacy: A → T ends FIXED-BY-DEV, A → T2 is new with no link', () => {
    const { lineages } = buildLineages(s3, [], LEGACY_FIXES_MINED);
    expect(one(lineages, K(dep('A.ts', 'T.ts')))).toMatchObject({ ended: 1, cause: 'FIXED-BY-DEV', filesStay: true });
    expect(one(lineages, K(dep('A.ts', 'T2.ts'))).derivedFrom).toBeUndefined();
  });
  it('S3 under G08: A → T ends RE-POINTED (never credited), A → T2 derives from it', () => {
    const { lineages } = buildLineages(s3, [], G08_PROPOSED);
    expect(one(lineages, K(dep('A.ts', 'T.ts')))).toMatchObject({ ended: 1, cause: 'RE-POINTED' });
    expect(one(lineages, K(dep('A.ts', 'T2.ts')))).toMatchObject({ born: 1, derivedFrom: [K(dep('A.ts', 'T.ts'))] });
  });

  it('S4 cycle split: the original ends FIXED-BY-DEV, the two new cycles derive from it (both presets)', () => {
    const big = cyc('a.ts', 'b.ts', 'c.ts', 'd.ts', 'a.ts');
    const ab = cyc('a.ts', 'b.ts', 'a.ts');
    const cd = cyc('c.ts', 'd.ts', 'c.ts');
    for (const o of [LEGACY_FIXES_MINED, G08_PROPOSED]) {
      const { lineages } = buildLineages([snap('t', [big]), snap('t1', [ab, cd])], [], o);
      expect(one(lineages, K(big))).toMatchObject({ ended: 1, cause: 'FIXED-BY-DEV' });
      expect(one(lineages, K(ab))).toMatchObject({ born: 1, derivedFrom: [K(big)] });
      expect(one(lineages, K(cd))).toMatchObject({ born: 1, derivedFrom: [K(big)] });
    }
  });
});

describe('merges (G08 §2.4)', () => {
  const m1 = [snap('t', [dep('A.ts', 'T.ts'), dep('B.ts', 'T.ts')]), snap('t1', [dep('A.ts', 'T.ts')])];
  const m1t = [undefined, tr({ 'B.ts': 'A.ts' })];
  it('M1 source files merged, legacy: A → T continues, B → T ends RENAMED', () => {
    const { lineages } = buildLineages(m1, m1t, LEGACY_FIXES_MINED);
    expect(one(lineages, K(dep('A.ts', 'T.ts')))).toMatchObject({ ended: null });
    expect(one(lineages, K(dep('B.ts', 'T.ts')))).toMatchObject({ ended: 1, cause: 'RENAMED' });
  });
  it('M1 under G08: a tie in birth goes to the smallest key; the other ends MERGED', () => {
    const { lineages } = buildLineages(m1, m1t, G08_PROPOSED);
    expect(one(lineages, K(dep('A.ts', 'T.ts')))).toMatchObject({ ended: null });
    expect(one(lineages, K(dep('B.ts', 'T.ts')))).toMatchObject({ ended: 1, cause: 'MERGED' });
  });
  it('M1 under G08: the earliest birth wins even when its key is larger', () => {
    const snaps = [snap('t0', [dep('B.ts', 'T.ts')]), snap('t1', [dep('A.ts', 'T.ts'), dep('B.ts', 'T.ts')]), snap('t2', [dep('A.ts', 'T.ts')])];
    const { lineages } = buildLineages(snaps, [undefined, undefined, tr({ 'B.ts': 'A.ts' })], G08_PROPOSED);
    expect(one(lineages, K(dep('B.ts', 'T.ts')))).toMatchObject({ born: 0, ended: null, finalKey: K(dep('A.ts', 'T.ts')), renamedAt: [2] });
    expect(one(lineages, K(dep('A.ts', 'T.ts')))).toMatchObject({ born: 1, ended: 2, cause: 'MERGED' });
  });
  it('M2 merge without rename detection: A → T continues, B → T ends FILE-DELETED (both presets)', () => {
    for (const o of [LEGACY_FIXES_MINED, G08_PROPOSED]) {
      const { lineages } = buildLineages(m1, [], o);
      expect(one(lineages, K(dep('A.ts', 'T.ts')))).toMatchObject({ ended: null });
      expect(one(lineages, K(dep('B.ts', 'T.ts')))).toMatchObject({ ended: 1, cause: 'FILE-DELETED' });
    }
  });
  it('M3 cycles merged: both end (an edge went, so FIXED-BY-DEV), the new cycle derives from both', () => {
    const ab = cyc('a.ts', 'b.ts', 'a.ts');
    const bc = cyc('b.ts', 'c.ts', 'b.ts');
    const abc = cyc('a.ts', 'b.ts', 'c.ts', 'a.ts');
    for (const o of [LEGACY_FIXES_MINED, G08_PROPOSED]) {
      const { lineages } = buildLineages([snap('t', [ab, bc]), snap('t1', [abc])], [], o);
      expect(one(lineages, K(ab))).toMatchObject({ ended: 1, cause: 'FIXED-BY-DEV' });
      expect(one(lineages, K(bc))).toMatchObject({ ended: 1, cause: 'FIXED-BY-DEV' });
      expect([...(one(lineages, K(abc)).derivedFrom ?? [])].sort()).toEqual([K(ab), K(bc)].sort());
    }
  });
  it('M4 two rules on one edge: two fine keys, one edge key that ends only when both have ended', () => {
    const s01 = dep('P.ts', 'B.ts', 'FF-S01');
    const s03 = dep('P.ts', 'B.ts', 'FF-S03');
    const snaps = [snap('t', [s01, s03]), snap('t1', [s03]), snap('t2', [], { extraFiles: ['P.ts', 'B.ts'] })];
    for (const o of [LEGACY_FIXES_MINED, G08_PROPOSED]) {
      const fine = buildLineages(snaps, [], o).lineages;
      expect(one(fine, K(s01))).toMatchObject({ ended: 1, cause: 'OTHER' });
      expect(one(fine, K(s03))).toMatchObject({ ended: 2, cause: 'FIXED-BY-DEV' });
      const edge = buildLineages(snaps, [], { ...o, grain: 'edge' }).lineages;
      expect(edge).toHaveLength(1);
      expect(one(edge, 'P.ts|B.ts')).toMatchObject({ ruleIds: ['FF-S01', 'FF-S03'], born: 0, ended: 2, cause: 'FIXED-BY-DEV' });
    }
  });
});

describe('worked examples (G08 §2.5)', () => {
  it('1. a fix: no rename row, both files in place, the edge gone: FIXED-BY-DEV', () => {
    const f = dep('src/modules/user/queries/find-users/find-users.query-handler.ts', 'src/modules/user/database/user.repository.port.ts');
    for (const o of [LEGACY_FIXES_MINED, G08_PROPOSED]) {
      const { lineages } = buildLineages([snap('t', [f]), snap('t1', [], { extraFiles: [f.filePath, f.target ?? ''] })], [], o);
      expect(one(lineages, K(f))).toMatchObject({ ended: 1, cause: 'FIXED-BY-DEV', filesStay: true });
    }
  });
  const before = dep('src/persistence/user.repo.ts', 'src/business/user.ts');
  const after = dep('src/persistence/user.repo.ts', 'src/business/user.entity.ts');
  const ex2 = [snap('t', [before]), snap('t1', [after])];
  const ex2t = [undefined, tr({ 'src/business/user.ts': 'src/business/user.entity.ts' })];
  it('2. a renamed target, legacy: ends RENAMED and a new lineage opens', () => {
    const { lineages } = buildLineages(ex2, ex2t, LEGACY_FIXES_MINED);
    expect(one(lineages, K(before))).toMatchObject({ ended: 1, cause: 'RENAMED' });
    expect(one(lineages, K(after))).toMatchObject({ born: 1 });
  });
  it('2. a renamed target under G08: the violation survives and is not introduced', () => {
    const { lineages } = buildLineages(ex2, ex2t, G08_PROPOSED);
    expect(lineages).toHaveLength(1);
    expect(one(lineages, K(before))).toMatchObject({ ended: null, finalKey: K(after) });
  });
  it('3. a cycle reported from another start node is the same violation (both presets)', () => {
    for (const o of [LEGACY_FIXES_MINED, G08_PROPOSED]) {
      const { lineages } = buildLineages([snap('t', [cyc('b', 'c', 'a', 'b')]), snap('t1', [cyc('a', 'b', 'c', 'a')])], [], o);
      expect(lineages).toHaveLength(1);
      expect(lineages[0]).toMatchObject({ born: 0, ended: null });
    }
  });
});

describe('sequence rules', () => {
  it('a failed middle snapshot is neither a birth nor a death (ID-13), and ρ is supplied for the two good ones', () => {
    const a = dep('A.ts', 'T.ts');
    const snaps = [snap('0', [a]), snap('1', [], { ok: false }), snap('2', [dep('A1.ts', 'T.ts')])];
    const g = buildLineages(snaps, [undefined, undefined, tr({ 'A.ts': 'A1.ts' })], G08_PROPOSED);
    expect(g.lineages).toHaveLength(1);
    expect(g.lineages[0]).toMatchObject({ born: 0, ended: null, renamedAt: [2] });
    expect(g.validSnapshots).toBe(2);
    const l = buildLineages([snap('0', [a]), snap('1', [], { ok: false }), snap('2', [a])], [], LEGACY_FIXES_MINED);
    expect(l.lineages).toEqual([expect.objectContaining({ born: 0, ended: null })]);
  });
  it('a mass commit changes credit, never identity (ID-12)', () => {
    const a = dep('A.ts', 'T.ts');
    const b = dep('B.ts', 'T.ts');
    const snaps = [snap('0', [a, b]), snap('1', [dep('A1.ts', 'T.ts')], { extraFiles: ['B.ts'] })];
    const t = [undefined, tr({ 'A.ts': 'A1.ts' }, { massOrBot: true })];
    const g = buildLineages(snaps, t, G08_PROPOSED).lineages;
    expect(one(g, K(a))).toMatchObject({ ended: null, finalKey: K(dep('A1.ts', 'T.ts')) });
    expect(one(g, K(b))).toMatchObject({ ended: 1, cause: 'MASS-OR-BOT' });
    expect(one(buildLineages(snaps, t, LEGACY_FIXES_MINED).lineages, K(b))).toMatchObject({ cause: 'MASS-OR-BOT' });
  });
  it('a rename out of the root ends the lineage as RENAMED under either policy (ID-10)', () => {
    const a = dep('A.ts', 'T.ts');
    for (const o of [LEGACY_FIXES_MINED, G08_PROPOSED]) {
      const { lineages } = buildLineages([snap('0', [a]), snap('1', [], { extraFiles: ['T.ts'] })], [undefined, { outOfRoot: new Set(['A.ts']) }], o);
      expect(one(lineages, K(a))).toMatchObject({ ended: 1, cause: 'RENAMED', filesStay: false });
    }
  });
  it("git's skipped rename detection is counted (ID-9)", () => {
    const r = buildLineages([snap('0', []), snap('1', [])], [undefined, { renameDetection: 'skipped' }], G08_PROPOSED);
    expect(r.renameDetectionSkipped).toBe(1);
  });
  it('a context mismatch throws (ID-1)', () => {
    expect(() => buildLineages([snap('0', []), snap('1', [], { contextId: 'other' })], [], G08_PROPOSED)).toThrow(/ID-1/);
  });
  it('explode-edges: one cycle K feeds one E lineage per edge, and an edge shared with FF-S01 ends only when both go (ID-8)', () => {
    const o: IdentityOptions = { ...G08_PROPOSED, grain: 'edge', cycleIdentity: 'explode-edges', edgeOnly: true };
    const c = cyc('a.ts', 'b.ts', 'a.ts');
    const s = dep('a.ts', 'b.ts');
    const { lineages } = buildLineages([snap('0', [c, s]), snap('1', [s], { extraEdges: ['b.ts|a.ts'] }), snap('2', [], { extraFiles: ['a.ts', 'b.ts'] })], [], o);
    expect(one(lineages, 'a.ts|b.ts')).toMatchObject({ ruleIds: ['FF-S01', 'FF-S02'], ended: 2 });
    expect(one(lineages, 'b.ts|a.ts')).toMatchObject({ ended: 1 });
  });
});

describe('the legacy preset reproduces lineages() of scripts/v1.3/fixes-mined-run.ts', () => {
  // A hand-built 6-point grid; snapshots carry files (for filesStay) and no edges, as the committed walk did not keep
  // a cause per lineage. The expected values were derived by reading `lineages()` and written here first.
  const v1 = dep('a.ts', 'b.ts');
  const v2 = cyc('x.ts', 'y.ts', 'x.ts');
  const v2r = cyc('y.ts', 'x.ts', 'y.ts');
  const v3 = dep('c.ts', 'd.ts', 'FF-S03');
  const files = (fs: string[]) => ({ ...snapBare, files: fs });
  const snapBare = { contextId: 'ctx-test', ok: true };
  const grid = [
    { id: '0', ...files(['a.ts', 'b.ts', 'x.ts', 'y.ts']), findings: [v1, v2] },
    { id: '1', ...files(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'x.ts', 'y.ts']), findings: [v1, v3] },
    { id: '2', contextId: 'ctx-test', ok: false, findings: [] },
    { id: '3', ...files(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'x.ts', 'y.ts']), findings: [v3, v2r] },
    { id: '4', ...files(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'x.ts']), findings: [v1, v3] },
    { id: '5', ...files(['a.ts', 'b.ts', 'c.ts']), findings: [] },
  ];
  it('gives the same born, ended and filesStay', () => {
    const got = buildLineages(grid, [], LEGACY_FIXES_MINED).lineages.map((l) => [l.key, l.born, l.ended, l.filesStay, l.cause]);
    expect(got).toEqual([
      [K(v1), 0, 3, true, undefined],
      [K(v2), 0, 1, true, undefined],
      [K(v3), 1, 5, false, undefined],
      [K(v2), 3, 4, false, undefined],
      [K(v1), 4, 5, true, undefined],
    ]);
  });
});
