import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Project, ts } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import { extractNodes } from '../../../src/apg-extractor/node-extractor.js';
import {
  buildImportResolutionContext,
  classifySpecifier,
  resolveModule,
} from '../../../src/apg-extractor/import-resolver.js';
import type { ImportResolutionContext, ModuleResolution } from '../../../src/apg-extractor/import-resolver.js';
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
