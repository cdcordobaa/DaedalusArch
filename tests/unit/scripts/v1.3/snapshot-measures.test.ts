/**
 * v1.3 snapshot measures (gate D13, D16; `Docs/v1.3/snapshot-measures.md`): import kinds, barrels, LOC, the tool's
 * rows on the shared key, and the tool vs dependency-cruiser agreement with its reason classes. Hand-written
 * fixtures; no dependency-cruiser run, no store, no Neo4j.
 */
import {
  agreement, classifyDisagreement, isSourceFile, nonBlankLines, resolveRelative, scanImports, toolFindings, treeMeasures,
} from '../../../../scripts/v1.3/lib/snapshot-measures.js';
import type { ClassifyContext } from '../../../../scripts/v1.3/lib/snapshot-measures.js';
import type { Finding } from '../../../../scripts/tool-comparison.js';

describe('scanImports', () => {
  it('counts the four gate kinds and re-exports from the parser, not from text', () => {
    const src = [
      "import { a } from './a';",
      "import './side-effect';",
      "import type { B } from './b';",
      "import { type C, d } from './c';",
      "import fs = require('fs');",
      "const x = require('./x');",
      "async function f() { return import('./lazy'); }",
      "export { e } from './e';",
      "// import { nope } from './comment';",
      "const s = \"require('./string')\";",
    ].join('\n');
    const r = scanImports('src/m.ts', src);
    expect(r.kinds).toEqual({ static: 3, typeOnly: 1, dynamic: 1, require: 2, reexport: 1 });
    expect(r.imports.map((i) => i.specifier)).toEqual(['./a', './side-effect', './b', './c', 'fs', './x', './lazy', './e']);
    expect(r.barrel).toBe(false);
  });

  it('a barrel exports only re-exports; an empty file or a file with its own code is not one', () => {
    expect(scanImports('src/index.ts', "export * from './a';\nexport { b } from './b';\n").barrel).toBe(true);
    expect(scanImports('src/empty.ts', '\n// nothing\n').barrel).toBe(false);
    expect(scanImports('src/e.ts', "export * from '../p/e';\nexport class X {}\n").barrel).toBe(false);
  });
});

describe('treeMeasures', () => {
  it('measures src/**/*.ts only, .d.ts excluded, LOC non-blank, files sorted', () => {
    const t = treeMeasures(new Map([
      ['src/b.ts', "import { a } from './a';\n\nexport const b = a;\n"],
      ['src/a.ts', 'export const a = 1;\n'],
      ['src/index.ts', "export * from './a';\n"],
      ['src/types.d.ts', 'declare const z: number;\n'],
      ['test/a.test.ts', "import './x';\n"],
    ]));
    expect(t.sourceFiles).toEqual(['src/a.ts', 'src/b.ts', 'src/index.ts']);
    expect(t.loc).toBe(4);
    expect(t.importKinds).toEqual({ static: 1, typeOnly: 0, dynamic: 0, require: 0, reexport: 1 });
    expect(t.barrels).toEqual(['src/index.ts']);
    expect(isSourceFile('src/x.d.ts')).toBe(false);
    expect(nonBlankLines('a\n  \nb\n')).toBe(2);
  });
});

describe('resolveRelative', () => {
  const files = new Set(['src/a/x.ts', 'src/b/index.ts', 'src/c.d.ts']);
  it('resolves .ts, index.ts, .d.ts and a .js suffix; leaves packages alone', () => {
    expect(resolveRelative('src/a/y.ts', './x', files)).toBe('src/a/x.ts');
    expect(resolveRelative('src/a/y.ts', './x.js', files)).toBe('src/a/x.ts');
    expect(resolveRelative('src/a/y.ts', '../b', files)).toBe('src/b/index.ts');
    expect(resolveRelative('src/a/y.ts', '../c', files)).toBe('src/c.d.ts');
    expect(resolveRelative('src/a/y.ts', 'express', files)).toBeUndefined();
  });
});

describe('toolFindings', () => {
  it('reads loop rows and probe rows, keeps only the compared functions, keys a cycle on its ring', () => {
    const f = toolFindings([
      { ruleId: 'FF-S01', filePath: 'src/d/a.ts', target: 'src/i/b.ts' },
      { rule: 'FF-S03', file: 'src/p/c.ts', target: 'src/q/d.ts' },
      { ruleId: 'FF-S02', filePath: 'src/z.ts,src/a.ts' },
      { ruleId: 'FF-DS02', filePath: 'src/x.ts', target: 'src/y.ts' },
    ], ['FF-S01', 'FF-S02', 'FF-S03']);
    expect(f).toEqual([
      { functionId: 'FF-S01', filePath: 'src/d/a.ts', target: 'src/i/b.ts' },
      { functionId: 'FF-S03', filePath: 'src/p/c.ts', target: 'src/q/d.ts' },
      { functionId: 'FF-S02', filePath: 'src/a.ts', target: 'src/a.ts > src/z.ts', cycle: ['src/a.ts', 'src/z.ts'] },
    ]);
  });
});

describe('agreement and reason classes', () => {
  const texts = new Map([
    ['src/domain/a.ts', "import type { T } from '../infra/t';\nimport { s } from '../infra/s';\n"],
    ['src/domain/gen.ts', "import { s } from '../infra/s';\n"],
    ['src/domain/lazy.ts', "export const f = () => import('../infra/s');\n"],
    ['src/infra/t.ts', 'export interface T { x: number }\n'],
    ['src/infra/s.ts', 'export const s = 1;\n'],
  ]);
  const tm = treeMeasures(texts);
  const ctx: ClassifyContext = {
    files: new Set(texts.keys()), perFile: tm.perFile, barrels: new Set(tm.barrels),
    excluded: (_fn, file) => file.includes('/gen'),
  };
  const f = (functionId: string, filePath: string, target: string): Finding => ({ functionId, filePath, target });

  it('counts both, tool-only and depcruise-only on distinct keys and lists functions not translated here', () => {
    const tool = [f('FF-S01', 'src/domain/a.ts', 'src/infra/s.ts'), f('FF-S01', 'src/domain/a.ts', 'src/infra/s.ts'), f('FF-S01', 'src/domain/a.ts', 'src/infra/t.ts')];
    const dc = [f('FF-S01', 'src/domain/a.ts', 'src/infra/s.ts'), f('FF-S01', 'src/domain/lazy.ts', 'src/infra/s.ts')];
    const a = agreement(tool, dc, ['FF-C04', 'FF-S01', 'FF-S02'], ctx);
    expect(a.notTranslatedHere).toEqual(['FF-P01', 'FF-S03', 'FF-S04']);
    const s01 = a.compared.find((c) => c.functionId === 'FF-S01');
    expect(s01).toMatchObject({ tool: 2, depcruise: 2, both: 1 });
    expect(s01?.toolOnly.map((x) => x.reason)).toEqual(['type-only']);
    expect(s01?.depcruiseOnly.map((x) => x.reason)).toEqual(['dynamic-import']);
    expect(a.compared.map((c) => c.functionId)).toEqual(['FF-S01', 'FF-S02']);
  });

  it('classifies a plain static edge as rule-semantics, an excluded source as excluded-file, a .d.ts target as .d.ts', () => {
    expect(classifyDisagreement(f('FF-S01', 'src/domain/a.ts', 'src/infra/s.ts'), ctx)).toBe('rule-semantics');
    expect(classifyDisagreement(f('FF-S01', 'src/domain/gen.ts', 'src/infra/s.ts'), ctx)).toBe('excluded-file');
    expect(classifyDisagreement(f('FF-S01', 'src/domain/a.ts', 'src/x.d.ts'), ctx)).toBe('.d.ts');
    expect(classifyDisagreement(f('FF-S01', 'src/domain/a.ts', 'src/none.ts'), ctx)).toBe('unexplained');
  });
});
