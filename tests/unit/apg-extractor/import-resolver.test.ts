import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Node, Project, ts } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import { extractNodes } from '../../../src/apg-extractor/node-extractor.js';
import {
  buildImportResolutionContext,
  classifySpecifier,
  countUnsupportedDynamicImports,
  resolveImportTargets,
  resolveModule,
  resolveReExportTargets,
} from '../../../src/apg-extractor/import-resolver.js';
import type {
  ImportResolutionContext,
  ModuleResolution,
  StatementResolution,
} from '../../../src/apg-extractor/import-resolver.js';
import { PackageNodeRegistry } from '../../../src/apg-extractor/package-node-factory.js';
import type { ExtractorOptions } from '../../../src/apg-extractor/types.js';

interface Warning { filePath: string; code: string; message: string }

interface Harness {
  project: Project;
  ctx: ImportResolutionContext;
  warnings: Warning[];
  sf: (path: string) => SourceFile;
}

function harness(project: Project, root: string, nodeFiles: SourceFile[], opts: ExtractorOptions = {}): Harness {
  const warnings: Warning[] = [];
  const { lookup } = extractNodes(nodeFiles, root);
  const ctx = buildImportResolutionContext(
    project, lookup, root, opts,
    (filePath, code, message) => { warnings.push({ filePath, code, message }); },
    new PackageNodeRegistry(),
  );
  return { project, ctx, warnings, sf: p => project.getSourceFileOrThrow(p) };
}

/** In-memory project; files under a `node_modules` segment or ending in `.d.ts`, or outside `/proj`, get no File node. */
function memory(files: Record<string, string>, compilerOptions: ts.CompilerOptions = {}, opts: ExtractorOptions = {}): Harness {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    compilerOptions: { strict: false, ...compilerOptions },
  });
  for (const [fp, content] of Object.entries(files)) project.createSourceFile(fp, content);
  const nodeFiles = project.getSourceFiles().filter(sf => {
    const p = sf.getFilePath();
    return p.startsWith('/proj/') && !p.includes('/node_modules/') && !p.endsWith('.d.ts');
  });
  return harness(project, '/proj', nodeFiles, opts);
}

const ALIAS_ROOT = resolve(__dirname, '../../../fixtures/unit/u2-alias');
const ALIAS_MAIN = join(ALIAS_ROOT, 'src/presentation/main.ts');

/** F-ALIAS, built the way `extractAPG` builds its project. */
function aliasFixture(): Harness {
  const project = new Project({
    tsConfigFilePath: join(ALIAS_ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
    skipFileDependencyResolution: true,
  });
  return harness(project, ALIAS_ROOT, project.getSourceFiles());
}

function pkg(r: ModuleResolution): { name: string; scope: string; outOfRootAlias: boolean } | undefined {
  return r.kind === 'package' ? { name: r.root.name, scope: r.root.scope, outOfRootAlias: r.outOfRootAlias } : undefined;
}

describe('classifySpecifier (BR-U2-01)', () => {
  it.each([
    ['node:fs/promises', 'node-builtin'],
    ['fs', 'node-builtin'],
    ['punycode', 'node-builtin'],
    ['./a', 'relative'],
    ['../a', 'relative'],
    ['/abs', 'relative'],
    ['express', 'alias-or-bare'],
    ['@nestjs/common', 'alias-or-bare'],
    ['~/x', 'alias-or-bare'],
    ['#internal/x', 'alias-or-bare'],
    ['src/x', 'alias-or-bare'],
  ])('%s → %s', (specifier, expected) => {
    expect(classifySpecifier(specifier)).toBe(expected);
  });
});

describe('resolveModule — in-memory cases', () => {
  it('built-ins map to one node-scoped Package without the node: prefix (BR-U2-03)', () => {
    const h = memory({ '/proj/src/a.ts': 'export const a = 1;' });
    for (const spec of ['node:fs', 'fs', 'fs/promises', 'node:fs/promises']) {
      expect(pkg(resolveModule(spec, h.sf('/proj/src/a.ts'), h.ctx))).toEqual({ name: 'fs', scope: 'node', outOfRootAlias: false });
    }
    expect(h.warnings).toEqual([]);
  });

  it('a relative project import resolves to the project file', () => {
    const h = memory({ '/proj/src/a.ts': "import { B } from './b';", '/proj/src/b.ts': 'export class B {}' });
    const r = resolveModule('./b', h.sf('/proj/src/a.ts'), h.ctx);
    expect(r.kind).toBe('project-file');
    if (r.kind === 'project-file') {
      expect(r.sourceFile.getFilePath()).toBe('/proj/src/b.ts');
      expect(r.fileNodeId).toBe(h.ctx.lookup.fileNodes.get('src/b.ts'));
    }
  });

  it('BR-U2-09 (S-4): a relative import into node_modules is a Package named from the path, no EXTRACTOR_008', () => {
    const h = memory({
      '/proj/src/a.ts': "import x from '../node_modules/left-pad/index';",
      '/proj/node_modules/left-pad/index.ts': 'export default 1;',
    });
    const r = resolveModule('../node_modules/left-pad/index', h.sf('/proj/src/a.ts'), h.ctx);
    expect(pkg(r)).toEqual({ name: 'left-pad', scope: 'npm', outOfRootAlias: false });
    expect(h.warnings).toEqual([]);
  });

  it('BR-U2-09 (S-4): a scoped package path keeps two segments', () => {
    const h = memory({
      '/proj/src/a.ts': "import x from '../node_modules/@acme/pad/lib/index';",
      '/proj/node_modules/@acme/pad/lib/index.ts': 'export default 1;',
    });
    expect(pkg(resolveModule('../node_modules/@acme/pad/lib/index', h.sf('/proj/src/a.ts'), h.ctx)))
      .toEqual({ name: '@acme/pad', scope: '@acme', outOfRootAlias: false });
  });

  it('BR-U2-11: a bare specifier that is not installed is a Package', () => {
    const h = memory({ '/proj/src/a.ts': "import lp from 'left-pad';" });
    expect(pkg(resolveModule('left-pad', h.sf('/proj/src/a.ts'), h.ctx))).toEqual({ name: 'left-pad', scope: 'npm', outOfRootAlias: false });
    expect(pkg(resolveModule('@nestjs/common/decorators', h.sf('/proj/src/a.ts'), h.ctx)))
      .toEqual({ name: '@nestjs/common', scope: '@nestjs', outOfRootAlias: false });
    expect(h.warnings).toEqual([]);
  });

  it('BR-U2-05: a bare specifier resolving into node_modules is named from the specifier', () => {
    const h = memory({
      '/proj/src/a.ts': "import fp from 'lodash/fp';",
      '/proj/node_modules/lodash/fp.ts': 'export default 1;',
    });
    expect(pkg(resolveModule('lodash/fp', h.sf('/proj/src/a.ts'), h.ctx))).toEqual({ name: 'lodash', scope: 'npm', outOfRootAlias: false });
  });

  it('BR-U2-12: an unresolvable relative import keeps EXTRACTOR_002 with the unchanged message', () => {
    const h = memory({ '/proj/src/a.ts': "import './missing';" });
    expect(resolveModule('./missing', h.sf('/proj/src/a.ts'), h.ctx)).toEqual({ kind: 'unresolved' });
    expect(h.warnings).toEqual([{ filePath: 'src/a.ts', code: 'EXTRACTOR_002', message: 'Unresolvable import: ./missing' }]);
  });

  it('warnUnresolved: false suppresses EXTRACTOR_002 (S-9a hops)', () => {
    const h = memory({ '/proj/src/a.ts': "import './missing';" });
    expect(resolveModule('./missing', h.sf('/proj/src/a.ts'), h.ctx, { warnUnresolved: false })).toEqual({ kind: 'unresolved' });
    expect(h.warnings).toEqual([]);
  });

  it('BR-U2-13: a .d.ts target has no File node → no-file-node with EXTRACTOR_008', () => {
    const h = memory({ '/proj/src/a.ts': "import { T } from './types.d';", '/proj/src/types.d.ts': 'export interface T {}' });
    expect(resolveModule('./types.d', h.sf('/proj/src/a.ts'), h.ctx)).toEqual({ kind: 'no-file-node', reason: 'excluded-or-skipped' });
    expect(h.warnings).toEqual([{ filePath: 'src/a.ts', code: 'EXTRACTOR_008', message: 'Import target outside the extracted set: ./types.d' }]);
  });

  it('BR-U2-13: a relative import leaving the root → no-file-node outside-root, no absolute path in the message', () => {
    const h = memory({ '/proj/src/a.ts': "import '../../outside';", '/outside.ts': 'export const o = 1;' });
    expect(resolveModule('../../outside', h.sf('/proj/src/a.ts'), h.ctx)).toEqual({ kind: 'no-file-node', reason: 'outside-root' });
    expect(h.warnings).toEqual([{ filePath: 'src/a.ts', code: 'EXTRACTOR_008', message: 'Import target outside the extracted set: ../../outside' }]);
    expect(h.warnings.some(w => w.message.includes('/outside.ts'))).toBe(false);
  });

  it('isInstalledPackage walks ancestors on the module-resolution host', () => {
    const h = memory({ '/proj/src/deep/a.ts': 'export const a = 1;', '/proj/node_modules/left-pad/package.json': '{}' });
    expect(h.ctx.isInstalledPackage('/proj/src/deep', 'left-pad')).toBe(true);
    expect(h.ctx.isInstalledPackage('/proj/src/deep', 'right-pad')).toBe(false);
  });
});

describe('resolveModule — F-ALIAS on-disk fixture', () => {
  let h: Harness;
  let main: SourceFile;
  beforeAll(() => {
    h = aliasFixture();
    main = h.sf(ALIAS_MAIN);
  });
  beforeEach(() => { h.warnings.length = 0; });

  it('the fixture is built from its own tsconfig', () => {
    expect(h.ctx.aliasRules.map(r => `${r.kind}:${r.kind === 'paths' ? r.key : '<baseUrl>'}:${String(r.targetsIntoNodeModules)}`)).toEqual([
      'paths:@internal/pg:true', 'paths:@libs/*:false', 'paths:@app/*:false', 'paths:~/*:false', 'baseUrl:<baseUrl>:false',
    ]);
  });

  it('BR-U2-07: paths and baseUrl imports resolve to project files', () => {
    for (const [spec, file] of [['@app/domain/x', 'src/domain/x.ts'], ['src/domain/y', 'src/domain/y.ts'], ['~/domain/x', 'src/domain/x.ts']] as const) {
      const r = resolveModule(spec, main, h.ctx);
      expect(r.kind).toBe('project-file');
      if (r.kind === 'project-file') expect(r.fileNodeId).toBe(h.ctx.lookup.fileNodes.get(file));
    }
    expect(h.warnings).toEqual([]);
  });

  it('BR-U2-08: an alias resolving outside the root is a Package named by the alias, outOfRootAlias true', () => {
    expect(existsSync(resolve(ALIAS_ROOT, '../u2-alias-libs/x.ts'))).toBe(true);
    expect(pkg(resolveModule('@libs/x', main, h.ctx))).toEqual({ name: '@libs/x', scope: '@libs', outOfRootAlias: true });
    expect(h.warnings).toEqual([]);
  });

  it('BR-U2-09: a paths rule into node_modules with nothing installed is a Package, no EXTRACTOR_002', () => {
    expect(pkg(resolveModule('@internal/pg', main, h.ctx))).toEqual({ name: '@internal/pg', scope: '@internal', outOfRootAlias: false });
    expect(h.warnings).toEqual([]);
  });

  it('BR-U2-10: an installed package shadowed by a baseUrl directory is a Package, no EXTRACTOR_002', () => {
    // Guards: TypeScript does not resolve `config` (else BR-U2-09 would answer), and the shadowing directory exists.
    expect(ts.resolveModuleName('config', ALIAS_MAIN, h.project.getCompilerOptions(), h.project.getModuleResolutionHost()).resolvedModule).toBeUndefined();
    expect(existsSync(join(ALIAS_ROOT, 'config'))).toBe(true);
    expect(pkg(resolveModule('config', main, h.ctx))).toEqual({ name: 'config', scope: 'npm', outOfRootAlias: false });
    expect(h.warnings).toEqual([]);
  });

  it('isInstalledPackage: true from src/ for config, false for left-pad', () => {
    expect(h.ctx.isInstalledPackage(dirname(ALIAS_MAIN), 'config')).toBe(true);
    expect(h.ctx.isInstalledPackage(dirname(ALIAS_MAIN), 'left-pad')).toBe(false);
  });

  it('BR-U2-11: unresolved project aliases are EXTRACTOR_002, no Package src', () => {
    expect(resolveModule('@app/missing', main, h.ctx)).toEqual({ kind: 'unresolved' });
    expect(resolveModule('src/missing', main, h.ctx)).toEqual({ kind: 'unresolved' });
    expect(h.warnings.map(w => `${w.code} ${w.message}`)).toEqual([
      'EXTRACTOR_002 Unresolvable import: @app/missing',
      'EXTRACTOR_002 Unresolvable import: src/missing',
    ]);
    expect(h.ctx.packages.nodes()).toEqual([]);
  });
});

// ── Step 8: statement resolution (BR-U2-15, 16, 20, 22..25; S-3, S-9) ────────

/** Resolves every import / `import x = require()` / `export … from` statement of one file, in source order. */
function statements(h: Harness, path: string): StatementResolution[] {
  const out: StatementResolution[] = [];
  for (const stmt of h.sf(path).getStatements()) {
    if (Node.isImportDeclaration(stmt) || Node.isImportEqualsDeclaration(stmt)) out.push(resolveImportTargets(stmt, h.ctx));
    else if (Node.isExportDeclaration(stmt) && stmt.getModuleSpecifierValue() !== undefined) out.push(resolveReExportTargets(stmt, h.ctx));
  }
  return out;
}

/** Projection of occurrences: target as a project path or `pkg:<name>`. */
function view(h: Harness, r: StatementResolution): { edge: string; target: string; names: readonly string[]; typeOnly: boolean; line: number }[] {
  const pathOf = new Map([...h.ctx.lookup.fileNodes].map(([path, id]) => [id, path]));
  return r.occurrences.map(o => ({
    edge: o.edgeType,
    target: o.target.kind === 'file' ? (pathOf.get(o.target.fileNodeId) ?? '?') : `pkg:${o.target.root.name}`,
    names: o.names,
    typeOnly: o.isTypeOnly,
    line: o.line,
  }));
}

function only(rs: StatementResolution[]): StatementResolution {
  expect(rs).toHaveLength(1);
  const [first] = rs;
  if (first === undefined) throw new Error('no statement');
  return first;
}

const F_BARREL = {
  '/proj/src/application/a.ts': 'export class A {}',
  '/proj/src/infrastructure/i.ts': 'export class I {}',
  '/proj/src/application/index.ts': "export { A } from './a';\nexport { I } from '../infrastructure/i';",
  '/proj/src/presentation/p.ts': "import { A, I } from '../application';",
};

describe('resolveImportTargets — per-name barrel resolution (BR-U2-24, FR-34 acceptance)', () => {
  it('F-BARREL: one IMPORTS occurrence per declaring file, none to index.ts', () => {
    const h = memory(F_BARREL);
    const r = only(statements(h, '/proj/src/presentation/p.ts'));
    expect(r.outcome).toBe('resolvedInternal');
    expect(view(h, r)).toEqual([
      { edge: 'IMPORTS', target: 'src/application/a.ts', names: ['A'], typeOnly: false, line: 1 },
      { edge: 'IMPORTS', target: 'src/infrastructure/i.ts', names: ['I'], typeOnly: false, line: 1 },
    ]);
    expect(h.warnings).toEqual([]);
  });

  it('F-BARREL: the barrel yields two RE_EXPORTS occurrences to the modules it names', () => {
    const h = memory(F_BARREL);
    expect(statements(h, '/proj/src/application/index.ts').flatMap(r => view(h, r))).toEqual([
      { edge: 'RE_EXPORTS', target: 'src/application/a.ts', names: ['A'], typeOnly: false, line: 1 },
      { edge: 'RE_EXPORTS', target: 'src/infrastructure/i.ts', names: ['I'], typeOnly: false, line: 2 },
    ]);
  });

  it('namespace and side-effect imports of a barrel target the module file', () => {
    const h = memory({ ...F_BARREL, '/proj/src/presentation/q.ts': "import * as app from '../application';\nimport '../application';" });
    expect(statements(h, '/proj/src/presentation/q.ts').flatMap(r => view(h, r))).toEqual([
      { edge: 'IMPORTS', target: 'src/application/index.ts', names: ['*'], typeOnly: false, line: 1 },
      { edge: 'IMPORTS', target: 'src/application/index.ts', names: [], typeOnly: false, line: 2 },
    ]);
  });

  it('a default import follows to the declaring file', () => {
    const h = memory({
      '/proj/src/d.ts': 'export default class D {}',
      '/proj/src/barrel.ts': "export { default } from './d';",
      '/proj/src/p.ts': "import D from './barrel';",
    });
    expect(view(h, only(statements(h, '/proj/src/p.ts')))).toEqual([
      { edge: 'IMPORTS', target: 'src/d.ts', names: ['default'], typeOnly: false, line: 1 },
    ]);
  });

  it('a name re-exported through an import and a local export is followed', () => {
    const h = memory({
      '/proj/src/a.ts': 'export class A {}',
      '/proj/src/barrel.ts': "import { A } from './a';\nexport { A };",
      '/proj/src/p.ts': "import { A } from './barrel';",
    });
    expect(view(h, only(statements(h, '/proj/src/p.ts'))).map(o => o.target)).toEqual(['src/a.ts']);
  });

  it('depth: maxBarrelDepth 1 and a two-level chain → EXTRACTOR_006, edge to the module file', () => {
    const h = memory({
      '/proj/src/a.ts': 'export class A {}',
      '/proj/src/l2.ts': "export { A } from './a';",
      '/proj/src/l1.ts': "export { A } from './l2';",
      '/proj/src/p.ts': "import { A } from './l1';",
    }, {}, { maxBarrelDepth: 1 });
    expect(view(h, only(statements(h, '/proj/src/p.ts'))).map(o => o.target)).toEqual(['src/l1.ts']);
    expect(h.warnings).toEqual([{ filePath: 'src/p.ts', code: 'EXTRACTOR_006', message: 'Barrel resolution depth exceeded: ./l1' }]);
  });

  it('the same two-level chain resolves within the default depth', () => {
    const h = memory({
      '/proj/src/a.ts': 'export class A {}',
      '/proj/src/l2.ts': "export { A } from './a';",
      '/proj/src/l1.ts': "export { A } from './l2';",
      '/proj/src/p.ts': "import { A } from './l1';",
    });
    expect(view(h, only(statements(h, '/proj/src/p.ts'))).map(o => o.target)).toEqual(['src/a.ts']);
    expect(h.warnings).toEqual([]);
  });

  it('loop → EXTRACTOR_007, edge to the module file', () => {
    const h = memory({
      '/proj/src/lb.ts': "export { L } from './lc';",
      '/proj/src/lc.ts': "export { L } from './lb';",
      '/proj/src/index.ts': "export { L } from './lb';",
      '/proj/src/p.ts': "import { L } from './index';",
    });
    expect(view(h, only(statements(h, '/proj/src/p.ts'))).map(o => o.target)).toEqual(['src/index.ts']);
    expect(h.warnings.map(w => `${w.filePath} ${w.code}`)).toEqual(['src/p.ts EXTRACTOR_007']);
  });

  it('S-9a unresolved hop: falls back to the module file, no extra warning; the barrel statement carries EXTRACTOR_002', () => {
    const h = memory({ '/proj/src/index.ts': "export { Z } from './missing';", '/proj/src/p.ts': "import { Z } from './index';" });
    const p = only(statements(h, '/proj/src/p.ts'));
    expect(p.outcome).toBe('resolvedInternal');
    expect(view(h, p).map(o => o.target)).toEqual(['src/index.ts']);
    expect(h.warnings).toEqual([]);
    const barrel = only(statements(h, '/proj/src/index.ts'));
    expect(barrel.outcome).toBe('unresolved');
    expect(barrel.occurrences).toEqual([]);
    expect(h.warnings).toEqual([{ filePath: 'src/index.ts', code: 'EXTRACTOR_002', message: 'Unresolvable import: ./missing' }]);
  });

  it('S-9a package hop: export { Router } from express → Package express', () => {
    const h = memory({ '/proj/src/index.ts': "export { Router } from 'express';", '/proj/src/p.ts': "import { Router } from './index';" });
    const p = only(statements(h, '/proj/src/p.ts'));
    expect(view(h, p)).toEqual([{ edge: 'IMPORTS', target: 'pkg:express', names: ['Router'], typeOnly: false, line: 1 }]);
    expect(p.outcome).toBe('external');
  });

  it('S-9a no-file-node hop: dropped target with EXTRACTOR_008; the statement counts droppedNoFileNode', () => {
    const h = memory({
      '/proj/src/types.d.ts': 'export interface T {}',
      '/proj/src/index.ts': "export { T } from './types.d';",
      '/proj/src/p.ts': "import { T } from './index';",
    });
    const p = only(statements(h, '/proj/src/p.ts'));
    expect(p.occurrences).toEqual([]);
    expect(p.outcome).toBe('droppedNoFileNode');
    expect(h.warnings.map(w => `${w.filePath} ${w.code}`)).toEqual(['src/index.ts EXTRACTOR_008']);
  });

  it('a split statement (File + Package) counts resolvedInternal (BR-U2-14 precedence)', () => {
    const h = memory({
      '/proj/src/a.ts': 'export class A {}',
      '/proj/src/index.ts': "export { A } from './a';\nexport { Router } from 'express';",
      '/proj/src/p.ts': "import { Router, A } from './index';",
    });
    const p = only(statements(h, '/proj/src/p.ts'));
    expect(view(h, p).map(o => o.target)).toEqual(['pkg:express', 'src/a.ts']);
    expect(p.outcome).toBe('resolvedInternal');
  });
});

describe('resolveImportTargets — order, line, names, type-only', () => {
  const ORDER = {
    '/proj/src/fa.ts': 'export class a {}',
    '/proj/src/fb.ts': 'export class b {}',
    '/proj/src/barrel.ts': "export { a } from './fa';\nexport { b } from './fb';",
    '/proj/src/p.ts': "import { b, a } from './barrel';",
  };

  it('BR-U2-15: occurrences follow the first name routed to each target; two runs are identical', () => {
    const run = (): unknown => { const h = memory(ORDER); return view(h, only(statements(h, '/proj/src/p.ts'))); };
    const first = run();
    expect((first as { target: string }[]).map(o => o.target)).toEqual(['src/fb.ts', 'src/fa.ts']);
    expect(run()).toEqual(first);
  });

  it('BR-U2-16: line is the statement start line, leading comments excluded', () => {
    const h = memory({ '/proj/src/a.ts': 'export class A {}', '/proj/src/p.ts': "// one\n// two\nimport { A } from './a';" });
    expect(view(h, only(statements(h, '/proj/src/p.ts')))[0]?.line).toBe(3);
  });

  it("BR-U2-16 (S-9b): import x = require('./m') yields one IMPORTS occurrence with ['*']", () => {
    const h = memory({ '/proj/src/m.ts': 'export const m = 1;', '/proj/src/p.ts': "import x = require('./m');\nexport const y = x;" });
    expect(view(h, only(statements(h, '/proj/src/p.ts')))).toEqual([
      { edge: 'IMPORTS', target: 'src/m.ts', names: ['*'], typeOnly: false, line: 1 },
    ]);
  });

  it('BR-U2-20: all specifiers type-marked → type-only', () => {
    const h = memory({ '/proj/src/x.ts': 'export interface A {}\nexport interface B {}', '/proj/src/p.ts': "import { type A, type B } from './x';" });
    expect(view(h, only(statements(h, '/proj/src/p.ts')))[0]?.typeOnly).toBe(true);
  });

  it('BR-U2-20: import { A, type B } from a barrel → value edge to A, type-only edge to B', () => {
    const h = memory({
      '/proj/src/fa.ts': 'export class A {}',
      '/proj/src/fb.ts': 'export interface B {}',
      '/proj/src/barrel.ts': "export { A } from './fa';\nexport { B } from './fb';",
      '/proj/src/p.ts': "import { A, type B } from './barrel';",
    });
    expect(view(h, only(statements(h, '/proj/src/p.ts'))).map(o => `${o.target}:${String(o.typeOnly)}`))
      .toEqual(['src/fa.ts:false', 'src/fb.ts:true']);
  });

  it('BR-U2-20: import type statement → type-only; side-effect → not type-only', () => {
    const h = memory({ '/proj/src/x.ts': 'export interface A {}', '/proj/src/p.ts': "import type { A } from './x';\nimport './x';" });
    expect(statements(h, '/proj/src/p.ts').flatMap(r => view(h, r)).map(o => o.typeOnly)).toEqual([true, false]);
  });

  it('BR-U2-21: names are exported-name forms (default, A for { A as B }, *)', () => {
    const h = memory({ '/proj/src/x.ts': 'export default 1;\nexport const A = 2;', '/proj/src/p.ts': "import D, { A as B } from './x';\nimport * as ns from './x';" });
    expect(statements(h, '/proj/src/p.ts').flatMap(r => view(h, r)).map(o => o.names)).toEqual([['default', 'A'], ['*']]);
  });

  it('package statement: one occurrence with every name form; outcome external', () => {
    const h = memory({ '/proj/src/p.ts': "import express, { Router as R } from 'express';\nimport 'reflect-metadata';" });
    const rs = statements(h, '/proj/src/p.ts');
    expect(rs.map(r => r.outcome)).toEqual(['external', 'external']);
    expect(rs.flatMap(r => view(h, r))).toEqual([
      { edge: 'IMPORTS', target: 'pkg:express', names: ['default', 'Router'], typeOnly: false, line: 1 },
      { edge: 'IMPORTS', target: 'pkg:reflect-metadata', names: [], typeOnly: false, line: 2 },
    ]);
  });

  it('statement outcomes: unresolved and droppedNoFileNode carry no occurrence', () => {
    const h = memory({ '/proj/src/types.d.ts': 'export interface T {}', '/proj/src/p.ts': "import './missing';\nimport { T } from './types.d';" });
    expect(statements(h, '/proj/src/p.ts').map(r => [r.outcome, r.occurrences.length])).toEqual([['unresolved', 0], ['droppedNoFileNode', 0]]);
  });

  it('F-ALIAS: the out-of-root alias statement is external with outOfRootAlias; other statements are not flagged', () => {
    const h = aliasFixture();
    const rs = statements(h, ALIAS_MAIN);
    expect(rs.map(r => `${r.outcome}${r.outOfRootAlias ? '+oor' : ''}`)).toEqual([
      'resolvedInternal', 'resolvedInternal', 'resolvedInternal', 'unresolved', 'unresolved', 'external+oor', 'external', 'external',
    ]);
  });
});

describe('resolveReExportTargets (BR-U2-22, 23; S-3)', () => {
  const A = { '/proj/src/a.ts': 'export class A {}\nexport interface T {}' };

  it('exportedNames: A for { A as B }, * for export * as ns and export *', () => {
    const h = memory({ ...A, '/proj/src/r.ts': "export { A as B } from './a';\nexport * as ns from './a';\nexport * from './a';" });
    expect(statements(h, '/proj/src/r.ts').flatMap(r => view(h, r)).map(o => o.names)).toEqual([['A'], ['*'], ['*']]);
  });

  it('isTypeOnly: export type * and export type { } are type-only; mixed specifiers are not', () => {
    const h = memory({
      ...A,
      '/proj/src/r.ts': "export type * from './a';\nexport type { T } from './a';\nexport { type T as U, A } from './a';\nexport { type T as V } from './a';",
    });
    expect(statements(h, '/proj/src/r.ts').flatMap(r => view(h, r)).map(o => o.typeOnly)).toEqual([true, true, false, true]);
  });

  it('a re-export of a package targets the Package; the barrel is not followed further', () => {
    const h = memory({
      ...A,
      '/proj/src/mid.ts': "export { A } from './a';",
      '/proj/src/r.ts': "export { Router } from 'express';\nexport { A } from './mid';",
    });
    expect(statements(h, '/proj/src/r.ts').flatMap(r => view(h, r)).map(o => o.target)).toEqual(['pkg:express', 'src/mid.ts']);
  });

  it('F-ALIAS: export * from a baseUrl path targets the project file', () => {
    const h = aliasFixture();
    const r = only(statements(h, join(ALIAS_ROOT, 'src/shared/reexport.ts')));
    expect(r.outcome).toBe('resolvedInternal');
    expect(view(h, r)).toEqual([{ edge: 'RE_EXPORTS', target: 'src/domain/x.ts', names: ['*'], typeOnly: false, line: 1 }]);
  });
});

describe('countUnsupportedDynamicImports (BR-U2-25, F-DYN)', () => {
  it("counts import() and require() calls, not import('x').T, import-equals or require.resolve", () => {
    const h = memory({
      '/proj/src/dyn.ts': [
        "import eq = require('./eq');",
        'export async function f(): Promise<unknown> {',
        "  const a = await import('./a');",
        "  const b = await import('./b');",
        "  const c = require('./c');",
        "  let t: import('./x').T | undefined;",
        "  const p = require.resolve('./d');",
        '  return [a, b, c, t, p, eq];',
        '}',
      ].join('\n'),
    });
    expect(countUnsupportedDynamicImports(h.sf('/proj/src/dyn.ts'))).toBe(3);
  });
});
