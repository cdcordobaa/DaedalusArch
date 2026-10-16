/**
 * Helpers of the default-view coverage diagnostic (`scripts/v1.3/default-view-coverage.ts`): the barrel export form and
 * the `require()` / `import()` call form.
 */
import { Project } from 'ts-morph';
import { callForm, exportForm, isAliasSpecifier } from '../../../../scripts/v1.3/lib/default-view-coverage.js';

function project(files: Record<string, string>): Project {
  const p = new Project({ useInMemoryFileSystem: true, compilerOptions: { strict: false, esModuleInterop: true } });
  for (const [f, text] of Object.entries(files)) p.createSourceFile(f, text);
  return p;
}

describe('exportForm', () => {
  const p = project({
    '/src/a.ts': 'export class A {}\nexport default class D {}\n',
    '/src/b.ts': 'export class B {}\n',
    '/src/c.ts': 'export const C = 1;\n',
    '/src/barrel.ts': [
      "export { A } from './a';",
      "export { default as Dee } from './a';",
      "export * from './b';",
      "export * as ns from './c';",
      "import { A as LocalA } from './a';",
      'export { LocalA };',
      'export const Own = 2;',
    ].join('\n'),
    '/src/default-barrel.ts': "import D from './a';\nexport default D;\n",
    '/src/own-default.ts': 'export default 42;\n',
  });
  const barrel = p.getSourceFileOrThrow('/src/barrel.ts');

  const cases: readonly (readonly [string, string])[] = [
    ['A', 'named-reexport'],
    ['Dee', 'renamed-reexport'],
    ['B', 'export-star'],
    ['ns', 'namespace-reexport'],
    ['LocalA', 'local-reexport'],
    ['Own', 'declared'],
    ['Missing', 'unknown'],
  ];
  for (const [name, form] of cases) {
    it(`${name} -> ${form}`, () => {
      expect(exportForm(barrel, name)).toBe(form);
    });
  }

  it('a default export of an imported name is a local re-export; a default expression is declared', () => {
    expect(exportForm(p.getSourceFileOrThrow('/src/default-barrel.ts'), 'default')).toBe('local-reexport');
    expect(exportForm(p.getSourceFileOrThrow('/src/own-default.ts'), 'default')).toBe('declared');
  });
});

describe('callForm', () => {
  const sf = project({
    '/src/m.ts': [
      "const { a } = require('./x');",
      "const b = require('./x');",
      "require('./x').default();",
      "require('./x');",
      "async function f() { return import('./x'); }",
      "const r = require.resolve('./x');",
    ].join('\n'),
  }).getSourceFileOrThrow('/src/m.ts');

  const cases: readonly (readonly [number, string])[] = [
    [1, 'require:destructured'],
    [2, 'require:assigned'],
    [3, 'require:member'],
    [4, 'require:bare'],
    [5, 'dynamic-import'],
    [6, 'unknown'], // require.resolve is not a require() call (neither the extractor nor tsc models it)
  ];
  for (const [line, form] of cases) {
    it(`line ${String(line)} -> ${form}`, () => {
      expect(callForm(sf, line)).toBe(form);
    });
  }
});

describe('isAliasSpecifier', () => {
  it('relative and absolute specifiers are not aliases; bare ones are', () => {
    expect(isAliasSpecifier('./a')).toBe(false);
    expect(isAliasSpecifier('../a')).toBe(false);
    expect(isAliasSpecifier('/abs/a')).toBe(false);
    expect(isAliasSpecifier('@app/a')).toBe(true);
    expect(isAliasSpecifier('~/domain/a')).toBe(true);
  });
});
