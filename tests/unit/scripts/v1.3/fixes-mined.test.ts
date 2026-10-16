import {
  canonicalCycle, classifyDisappearance, clusterBootstrap, cohenH, evenlySpaced, isBotAuthor, isMassChange, kaplanMeier,
  median, mentionsArchitecture, rateRatio, sampleWithout, seededRandom, signTest, violationEdges, violationFiles,
  violationKey, wilson,
} from '../../../../scripts/v1.3/lib/fixes-mined';
import { CYCLIC_COUNT, FastCycleRepository, NO_CYCLIC_DEPS } from '../../../../scripts/v1.3/lib/fast-cycles';

describe('evenlySpaced', () => {
  it('keeps everything when there are fewer items than n', () => {
    expect(evenlySpaced([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });
  it('spreads n items with both ends included', () => {
    const xs = Array.from({ length: 1000 }, (_, i) => i);
    const s = evenlySpaced(xs, 200);
    expect(s).toHaveLength(200);
    expect(s[0]).toBe(0);
    expect(s.at(-1)).toBe(999);
    expect([...s].sort((a, b) => a - b)).toEqual(s);
  });
  it('handles n = 1 and empty input', () => {
    expect(evenlySpaced([1, 2, 3], 1)).toEqual([3]);
    expect(evenlySpaced([], 4)).toEqual([]);
  });
});

describe('finding identity', () => {
  const dep = { functionId: 'FF-S01', filePath: 'src/a.ts', target: 'src/b.ts', discriminator: ['IMPORTS'] };
  it('an import finding rests on one edge and ignores the line', () => {
    expect(violationEdges(dep)).toEqual(['src/a.ts|src/b.ts']);
    expect(violationKey({ ...dep })).toBe(violationKey({ ...dep, discriminator: ['IMPORTS'] }));
    expect(violationFiles(dep)).toEqual(['src/a.ts', 'src/b.ts']);
  });
  it('a cycle rests on its consecutive pairs and keeps its identity under rotation', () => {
    const c1 = { functionId: 'FF-S02', filePath: 'a,b,c,a', target: 'b', discriminator: ['["a.ts","b.ts","c.ts","a.ts"]'] };
    const c2 = { functionId: 'FF-S02', filePath: 'b,c,a,b', target: 'c', discriminator: ['["b.ts","c.ts","a.ts","b.ts"]'] };
    expect(violationEdges(c1)).toEqual(['a.ts|b.ts', 'b.ts|c.ts', 'c.ts|a.ts']);
    expect(violationKey(c1)).toBe(violationKey(c2));
    expect(canonicalCycle(['c', 'a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });
  it('a package target or a metric finding is file-level', () => {
    expect(violationEdges({ functionId: 'FF-P01', filePath: 'src/d.ts', target: '@nestjs/common' })).toEqual([]);
    expect(violationEdges({ functionId: 'FF-C02', filePath: 'src/d.ts' })).toEqual([]);
  });
});

describe('classifyDisappearance', () => {
  const base = {
    files: ['a.ts', 'b.ts'], edges: ['a.ts|b.ts'], childFiles: new Set(['a.ts', 'b.ts']), childEdges: new Set<string>(),
    renamedFrom: new Set<string>(), massOrBot: false,
  };
  it('credits a removed edge with both files in place', () => {
    expect(classifyDisappearance(base)).toBe('FIXED-BY-DEV');
  });
  it('rename, deletion and mass changes take precedence, in that order', () => {
    expect(classifyDisappearance({ ...base, renamedFrom: new Set(['b.ts']), childFiles: new Set(['a.ts']) })).toBe('RENAMED');
    expect(classifyDisappearance({ ...base, childFiles: new Set(['a.ts']) })).toBe('FILE-DELETED');
    expect(classifyDisappearance({ ...base, massOrBot: true })).toBe('MASS-OR-BOT');
  });
  it('an edge still present is OTHER; a file-level finding is RESOLVED-IN-PLACE', () => {
    expect(classifyDisappearance({ ...base, childEdges: new Set(['a.ts|b.ts']) })).toBe('OTHER');
    expect(classifyDisappearance({ ...base, files: ['a.ts'], edges: [] })).toBe('RESOLVED-IN-PLACE');
  });
});

describe('threat filters and the message signal', () => {
  it('recognises bots', () => {
    expect(isBotAuthor('dependabot[bot]', '49699333+dependabot[bot]@users.noreply.github.com')).toBe(true);
    expect(isBotAuthor('Renovate Bot', 'bot@renovateapp.com')).toBe(true);
    expect(isBotAuthor('Jane Doe', 'jane@example.com')).toBe(false);
  });
  it('flags mass changes by count and by share', () => {
    expect(isMassChange({ changed: 100, renamedOrDeleted: 0, rootFiles: 2000 })).toBe(true);
    expect(isMassChange({ changed: 30, renamedOrDeleted: 0, rootFiles: 100 })).toBe(true);
    expect(isMassChange({ changed: 12, renamedOrDeleted: 11, rootFiles: 100 })).toBe(true);
    expect(isMassChange({ changed: 12, renamedOrDeleted: 2, rootFiles: 100 })).toBe(false);
  });
  it('matches architecture words but not import/report/support', () => {
    expect(mentionsArchitecture('refactor: move repo behind a port')).toBe(true);
    expect(mentionsArchitecture('Decouple notes from users')).toBe(true);
    expect(mentionsArchitecture('fix import of report support module')).toBe(false);
    expect(mentionsArchitecture('add ports for storage')).toBe(true);
  });
});

describe('statistics', () => {
  it('wilson matches the textbook interval', () => {
    const w = wilson(10, 100);
    expect(w.p).toBeCloseTo(0.1, 10);
    expect(w.lo).toBeCloseTo(0.0552, 3);
    expect(w.hi).toBeCloseTo(0.1744, 3);
    expect(Number.isNaN(wilson(0, 0).p)).toBe(true);
  });
  it('rateRatio and cohenH', () => {
    const rr = rateRatio(20, 100, 10, 100);
    expect(rr.p).toBeCloseTo(2, 10);
    expect(rr.lo).toBeLessThan(2);
    expect(rr.hi).toBeGreaterThan(2);
    expect(rateRatio(0, 100, 5, 100).p).toBeGreaterThan(0);
    expect(cohenH(0.5, 0.5)).toBe(0);
    expect(cohenH(0.2, 0.1)).toBeGreaterThan(0);
  });
  it('kaplanMeier: median and censoring', () => {
    const km = kaplanMeier([{ t: 10, event: true }, { t: 20, event: true }, { t: 30, event: false }, { t: 40, event: true }]);
    // S: 0.75 after 10, 0.5 after 20 -> median 20
    expect(km.median).toBe(20);
    expect(km.events).toBe(3);
    expect(kaplanMeier([{ t: 5, event: false }, { t: 6, event: false }]).median).toBeNull();
    expect(kaplanMeier([{ t: 400, event: true }, { t: 500, event: false }]).s365).toBe(1);
  });
  it('median, signTest, sampleWithout, clusterBootstrap', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(signTest(10, 10)).toBeCloseTo(2 / 1024, 10);
    expect(signTest(5, 10)).toBe(1);
    const rnd = seededRandom(7);
    const s = sampleWithout([1, 2, 3, 4, 5], 3, rnd);
    expect(new Set(s).size).toBe(3);
    const ci = clusterBootstrap([1, 2, 3, 4], (cs) => cs.reduce((a, b) => a + b, 0) / cs.length, 500, seededRandom(1));
    expect(ci.lo).toBeGreaterThanOrEqual(1);
    expect(ci.hi).toBeLessThanOrEqual(4);
  });
});

describe('FastCycleRepository parity with the interpreter', () => {
  function randomGraph(seed: number, n: number, m: number, withPackages: boolean): FastCycleRepository {
    const repo = new FastCycleRepository(true);
    const rnd = seededRandom(seed);
    const files = Array.from({ length: n }, (_, i) => repo.graph.createNode(['APGNode', 'File'], new Map([['id', `f${String(i)}`], ['filePath', `src/m${String(Math.floor(rnd() * 1000)).padStart(3, '0')}-${String(i)}.ts`]])));
    const pkgs = withPackages ? [repo.graph.createNode(['APGNode', 'Package'], new Map([['id', 'p0'], ['name', 'lodash']]))] : [];
    for (let k = 0; k < m; k++) {
      const s = files[Math.floor(rnd() * n)];
      const toPkg = pkgs.length > 0 && rnd() < 0.1;
      const t = toPkg ? pkgs[0] : files[Math.floor(rnd() * n)];
      if (s === undefined || t === undefined) continue;
      const type = rnd() < 0.8 ? 'IMPORTS' : 'RE_EXPORTS';
      const props = new Map<string, null | boolean | bigint>([['line', BigInt(1 + Math.floor(rnd() * 40))]]);
      if (rnd() < 0.1) props.set('viaReExport', true);
      repo.graph.createRelationship(type, s, t, props);
    }
    return repo;
  }

  it.each([[1, 6, 12, false], [2, 8, 20, true], [3, 10, 25, true], [4, 7, 30, false], [5, 12, 22, true], [6, 5, 14, false]])(
    'seed %i: %i files, %i edges', async (seed, n, m, pk) => {
      const repo = randomGraph(seed, n, m, pk);
      const a = await repo.executeQuery(NO_CYCLIC_DEPS);
      const b = await repo.executeQuery(CYCLIC_COUNT);
      expect(a.success && b.success).toBe(true);
      expect(repo.stats.fastCycles).toBe(1);
      expect(repo.stats.fastCount).toBe(1);
      expect(repo.stats.parityMismatches).toEqual([]);
    },
  );

  it('stops at the 101-row sentinel, rows in ORDER BY cycle order', async () => {
    // A complete digraph on 7 files has far more than 101 simple cycles of length <= 10 (the interpreter is not run:
    // it enumerates every trail of up to ten hops, which is the cost this repository avoids).
    const repo = new FastCycleRepository(false);
    const files = Array.from({ length: 7 }, (_, i) => repo.graph.createNode(['APGNode', 'File'], new Map([['id', `f${String(i)}`], ['filePath', `src/f${String(i)}.ts`]])));
    for (const s of files) for (const t of files) if (s !== t) repo.graph.createRelationship('IMPORTS', s, t, new Map([['line', 1n]]));
    const r = await repo.executeQuery(NO_CYCLIC_DEPS);
    expect(r.success).toBe(true);
    const cycles = r.success ? r.data.records.map((x) => (x.cycle as string[]).join('>')) : [];
    expect(cycles).toHaveLength(101);
    expect(cycles[0]).toBe('src/f0.ts>src/f1.ts>src/f0.ts');
    expect(cycles[1]).toBe('src/f0.ts>src/f1.ts>src/f2.ts>src/f0.ts');
  });

  it('falls back to the interpreter when two Files share a filePath', async () => {
    const repo = new FastCycleRepository(false);
    repo.graph.createNode(['APGNode', 'File'], new Map([['id', 'a'], ['filePath', 'x.ts']]));
    repo.graph.createNode(['APGNode', 'File'], new Map([['id', 'b'], ['filePath', 'x.ts']]));
    await repo.executeQuery(CYCLIC_COUNT);
    expect(repo.stats.fallbacks).toBe(1);
  });
});
