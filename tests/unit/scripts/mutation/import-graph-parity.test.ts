/**
 * Import-graph builder parity with `extractAPG` (U5a plan Step 13; BR-U5a-56; D-U5a-15).
 *
 * Test code may import `src/apg-extractor` (the BR-U5a-06 static check covers `scripts/lib/mutation/**` only).
 * Projects read in place are never written; projects built for a case are written into a temp directory, so jest's
 * `**\/*.test.ts` match and the lint and type gates never see them. The mutant cases of BR-U5a-56: MO-S01, MO-C04
 * and the layered fixture spec (Step 27), MO-DF01 (Step 29), MO-X03 (Step 30).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DEFAULT_EXCLUDE_PATTERNS } from '../../../../src/apg-extractor/types.js';
import { compareImportGraphs } from '../../../../scripts/lib/import-graph-parity.js';
import {
  IMPORT_GRAPH_EXCLUDE_PATTERNS,
  buildImportGraph,
  layerOf,
  openImportGraphProject,
} from '../../../../scripts/lib/mutation/import-graph.js';
import type { ImportGraph, LayerDirs } from '../../../../scripts/lib/mutation/import-graph.js';
import { loadCompiledSpec } from '../../../../scripts/lib/mutation/expected.js';
import { MO_C04 } from '../../../../scripts/lib/mutation/operators/mo-c04.js';
import { MO_S01 } from '../../../../scripts/lib/mutation/operators/mo-s01.js';
import { CLEAN_SPEC, LAYERED_SPEC, applyForced, fixtureBase } from './operator-harness.js';

const REPO = process.cwd();
jest.setTimeout(120_000);

/** Layers of `specs/clean-arch.yaml` (the spec wiring arrives in Step 25). */
const CLEAN_ARCH: readonly LayerDirs[] = [
  { name: 'domain', directories: ['src/domain/**'] },
  { name: 'application', directories: ['src/application/**'] },
  { name: 'infrastructure', directories: ['src/infrastructure/**'] },
];

const GOLDEN = [
  'fixtures/correct-reference',
  'fixtures/variant-a-structural',
  'fixtures/variant-b-pattern',
  'fixtures/variant-c-everything',
  'fixtures/variant-d-subtle',
] as const;

const TSCONFIG = JSON.stringify({
  compilerOptions: { target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', strict: true, skipLibCheck: true },
  include: ['src/**/*.ts'],
});

let scratch: string;
beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-parity-'));
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

function writeProject(name: string, files: Readonly<Record<string, string>>): string {
  const dir = path.join(scratch, name);
  for (const [rel, text] of Object.entries({ 'tsconfig.json': TSCONFIG, ...files })) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

function graphOf(dir: string, layers: readonly LayerDirs[] = []): ImportGraph {
  return buildImportGraph(openImportGraphProject(dir, 'tsconfig.json'), layers);
}

function edgesFrom(g: ImportGraph, source: string): string[] {
  return g.edges.filter((e) => e.source === source).map((e) => `${e.type} ${e.target} typeOnly=${String(e.isTypeOnly)}`);
}

async function expectParity(dir: string, layers: readonly LayerDirs[] = []): Promise<void> {
  const r = await compareImportGraphs(dir, 'tsconfig.json', layers);
  expect({ onlyInBuilder: r.onlyInBuilder, onlyInExtractor: r.onlyInExtractor }).toEqual({ onlyInBuilder: [], onlyInExtractor: [] });
  expect(r.equal).toBe(true);
}

function fixturesStatus(): string {
  return execFileSync('git', ['status', '--porcelain', '--', 'fixtures'], { cwd: REPO, encoding: 'utf8' });
}

describe('import graph — exclusion list (D-U5a-15 1)', () => {
  it('IMPORT_GRAPH_EXCLUDE_PATTERNS deep-equals the extractor default list, same order', () => {
    expect([...IMPORT_GRAPH_EXCLUDE_PATTERNS]).toEqual([...DEFAULT_EXCLUDE_PATTERNS]);
  });
});

describe('import graph — parity on the five golden fixtures (BR-U5a-56)', () => {
  const before = fixturesStatus();
  it.each(GOLDEN)('%s: File set, isBarrel and File→File edges equal extractAPG', async (fixture) => {
    await expectParity(path.resolve(REPO, fixture), CLEAN_ARCH);
  });

  it('correct-reference: §2.4 base graph (10 files, layers from clean-arch, no barrel, 12 IMPORTS edges)', () => {
    const g = graphOf(path.resolve(REPO, 'fixtures/correct-reference'), CLEAN_ARCH);
    expect(g.files.size).toBe(10);
    expect(g.files.get('src/domain/entities/Task.ts')).toEqual({ filePath: 'src/domain/entities/Task.ts', layer: 'domain', isBarrel: false });
    expect(g.files.get('src/infrastructure/controllers/TaskController.ts')?.layer).toBe('infrastructure');
    expect([...g.files.values()].some((f) => f.isBarrel)).toBe(false);
    const fanIn = g.edges.filter((e) => e.type === 'IMPORTS' && e.target === 'src/domain/entities/Task.ts').length;
    expect(fanIn).toBe(6);
    expect(g.edges.every((e) => e.type === 'IMPORTS')).toBe(true);
    expect(g.edges.length).toBe(12);
    // Sorted by (source, target, type) in code-unit order.
    const keys = g.edges.map((e) => `${e.source}\u0000${e.target}\u0000${e.type}`);
    expect(keys).toEqual([...keys].sort());
  });

  it('reads the fixtures in place without writing them', () => {
    expect(fixturesStatus()).toBe(before);
  });
});

describe('import graph — F-BARREL shape (BR-U2-15, 20, 22..24)', () => {
  let dir: string;
  beforeAll(() => {
    dir = writeProject('f-barrel', {
      'src/application/a.ts': 'export class A {}\nexport interface B { readonly x: number }\n',
      'src/infrastructure/i.ts': 'export class I {}\n',
      'src/index.ts': [
        "export { A, B } from './application/a';",
        "export { I } from './infrastructure/i';",
        "export { Missing } from './nowhere';",
        "export { Router } from 'express';",
        '',
      ].join('\n'),
      'src/p.ts': "import { A, I } from './index';\nexport const p = [A, I];\n",
      'src/q.ts': "import { A, type B } from './index';\nexport const q = (b: B): unknown => [A, b];\n",
      'src/r.ts': "import { type B } from './index';\nexport const r = (b: B): B => b;\n",
      'src/s.ts': "import { Missing } from './index';\nimport { Router } from './index';\nexport const s = [Missing, Router];\n",
      'src/t.ts': "import * as all from './index';\nimport './index';\nexport const t = all;\n",
    });
  });

  it('parity with extractAPG', async () => {
    await expectParity(dir);
  });

  it('IMPORTS from p.ts go to a.ts and i.ts, none to index.ts', () => {
    const g = graphOf(dir);
    expect(edgesFrom(g, 'src/p.ts')).toEqual(['IMPORTS src/application/a.ts typeOnly=false', 'IMPORTS src/infrastructure/i.ts typeOnly=false']);
    expect(g.files.get('src/index.ts')?.isBarrel).toBe(true);
  });

  it('`{ A, type B }` merges to one non-type-only edge; `{ type B }` alone is type-only', () => {
    const g = graphOf(dir);
    expect(edgesFrom(g, 'src/q.ts')).toEqual(['IMPORTS src/application/a.ts typeOnly=false']);
    expect(edgesFrom(g, 'src/r.ts')).toEqual(['IMPORTS src/application/a.ts typeOnly=true']);
  });

  it('an unresolved hop falls back to the barrel; a Package hop gives no File edge', () => {
    expect(edgesFrom(graphOf(dir), 'src/s.ts')).toEqual(['IMPORTS src/index.ts typeOnly=false']);
  });

  it('namespace and side-effect imports go to the barrel; RE_EXPORTS name the modules, not followed', () => {
    const g = graphOf(dir);
    expect(edgesFrom(g, 'src/t.ts')).toEqual(['IMPORTS src/index.ts typeOnly=false']);
    expect(edgesFrom(g, 'src/index.ts')).toEqual([
      'RE_EXPORTS src/application/a.ts typeOnly=false',
      'RE_EXPORTS src/infrastructure/i.ts typeOnly=false',
    ]);
  });
});

describe('import graph — fixtures/unit/u2-alias in place (BR-U2-07..14)', () => {
  const dir = path.resolve(REPO, 'fixtures/unit/u2-alias');
  const before = fixturesStatus();

  it('parity with extractAPG (paths, baseUrl, missing aliases, out-of-root alias, installed package, paths into node_modules)', async () => {
    await expectParity(dir);
  });

  it('main.ts reaches x.ts and y.ts only; reexport.ts re-exports x.ts through baseUrl', () => {
    const g = graphOf(dir);
    expect(edgesFrom(g, 'src/presentation/main.ts')).toEqual(['IMPORTS src/domain/x.ts typeOnly=false', 'IMPORTS src/domain/y.ts typeOnly=false']);
    expect(edgesFrom(g, 'src/shared/reexport.ts')).toEqual(['RE_EXPORTS src/domain/x.ts typeOnly=false']);
  });

  it('is never written', () => {
    expect(fixturesStatus()).toBe(before);
  });
});

describe('import graph — exclusion project (D-U5a-15 1)', () => {
  let dir: string;
  beforeAll(() => {
    dir = writeProject('exclusion', {
      'src/a.ts': "import { L } from 'legacy-mod';\nexport const a = L;\n",
      'src/a.spec.ts': "import { a } from './a';\nexport const spec = a;\n",
      'src/a.test.ts': "import { a } from './a';\nexport const test = a;\n",
      'src/dist/x.ts': "import { a } from '../a';\nexport const x = a;\n",
      'src/build/y.ts': "import { a } from '../a';\nexport const y = a;\n",
      'src/legacy.d.ts': "declare module 'legacy-mod' { export const L: number; }\n",
      'src/types.d.ts': 'export interface T { readonly v: number }\n',
      'src/b.ts': "import type { T } from './types';\nexport const b = (t: T): number => t.v;\n",
    });
  });

  it('parity with extractAPG', async () => {
    await expectParity(dir);
  });

  it('no excluded file is a File node; a.ts has fan-in 0; the .d.ts targets give no edge', () => {
    const g = graphOf(dir);
    expect([...g.files.keys()]).toEqual(['src/a.ts', 'src/b.ts']);
    expect(g.edges).toEqual([]);
  });
});

describe('layerOf', () => {
  it('directory globs first in layer order, then file patterns, else null', () => {
    const layers: LayerDirs[] = [
      { name: 'domain', directories: ['src/domain/**'] },
      { name: 'presentation', directories: [], filePatterns: ['**/*.controller.ts'] },
    ];
    expect(layerOf('src/domain/x.ts', layers)).toBe('domain');
    expect(layerOf('src/domain/x.controller.ts', layers)).toBe('domain');
    expect(layerOf('src/web/x.controller.ts', layers)).toBe('presentation');
    expect(layerOf('src/web/x.ts', layers)).toBeNull();
  });
});

describe('import graph — mutants and the layered fixture spec (BR-U5a-56; Step 27)', () => {
  it('MO-S01 mutant of correct-reference (forced F-U5A-CYCLE site)', async () => {
    const { copy } = await applyForced(scratch, [MO_S01], 'MO-S01', fixtureBase(CLEAN_SPEC), {
      filePath: 'src/domain/entities/Task.ts',
      detail: { symbol: 'InMemoryTaskRepository', targetFile: 'src/infrastructure/repositories/InMemoryTaskRepository.ts' },
    });
    await expectParity(copy, CLEAN_ARCH);
  });

  it('MO-C04 mutant of correct-reference (created orphan file)', async () => {
    const { copy } = await applyForced(scratch, [MO_C04], 'MO-C04', fixtureBase(CLEAN_SPEC), {
      filePath: 'src/application/use-cases/OrphanHelper.ts',
      detail: { directory: 'src/application/use-cases' },
    });
    await expectParity(copy, CLEAN_ARCH);
  });

  it('correct-reference under the layered fixture spec layers', async () => {
    const spec = await loadCompiledSpec(REPO, LAYERED_SPEC);
    if (!spec.success) throw new Error(JSON.stringify(spec.errors));
    await expectParity(path.resolve(REPO, 'fixtures/correct-reference'), spec.data.layers);
  });
});
