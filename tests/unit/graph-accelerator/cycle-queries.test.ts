/**
 * In-memory answers to the bounded cycle queries (Docs/v1.3/scale.md §3): the recognised texts, the semantics against
 * a brute-force reading of the Cypher text, and every guard that hands a query back to Neo4j.
 */
import neo4j from 'neo4j-driver';
import { CYPHER_TEMPLATES, CYCLE_ROW_CAP, MAX_CYCLE_LENGTH } from '../../../src/fitness-compiler/cypher-templates.js';
import { replaceExcludeMarkers } from '../../../src/fitness-compiler/exclude-injector.js';
import { applyV13Rewrites } from '../../../src/fitness-compiler/v13-rewrites.js';
import { UNIVERSAL_METRIC_QUERIES, UNIVERSAL_METRIC_QUERIES_LITERAL } from '../../../src/scoring-engine/universal-metrics.js';
import { acceleratedTexts, answer, componentIds, cycleMetricRows, noCyclicDepsRows, recogniseQuery } from '../../../src/graph-accelerator/cycle-queries.js';
import { globToRegex } from '../../../src/fitness-compiler/glob-to-regex.js';
import type { TestEdge, TestNode } from './helpers.js';
import { bruteForceCycleCount, bruteForceCycles, mirrored, randomGraph } from './helpers.js';

const TEMPLATE = CYPHER_TEMPLATES.get('no-cyclic-deps')!.template;
const ring = (ids: readonly string[]): TestEdge[] => ids.map((id, i) => ({ from: id, to: ids[(i + 1) % ids.length]!, line: i + 1 }));
const files = (ids: readonly string[]): TestNode[] => ids.map((id) => ({ id }));
const asPlain = (rows: readonly Record<string, unknown>[] | undefined): unknown =>
  rows?.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, neo4j.isInt(v) ? (v as { toNumber(): number }).toNumber() : v])));

describe('recognised texts', () => {
  it('recognises the four compiled FF-S02 forms and the two metric texts, nothing else', () => {
    expect(acceleratedTexts().size).toBe(6);
    for (const excludes of [false, true]) {
      const base = replaceExcludeMarkers(TEMPLATE, excludes);
      expect(recogniseQuery(applyV13Rewrites('no-cyclic-deps', base, { edgeViews: false, roleTokens: false }))).toEqual({ name: 'no-cyclic-deps', filter: 'all', excludes });
      expect(recogniseQuery(applyV13Rewrites('no-cyclic-deps', base, { edgeViews: true, roleTokens: true }))).toEqual({ name: 'no-cyclic-deps', filter: 'literal', excludes });
    }
    expect(recogniseQuery(UNIVERSAL_METRIC_QUERIES.cyclicDependencyCount)?.filter).toBe('all');
    expect(recogniseQuery(UNIVERSAL_METRIC_QUERIES_LITERAL.cyclicDependencyCount)?.filter).toBe('literal');
    expect(recogniseQuery(`${UNIVERSAL_METRIC_QUERIES.cyclicDependencyCount} `)).toBeUndefined();
    expect(recogniseQuery(UNIVERSAL_METRIC_QUERIES.maxFanOut)).toBeUndefined();
  });
});

describe('no-cyclic-deps rows', () => {
  it('returns one row per simple cycle, from its smallest file, closing edges first, with the first edge line', async () => {
    // b -> c -> a -> b (a -> b on lines 3 and 7) and a <-> c.
    const repo = await mirrored(files(['b', 'a', 'c']), [...ring(['b', 'c', 'a']), { from: 'a', to: 'b', line: 7 }, { from: 'a', to: 'c', line: 5 }]);
    expect(noCyclicDepsRows(repo.mirror, 'all', {}, false)).toEqual([
      { cycle: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/a.ts'], target: 'src/b.ts', line: 3 },
      { cycle: ['src/a.ts', 'src/c.ts', 'src/a.ts'], target: 'src/c.ts', line: 5 },
    ]);
  });

  it('takes the smallest line of parallel first edges and null when none has a line', async () => {
    const repo = await mirrored(files(['a', 'b']), [
      { from: 'a', to: 'b', line: 9 }, { from: 'a', to: 'b', type: 'RE_EXPORTS', line: 3 }, { from: 'b', to: 'a' },
    ]);
    expect(noCyclicDepsRows(repo.mirror, 'all', {}, false)).toEqual([{ cycle: ['src/a.ts', 'src/b.ts', 'src/a.ts'], target: 'src/b.ts', line: 3 }]);
    const none = await mirrored(files(['a', 'b']), [{ from: 'a', to: 'b' }, { from: 'b', to: 'a', line: 2 }]);
    expect(noCyclicDepsRows(none.mirror, 'all', {}, false)).toEqual([{ cycle: ['src/a.ts', 'src/b.ts', 'src/a.ts'], target: 'src/b.ts', line: null }]);
  });

  it('drops viaReExport edges in the literal view only', async () => {
    const repo = await mirrored(files(['a', 'b']), [{ from: 'a', to: 'b', line: 1, viaReExport: true }, { from: 'b', to: 'a', line: 2 }]);
    expect(noCyclicDepsRows(repo.mirror, 'literal', {}, false)).toEqual([]);
    expect(noCyclicDepsRows(repo.mirror, 'all', {}, false)).toHaveLength(1);
  });

  it('removes every cycle through an excluded file', async () => {
    const repo = await mirrored(files(['a', 'b', 'c']), [...ring(['a', 'b']), ...ring(['a', 'c'])]);
    const rows = noCyclicDepsRows(repo.mirror, 'all', { excludePatterns: [globToRegex('**/c.ts')] }, true);
    expect(rows?.map((r) => r['cycle'])).toEqual([['src/a.ts', 'src/b.ts', 'src/a.ts']]);
  });

  it(`keeps cycles of 2..${String(MAX_CYCLE_LENGTH)} relationships only`, async () => {
    const ids = Array.from({ length: MAX_CYCLE_LENGTH + 1 }, (_, i) => `n${String(i).padStart(2, '0')}`);
    const tooLong = await mirrored(files(ids), ring(ids));
    expect(noCyclicDepsRows(tooLong.mirror, 'all', {}, false)).toEqual([]);
    const longest = await mirrored(files(ids.slice(1)), ring(ids.slice(1)));
    expect(noCyclicDepsRows(longest.mirror, 'all', {}, false)).toHaveLength(1);
    const selfLoop = await mirrored(files(['a']), [{ from: 'a', to: 'a' }, { from: 'a', to: 'a', type: 'RE_EXPORTS' }]);
    expect(noCyclicDepsRows(selfLoop.mirror, 'all', {}, false)).toEqual([]);
  });

  it(`stops at the sentinel row ${String(CYCLE_ROW_CAP + 1)} in ORDER BY cycle order`, async () => {
    // A complete graph on 6 files has far more than 101 simple cycles.
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const edges = ids.flatMap((x) => ids.filter((y) => y !== x).map((y) => ({ from: x, to: y, line: 1 })));
    const repo = await mirrored(files(ids), edges);
    const rows = noCyclicDepsRows(repo.mirror, 'all', {}, false);
    expect(rows).toHaveLength(CYCLE_ROW_CAP + 1);
    expect(rows).toEqual(bruteForceCycles(files(ids), edges, false));
  });

  it('models shared node ids as Neo4j does: one relationship per matching pair', async () => {
    const nodes: TestNode[] = [{ id: 'a' }, { id: 'm', type: 'Method', filePath: 'src/a.ts' }, { id: 'm', type: 'Method', filePath: 'src/a.ts' }, { id: 'b' }];
    const repo = await mirrored(nodes, [...ring(['a', 'b']), { from: 'm', to: 'm', type: 'CALLS' }]);
    expect(repo.mirror.state).toBe('valid');
    expect(noCyclicDepsRows(repo.mirror, 'literal', {}, false)).toHaveLength(1);
  });

  it('matches the brute-force reading of the template on 300 random graphs, both views, with and without excludes', async () => {
    const excludes = [globToRegex('**/a*.ts'), globToRegex('src/q?.ts')];
    for (let seed = 1; seed <= 300; seed += 1) {
      const { nodes, edges } = randomGraph(seed);
      const repo = await mirrored(nodes, edges);
      for (const literal of [false, true]) {
        const view = literal ? 'literal' : 'all';
        expect([seed, view, noCyclicDepsRows(repo.mirror, view, {}, false)]).toEqual([seed, view, bruteForceCycles(nodes, edges, literal)]);
        const ex = noCyclicDepsRows(repo.mirror, view, { excludePatterns: excludes }, true);
        const exRe = excludes.map((p) => new RegExp(p));
        expect([seed, view, 'excludes', ex]).toEqual([seed, view, 'excludes', bruteForceCycles(nodes, edges, literal, exRe)]);
      }
    }
  });
});

describe('no-cyclic-deps guards (the query goes to Neo4j)', () => {
  it('declines a non-File node with an outgoing IMPORTS edge', async () => {
    const repo = await mirrored([{ id: 'a' }, { id: 'k', type: 'Class', filePath: 'src/k.ts' }], [{ from: 'k', to: 'a' }]);
    expect(noCyclicDepsRows(repo.mirror, 'all', {}, false)).toBeUndefined();
  });

  it('declines non-ASCII and duplicate file paths', async () => {
    const accented = await mirrored([{ id: 'a', filePath: 'src/é.ts' }, { id: 'b' }], ring(['a', 'b']));
    expect(noCyclicDepsRows(accented.mirror, 'all', {}, false)).toBeUndefined();
    const twin = await mirrored([{ id: 'a', filePath: 'src/x.ts' }, { id: 'b', filePath: 'src/x.ts' }], ring(['a', 'b']));
    expect(noCyclicDepsRows(twin.mirror, 'all', {}, false)).toBeUndefined();
  });

  it('declines exclude patterns outside the globToRegex grammar, or missing', async () => {
    const repo = await mirrored(files(['a', 'b']), ring(['a', 'b']));
    expect(noCyclicDepsRows(repo.mirror, 'all', { excludePatterns: ['^(a|b)$'] }, true)).toBeUndefined();
    expect(noCyclicDepsRows(repo.mirror, 'all', { excludePatterns: [] }, true)).toBeUndefined();
    expect(noCyclicDepsRows(repo.mirror, 'all', {}, true)).toBeUndefined();
    expect(noCyclicDepsRows(repo.mirror, 'all', { excludePatterns: [globToRegex('**/z.ts', { segmentGlobstar: true })] }, true)).toHaveLength(1);
  });

  it('hands back a walk over the step budget', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const edges = ids.flatMap((x) => ids.filter((y) => y !== x).map((y) => ({ from: x, to: y })));
    const repo = await mirrored(files(ids), edges);
    expect(noCyclicDepsRows(repo.mirror, 'all', {}, false, 5)).toBeUndefined();
  });

  it('answers nothing while the mirror is not valid', async () => {
    const repo = await mirrored(files(['a', 'b']), ring(['a', 'b']));
    repo.mirror.invalidate();
    expect(answer(repo.mirror, { name: 'no-cyclic-deps', filter: 'all', excludes: false }, {})).toBeUndefined();
  });
});

describe('cyclicDependencyCount', () => {
  it('counts Files on a cycle of 2..MAX relationships through any node, and Files with two self-loops', async () => {
    const nodes: TestNode[] = [...files(['a', 'b', 'c', 'd', 's1', 's2']), { id: 'k', type: 'Class', filePath: 'src/k.ts' }];
    const edges: TestEdge[] = [
      ...ring(['a', 'b']), // a, b
      { from: 'c', to: 'k' }, { from: 'k', to: 'c' }, // c (through a non-File node)
      { from: 'd', to: 'd' }, // one self-loop: not counted
      { from: 's1', to: 's1' }, { from: 's1', to: 's1', type: 'RE_EXPORTS' }, // two self-loops: counted
      { from: 's2', to: 's2', viaReExport: true }, { from: 's2', to: 's2' }, // counted in the frozen view only
    ];
    const repo = await mirrored(nodes, edges);
    expect(asPlain(cycleMetricRows(repo.mirror, 'all'))).toEqual([{ cnt: 5 }]);
    expect(asPlain(cycleMetricRows(repo.mirror, 'literal'))).toEqual([{ cnt: 4 }]);
    expect(neo4j.isInt(cycleMetricRows(repo.mirror, 'all')![0]!['cnt'])).toBe(true);
  });

  it('matches the brute-force reading of the metric on 300 random graphs, both views', async () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const { nodes, edges } = randomGraph(seed);
      const repo = await mirrored(nodes, edges);
      for (const literal of [false, true]) {
        const rows = asPlain(cycleMetricRows(repo.mirror, literal ? 'literal' : 'all'));
        expect([seed, literal, rows]).toEqual([seed, literal, [{ cnt: bruteForceCycleCount(nodes, edges, literal) }]]);
      }
    }
  });

  it('declines a non-boolean viaReExport in the literal view', async () => {
    const repo = await mirrored(files(['a', 'b']), ring(['a', 'b']));
    (repo.mirror.rels as { viaReExport: unknown }[])[0]!.viaReExport = 'yes';
    expect(cycleMetricRows(repo.mirror, 'literal')).toBeUndefined();
    expect(cycleMetricRows(repo.mirror, 'all')).toBeDefined();
  });
});

describe('componentIds', () => {
  it('puts each strongly connected set in one component', () => {
    const comp = componentIds([[1], [0, 2], [], [3]]);
    expect(comp[0]).toBe(comp[1]);
    expect(new Set([comp[0], comp[2], comp[3]]).size).toBe(3);
  });
});
