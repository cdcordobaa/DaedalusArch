import { Project } from 'ts-morph';
import { extractNodes } from '../../../src/apg-extractor/node-extractor.js';
import { extractEdges } from '../../../src/apg-extractor/edge-extractor.js';
import type { ExtractorOptions } from '../../../src/apg-extractor/types.js';
import { DEFAULT_OPTIONS, V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/types.js';

const ROOT = '/proj';

function setup(files: Record<string, string>, options: ExtractorOptions = {}) {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    compilerOptions: { strict: false },
  });
  for (const [fp, content] of Object.entries(files)) project.createSourceFile(fp, content);
  const sfs = project.getSourceFiles();
  const { nodes, lookup } = extractNodes(sfs, ROOT);
  const result = extractEdges(sfs, lookup, ROOT, options);
  const fileId = (p: string): string => lookup.fileNodes.get(p) ?? '';
  return { nodes, ...result, fileId };
}

// The exact shape MO-X01 adds to a domain class (scripts/lib/mutation/operators/mo-x01.ts).
const MO_X01_SEED: Record<string, string> = {
  '/proj/src/domain/order.ts': `export class Order {
  async loadDbModule(): Promise<unknown> {
    return import('../infrastructure/db');
  }
}`,
  '/proj/src/infrastructure/db.ts': 'export class Db {}',
};

describe('v1.3 dynamicImports option', () => {
  it('is on by default in v1.3 (V13_DEFAULT_OPTIONS) and off in the frozen v1.2E defaults', () => {
    expect(DEFAULT_OPTIONS).toBe(V13_DEFAULT_OPTIONS);
    expect(V13_DEFAULT_OPTIONS.dynamicImports).toBe(true);
    expect(V12E_DEFAULT_OPTIONS.dynamicImports).toBe(false);
  });

  it('default (no option): the MO-X01 dynamic import is an IMPORTS edge, same as dynamicImports: true', () => {
    const byDefault = setup(MO_X01_SEED);
    const explicit = setup(MO_X01_SEED, { dynamicImports: true });
    const imports = byDefault.edges.filter(e => e.type === 'IMPORTS');
    expect(imports).toHaveLength(1);
    expect(imports[0]?.properties.dynamic).toBe(true);
    expect(byDefault.importResolution.unsupportedDynamic).toBe(0);
    expect(byDefault.edges).toEqual(explicit.edges);
  });

  it('explicit off (dynamicImports: false): dynamic calls give no IMPORTS edge and stay counted (v1.2E behaviour)', () => {
    const { edges, importResolution, warnings } = setup(MO_X01_SEED, { dynamicImports: false });
    expect(edges.filter(e => e.type === 'IMPORTS')).toHaveLength(0);
    expect(importResolution.unsupportedDynamic).toBe(1);
    expect(warnings.some(w => w.code === 'EXTRACTOR_009')).toBe(true);
  });

  it('MO-X01 seed: the dynamic import is detected as IMPORTS domain -> infrastructure with dynamic = true', () => {
    const { edges, fileId, importResolution, warnings } = setup(MO_X01_SEED, { dynamicImports: true });
    const imports = edges.filter(e => e.type === 'IMPORTS');
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({
      sourceId: fileId('src/domain/order.ts'),
      targetId: fileId('src/infrastructure/db.ts'),
      properties: { specifier: '../infrastructure/db', line: 3, lines: [3], isTypeOnly: false, importedNames: ['*'], dynamic: true },
    });
    expect(importResolution.unsupportedDynamic).toBe(0);
    expect(warnings.some(w => w.code === 'EXTRACTOR_009')).toBe(false);
  });

  it('models require() with a string literal and resolves aliases/bare specifiers like static imports', () => {
    const { edges, fileId, packageNodes } = setup({
      '/proj/src/a.ts': "export function f() { const b = require('./b'); const fs = require('node:fs'); return [b, fs]; }",
      '/proj/src/b.ts': 'export const b = 1;',
    }, { dynamicImports: true });
    const imports = edges.filter(e => e.type === 'IMPORTS');
    expect(imports.map(e => e.targetId)).toContain(fileId('src/b.ts'));
    expect(imports.every(e => e.properties.dynamic === true)).toBe(true);
    expect(packageNodes.map(p => p.name)).toContain('fs');
  });

  it('a static import of the same target wins: one merged edge without the dynamic property', () => {
    const { edges } = setup({
      '/proj/src/a.ts': "import { B } from './b';\nexport async function f() { return [B, await import('./b')]; }",
      '/proj/src/b.ts': 'export const B = 1;',
    }, { dynamicImports: true });
    const imports = edges.filter(e => e.type === 'IMPORTS');
    expect(imports).toHaveLength(1);
    expect(imports[0]?.properties.dynamic).toBeUndefined();
    expect(imports[0]?.properties.lines).toEqual([1, 2]);
  });

  it('keeps computed specifiers unmodelled and counted', () => {
    const { edges, importResolution } = setup({
      '/proj/src/a.ts': "export async function f(n: string) { return import(n); }",
    }, { dynamicImports: true });
    expect(edges.filter(e => e.type === 'IMPORTS')).toHaveLength(0);
    expect(importResolution.unsupportedDynamic).toBe(1);
  });

  it('warns EXTRACTOR_002 and emits no edge for an unresolvable relative specifier', () => {
    const { edges, warnings } = setup({
      '/proj/src/a.ts': "export async function f() { return import('./missing'); }",
    }, { dynamicImports: true });
    expect(edges.filter(e => e.type === 'IMPORTS')).toHaveLength(0);
    expect(warnings.some(w => w.code === 'EXTRACTOR_002')).toBe(true);
  });

  it('leaves the statement partition counters unchanged', () => {
    const off = setup(MO_X01_SEED, { dynamicImports: false }).importResolution;
    const on = setup(MO_X01_SEED, { dynamicImports: true }).importResolution;
    expect({ ...on, unsupportedDynamic: 0 }).toEqual({ ...off, unsupportedDynamic: 0 });
  });
});
