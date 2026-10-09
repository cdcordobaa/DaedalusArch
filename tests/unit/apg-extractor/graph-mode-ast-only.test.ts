/**
 * ADR-021 SO2; audit SO2-4, SO2-5, X-2: FLOWS_TO store accounting and the `ast-only` graph mode, the register's
 * edge-type allow-list (IMPORTS, DECLARES, CONTAINS) over the full extraction (ADR-021 item 8).
 */
import { Project } from 'ts-morph';
import type { CompilerOptions } from 'ts-morph';
import { extractNodes } from '../../../src/apg-extractor/node-extractor.js';
import { extractEdges } from '../../../src/apg-extractor/edge-extractor.js';
import { AST_ONLY_EDGE_TYPES, edgeTypesOf, restrictToGraphMode } from '../../../src/apg-extractor/graph-mode.js';
import type { EdgeExtractionResult } from '../../../src/apg-extractor/edge-extractor.js';
import type { GraphMode } from '../../../src/apg-extractor/types.js';
import { GRAPH_MODES } from '../../../src/apg-extractor/types.js';
import { PLAN_GRAPH_MODES } from '../../../scripts/run-experiment.js';
import type { APGEdge, APGNode } from '../../../src/shared/types/apg.js';
import type { EdgeType } from '../../../src/shared/types/enums.js';

const ROOT = '/proj';
const lines = (...ls: string[]): string => ls.join('\n');

function run(files: Record<string, string>, graphMode: GraphMode, compilerOptions: CompilerOptions = {}): { nodes: APGNode[]; r: EdgeExtractionResult } {
  const project = new Project({ useInMemoryFileSystem: true, skipFileDependencyResolution: true, compilerOptions });
  for (const [fp, content] of Object.entries(files)) project.createSourceFile(fp, content);
  const sfs = project.getSourceFiles();
  const { nodes, lookup } = extractNodes(sfs, ROOT);
  return { nodes, r: extractEdges(sfs, lookup, ROOT, { graphMode }) };
}

/** `TYPE source -> target` by node name (Package nodes by name too). */
function edgeList(nodes: readonly APGNode[], r: EdgeExtractionResult, types: readonly string[]): string[] {
  const name = new Map([...nodes, ...r.packageNodes].map((n) => [n.id, n.type === 'File' ? n.filePath : n.name]));
  return r.edges.filter((e) => types.includes(e.type)).map((e) => `${e.type} ${name.get(e.sourceId) ?? '?'} -> ${name.get(e.targetId) ?? '?'}`).sort();
}

describe('FLOWS_TO store accounting (audit SO2-4)', () => {
  // Hand count over class Svc: stores 5 = repo (new Repo, line 6), repo2 (new Repo, line 7, same target),
  // when (new Date(): not extracted), self (constructor `this.self = new Svc()`: self-loop) and the method
  // assignment `this.other = o` (Other). `either` has a conditional initialiser, not a `new`: not a store.
  // Candidates 3 (repo, repo2, other); edges 2 (Repo once, Other).
  const files = {
    '/proj/src/a.ts': lines(
      'export class Repo {}', 'export class A {}', 'export class B {}', 'export class Other {}',
      'export class Svc {',
      '  private repo = new Repo();',
      '  private repo2 = new Repo();',
      '  private either: A | B = Math.random() > 0.5 ? new A() : new B();',
      '  private when = new Date();',
      '  private self?: Svc;',
      '  private other?: Other;',
      '  constructor() { this.self = new Svc(); }',
      '  attach(o: Other): void { this.other = o; }',
      '}',
    ),
  };

  it('counts every considered store by outcome; edges follow the one-per-target rule', () => {
    const { r } = run(files, 'full');
    expect(r.flowsTo).toEqual({ stores: 5, candidates: 3, skippedUnionOrIntersection: 0, skippedUnextractedTarget: 1, skippedSelfLoop: 1, edges: 2 });
  });

  it('a union-typed `this.f = expr` store is counted as skipped (union or intersection)', () => {
    const { r } = run({
      '/proj/src/b.ts': lines(
        'export class A {}', 'export class B {}',
        'export class Holder {',
        '  private either?: A | B;',
        '  set(v: A | B): void { this.either = v; }',
        '}',
      ),
    }, 'full');
    expect(r.flowsTo).toEqual({ stores: 1, candidates: 0, skippedUnionOrIntersection: 1, skippedUnextractedTarget: 0, skippedSelfLoop: 0, edges: 0 });
  });

  it('the ast-only mode keeps the full extraction\'s store accounting but no FLOWS_TO edge', () => {
    const { nodes, r } = run(files, 'ast-only');
    expect(edgeList(nodes, r, ['FLOWS_TO'])).toEqual([]);
    expect(r.flowsTo).toEqual({ stores: 5, candidates: 3, skippedUnionOrIntersection: 0, skippedUnextractedTarget: 1, skippedSelfLoop: 1, edges: 2 });
  });
});

describe('ast-only graph mode = edge-type allow-list IMPORTS, DECLARES, CONTAINS (audit SO2-5, X-2)', () => {
  // One fixture with every edge type. Hand list of the full graph (18 edges):
  //   IMPORTS 3: svc.ts -> base.ts and -> repo.ts (alias `@dom/index` via `paths`, then followed through the barrel), svc.ts -> fs
  //   RE_EXPORTS 3: index.ts -> base.ts, -> repo.ts, -> ext-lib
  //   DECLARES 4: base.ts -> Base, repo.ts -> Repo, svc.ts -> Impl, svc.ts -> Svc
  //   CONTAINS 3: Repo -> Repo.save, Impl -> Impl.save, Svc -> Svc.run
  //   EXTENDS Impl -> Base; IMPLEMENTS Impl -> Repo; CONSTRUCTOR_INJECTS Svc -> Repo; FLOWS_TO Svc -> Impl; CALLS Svc.run -> Impl.save
  // ast-only keeps 3 + 4 + 3 = 10 edges; Package ext-lib is targeted only by a RE_EXPORTS edge and is dropped, fs stays.
  const all = {
    '/proj/src/domain/repo.ts': 'export interface Repo { save(): void; }',
    '/proj/src/domain/base.ts': 'export class Base {}',
    '/proj/src/domain/index.ts': lines("export { Base } from './base';", "export { Repo } from './repo';", "export { chunk } from 'ext-lib';"),
    '/proj/src/app/svc.ts': lines(
      "import { Base, Repo } from '@dom/index';",
      "import { readFileSync } from 'node:fs';",
      'export class Impl extends Base implements Repo { save(): void {} }',
      'export class Svc {',
      '  private impl = new Impl();',
      '  constructor(private readonly repo: Repo) {}',
      '  run(): void { this.impl.save(); }',
      '}',
    ),
  };
  const aliasOptions = { baseUrl: '/proj', paths: { '@dom/*': ['src/domain/*'] } };
  const KEPT = [
    'CONTAINS Impl -> Impl.save', 'CONTAINS Repo -> Repo.save', 'CONTAINS Svc -> Svc.run',
    'DECLARES src/app/svc.ts -> Impl', 'DECLARES src/app/svc.ts -> Svc', 'DECLARES src/domain/base.ts -> Base', 'DECLARES src/domain/repo.ts -> Repo',
    'IMPORTS src/app/svc.ts -> fs', 'IMPORTS src/app/svc.ts -> src/domain/base.ts', 'IMPORTS src/app/svc.ts -> src/domain/repo.ts',
  ];
  const ALL_TYPES = ['IMPORTS', 'RE_EXPORTS', 'DECLARES', 'CONTAINS', 'EXTENDS', 'IMPLEMENTS', 'CONSTRUCTOR_INJECTS', 'FLOWS_TO', 'CALLS'];

  it('full: all nine edge types, 18 edges', () => {
    const { nodes, r } = run(all, 'full', aliasOptions);
    expect(edgeList(nodes, r, ALL_TYPES)).toEqual([
      ...KEPT.slice(0, 7),
      'CALLS Svc.run -> Impl.save', 'CONSTRUCTOR_INJECTS Svc -> Repo', 'EXTENDS Impl -> Base', 'FLOWS_TO Svc -> Impl', 'IMPLEMENTS Impl -> Repo',
      ...KEPT.slice(7),
      'RE_EXPORTS src/domain/index.ts -> ext-lib', 'RE_EXPORTS src/domain/index.ts -> src/domain/base.ts', 'RE_EXPORTS src/domain/index.ts -> src/domain/repo.ts',
    ].sort());
    expect(r.packageNodes.map((n) => n.name)).toEqual(['ext-lib', 'fs']);
  });

  it('ast-only: exactly the IMPORTS, DECLARES and CONTAINS edges of the full graph (10), alias and barrel resolution kept', () => {
    const { nodes, r } = run(all, 'ast-only', aliasOptions);
    expect(edgeList(nodes, r, ALL_TYPES)).toEqual(KEPT);
    expect(r.packageNodes.map((n) => n.name)).toEqual(['fs']);
  });

  it('ast-only: the import-resolution counts equal the full extraction (resolution is not ablated)', () => {
    const full = run(all, 'full', aliasOptions).r;
    const ast = run(all, 'ast-only', aliasOptions).r;
    expect(ast.importResolution).toEqual(full.importResolution);
    expect(full.importResolution).toMatchObject({ resolvedInternal: 3, external: 2, unresolved: 0 });
  });

  it('ast-only edges are the full edges filtered, in the same order and with the same ids', () => {
    const full = run(all, 'full', aliasOptions).r;
    const ast = run(all, 'ast-only', aliasOptions).r;
    expect(ast.edges).toEqual(full.edges.filter((e) => (AST_ONLY_EDGE_TYPES as readonly string[]).includes(e.type)));
  });

  it('the two arms differ on this fixture (8 edges removed), so the ablation can show a loss', () => {
    const full = run(all, 'full', aliasOptions).r;
    const ast = run(all, 'ast-only', aliasOptions).r;
    expect(full.edges.length - ast.edges.length).toBe(8);
  });

  it('the harness graph modes equal the C1 graph modes (BR-U5b-55 keeps them apart)', () => {
    expect([...PLAN_GRAPH_MODES]).toEqual([...GRAPH_MODES]);
  });
});

describe('restrictToGraphMode (pure)', () => {
  const e = (id: string, type: EdgeType, targetId: string): APGEdge => ({ id, type, sourceId: 's', targetId, properties: {} });
  const pkg = (id: string): APGNode => ({ id, type: 'Package', name: id, properties: {} }) as unknown as APGNode;
  const view = {
    edges: [e('1', 'IMPORTS', 'p1'), e('2', 'RE_EXPORTS', 'p2'), e('3', 'CALLS', 'm'), e('4', 'CONTAINS', 'm'), e('5', 'DECLARES', 'c'), e('6', 'FLOWS_TO', 'c')],
    packageNodes: [pkg('p1'), pkg('p2')],
  };

  it('full returns the view unchanged', () => {
    expect(restrictToGraphMode(view, 'full')).toBe(view);
    expect(edgeTypesOf('full')).toBeUndefined();
  });

  it('ast-only keeps edges 1, 4, 5 in order and the Package a kept edge targets', () => {
    const r = restrictToGraphMode(view, 'ast-only');
    expect(r.edges.map((x) => x.id)).toEqual(['1', '4', '5']);
    expect(r.packageNodes.map((n) => n.id)).toEqual(['p1']);
  });

  it('the allow-list is the register\'s: IMPORTS, DECLARES, CONTAINS', () => {
    expect([...AST_ONLY_EDGE_TYPES]).toEqual(['IMPORTS', 'DECLARES', 'CONTAINS']);
    expect(edgeTypesOf('ast-only')).toBe(AST_ONLY_EDGE_TYPES);
  });
});
