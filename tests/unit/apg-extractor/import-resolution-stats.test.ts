import { resolve } from 'node:path';
import { Node, Project } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import { extractAPG } from '../../../src/apg-extractor/apg-extractor.js';
import { extractNodes } from '../../../src/apg-extractor/node-extractor.js';
import { extractEdges } from '../../../src/apg-extractor/edge-extractor.js';
import type { EdgeExtractionResult } from '../../../src/apg-extractor/edge-extractor.js';
import { importEqualsSpecifier } from '../../../src/apg-extractor/import-resolver.js';
import type { APGEdge, APGNode, ImportResolutionStats } from '../../../src/shared/types/apg.js';

const ROOT = '/proj';
const ALIAS_ROOT = resolve(__dirname, '../../../fixtures/unit/u2-alias');

/** Files under `/proj`, not under `node_modules`, not `.d.ts`: the set `extractAPG` would keep. */
function nodeFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter(sf => {
    const p = sf.getFilePath();
    return p.startsWith(`${ROOT}/`) && !p.includes('/node_modules/') && !p.endsWith('.d.ts');
  });
}

interface Run extends EdgeExtractionResult {
  readonly nodes: readonly APGNode[];
  readonly sourceFiles: readonly SourceFile[];
}

function run(files: Record<string, string>): Run {
  const project = new Project({ useInMemoryFileSystem: true, skipFileDependencyResolution: true, compilerOptions: { strict: false } });
  for (const [fp, content] of Object.entries(files)) project.createSourceFile(fp, content);
  const sourceFiles = nodeFiles(project);
  const { nodes, lookup } = extractNodes(sourceFiles, ROOT);
  return { ...extractEdges(sourceFiles, lookup, ROOT), nodes, sourceFiles };
}

/** Counted statements (BR-U2-14): import declarations, `import x = require()`, `export … from`. */
function countedStatements(sourceFiles: readonly SourceFile[]): number {
  let n = 0;
  for (const sf of sourceFiles) {
    for (const stmt of sf.getStatements()) {
      if (Node.isImportDeclaration(stmt)) n++;
      else if (Node.isImportEqualsDeclaration(stmt) && importEqualsSpecifier(stmt) !== undefined) n++;
      else if (Node.isExportDeclaration(stmt) && stmt.getModuleSpecifierValue() !== undefined) n++;
    }
  }
  return n;
}

function partitionSum(s: ImportResolutionStats): number {
  return s.resolvedInternal + s.external + s.unresolved + s.droppedNoFileNode;
}

function pathOf(r: { nodes: readonly APGNode[] }, id: string): string {
  const node = r.nodes.find(n => n.id === id);
  return node === undefined ? '?' : node.type === 'Package' ? `pkg:${node.name}` : node.filePath;
}

function edgeView(r: Run, e: APGEdge): string {
  return `${e.type} ${pathOf(r, e.sourceId)} -> ${pathOf({ nodes: [...r.nodes, ...r.packageNodes] }, e.targetId)}`;
}

const F_BARREL = {
  '/proj/src/application/a.ts': 'export class A {}',
  '/proj/src/infrastructure/i.ts': 'export class I {}',
  '/proj/src/application/index.ts': "export { A } from './a';\nexport { I } from '../infrastructure/i';",
  '/proj/src/presentation/p.ts': "import { A, I } from '../application';",
};
const F_BARREL_UNRESOLVED = {
  '/proj/src/index.ts': "export { Z } from './missing';",
  '/proj/src/p.ts': "import { Z } from './index';",
};
const F_SPLIT = {
  '/proj/src/a.ts': 'export class A {}',
  '/proj/src/index.ts': "export { A } from './a';\nexport { Router } from 'express';",
  '/proj/src/p.ts': "import { Router, A } from './index';",
};
const F_DUP = {
  '/proj/src/x/index.ts': 'export class A {}\nexport class B {}',
  '/proj/src/p.ts': "// dup\nimport { B } from './x/index';\nconst k = 1;\n\nimport type { A } from './x';\nexport const used = [k];",
};
const F_EXCL = {
  '/proj/src/types.d.ts': 'export interface T {}',
  '/outside.ts': 'export const o = 1;',
  '/proj/node_modules/left-pad/index.ts': 'export default 1;',
  '/proj/src/a.ts': "import { T } from './types.d';\nimport '../../outside';\nimport lp from '../node_modules/left-pad/index';\nimport './missing';",
};
const F_BUILTIN = { '/proj/src/b.ts': "import 'fs';\nimport x from 'node:fs';\nimport y from 'fs/promises';\nimport p from 'punycode';" };
const F_DYN = {
  '/proj/src/dyn.ts': "export async function f() {\n  await import('./a');\n  await import('./b');\n  return [require('./c'), require.resolve('./d')];\n}\nlet t: import('./x').T;",
};
const F_PKG = { '/proj/src/domain/x.ts': "import express from 'express';\nexport const app = express;" };

describe('importResolution partition (BR-U2-14)', () => {
  it.each([
    ['F-BARREL', F_BARREL], ['F-BARREL unresolved hop', F_BARREL_UNRESOLVED], ['F-SPLIT', F_SPLIT], ['F-DUP', F_DUP],
    ['F-EXCL', F_EXCL], ['F-BUILTIN', F_BUILTIN], ['F-DYN', F_DYN], ['F-PKG', F_PKG],
  ])('%s: the four counters sum to the counted statements; 0 ≤ externalOutOfRootAlias ≤ external', (_name, files) => {
    const r = run(files);
    expect(partitionSum(r.importResolution)).toBe(countedStatements(r.sourceFiles));
    expect(r.importResolution.externalOutOfRootAlias).toBeGreaterThanOrEqual(0);
    expect(r.importResolution.externalOutOfRootAlias).toBeLessThanOrEqual(r.importResolution.external);
  });

  it('F-EXCL: dropped, external and unresolved statements each count once', () => {
    const r = run(F_EXCL);
    expect(r.importResolution).toEqual({
      resolvedInternal: 0, external: 1, externalOutOfRootAlias: 0, unresolved: 1, droppedNoFileNode: 2, unsupportedDynamic: 0,
    });
    expect(r.warnings.map(w => w.code)).toEqual(['EXTRACTOR_008', 'EXTRACTOR_008', 'EXTRACTOR_002']);
    expect(r.edges.filter(e => e.type === 'IMPORTS').map(e => edgeView(r, e))).toEqual(['IMPORTS src/a.ts -> pkg:left-pad']);
  });

  it('a statement split into one File and one Package target counts once, as resolvedInternal', () => {
    const r = run(F_SPLIT);
    const pFile = 'src/p.ts';
    expect(r.edges.filter(e => e.type === 'IMPORTS' && pathOf(r, e.sourceId) === pFile).map(e => edgeView(r, e)))
      .toEqual(['IMPORTS src/p.ts -> pkg:express', 'IMPORTS src/p.ts -> src/a.ts']);
    // p.ts: 1 resolvedInternal; index.ts: one File re-export (resolvedInternal) and one Package re-export (external).
    expect(r.importResolution).toMatchObject({ resolvedInternal: 2, external: 1, unresolved: 0, droppedNoFileNode: 0 });
  });

  it('F-DYN: unsupportedDynamic counts call occurrences outside the partition, one EXTRACTOR_009 per file', () => {
    const r = run(F_DYN);
    expect(r.importResolution.unsupportedDynamic).toBe(3);
    expect(partitionSum(r.importResolution)).toBe(0);
    expect(r.warnings).toEqual([{ filePath: 'src/dyn.ts', code: 'EXTRACTOR_009', message: 'Unsupported dynamic import(s): 3' }]);
  });
});

describe('extractEdges wiring (BR-U2-03, 15, 17..24)', () => {
  it('F-PKG: Package express, File → Package IMPORTS edge, external 1', () => {
    const r = run(F_PKG);
    expect(r.packageNodes).toEqual([{
      id: expect.any(String) as string, type: 'Package', name: 'express', filePath: '', decorators: [], properties: { scope: 'npm' },
    }]);
    expect(r.edges.filter(e => e.type === 'IMPORTS').map(e => edgeView(r, e))).toEqual(['IMPORTS src/domain/x.ts -> pkg:express']);
    expect(r.importResolution).toMatchObject({ resolvedInternal: 0, external: 1, unresolved: 0, droppedNoFileNode: 0 });
  });

  it('BR-U2-03: fs, node:fs and fs/promises → one Package fs and one merged IMPORTS edge with three specifiers', () => {
    const r = run(F_BUILTIN);
    expect(r.packageNodes.map(n => `${n.name}:${String(n.properties.scope)}`)).toEqual(['fs:node', 'punycode:node']);
    const fsEdge = r.edges.find(e => e.type === 'IMPORTS' && e.targetId === r.packageNodes[0]?.id);
    expect(fsEdge?.properties).toEqual({
      specifier: 'fs', specifiers: ['fs', 'node:fs', 'fs/promises'], line: 1, lines: [1, 2, 3], isTypeOnly: false, importedNames: ['default'],
    });
    expect(r.edges.filter(e => e.type === 'IMPORTS')).toHaveLength(2);
  });

  it('F-DUP: two statements to one target merge into one edge (BR-U2-18..21)', () => {
    const r = run(F_DUP);
    const imports = r.edges.filter(e => e.type === 'IMPORTS');
    expect(imports).toHaveLength(1);
    expect(imports[0]?.properties).toEqual({
      specifier: './x/index', specifiers: ['./x/index', './x'], line: 2, lines: [2, 5], isTypeOnly: false, importedNames: ['A', 'B'],
    });
  });

  it('BR-U2-24 on F-BARREL: two per-name IMPORTS and two RE_EXPORTS from index.ts; IMPORTS first', () => {
    const r = run(F_BARREL);
    expect(r.edges.filter(e => e.type === 'IMPORTS' || e.type === 'RE_EXPORTS').map(e => edgeView(r, e))).toEqual([
      'IMPORTS src/presentation/p.ts -> src/application/a.ts',
      'IMPORTS src/presentation/p.ts -> src/infrastructure/i.ts',
      'RE_EXPORTS src/application/index.ts -> src/application/a.ts',
      'RE_EXPORTS src/application/index.ts -> src/infrastructure/i.ts',
    ]);
    const firstOther = r.edges.findIndex(e => e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS');
    expect(firstOther).toBe(4);
    expect(r.importResolution).toMatchObject({ resolvedInternal: 3, external: 0, unresolved: 0, droppedNoFileNode: 0 });
  });

  it('BR-U2-17: an import and an export … from of the same module yield one IMPORTS and one RE_EXPORTS edge, different ids', () => {
    const r = run({ '/proj/src/a.ts': 'export class A {}', '/proj/src/b.ts': "import { A } from './a';\nexport { A } from './a';\nexport const k = A;" });
    const pair = r.edges.filter(e => e.type === 'IMPORTS' || e.type === 'RE_EXPORTS');
    expect(pair.map(e => e.type)).toEqual(['IMPORTS', 'RE_EXPORTS']);
    expect(pair[0]?.id).not.toBe(pair[1]?.id);
  });

  it('S-9a through extractEdges: one EXTRACTOR_002 attributed to index.ts; the p.ts statement counts resolvedInternal', () => {
    const r = run(F_BARREL_UNRESOLVED);
    expect(r.warnings).toEqual([{ filePath: 'src/index.ts', code: 'EXTRACTOR_002', message: 'Unresolvable import: ./missing' }]);
    expect(r.edges.filter(e => e.type === 'IMPORTS').map(e => edgeView(r, e))).toEqual(['IMPORTS src/p.ts -> src/index.ts']);
    expect(r.importResolution).toMatchObject({ resolvedInternal: 1, unresolved: 1 });
  });

  it('an empty source file list gives an empty result', () => {
    const { lookup } = extractNodes([], ROOT);
    expect(extractEdges([], lookup, ROOT)).toEqual({
      edges: [], warnings: [], packageNodes: [],
      importResolution: { resolvedInternal: 0, external: 0, externalOutOfRootAlias: 0, unresolved: 0, droppedNoFileNode: 0, unsupportedDynamic: 0 },
      flowsTo: { stores: 0, candidates: 0, skippedUnionOrIntersection: 0, skippedUnextractedTarget: 0, skippedSelfLoop: 0, edges: 0 },
    });
  });
});

describe('extractAPG on F-ALIAS (BR-U2-07..11, 22, 26)', () => {
  it('counts, Package nodes and warnings', async () => {
    const result = await extractAPG(ALIAS_ROOT);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // BR-U2-26: no warnings at the DomainResult level; extractor codes stay in data.warnings.
    expect(result.warnings).toBeUndefined();
    expect(result.data.warnings.map(w => `${w.filePath} ${w.code} ${w.message}`)).toEqual([
      'src/presentation/main.ts EXTRACTOR_002 Unresolvable import: @app/missing',
      'src/presentation/main.ts EXTRACTOR_002 Unresolvable import: src/missing',
    ]);
    expect(result.data.importResolution).toEqual({
      resolvedInternal: 4, external: 3, externalOutOfRootAlias: 1, unresolved: 2, droppedNoFileNode: 0, unsupportedDynamic: 0,
    });
    const packages = result.data.nodes.filter(n => n.type === 'Package');
    expect(packages.map(n => `${n.name}:${String(n.properties.scope)}`)).toEqual(['@internal/pg:@internal', '@libs/x:@libs', 'config:npm']);
    // Package nodes come after every extracted node.
    const firstPackage = result.data.nodes.findIndex(n => n.type === 'Package');
    expect(result.data.nodes.slice(firstPackage).every(n => n.type === 'Package')).toBe(true);
  }, 30_000);

  it("BR-U2-22: export * from 'src/domain/x' yields one RE_EXPORTS edge to the File, no Package src", async () => {
    const result = await extractAPG(ALIAS_ROOT);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const byId = new Map(result.data.nodes.map(n => [n.id, n]));
    const reExports = result.data.edges.filter(e => e.type === 'RE_EXPORTS');
    expect(reExports.map(e => [byId.get(e.sourceId)?.filePath, byId.get(e.targetId)?.type, byId.get(e.targetId)?.filePath, e.properties.exportedNames]))
      .toEqual([['src/shared/reexport.ts', 'File', 'src/domain/x.ts', ['*']]]);
    expect(result.data.nodes.some(n => n.type === 'Package' && n.name === 'src')).toBe(false);
    const imports = result.data.edges.filter(e => e.type === 'IMPORTS').map(e => `${String(byId.get(e.targetId)?.type)}:${String(byId.get(e.targetId)?.type === 'Package' ? byId.get(e.targetId)?.name : byId.get(e.targetId)?.filePath)}`);
    expect(imports).toEqual(['File:src/domain/x.ts', 'File:src/domain/y.ts', 'Package:@libs/x', 'Package:config', 'Package:@internal/pg']);
  }, 30_000);
});
