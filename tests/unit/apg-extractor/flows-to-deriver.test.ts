import { resolve } from 'node:path';
import { Project } from 'ts-morph';
import { extractNodes } from '../../../src/apg-extractor/node-extractor.js';
import { extractEdges } from '../../../src/apg-extractor/edge-extractor.js';
import { extractAPG } from '../../../src/apg-extractor/apg-extractor.js';
import type { APGEdge, APGNode } from '../../../src/shared/types/apg.js';

// FR-21 edge (reduced by D8): BR-U2-27 (sources), BR-U2-28 (exclusions), BR-U2-29 (one edge per target).

const ROOT = '/proj';

function setup(files: Record<string, string>, strict = false): { nodes: APGNode[]; edges: APGEdge[] } {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    compilerOptions: { strict },
  });
  for (const [fp, content] of Object.entries(files)) project.createSourceFile(fp, content);
  const sfs = project.getSourceFiles();
  const { nodes, lookup } = extractNodes(sfs, ROOT);
  const { edges } = extractEdges(sfs, lookup, ROOT);
  return { nodes, edges };
}

function flows(nodes: readonly APGNode[], edges: readonly APGEdge[]): { source: string; target: string; properties: unknown }[] {
  const name = new Map(nodes.map(n => [n.id, n.name]));
  return edges
    .filter(e => e.type === 'FLOWS_TO')
    .map(e => ({ source: name.get(e.sourceId) ?? '?', target: name.get(e.targetId) ?? '?', properties: e.properties }));
}

const lines = (...ls: string[]): string => ls.join('\n');

describe('FLOWS_TO sources (BR-U2-27)', () => {
  it('F-FLOW-NEW: a `new` field initialiser yields exactly one edge with via "new"', () => {
    const { nodes, edges } = setup({
      '/proj/src/infrastructure/InMemoryOrderRepository.ts': 'export class InMemoryOrderRepository { save(): void {} }',
      '/proj/src/domain/Order.ts': lines(
        "import { InMemoryOrderRepository } from '../infrastructure/InMemoryOrderRepository';",
        'export class Order {',
        '  private readonly repo = new InMemoryOrderRepository();',
        '  place(): void { this.repo.save(); }',
        '}',
      ),
    });
    expect(flows(nodes, edges)).toEqual([
      { source: 'Order', target: 'InMemoryOrderRepository', properties: { field: 'repo', via: 'new', line: 3 } },
    ]);
  });

  it('F-FLOW-ASSIGN: `this.f = expr` in a method yields one edge with via "field-assignment" and the assignment line', () => {
    const { nodes, edges } = setup({
      '/proj/src/domain/OrderStore.ts': 'export class OrderStore {}',
      '/proj/src/domain/Basket.ts': lines(
        "import { OrderStore } from './OrderStore';",
        'export class Basket {',
        '  private store: OrderStore;',
        '  attach(s: OrderStore): void {',
        '    this.store = s;',
        '  }',
        '}',
      ),
    });
    expect(flows(nodes, edges)).toEqual([
      { source: 'Basket', target: 'OrderStore', properties: { field: 'store', via: 'field-assignment', line: 5 } },
    ]);
  });

  it('`this.f = new T()` in the constructor yields via "new"', () => {
    const { nodes, edges } = setup({
      '/proj/src/a.ts': lines(
        'export class Repo {}',
        'export class Svc {',
        '  private repo: Repo;',
        '  constructor() {',
        '    this.repo = new Repo();',
        '  }',
        '}',
      ),
    });
    expect(flows(nodes, edges)).toEqual([
      { source: 'Svc', target: 'Repo', properties: { field: 'repo', via: 'new', line: 5 } },
    ]);
  });

  it('an assignment inside an arrow function in a method binds `this` to the class', () => {
    const { nodes, edges } = setup({
      '/proj/src/a.ts': lines(
        'export class Repo {}',
        'export class Svc {',
        '  private repo: Repo;',
        '  later(r: Repo): void { [1].forEach(() => { this.repo = r; }); }',
        '}',
      ),
    });
    expect(flows(nodes, edges)).toEqual([
      { source: 'Svc', target: 'Repo', properties: { field: 'repo', via: 'field-assignment', line: 4 } },
    ]);
  });

  it('targets an extracted Interface', () => {
    const { nodes, edges } = setup({
      '/proj/src/a.ts': lines(
        'export interface IRepo { save(): void }',
        'export class Svc {',
        '  private repo: IRepo;',
        '  use(r: IRepo): void { this.repo = r; }',
        '}',
      ),
    });
    expect(flows(nodes, edges)).toEqual([
      { source: 'Svc', target: 'IRepo', properties: { field: 'repo', via: 'field-assignment', line: 4 } },
    ]);
  });

  it('a constructor parameter property assigned in a method counts as an instance field', () => {
    const { nodes, edges } = setup({
      '/proj/src/a.ts': lines(
        'export class Repo {}',
        'export class Svc {',
        '  constructor(private repo: Repo) {}',
        '  swap(r: Repo): void { this.repo = r; }',
        '}',
      ),
    });
    expect(flows(nodes, edges)).toEqual([
      { source: 'Svc', target: 'Repo', properties: { field: 'repo', via: 'field-assignment', line: 4 } },
    ]);
  });
});

describe('FLOWS_TO exclusions (BR-U2-28, F-FLOW-EXCL)', () => {
  const flowCount = (files: Record<string, string>, strict = false): number => {
    const { nodes, edges } = setup(files, strict);
    return flows(nodes, edges).length;
  };

  it('constructor-parameter flows (parameter property, CONSTRUCTOR_INJECTS only)', () => {
    const { nodes, edges } = setup({
      '/proj/src/a.ts': lines(
        'export class Repo {}',
        'export class Svc {',
        '  constructor(private readonly repo: Repo) {}',
        '}',
      ),
    });
    expect(flows(nodes, edges)).toHaveLength(0);
    expect(edges.filter(e => e.type === 'CONSTRUCTOR_INJECTS')).toHaveLength(1);
  });

  it('constructor-body assignment from a non-`new` expression', () => {
    expect(flowCount({
      '/proj/src/a.ts': lines(
        'export class Repo {}',
        'export class Svc {',
        '  private repo: Repo;',
        '  constructor(r: Repo) { this.repo = r; }',
        '}',
      ),
    })).toBe(0);
  });

  it('static fields (initialiser and `this.f` in a static method)', () => {
    expect(flowCount({
      '/proj/src/a.ts': lines(
        'export class Repo {}',
        'export class Svc {',
        '  static shared = new Repo();',
        '  static other: Repo;',
        '  static set(r: Repo): void { this.other = r; }',
        '}',
      ),
    })).toBe(0);
  });

  it('fields declared only in a base class', () => {
    const { nodes, edges } = setup({
      '/proj/src/a.ts': lines(
        'export class Repo {}',
        'export class Base { protected repo: Repo; }',
        'export class Child extends Base {',
        '  set(r: Repo): void { this.repo = r; }',
        '  reset(): void { this.repo = new Repo(); }',
        '}',
      ),
    });
    expect(flows(nodes, edges)).toHaveLength(0);
  });

  it('self-loops', () => {
    expect(flowCount({
      '/proj/src/a.ts': lines(
        'export class Link {',
        '  private next = new Link();',
        '  private prev: Link;',
        '  link(p: Link): void { this.prev = p; }',
        '}',
      ),
    })).toBe(0);
  });

  it('union value types', () => {
    expect(flowCount({
      '/proj/src/a.ts': lines(
        'export class A {}',
        'export class B { b = 1; }',
        'export class Svc {',
        '  private x: A | B;',
        '  set(v: A | B): void { this.x = v; }',
        '}',
      ),
    })).toBe(0);
  });

  it('nullable value types `T | null` (strict)', () => {
    expect(flowCount({
      '/proj/src/a.ts': lines(
        'export class Repo {}',
        'export class Svc {',
        '  private repo: Repo | null = null;',
        '  set(r: Repo | null): void { this.repo = r; }',
        '}',
      ),
    }, true)).toBe(0);
  });

  it('intersection value types', () => {
    expect(flowCount({
      '/proj/src/a.ts': lines(
        'export interface A { a(): void }',
        'export interface B { b(): void }',
        'export class Svc {',
        '  private x: A & B;',
        '  set(v: A & B): void { this.x = v; }',
        '}',
      ),
    })).toBe(0);
  });

  it('type arguments are not unwrapped (`new Map<string, Task>()`)', () => {
    expect(flowCount({
      '/proj/src/a.ts': lines(
        'export class Task {}',
        'export class Repo {',
        '  private readonly store = new Map<string, Task>();',
        '}',
      ),
    })).toBe(0);
  });

  it('`this` inside a nested function expression does not bind to the class', () => {
    expect(flowCount({
      '/proj/src/a.ts': lines(
        'export class Repo {}',
        'export class Svc {',
        '  private repo: Repo;',
        '  run(r: Repo): void { const f = function (this: any) { this.repo = r; }; f(); }',
        '}',
      ),
    })).toBe(0);
  });

  it('targets that are not an extracted Class or Interface', () => {
    expect(flowCount({
      '/proj/src/a.ts': lines(
        'type Alias = { n: number };',
        'export class Svc {',
        '  private when = new Date();',
        '  private a: Alias;',
        '  set(v: Alias): void { this.a = v; }',
        '}',
      ),
    })).toBe(0);
  });
});

describe('one FLOWS_TO edge per target (BR-U2-29)', () => {
  it('two fields of one type on lines 9 and 4 keep the line-4 field', () => {
    const { nodes, edges } = setup({
      '/proj/src/a.ts': lines(
        'export class T {}',
        'export class Svc {',
        '  private alpha: T;',
        '  private zeta = new T();',
        '  m1(): void {}',
        '  m2(): void {}',
        '  m3(): void {}',
        '  set(v: T): void {',
        '    this.alpha = v;',
        '  }',
        '}',
      ),
    });
    expect(flows(nodes, edges)).toEqual([
      { source: 'Svc', target: 'T', properties: { field: 'zeta', via: 'new', line: 4 } },
    ]);
  });

  it('on one line the lexicographically smaller field wins', () => {
    const { nodes, edges } = setup({
      '/proj/src/a.ts': lines(
        'export class T {}',
        'export class Svc {',
        '  private b: T; private a: T;',
        '  set(v: T): void { this.b = v; this.a = v; }',
        '}',
      ),
    });
    expect(flows(nodes, edges)).toEqual([
      { source: 'Svc', target: 'T', properties: { field: 'a', via: 'field-assignment', line: 4 } },
    ]);
  });
});

describe('FLOWS_TO over the golden fixtures', () => {
  const FIXTURES = resolve(__dirname, '../../../fixtures');
  const helper = (line: number) => ({ field: 'helper', via: 'new', line });
  const expected: Record<string, { source: string; target: string; properties: unknown }[]> = {
    'correct-reference': [],
    'variant-a-structural': [{ source: 'InMemoryTaskRepository', target: 'CircularHelper', properties: helper(8) }],
    'variant-b-pattern': [],
    'variant-c-everything': [{ source: 'InMemoryTaskRepository', target: 'CircularB', properties: helper(7) }],
    'variant-d-subtle': [],
  };

  it.each(Object.keys(expected))('%s', async name => {
    const r = await extractAPG(resolve(FIXTURES, name));
    if (!r.success) throw new Error(`extraction failed for ${name}`);
    expect(flows(r.data.nodes, r.data.edges)).toEqual(expected[name]);
  }, 60_000);
});
