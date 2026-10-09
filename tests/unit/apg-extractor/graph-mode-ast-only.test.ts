/**
 * ADR-021 SO2; audit SO2-4, SO2-5, X-2: FLOWS_TO store accounting and the `ast-only` graph mode (no FLOWS_TO, no
 * RE_EXPORTS, no alias resolution: no `paths` / `baseUrl`, no barrel following).
 */
import { Project } from 'ts-morph';
import { extractNodes } from '../../../src/apg-extractor/node-extractor.js';
import { extractEdges } from '../../../src/apg-extractor/edge-extractor.js';
import { withoutAliasResolution } from '../../../src/apg-extractor/import-resolver.js';
import type { EdgeExtractionResult } from '../../../src/apg-extractor/edge-extractor.js';
import type { GraphMode } from '../../../src/apg-extractor/types.js';
import { GRAPH_MODES } from '../../../src/apg-extractor/types.js';
import { PLAN_GRAPH_MODES } from '../../../scripts/run-experiment.js';
import type { APGNode } from '../../../src/shared/types/apg.js';

const ROOT = '/proj';
const lines = (...ls: string[]): string => ls.join('\n');

function run(files: Record<string, string>, graphMode: GraphMode, compilerOptions: Record<string, unknown> = {}): { nodes: APGNode[]; r: EdgeExtractionResult } {
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

  it('the ast-only mode derives no FLOWS_TO edge and counts no store', () => {
    const { nodes, r } = run(files, 'ast-only');
    expect(edgeList(nodes, r, ['FLOWS_TO'])).toEqual([]);
    expect(r.flowsTo.stores).toBe(0);
  });
});

describe('ast-only graph mode (audit SO2-5, X-2)', () => {
  const barrel = {
    '/proj/src/a.ts': 'export class A {}',
    '/proj/src/index.ts': "export { A } from './a';",
    '/proj/src/b.ts': lines("import { A } from './index';", 'export class B { a?: A; }'),
  };

  it('full: the import follows the barrel to a.ts and the re-export is a RE_EXPORTS edge', () => {
    const { nodes, r } = run(barrel, 'full');
    expect(edgeList(nodes, r, ['IMPORTS', 'RE_EXPORTS'])).toEqual(['IMPORTS src/b.ts -> src/a.ts', 'RE_EXPORTS src/index.ts -> src/a.ts']);
    expect(r.importResolution.resolvedInternal).toBe(2);
  });

  it('ast-only: the import targets the barrel file, no RE_EXPORTS edge, the re-export statement is not counted', () => {
    const { nodes, r } = run(barrel, 'ast-only');
    expect(edgeList(nodes, r, ['IMPORTS', 'RE_EXPORTS'])).toEqual(['IMPORTS src/b.ts -> src/index.ts']);
    expect(r.importResolution.resolvedInternal).toBe(1);
  });

  const aliased = {
    '/proj/src/domain/a.ts': 'export class A {}',
    '/proj/src/app/b.ts': lines("import { A } from '@app/domain/a';", 'export class B { a?: A; }'),
  };
  const aliasOptions = { baseUrl: '/proj', paths: { '@app/*': ['src/*'] } };

  it('full: a `paths` alias resolves to the project file', () => {
    const { nodes, r } = run(aliased, 'full', aliasOptions);
    expect(edgeList(nodes, r, ['IMPORTS'])).toEqual(['IMPORTS src/app/b.ts -> src/domain/a.ts']);
    expect(r.importResolution).toMatchObject({ resolvedInternal: 1, external: 0 });
  });

  it('ast-only: the alias is not resolved and becomes a bare Package import (external)', () => {
    const { nodes, r } = run(aliased, 'ast-only', aliasOptions);
    expect(edgeList(nodes, r, ['IMPORTS'])).toEqual(['IMPORTS src/app/b.ts -> @app/domain']);
    expect(r.importResolution).toMatchObject({ resolvedInternal: 0, external: 1 });
  });

  it('withoutAliasResolution drops paths, baseUrl and pathsBasePath only', () => {
    const options = { baseUrl: '/p', paths: { '@x/*': ['x/*'] }, strict: true, pathsBasePath: '/p' };
    expect(withoutAliasResolution(options)).toEqual({ strict: true });
  });

  it('the harness graph modes equal the C1 graph modes (BR-U5b-55 keeps them apart)', () => {
    expect([...PLAN_GRAPH_MODES]).toEqual([...GRAPH_MODES]);
  });
});
