import { resolve } from 'node:path';
import { Project } from 'ts-morph';
import { extractNodes } from '../../../src/apg-extractor/node-extractor.js';
import { extractEdges } from '../../../src/apg-extractor/edge-extractor.js';
import { extractAPG } from '../../../src/apg-extractor/apg-extractor.js';
import type { APGEdge, APGNode, APGResult } from '../../../src/shared/types/apg.js';

// ADR-016 f, BR-U2-47: interface Method nodes and `Interface -[:CONTAINS]-> Method` (F-IFACE).

const ROOT = '/proj';

function setup(files: Record<string, string>): { nodes: APGNode[]; edges: APGEdge[] } {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    compilerOptions: { strict: false },
  });
  for (const [fp, content] of Object.entries(files)) project.createSourceFile(fp, content);
  const sfs = project.getSourceFiles();
  const { nodes, lookup } = extractNodes(sfs, ROOT);
  const { edges } = extractEdges(sfs, lookup, ROOT);
  return { nodes, edges };
}

/** `Interface -[:CONTAINS]-> Method` edges from the interface called `name`, as target method names. */
function interfaceContains(nodes: readonly APGNode[], edges: readonly APGEdge[], name: string): string[] {
  const byId = new Map(nodes.map(n => [n.id, n]));
  return edges
    .filter(e => e.type === 'CONTAINS')
    .filter(e => {
      const src = byId.get(e.sourceId);
      return src?.type === 'Interface' && src.name === name;
    })
    .map(e => byId.get(e.targetId)?.name ?? '?');
}

const F_IFACE = {
  '/proj/src/i.ts': `
    export interface I {
      a(): void;
      b(x: string): void;
      b(x: number): void;
      c: () => void;
      (n: number): string;
      new (s: string): I;
      [key: string]: unknown;
    }
    export interface J extends I { d(): void }
  `,
};

describe('F-IFACE: interface Method nodes (BR-U2-47 a)', () => {
  it('own method signatures only: I.a and I.b, not the function-typed property, call, construct or index signatures', () => {
    const { nodes } = setup(F_IFACE);
    const iMethods = nodes.filter(n => n.type === 'Method' && n.name.startsWith('I.'));
    expect(iMethods.map(m => m.name)).toEqual(['I.a', 'I.b']);
  });

  it('Method node properties: interface file, isAsync false, isStatic false, isAbstract true, first-signature returnType', () => {
    const { nodes } = setup({
      '/proj/src/r.ts': `
        export interface R {
          find(id: string): string;
          find(id: number): number;
          run(): Promise<void>;
        }
      `,
    });
    const find = nodes.find(n => n.name === 'R.find');
    expect(find).toMatchObject({
      type: 'Method',
      filePath: 'src/r.ts',
      properties: { isAsync: false, isStatic: false, isAbstract: true, returnType: 'string' },
    });
    expect(nodes.find(n => n.name === 'R.run')?.properties.returnType).toBe('Promise<void>');
    expect(nodes.filter(n => n.name === 'R.find')).toHaveLength(1);
  });

  it('exactly two I -[:CONTAINS]-> edges, overloads collapsed; J extends I yields one edge (not inherited)', () => {
    const { nodes, edges } = setup(F_IFACE);
    expect(interfaceContains(nodes, edges, 'I')).toEqual(['I.a', 'I.b']);
    expect(interfaceContains(nodes, edges, 'J')).toEqual(['J.d']);
    for (const e of edges.filter(x => x.type === 'CONTAINS')) expect(e.properties).toEqual({});
  });

  it('a class and an interface of one name merged in one file keep one Method node and the interface edge is added', () => {
    const { nodes, edges } = setup({
      '/proj/src/m.ts': `
        export interface Foo { a(): void; }
        export class Foo { a(): void {} }
      `,
    });
    expect(nodes.filter(n => n.type === 'Method' && n.name === 'Foo.a')).toHaveLength(1);
    expect(interfaceContains(nodes, edges, 'Foo')).toEqual(['Foo.a']);
    const ids = edges.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('CALLS still targets class methods only: a call through an interface-typed field yields no CALLS edge', () => {
    const { edges } = setup({
      '/proj/src/a.ts': `
        export interface IRepo { save(): void; }
        export class Svc {
          constructor(private readonly repo: IRepo) {}
          run(): void { this.repo.save(); }
        }
      `,
    });
    expect(edges.filter(e => e.type === 'CALLS')).toHaveLength(0);
  });
});

describe('fixtures: ITaskRepository CONTAINS edges and unchanged CALLS (BR-U2-47 b)', () => {
  const FIXTURES = resolve(__dirname, '../../../fixtures');
  // CALLS counts measured on the parent commit (before interface Method nodes); they must not change.
  const expected: Record<string, { iTaskRepository: number; calls: number }> = {
    'correct-reference': { iTaskRepository: 5, calls: 2 },
    'variant-a-structural': { iTaskRepository: 4, calls: 1 },
    'variant-b-pattern': { iTaskRepository: 8, calls: 4 },
    'variant-c-everything': { iTaskRepository: 9, calls: 2 },
    'variant-d-subtle': { iTaskRepository: 4, calls: 2 },
  };
  const results = new Map<string, APGResult>();

  beforeAll(async () => {
    for (const name of Object.keys(expected)) {
      const r = await extractAPG(resolve(FIXTURES, name));
      if (!r.success) throw new Error(`extraction failed for ${name}`);
      results.set(name, r.data);
    }
  }, 120_000);

  it.each(Object.keys(expected))('%s', name => {
    const r = results.get(name);
    if (r === undefined) throw new Error(`no result for ${name}`);
    const want = expected[name];
    expect(interfaceContains(r.nodes, r.edges, 'ITaskRepository')).toHaveLength(want?.iTaskRepository ?? -1);
    expect(r.edges.filter(e => e.type === 'CALLS')).toHaveLength(want?.calls ?? -1);
    // Every Interface -[:CONTAINS]-> target is an abstract Method in the interface's file.
    const byId = new Map(r.nodes.map(n => [n.id, n]));
    for (const e of r.edges.filter(x => x.type === 'CONTAINS' && byId.get(x.sourceId)?.type === 'Interface')) {
      const target = byId.get(e.targetId);
      expect(target?.type).toBe('Method');
      expect(target?.properties.isAbstract).toBe(true);
      expect(target?.filePath).toBe(byId.get(e.sourceId)?.filePath);
    }
  });
});
