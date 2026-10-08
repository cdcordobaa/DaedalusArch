/**
 * SCC fallback module (NFR-07, FR-35; U3 BR-U3-45; TF-11). Prepared and off (`CYCLE_STRATEGY`).
 */
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/apg-extractor.js';
import type { APGEdge, APGNode, APGResult } from '../../../src/shared/types/apg.js';
import {
  CYCLE_STRATEGY, SCC_DISCRIMINATOR, buildFileGraph, countSccFiles, findSccViolations,
  representativeCycle, stronglyConnectedComponents,
} from '../../../src/evaluation-engine/scc-cycles.js';
import { computeViolationId } from '../../../src/evaluation-engine/violation-id.js';
import { MAX_CYCLE_LENGTH } from '../../../src/fitness-compiler/cypher-templates.js';

const FIXTURES = path.resolve(__dirname, '../../../fixtures');
const S02 = { functionId: 'FF-S02', dimension: 'structural', severity: 'critical' } as const;

type Graph = Pick<APGResult, 'nodes' | 'edges'>;

function fileNode(filePath: string): APGNode {
  return { id: `id:${filePath}`, type: 'File', filePath, name: path.basename(filePath), decorators: [], properties: {} };
}

let edgeCounter = 0;
function edge(from: string, to: string, type: APGEdge['type'] = 'IMPORTS'): APGEdge {
  edgeCounter++;
  return { id: `e${String(edgeCounter)}`, type, sourceId: `id:${from}`, targetId: `id:${to}`, properties: {} };
}

function graphOf(edges: readonly (readonly [string, string])[], extraFiles: readonly string[] = []): Graph {
  const files = new Set<string>(extraFiles);
  for (const [a, b] of edges) { files.add(a); files.add(b); }
  return { nodes: [...files].map(fileNode), edges: edges.map(([a, b]) => edge(a, b)) };
}

/** Seeded Fisher-Yates (mulberry32), so the ten orders are reproducible. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  let s = seed >>> 0;
  const rand = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/**
 * Reference for the Cypher `no-cyclic-deps` file set: files on a simple cycle of length
 * 2..MAX_CYCLE_LENGTH over File→File IMPORTS|RE_EXPORTS (the template's semantics).
 */
function boundedCycleFiles(apg: Graph): Set<string> {
  const graph = buildFileGraph(apg);
  const onCycle = new Set<string>();
  for (const start of graph.keys()) {
    const walk = (node: string, trail: string[]): void => {
      for (const next of graph.get(node) ?? []) {
        if (next === start && trail.length >= 2) trail.forEach((f) => onCycle.add(f));
        else if (next > start && !trail.includes(next) && trail.length < MAX_CYCLE_LENGTH) walk(next, [...trail, next]);
      }
    };
    walk(start, [start]);
  }
  return onCycle;
}

async function apgOf(fixture: string): Promise<APGResult> {
  const result = await extractAPG(path.join(FIXTURES, fixture));
  if (!result.success) throw new Error(`extractAPG failed for ${fixture}`);
  return result.data;
}

describe('CYCLE_STRATEGY (BR-U3-45, BR-U3-70 item 3)', () => {
  it("is frozen at 'cypher'", () => {
    expect(CYCLE_STRATEGY).toBe('cypher');
  });
});

describe('SCC vs Cypher file sets on the golden APGs (TF-11)', () => {
  let a: APGResult;
  let c: APGResult;
  beforeAll(async () => {
    a = await apgOf('variant-a-structural');
    c = await apgOf('variant-c-everything');
  }, 60_000);

  it('variant-a: the same four files as the Cypher cycles (golden FF-S02 rows, cyclicDependencyCount 4)', () => {
    const scc = new Set(findSccViolations(a, S02).flatMap((v) => JSON.parse((v.evidence ?? [''])[0]?.slice('cycle='.length) ?? '[]') as string[]));
    const expected = new Set([
      'src/domain/entities/Task.ts', 'src/domain/repositories/ITaskRepository.ts',
      'src/infrastructure/repositories/CircularHelper.ts', 'src/infrastructure/repositories/InMemoryTaskRepository.ts',
    ]);
    const sccFiles = new Set(stronglyConnectedComponents(buildFileGraph(a)).flat());
    expect(sccFiles).toEqual(expected);
    expect(boundedCycleFiles(a)).toEqual(expected);
    expect(scc).toEqual(expected);
    expect(countSccFiles(a)).toBe(4);
  });

  it('variant-c: the same two files as the Cypher cycle (golden FF-S02 row, cyclicDependencyCount 2)', () => {
    const expected = new Set([
      'src/infrastructure/repositories/CircularB.ts', 'src/infrastructure/repositories/InMemoryTaskRepository.ts',
    ]);
    expect(new Set(stronglyConnectedComponents(buildFileGraph(c)).flat())).toEqual(expected);
    expect(boundedCycleFiles(c)).toEqual(expected);
    expect(countSccFiles(c)).toBe(2);
    const violations = findSccViolations(c, S02);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.filePath).toBe('src/infrastructure/repositories/CircularB.ts');
  });

  it('ten shuffled edge orders give identical violations (representative cycle included)', () => {
    for (const apg of [a, c]) {
      const reference = findSccViolations(apg, S02);
      for (let seed = 1; seed <= 10; seed++) {
        const shuffledApg: Graph = { nodes: shuffled(apg.nodes, seed * 7), edges: shuffled(apg.edges, seed) };
        expect(findSccViolations(shuffledApg, S02)).toEqual(reference);
      }
    }
  });
});

describe('SCC violation shape (BR-U3-45)', () => {
  const g = graphOf([
    ['src/c.ts', 'src/a.ts'], ['src/a.ts', 'src/b.ts'], ['src/b.ts', 'src/c.ts'], ['src/a.ts', 'src/d.ts'], ['src/d.ts', 'src/a.ts'],
    ['src/x.ts', 'src/y.ts'],
  ]);

  it('one violation per SCC of size >= 2, keyed on the smallest member, discriminator ["scc"], no target', () => {
    const [v, ...rest] = findSccViolations(g, S02);
    expect(rest).toHaveLength(0);
    expect(v).toMatchObject({
      filePath: 'src/a.ts', discriminator: [SCC_DISCRIMINATOR], type: 'CYCLIC_DEPENDENCY', route: 'symbolic',
      dimension: 'structural', severity: 'critical', deterministic: true, tag: 'topological',
    });
    expect(v?.target).toBeUndefined();
    expect(v?.id).toBe(computeViolationId({ functionId: 'FF-S02', filePath: 'src/a.ts', discriminator: ['scc'] }));
  });

  it('evidence holds the BFS-shortest cycle through the smallest member, ascending neighbour order', () => {
    // a -> b -> c -> a (length 3) and a -> d -> a (length 2): the shortest is a, d, a.
    expect(findSccViolations(g, S02)[0]?.evidence).toEqual(['cycle=["src/a.ts","src/d.ts","src/a.ts"]']);
    // Two equal-length cycles a->b->a and a->c->a: ascending order picks b.
    const tie = buildFileGraph(graphOf([['a', 'c'], ['c', 'a'], ['a', 'b'], ['b', 'a']]));
    expect(representativeCycle(tie, ['a', 'b', 'c'], 'a')).toEqual(['a', 'b', 'a']);
  });

  it('counts RE_EXPORTS edges, ignores other edge types and non-File endpoints', () => {
    const nodes = [fileNode('p.ts'), fileNode('q.ts'), { ...fileNode('pkg'), type: 'Package' as const }];
    const edges = [edge('p.ts', 'q.ts', 'RE_EXPORTS'), edge('q.ts', 'p.ts'), edge('p.ts', 'pkg'), edge('pkg', 'p.ts')];
    expect(countSccFiles({ nodes, edges })).toBe(2);
    expect(countSccFiles({ nodes, edges: [edge('p.ts', 'q.ts', 'CALLS'), edge('q.ts', 'p.ts')] })).toBe(0);
  });

  it('excludePaths removes matching files (template path); the metric path excludes nothing', () => {
    const cyc = graphOf([['src/a.ts', 'src/gen/b.ts'], ['src/gen/b.ts', 'src/a.ts']]);
    expect(findSccViolations(cyc, { ...S02, excludePaths: ['src/gen/**'] })).toHaveLength(0);
    expect(findSccViolations(cyc, S02)).toHaveLength(1);
    expect(countSccFiles(cyc)).toBe(2);
  });

  it('a self-import is not a cycle (SCC size 1; Cypher bound starts at 2)', () => {
    expect(countSccFiles(graphOf([['s.ts', 's.ts']]))).toBe(0);
  });
});

describe('SCC merge keys (TF-11)', () => {
  const base: (readonly [string, string])[] = [['b.ts', 'c.ts'], ['c.ts', 'b.ts'], ['d.ts', 'e.ts'], ['e.ts', 'd.ts']];

  it('a merge that keeps the smallest member keeps the key', () => {
    const before = findSccViolations(graphOf(base), S02);
    const after = findSccViolations(graphOf([...base, ['c.ts', 'd.ts'], ['e.ts', 'c.ts']]), S02);
    expect(before.map((v) => v.filePath)).toEqual(['b.ts', 'd.ts']);
    expect(after.map((v) => v.filePath)).toEqual(['b.ts']);
    expect(after[0]?.id).toBe(before[0]?.id);
  });

  it('a merge that changes the smallest member changes the key', () => {
    const before = findSccViolations(graphOf(base), S02);
    const after = findSccViolations(graphOf([...base, ['a.ts', 'b.ts'], ['c.ts', 'a.ts']]), S02);
    expect(after.map((v) => v.filePath)).toEqual(['a.ts', 'd.ts']);
    expect(after[0]?.id).not.toBe(before[0]?.id);
  });
});
