/**
 * T-MX (U4 design §5): the drift measures DR-1 to DR-7 on small synthetic grids, both `leftCensor` modes on a grid
 * whose point 0 failed, the S2 moves-censored option, the FF-S02 cap rule, and seeded-random property checks (no
 * fast-check; `seededRandom` of `scripts/v1.3/lib/fixes-mined.ts`). Pure.
 */
import { seededRandom } from '../../../../scripts/v1.3/lib/fixes-mined.js';
import { edgeKeys, fineKey } from '../../../../scripts/lib/drift/identity.js';
import { buildLineages } from '../../../../scripts/lib/drift/lineage.js';
import {
  isBlocking, kmRow, pairCounts, poolSamples, survival, SURVIVAL_GROUPS_5A, windowCounts, type MinedPairRecord,
} from '../../../../scripts/lib/drift/metrics.js';
import { LEGACY_FIXES_MINED, type IdFinding, type IdentityOptions, type Lineage, type Snapshot } from '../../../../scripts/lib/drift/types.js';
import { CTX, at, cyc, dep, fileLevel, snap } from './fixtures.js';

const day = (n: number): string => new Date(Date.UTC(2024, 0, 1) + n * 86_400_000).toISOString();
const grid = (n: number): { sha: string; date: string }[] => Array.from({ length: n }, (_, i) => ({ sha: `c${String(i)}`, date: day(100 * i) }));
const lin = (o: Partial<Lineage> & { born: number; ended: number | null }): Lineage => ({
  key: `k${String(o.born)}-${String(o.ended)}`, ruleIds: ['FF-S01'], edgeShaped: true, tier: 'blocking', kind: 'finding', functionId: 'FF-S01', ...o,
});

describe('survival (DR-2, DR-4, ID-19)', () => {
  const g = grid(6);
  const all = (): boolean => true;
  it('grid-index-0 drops only born === 0; times are committer days floored at 0', () => {
    const ls = [lin({ born: 0, ended: 2 }), lin({ born: 1, ended: 3, filesStay: true }), lin({ born: 2, ended: null })];
    const s = survival(ls, g, all, []);
    expect(s.obs).toEqual([{ t: 200, event: true }, { t: 300, event: false }]);
    expect(s.ended).toBe(1);
    expect(s.inPlace).toBe(1);
  });
  it('on a grid whose point 0 failed, first-valid also drops the lineages present at the first valid point', () => {
    const ls = [lin({ born: 2, ended: 4 }), lin({ born: 3, ended: null })];
    expect(survival(ls, g, all, [], { leftCensor: 'grid-index-0' }).obs).toHaveLength(2);
    const s1 = survival(ls, g, all, [], { leftCensor: 'first-valid', firstValid: 2 });
    expect(s1.obs).toEqual([{ t: 200, event: false }]);
  });
  it('S2 censors endings with filesStay false at their end date', () => {
    const ls = [lin({ born: 1, ended: 3, filesStay: false }), lin({ born: 1, ended: 2, filesStay: true })];
    const s = survival(ls, g, all, [], { leftCensor: 'grid-index-0', movesCensored: true });
    expect(s.obs).toEqual([{ t: 200, event: false }, { t: 100, event: true }]);
    expect(s.ended).toBe(1);
  });
  it('drops an FF-S02 lineage whose birth or end touches a capped point or the point before it', () => {
    const s02 = (born: number, ended: number | null): Lineage => lin({ born, ended, functionId: 'FF-S02', ruleIds: ['FF-S02'] });
    const capped = [false, false, true, false, false, false];
    const ls = [s02(1, 2), s02(3, 5), s02(1, 4), s02(4, null), lin({ born: 3, ended: null })];
    // born 3 touches the capped point 2 (the one before); 1→4 and 4→null touch nothing.
    const s = survival(ls, g, all, capped);
    expect(s.obs.length).toBe(3);
  });
  it('kmRow formats as the report prints', () => {
    const r = kmRow(poolSamples([survival([lin({ born: 1, ended: 2, filesStay: true }), lin({ born: 1, ended: null })], g, all, [])]));
    // S drops to 0.5 at t = 100, which is the median under kaplanMeier's `s <= 0.5` rule.
    expect(r).toMatchObject({ n: 2, ended: 1, median: 100, s365: 0.5, inPlacePct: 100 });
    const never = kmRow(survival([lin({ born: 1, ended: 2 }), lin({ born: 1, ended: null }), lin({ born: 2, ended: null })], g, all, []));
    expect(never.median).toBe('> obs.');
  });
  it('the eight §5a groups are the report’s, in its order', () => {
    expect(SURVIVAL_GROUPS_5A.map((x) => x.name)).toEqual([
      'blocking, edge-shaped findings', 'blocking, edge-shaped, without FF-S02 cycles', 'blocking FF-S02 cycles only',
      'advisory, edge-shaped findings', 'advisory, file-level findings', 'unflagged cross-layer import edges',
      'unflagged same-layer import edges', 'unflagged import edges, unlayered file',
    ]);
  });
});

describe('windowCounts (DR-1, DR-2, DR-7)', () => {
  const ok = [true, true, false, true, true];
  const ls: Lineage[] = [
    lin({ born: 0, ended: 3, filesStay: true }),
    lin({ born: 1, ended: null }),
    lin({ born: 3, ended: 4, filesStay: false }),
    lin({ born: 1, ended: 4, functionId: 'FF-S02', ruleIds: ['FF-S02'] }),
    lin({ born: 1, ended: null, tier: 'advisory' }),
    { key: 'a|b', ruleIds: [], edgeShaped: true, born: 1, ended: 3, kind: 'edge', edgeKind: 'crossLayer' },
  ];
  it('births exclude the left-censored, endings count every ended blocking lineage', () => {
    const w = windowCounts(ls, ok, []);
    expect(w).toMatchObject({ births: 3, endings: 3, endingsInPlace: 1, birthsNoS02: 2, endingsNoS02: 2, edgeBirths: 1, edgeEndings: 1, xlBirths: 1, xlEndings: 1 });
  });
  it('persisting at t counts lineages alive at the previous valid point and at t (DR-1)', () => {
    const w = windowCounts(ls, ok, []);
    expect(w.perPoint).toEqual([
      { i: 0, alive: 1, persisting: 0, introduced: 0, removed: 0 },
      { i: 1, alive: 3, persisting: 1, introduced: 2, removed: 0 },
      { i: 3, alive: 3, persisting: 2, introduced: 1, removed: 1 },
      { i: 4, alive: 1, persisting: 1, introduced: 0, removed: 2 },
    ]);
  });
  it('first-valid censors the lineages born at the first valid point', () => {
    expect(windowCounts(ls, ok, [], { leftCensor: 'first-valid', firstValid: 1 }).births).toBe(1);
  });
  it('an FF-S02 lineage touching the cap is dropped', () => {
    expect(windowCounts(ls, ok, [false, false, false, true, false]).birthsNoS02).toBe(2);
    expect(windowCounts(ls, ok, [false, false, false, true, false]).births).toBe(2);
  });
});

describe('pairCounts (DR-3, DR-6)', () => {
  const f = (functionId: string, cause?: string, edgeShaped = true, tier: 'blocking' | 'advisory' = 'blocking') => ({ key: `${functionId}-${cause ?? ''}`, functionId, tier, edgeShaped, filePath: 'a.ts', message: '', ...(cause !== undefined && { cause }) });
  const pair = (o: Partial<MinedPairRecord>): MinedPairRecord => ({ sha: 's', parent: 'p', date: day(0), bot: false, mass: false, parentOk: true, childOk: true, exposedByRule: {}, childByRule: {}, disappeared: [], introduced: [], ...o });
  const blockingRule = (r: string): boolean => r !== 'FF-C02';
  it('splits introductions three ways and tallies removals by cause, credited as the C5 note does', () => {
    const pc = pairCounts([
      pair({ exposedByRule: { 'FF-S01': 2 }, childByRule: { 'FF-S01': 2 }, disappeared: [f('FF-S01', 'RENAMED'), f('FF-S01', 'FIXED-BY-DEV')], introduced: [f('FF-S01'), f('FF-S01')] }),
      pair({ bot: true, exposedByRule: {}, childByRule: { 'FF-S01': 1 }, introduced: [f('FF-S01')] }),
      pair({ exposedByRule: { 'FF-P01': 1 }, childByRule: {}, disappeared: [f('FF-P01', 'RESOLVED-IN-PLACE', false)] }),
      pair({ parentOk: false, introduced: [f('FF-S01')] }),
    ], { blockingRule });
    expect(pc).toMatchObject({ validPairs: 3, introduced: 3, introBotMass: 1, introRenameMatched: 1, introOther: 1, removed: 3, credited: 2, netCheckFail: 0 });
    expect(pc.removedBy).toMatchObject({ RENAMED: 1, 'FIXED-BY-DEV': 1, 'RESOLVED-IN-PLACE': 1 });
  });
  it('drops FF-S02 rows when either side is capped, and flags a net mismatch', () => {
    const pc = pairCounts([
      pair({ exposedByRule: { 'FF-S02': 100 }, childByRule: { 'FF-S02': 100 }, disappeared: [f('FF-S02', 'OTHER')], introduced: [f('FF-S02')] }),
      pair({ exposedByRule: { 'FF-S01': 1 }, childByRule: { 'FF-S01': 1 }, introduced: [f('FF-S01')] }),
    ], { blockingRule });
    expect(pc.removed).toBe(0);
    expect(pc.introduced).toBe(1);
    expect(pc.netCheckFail).toBe(1);
  });
  it('isBlocking reads the live table (new data only)', () => {
    expect(isBlocking('FF-S01')).toBe(true);
    expect(isBlocking('FF-C02')).toBe(false);
    expect(isBlocking('FF-UNKNOWN')).toBe(false);
  });
});

// ── Seeded-random property checks ───────────────────────────────────────────

const FILES = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
function randomSnapshots(rnd: () => number, n: number): Snapshot[] {
  const pick = (): string => at(FILES, Math.floor(rnd() * FILES.length));
  const out: Snapshot[] = [];
  for (let i = 0; i < n; i++) {
    const fs: IdFinding[] = [];
    const m = Math.floor(rnd() * 6);
    for (let j = 0; j < m; j++) {
      const r = rnd();
      const s = pick();
      let t = pick();
      if (t === s) t = at(FILES, (FILES.indexOf(s) + 1) % FILES.length);
      if (r < 0.5) fs.push(dep(s, t, rnd() < 0.5 ? 'FF-S01' : 'FF-S03'));
      else if (r < 0.8) {
        const u = FILES.find((x) => x !== s && x !== t) ?? 'e.ts';
        fs.push(rnd() < 0.5 ? cyc(s, t, s) : cyc(s, t, u, s));
      } else fs.push(fileLevel(s));
    }
    out.push({ ...snap(String(i), fs), ok: i === 0 || rnd() > 0.15 });
  }
  return out;
}

describe('properties (seeded)', () => {
  const rnd = seededRandom(20261018);
  const runs = Array.from({ length: 60 }, () => randomSnapshots(rnd, 8));

  it('rotating a cycle never changes K', () => {
    const r = seededRandom(7);
    for (let i = 0; i < 200; i++) {
      const nodes = [...FILES].sort(() => r() - 0.5).slice(0, 2 + Math.floor(r() * 3));
      const k = 1 + Math.floor(r() * (nodes.length - 1));
      const rot = [...nodes.slice(k), ...nodes.slice(0, k)];
      expect(fineKey(cyc(...rot, at(rot, 0)))).toBe(fineKey(cyc(...nodes, at(nodes, 0))));
    }
  });

  it('per consecutive valid pair, introduced − removed = count at the child − count at the parent', () => {
    for (const ss of runs) {
      const { lineages } = buildLineages(ss, [], LEGACY_FIXES_MINED);
      const valid = ss.map((s, i) => [s, i] as const).filter(([s]) => s.ok);
      for (let v = 1; v < valid.length; v++) {
        const [p] = at(valid, v - 1);
        const [c, ci] = at(valid, v);
        const count = (s: Snapshot): number => new Set(s.findings.map(fineKey)).size;
        const intro = lineages.filter((l) => l.born === ci).length;
        const rem = lineages.filter((l) => l.ended === ci).length;
        expect(intro - rem).toBe(count(c) - count(p));
      }
    }
  });

  it("with an empty ρ, 'continue' equals 'end'", () => {
    for (const ss of runs) {
      const strip = (ls: readonly Lineage[]) => ls.map((l) => [l.key, l.born, l.ended, l.cause, l.filesStay]);
      const end = buildLineages(ss, [], { ...LEGACY_FIXES_MINED, renamePolicy: 'end' });
      const cont = buildLineages(ss, [], { ...LEGACY_FIXES_MINED, renamePolicy: 'continue' });
      expect(strip(cont.lineages)).toEqual(strip(end.lineages));
    }
  });

  it('E lineages ≤ K lineages under edge-set and sorted-files; ≤ Σ edges(K) under explode-edges (ID-8)', () => {
    for (const ss of runs) {
      const k = buildLineages(ss, [], LEGACY_FIXES_MINED).lineages;
      for (const mode of ['edge-set', 'sorted-files'] as const) {
        const o: IdentityOptions = { ...LEGACY_FIXES_MINED, grain: 'edge', cycleIdentity: mode, edgeOnly: false };
        expect(buildLineages(ss, [], o).lineages.length).toBeLessThanOrEqual(k.length);
      }
      const ox: IdentityOptions = { ...LEGACY_FIXES_MINED, grain: 'edge', cycleIdentity: 'explode-edges', edgeOnly: false };
      // Σ over K lineages of the number of E keys its finding maps to.
      const kAll = buildLineages(ss, [], LEGACY_FIXES_MINED, (f) => [fineKey(f)]);
      const findingOf = new Map<string, IdFinding>();
      for (const s of ss) for (const f of s.findings) findingOf.set(fineKey(f), f);
      const bound = kAll.lineages.reduce((a, l) => a + edgeKeys(findingOf.get(l.key) ?? { functionId: '', filePath: '' }, ox).length, 0);
      expect(buildLineages(ss, [], ox).lineages.length).toBeLessThanOrEqual(bound);
    }
  });

  it('the generator is a fixed point of the seed (the checks above are reproducible)', () => {
    const again = Array.from({ length: 60 }, ((r) => () => randomSnapshots(r, 8))(seededRandom(20261018)));
    expect(again.map((s) => s.map((x) => x.findings.length))).toEqual(runs.map((s) => s.map((x) => x.findings.length)));
    expect(CTX).toBe('ctx-test');
  });
});
