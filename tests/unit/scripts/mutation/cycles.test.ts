/**
 * New simple cycles and U3 key form (U5a plan Step 14; BR-U5a-13, BR-U5a-14 i; D-U5a-14;
 * `business-logic-model.md` §2.4).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  canonicalCycle,
  countSimpleCycles,
  cycleCapReached,
  cycleKey,
  newSimpleCycles,
  sccKeys,
  siteCycleKeys,
} from '../../../../scripts/lib/mutation/cycles.js';
import { buildImportGraph, openImportGraphProject } from '../../../../scripts/lib/mutation/import-graph.js';
import type { CycleStrategy, ImportGraph } from '../../../../scripts/lib/mutation/types.js';

const REPO = process.cwd();
const MAX = 10;
const CAP = 100;
const TASK = 'src/domain/entities/Task.ts';
const REPO_IMPL = 'src/infrastructure/repositories/InMemoryTaskRepository.ts';

/** Synthetic graph from `source>target` pairs (IMPORTS, line 1 unless `@n` is appended). */
function graph(pairs: readonly string[]): ImportGraph {
  const files = new Map<string, { filePath: string; layer: string | null; isBarrel: boolean }>();
  const edges = pairs.map((p) => {
    const [st, l] = p.split('@');
    const [source = '', target = ''] = (st ?? '').split('>');
    for (const f of [source, target]) files.set(f, { filePath: f, layer: null, isBarrel: false });
    return { source, target, type: 'IMPORTS' as const, isTypeOnly: false, line: l === undefined ? 1 : Number(l) };
  });
  return { files, edges };
}

/** A chain f0 → f1 → … → f(n−1) → f0 of n edges, names zero-padded so code-unit order is numeric order. */
function ring(prefix: string, n: number): string[] {
  const name = (i: number): string => `${prefix}${String(i).padStart(2, '0')}.ts`;
  return Array.from({ length: n }, (_, i) => `${name(i)}>${name((i + 1) % n)}`);
}

/** `n` disjoint 2-cycles. */
function twoCycles(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => [`${prefix}${String(i).padStart(3, '0')}a.ts>${prefix}${String(i).padStart(3, '0')}b.ts`, `${prefix}${String(i).padStart(3, '0')}b.ts>${prefix}${String(i).padStart(3, '0')}a.ts`]).flat();
}

describe('newSimpleCycles on synthetic graphs', () => {
  it('2-cycle → [A, B, A]', () => {
    expect(newSimpleCycles(graph(['A>B']), graph(['A>B', 'B>A']), MAX, CAP)).toEqual([['A', 'B', 'A']]);
  });

  it('a 3-cycle closed by a new edge starts at its smallest path', () => {
    const base = graph(['b.ts>c.ts', 'c.ts>a.ts']);
    const mutant = graph(['b.ts>c.ts', 'c.ts>a.ts', 'a.ts>b.ts']);
    expect(newSimpleCycles(base, mutant, MAX, CAP)).toEqual([['a.ts', 'b.ts', 'c.ts', 'a.ts']]);
    expect(canonicalCycle(['c', 'a', 'b'])).toEqual(['a', 'b', 'c', 'a']);
  });

  it('a cycle of length 10 is found, one of length 11 is not', () => {
    const r10 = ring('t', 10);
    expect(newSimpleCycles(graph(r10.slice(0, 9)), graph(r10), MAX, CAP)).toHaveLength(1);
    const r11 = ring('e', 11);
    expect(newSimpleCycles(graph(r11.slice(0, 10)), graph(r11), MAX, CAP)).toEqual([]);
    expect(countSimpleCycles(graph(r10), MAX, 1000)).toBe(1);
    expect(countSimpleCycles(graph(r11), MAX, 1000)).toBe(0);
  });

  it('a cycle already in the base is not new; self-loops are not cycles', () => {
    const base = graph(['A>B', 'B>A']);
    expect(newSimpleCycles(base, graph(['A>B', 'B>A', 'C>C']), MAX, CAP)).toEqual([]);
    expect(countSimpleCycles(graph(['C>C']), MAX, 10)).toBe(0);
  });

  it('every new cycle through a new edge, sorted as ORDER BY cycle', () => {
    const base = graph(['B>C', 'C>A', 'B>A']);
    const mutant = graph(['B>C', 'C>A', 'B>A', 'A>B']);
    expect(newSimpleCycles(base, mutant, MAX, CAP)).toEqual([['A', 'B', 'A'], ['A', 'B', 'C', 'A']]);
  });
});

describe('correct-reference plus Task.ts → InMemoryTaskRepository.ts (§2.4)', () => {
  let scratch: string;
  let base: ImportGraph;
  let mutant: ImportGraph;
  beforeAll(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-cycles-'));
    const copy = path.join(scratch, 'correct-reference');
    fs.cpSync(path.resolve(REPO, 'fixtures/correct-reference'), copy, { recursive: true });
    base = buildImportGraph(openImportGraphProject(copy, 'tsconfig.json'), []);
    const task = path.join(copy, TASK);
    fs.writeFileSync(
      task,
      "import { InMemoryTaskRepository } from '../../infrastructure/repositories/InMemoryTaskRepository';\n" +
        fs.readFileSync(task, 'utf8') +
        'export const repositoryRef = InMemoryTaskRepository;\n',
    );
    mutant = buildImportGraph(openImportGraphProject(copy, 'tsconfig.json'), []);
  });
  afterAll(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  it('the base has no simple cycle', () => {
    expect(countSimpleCycles(base, MAX, CAP)).toBe(0);
  });

  it('exactly the two cycles, both starting at Task.ts', () => {
    expect(newSimpleCycles(base, mutant, MAX, CAP)).toEqual([
      [TASK, REPO_IMPL, TASK],
      [TASK, REPO_IMPL, 'src/domain/repositories/ITaskRepository.ts', TASK],
    ]);
  });

  it('simple-cycles keys equal the §2.4 strings byte for byte (line of the new import)', () => {
    const keys = siteCycleKeys(base, mutant, 'simple-cycles', { functionId: 'FF-S02', maxLength: MAX, cap: CAP });
    expect(keys).toEqual([
      {
        functionId: 'FF-S02',
        filePath: 'src/domain/entities/Task.ts,src/infrastructure/repositories/InMemoryTaskRepository.ts,src/domain/entities/Task.ts',
        target: 'src/infrastructure/repositories/InMemoryTaskRepository.ts',
        discriminator: ['["src/domain/entities/Task.ts","src/infrastructure/repositories/InMemoryTaskRepository.ts","src/domain/entities/Task.ts"]'],
        lineRule: 'first-edge-line',
        line: 1,
      },
      {
        functionId: 'FF-S02',
        filePath:
          'src/domain/entities/Task.ts,src/infrastructure/repositories/InMemoryTaskRepository.ts,src/domain/repositories/ITaskRepository.ts,src/domain/entities/Task.ts',
        target: 'src/infrastructure/repositories/InMemoryTaskRepository.ts',
        discriminator: [
          '["src/domain/entities/Task.ts","src/infrastructure/repositories/InMemoryTaskRepository.ts","src/domain/repositories/ITaskRepository.ts","src/domain/entities/Task.ts"]',
        ],
        lineRule: 'first-edge-line',
        line: 1,
      },
    ]);
  });

  it('SCC form gives (FF-S02, Task.ts, \'\', [\'scc\'])', () => {
    const keys = siteCycleKeys(base, mutant, 'scc', { functionId: 'FF-S02', maxLength: MAX, cap: CAP });
    expect(keys.map((k) => [k.functionId, k.filePath, k.target, k.discriminator])).toEqual([['FF-S02', TASK, '', ['scc']]]);
    expect(keys[0]?.lineRule).toBe('first-edge-line');
    expect(keys[0]?.line).toBe(1);
  });
});

describe('SCC keys: new or changed components only', () => {
  it('a merge that keeps the smallest member keeps no key; one that changes it gives a key', () => {
    const base = graph(['b>c', 'c>b']);
    expect(sccKeys('F', base, graph(['b>c', 'c>b', 'c>d', 'd>b']))).toEqual([]);
    expect(sccKeys('F', base, graph(['b>c', 'c>b', 'a>b', 'c>a@7'])).map((k) => [k.filePath, k.line])).toEqual([['a', 1]]);
  });
});

describe('siteCycleKeys dispatches on the explicit strategy (D-U5a-14)', () => {
  const base = graph(['A>B']);
  const mutant = graph(['A>B', 'B>A@4']);
  const opts = { functionId: 'F', maxLength: MAX, cap: CAP };

  it('simple-cycles and scc give their own key forms', () => {
    expect(siteCycleKeys(base, mutant, 'simple-cycles', opts)).toEqual([cycleKey('F', ['A', 'B', 'A'], 1)]);
    expect(siteCycleKeys(base, mutant, 'scc', opts)).toEqual([
      { functionId: 'F', filePath: 'A', target: '', discriminator: ['scc'], lineRule: 'first-edge-line', line: 1 },
    ]);
  });

  it('an unknown strategy is refused (no default inside the module)', () => {
    expect(() => siteCycleKeys(base, mutant, 'cypher' as unknown as CycleStrategy, opts)).toThrow(/unknown cycle strategy/);
  });

  it('cycleKey refuses an open cycle', () => {
    expect(() => cycleKey('F', ['A', 'B'], 1)).toThrow(/closed/);
  });
});

describe('cycle cap (BR-U5a-13)', () => {
  it('a base with 100 cycles → cap reached', () => {
    const base = graph(twoCycles('x', 100));
    const n = countSimpleCycles(base, MAX, CAP);
    expect(n).toBe(100);
    expect(cycleCapReached(n, 0, CAP)).toBe(true);
  });

  it('99 base cycles plus a site adding 2 → cap reached', () => {
    const basePairs = [...twoCycles('x', 99), 'p.ts>q.ts', 'q.ts>r.ts'];
    const base = graph(basePairs);
    const mutant = graph([...basePairs, 'q.ts>p.ts', 'r.ts>q.ts']);
    const b = countSimpleCycles(base, MAX, CAP);
    const added = newSimpleCycles(base, mutant, MAX, CAP).length;
    expect([b, added]).toEqual([99, 2]);
    expect(cycleCapReached(b, added, CAP)).toBe(true);
  });

  it('98 base cycles plus a site adding 2 → not reached', () => {
    const basePairs = [...twoCycles('x', 98), 'p.ts>q.ts', 'q.ts>r.ts'];
    const base = graph(basePairs);
    const mutant = graph([...basePairs, 'q.ts>p.ts', 'r.ts>q.ts']);
    const b = countSimpleCycles(base, MAX, CAP);
    const added = newSimpleCycles(base, mutant, MAX, CAP).length;
    expect([b, added]).toEqual([98, 2]);
    expect(cycleCapReached(b, added, CAP)).toBe(false);
  });

  it('counting stops at the limit; new-cycle enumeration stops after cap + 1', () => {
    expect(countSimpleCycles(graph(twoCycles('x', 120)), MAX, CAP)).toBe(100);
    expect(newSimpleCycles(graph([]), graph(twoCycles('y', 120)), MAX, 5)).toHaveLength(6);
  });
});
