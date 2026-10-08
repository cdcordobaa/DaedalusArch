/**
 * Metric predicates and site collateral (U5a plan Step 15; BR-U5a-14 i–iv; `business-logic-model.md` §2.4, §2.5).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { newEdgePairs } from '../../../../scripts/lib/mutation/cycles.js';
import { createdWithoutTest, siteCollateral } from '../../../../scripts/lib/mutation/collateral.js';
import type { CollateralContext, CompiledFunctionRef } from '../../../../scripts/lib/mutation/collateral.js';
import { buildImportGraph, openImportGraphProject } from '../../../../scripts/lib/mutation/import-graph.js';
import type { LayerDirs } from '../../../../scripts/lib/mutation/import-graph.js';
import { metricValues, metricViolations } from '../../../../scripts/lib/mutation/metrics.js';
import type { ImportGraph, MetricTemplate, MutationEdit, SiteCollateral } from '../../../../scripts/lib/mutation/types.js';

const REPO = process.cwd();

/** Function ids and thresholds of `specs/clean-arch.yaml` for the collateral templates. */
const CLEAN_ARCH_FUNCTIONS: readonly CompiledFunctionRef[] = [
  { functionId: 'FF-S02', template: 'no-cyclic-deps' },
  { functionId: 'FF-C01', template: 'domain-stability', threshold: 0.3 },
  { functionId: 'FF-C02', template: 'module-fan-out', threshold: 10 },
  { functionId: 'FF-C03', template: 'component-instability' },
  { functionId: 'FF-C04', template: 'no-orphan-files' },
  { functionId: 'FF-C05', template: 'max-fan-in', threshold: 15 },
  { functionId: 'FF-C06', template: 'abstraction-ratio', threshold: 0.3 },
  { functionId: 'FF-CV05', template: 'test-file-pairing' },
];

const CLEAN_ARCH_LAYERS: readonly LayerDirs[] = [
  { name: 'domain', directories: ['src/domain/**'] },
  { name: 'application', directories: ['src/application/**'] },
  { name: 'infrastructure', directories: ['src/infrastructure/**'] },
];

function ctx(over: Partial<CollateralContext> = {}): CollateralContext {
  return {
    functions: CLEAN_ARCH_FUNCTIONS,
    domainLayer: 'domain',
    cycleStrategy: 'simple-cycles',
    maxCycleLength: 10,
    cycleRowCap: 100,
    expectedKeys: [],
    ...over,
  };
}

function edit(over: Partial<MutationEdit> = {}): MutationEdit {
  return { editedFiles: [], createdFiles: [], lineShifts: [], newEdges: [], ...over };
}

/**
 * Synthetic graph: `files` maps a path to its layer (`null` = unlayered; `!` suffix on the layer = barrel);
 * edges are `a>b` (IMPORTS) or `a>>b` (RE_EXPORTS).
 */
function graph(files: Readonly<Record<string, string | null>>, edges: readonly string[]): ImportGraph {
  const fileMap = new Map(
    Object.entries(files).map(([p, l]) => [p, { filePath: p, layer: l === null ? null : l.replace(/!$/, ''), isBarrel: l?.endsWith('!') === true }]),
  );
  return {
    files: fileMap,
    edges: edges.map((e) => {
      const re = e.includes('>>');
      const [source = '', target = ''] = e.split(re ? '>>' : '>');
      return { source, target, type: re ? ('RE_EXPORTS' as const) : ('IMPORTS' as const), isTypeOnly: false, line: 1 };
    }),
  };
}

/** Metric-crossing keys of one template between two synthetic graphs. */
function crossings(base: ImportGraph, mutant: ImportGraph, template: MetricTemplate, threshold?: number): string[] {
  const fn: CompiledFunctionRef = threshold === undefined ? { functionId: 'F', template } : { functionId: 'F', template, threshold };
  const r = siteCollateral(base, mutant, edit({ newEdges: newEdgePairs(base, mutant) }), ctx({ functions: [fn], domainLayer: 'd' }));
  if (!r.success) throw new Error(JSON.stringify(r.errors));
  return r.data.filter((c) => c.cause === 'metric-crossing').map((c) => c.key?.filePath ?? '?');
}

const many = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(2, '0')}`);
const layered = (names: readonly string[], layer: string): Record<string, string> => Object.fromEntries(names.map((n) => [n, layer]));

describe('metric predicates: one crossing per template plus controls (§2.5)', () => {
  it('domain-stability (FF-C01): 0.25 → 0.4 crosses; already violating and no-longer-violating give no key', () => {
    const files = { D: 'd', E: 'd', F: 'd', a1: 'a', a2: 'a', a3: 'a', x1: 'a', x2: 'a', x3: 'a', n: null };
    const base = graph(files, ['a1>D', 'a2>D', 'a3>D', 'D>x1', 'a1>E', 'E>x1', 'a1>F', 'F>x1', 'F>n']);
    const mutant = graph(files, ['a1>D', 'a2>D', 'a3>D', 'D>x1', 'D>x2', 'a1>E', 'E>x1', 'E>x2', 'a1>F', 'a2>F', 'a3>F', 'F>x1', 'F>n']);
    expect(metricValues(base, 'domain-stability', 'd')).toEqual(new Map([['D', 0.25], ['E', 0.5], ['F', 0.5]]));
    // F: 1/4 = 0.25 after (no longer violating); the null-layer neighbour n is not counted.
    expect(metricValues(mutant, 'domain-stability', 'd').get('F')).toBe(0.25);
    expect(crossings(base, mutant, 'domain-stability', 0.3)).toEqual(['D']);
  });

  it('module-fan-out (FF-C02): 10 → 11 crosses; 11 → 12 and 11 → 10 give no key', () => {
    const t = many('t', 12);
    const files = { f: 'a', g: 'a', h: 'a', ...layered(t, 'a') };
    const base = graph(files, [...t.slice(0, 10).map((x) => `f>${x}`), ...t.slice(0, 11).map((x) => `g>${x}`), ...t.slice(0, 11).map((x) => `h>${x}`)]);
    const mutant = graph(files, [...t.slice(0, 11).map((x) => `f>${x}`), ...t.slice(0, 12).map((x) => `g>${x}`), ...t.slice(0, 10).map((x) => `h>${x}`)]);
    expect(crossings(base, mutant, 'module-fan-out', 10)).toEqual(['f']);
  });

  it('component-instability (FF-C03): 0.8 → 0.83 crosses; already violating and no-longer-violating give no key; unlayered ignored', () => {
    const o = many('o', 6);
    const files = { f: 'a', g: 'a', h: 'a', u: null, i1: 'a', i2: null, ...layered(o, 'a') };
    const base = graph(files, [
      'i1>f', ...o.slice(0, 4).map((x) => `f>${x}`),
      'i1>g', ...o.slice(0, 5).map((x) => `g>${x}`),
      'i1>h', ...o.slice(0, 5).map((x) => `h>${x}`),
      ...o.slice(0, 4).map((x) => `u>${x}`),
    ]);
    const mutant = graph(files, [
      'i1>f', ...o.slice(0, 5).map((x) => `f>${x}`),
      'i1>g', ...o.slice(0, 6).map((x) => `g>${x}`),
      'i1>h', 'i2>h', ...o.slice(0, 5).map((x) => `h>${x}`),
      ...o.slice(0, 5).map((x) => `u>${x}`),
    ]);
    expect(crossings(base, mutant, 'component-instability')).toEqual(['f']);
  });

  it('no-orphan-files (FF-C04): losing the last edge crosses; already orphan, re-exported and barrel files give no key', () => {
    const files = { f: 'a', g: 'a', h: 'a', o: 'a', p: 'a', r: 'a', b: 'a!', n: null };
    const base = graph(files, ['f>g', 'g>h', 'p>>r']);
    const mutant = graph(files, ['g>h', 'p>>r', 'o>h']);
    expect(metricViolations(base, 'no-orphan-files', undefined, null)).toEqual(new Map([['o', 0]]));
    expect(crossings(base, mutant, 'no-orphan-files')).toEqual(['f']);
  });

  it('max-fan-in (FF-C05): 15 → 16 crosses; 16 → 17 and 16 → 15 give no key', () => {
    const s = many('s', 17);
    const files = { f: 'a', g: 'a', h: 'a', ...layered(s, 'a') };
    const base = graph(files, [...s.slice(0, 15).map((x) => `${x}>f`), ...s.slice(0, 16).map((x) => `${x}>g`), ...s.slice(0, 16).map((x) => `${x}>h`)]);
    const mutant = graph(files, [...s.slice(0, 16).map((x) => `${x}>f`), ...s.slice(0, 17).map((x) => `${x}>g`), ...s.slice(0, 15).map((x) => `${x}>h`)]);
    expect(crossings(base, mutant, 'max-fan-in', 15)).toEqual(['f']);
  });

  it('RE_EXPORTS edges count for orphans only; IMPORTS-only metrics ignore them', () => {
    const g = graph({ a: 'x', b: 'x' }, ['a>>b']);
    expect(metricViolations(g, 'no-orphan-files', undefined, null).size).toBe(0);
    expect(metricValues(g, 'component-instability', null).size).toBe(0);
    expect(metricValues(g, 'module-fan-out', null).size).toBe(0);
  });
});

describe('correct-reference copies (§2.3, §2.4)', () => {
  let scratch: string;
  let base: ImportGraph;
  beforeAll(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-collateral-'));
    base = buildImportGraph(openImportGraphProject(path.resolve(REPO, 'fixtures/correct-reference'), 'tsconfig.json'), CLEAN_ARCH_LAYERS);
  });
  afterAll(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  /** A fresh copy with `files` written (created or replaced) and `edits` applied to existing files. */
  function mutantOf(name: string, files: Readonly<Record<string, string>>, edits: Readonly<Record<string, (s: string) => string>> = {}): ImportGraph {
    const copy = path.join(scratch, name);
    fs.cpSync(path.resolve(REPO, 'fixtures/correct-reference'), copy, { recursive: true });
    for (const [rel, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(copy, rel)), { recursive: true });
      fs.writeFileSync(path.join(copy, rel), text);
    }
    for (const [rel, f] of Object.entries(edits)) fs.writeFileSync(path.join(copy, rel), f(fs.readFileSync(path.join(copy, rel), 'utf8')));
    return buildImportGraph(openImportGraphProject(copy, 'tsconfig.json'), CLEAN_ARCH_LAYERS);
  }

  function collateralOf(mutant: ImportGraph, e: MutationEdit, over: Partial<CollateralContext> = {}): SiteCollateral[] {
    const r = siteCollateral(base, mutant, e, ctx(over));
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    return r.data;
  }

  it('base values: FF-C03 violating = the five bold files; FF-C01, C02, C04, C05 empty; FF-C01 per §2.4', () => {
    expect([...metricViolations(base, 'component-instability', 0.8, 'domain').keys()]).toEqual([
      'src/application/use-cases/CompleteTaskUseCase.ts',
      'src/application/use-cases/CreateTaskUseCase.ts',
      'src/domain/repositories/ICategoryRepository.ts',
      'src/infrastructure/controllers/TaskController.ts',
      'src/infrastructure/repositories/InMemoryTaskRepository.ts',
    ]);
    expect(metricValues(base, 'component-instability', 'domain')).toEqual(
      new Map([
        ['src/application/use-cases/CompleteTaskUseCase.ts', 1],
        ['src/application/use-cases/CreateTaskUseCase.ts', 1],
        ['src/application/use-cases/ICompleteTaskUseCase.ts', 0.5],
        ['src/application/use-cases/ICreateTaskUseCase.ts', 0.5],
        ['src/domain/entities/Category.ts', 0],
        ['src/domain/entities/Task.ts', 0],
        ['src/domain/repositories/ICategoryRepository.ts', 1],
        ['src/domain/repositories/ITaskRepository.ts', 0.25],
        ['src/infrastructure/controllers/TaskController.ts', 1],
        ['src/infrastructure/repositories/InMemoryTaskRepository.ts', 1],
      ]),
    );
    expect(metricValues(base, 'domain-stability', 'domain')).toEqual(
      new Map([['src/domain/entities/Task.ts', 0], ['src/domain/repositories/ITaskRepository.ts', 0]]),
    );
    for (const t of ['domain-stability', 'module-fan-out', 'no-orphan-files', 'max-fan-in'] as const) {
      expect(metricViolations(base, t, undefined, 'domain').size).toBe(0);
    }
    expect(metricValues(base, 'max-fan-in', 'domain').get('src/domain/entities/Task.ts')).toBe(6);
  });

  it('created domain module imported by nothing → FF-C04 key (base null), FF-CV05 key, no FF-C03', () => {
    const file = 'src/domain/rules/orphan.ts';
    const c = collateralOf(mutantOf('orphan', { [file]: 'export const orphan = 1;\n' }), edit({ createdFiles: [file] }));
    expect(c).toEqual([
      {
        kind: 'site', template: 'no-orphan-files', functionId: 'FF-C04', cause: 'metric-crossing',
        key: { functionId: 'FF-C04', filePath: file, target: '', discriminator: [], lineRule: 'none' },
        metric: { base: null, mutant: 0, threshold: 0 },
      },
      {
        kind: 'site', template: 'test-file-pairing', functionId: 'FF-CV05', cause: 'created-without-test',
        key: { functionId: 'FF-CV05', filePath: file, target: '', discriminator: [], lineRule: 'none' },
      },
    ]);
  });

  it('created domain module importing Task.ts only → FF-C03 key (1.0 > 0.8), no FF-C04 key', () => {
    const file = 'src/domain/rules/uses.ts';
    const mutant = mutantOf('uses', { [file]: "import { Task } from '../entities/Task';\nexport const uses = Task;\n" });
    const c = collateralOf(mutant, edit({ createdFiles: [file], newEdges: [{ source: file, target: 'src/domain/entities/Task.ts' }] }));
    const metric = c.filter((x) => x.cause === 'metric-crossing');
    expect(metric).toEqual([
      {
        kind: 'site', template: 'component-instability', functionId: 'FF-C03', cause: 'metric-crossing',
        key: { functionId: 'FF-C03', filePath: file, target: '', discriminator: [], lineRule: 'none' },
        metric: { base: null, mutant: 1, threshold: 0.8 },
      },
    ]);
    expect(c.some((x) => x.template === 'no-orphan-files')).toBe(false);
  });

  it('MO-X03-shaped edit → no metric key; exactly one test-file-pairing entry on the created module', () => {
    const file = 'src/domain/rules/taskRules.ts';
    const uc = 'src/application/use-cases/CreateTaskUseCase.ts';
    const mutant = mutantOf(
      'mo-x03',
      { [file]: 'export function isValidTitle(title: string): boolean {\n  return title.trim().length > 0;\n}\n' },
      { [uc]: (s) => `import { isValidTitle } from '../../domain/rules/taskRules';\n${s}export const titleRule = isValidTitle;\n` },
    );
    const c = collateralOf(mutant, edit({ editedFiles: [uc], createdFiles: [file], newEdges: [{ source: uc, target: file }] }));
    expect(c).toEqual([
      {
        kind: 'site', template: 'test-file-pairing', functionId: 'FF-CV05', cause: 'created-without-test',
        key: { functionId: 'FF-CV05', filePath: file, target: '', discriminator: [], lineRule: 'none' },
      },
    ]);
  });

  it('MO-S01-shaped edit → the two FF-S02 cycle keys; InMemoryTaskRepository already FF-C03, no metric key', () => {
    const task = 'src/domain/entities/Task.ts';
    const impl = 'src/infrastructure/repositories/InMemoryTaskRepository.ts';
    const mutant = mutantOf('mo-s01', {}, {
      [task]: (s) => `import { InMemoryTaskRepository } from '../../infrastructure/repositories/InMemoryTaskRepository';\n${s}export const repositoryRef = InMemoryTaskRepository;\n`,
    });
    const c = collateralOf(mutant, edit({ editedFiles: [task], newEdges: [{ source: task, target: impl }] }));
    expect(c.map((x) => [x.functionId, x.cause, x.key?.target])).toEqual([
      ['FF-S02', 'cycle', impl],
      ['FF-S02', 'cycle', impl],
    ]);
    // Task.ts: domain file, one non-domain out, five non-domain in → FF-C01 1/6 ≤ 0.3; FF-C03 1/7 ≤ 0.8.
  });

  it('a key already in expected.keys is not repeated (MO-C04: FF-C04 expected, FF-CV05 collateral)', () => {
    const file = 'src/application/use-cases/OrphanHelper.ts';
    const mutant = mutantOf('mo-c04', { [file]: 'export const orphanHelper = 1;\n' });
    const expectedKeys = [{ functionId: 'FF-C04', filePath: file, target: '', discriminator: [], lineRule: 'none' as const }];
    const c = collateralOf(mutant, edit({ createdFiles: [file] }), { expectedKeys });
    expect(c.map((x) => [x.functionId, x.cause])).toEqual([['FF-CV05', 'created-without-test']]);
  });

  it('planned newEdges must equal edges(G\') − edges(G)', () => {
    const task = 'src/domain/entities/Task.ts';
    const mutant = mutantOf('mismatch', {}, {
      [task]: (s) => `import { InMemoryTaskRepository } from '../../infrastructure/repositories/InMemoryTaskRepository';\n${s}export const repositoryRef = InMemoryTaskRepository;\n`,
    });
    const r = siteCollateral(base, mutant, edit({ newEdges: [] }), ctx());
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors[0]?.code).toBe('MUT_NEW_EDGES_MISMATCH');
  });

  it('templates the spec does not declare give no entry; project-metric only when a class or interface is added or removed', () => {
    const file = 'src/domain/rules/orphan2.ts';
    const mutant = mutantOf('undeclared', { [file]: 'export const orphan2 = 1;\n' });
    expect(collateralOf(mutant, edit({ createdFiles: [file] }), { functions: [{ functionId: 'FF-C03', template: 'component-instability' }] })).toEqual([]);
    const withTypes = collateralOf(mutant, edit({ createdFiles: [file] }), {
      functions: [{ functionId: 'FF-C06', template: 'abstraction-ratio', threshold: 0.3 }],
      typesAddedOrRemoved: true,
    });
    expect(withTypes).toEqual([{ kind: 'site', template: 'abstraction-ratio', functionId: 'FF-C06', cause: 'project-metric' }]);
  });

  it('createdWithoutTest mirrors test-file-pairing: test files, barrels, unlayered and paired files are skipped', () => {
    const g = graph({ 'src/x/a.ts': 'l', 'src/x/a.spec.ts': 'l', 'src/x/b.ts': 'l', 'src/x/i.ts': 'l!', 'u.ts': null, 'src/x/c.test.ts': 'l' }, []);
    expect(createdWithoutTest(g, 'src/x/a.ts')).toBe(false);
    expect(createdWithoutTest(g, 'src/x/b.ts')).toBe(true);
    expect(createdWithoutTest(g, 'src/x/i.ts')).toBe(false);
    expect(createdWithoutTest(g, 'u.ts')).toBe(false);
    expect(createdWithoutTest(g, 'src/x/c.test.ts')).toBe(false);
    expect(createdWithoutTest(g, 'src/x/missing.ts')).toBe(false);
  });
});
