// BR-U4-SEL-01..07; BLM §3-§5; ADR-017 item 4; T4, T17 (selection part), T23 (U4 plan Step 15).
// Views are JudgeGraphView literals built from fixture file lists; no Neo4j.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { LayerDefinition } from '../../../src/shared/types/spec.js';
import type { BaselineSelection } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import type { JudgeGraphView, JudgeGraphFile } from '../../../src/llm-critic/judge-graph.js';
import { sortJudgeGraphView } from '../../../src/llm-critic/judge-graph.js';
import {
  enumerateCandidates, buildModuleUnits, buildCandidateSet, selectUnits, classifyGlob, rankOf,
  resolveBaselineSelection, DEFAULT_SELECTION_RULE, EXCLUSION_REASONS,
} from '../../../src/llm-critic/judge-unit-selector.js';
import type { JudgeUnit, UnitSelectionRule } from '../../../src/llm-critic/judge-unit-selector.js';

const REPO = resolve(__dirname, '../../..');
const UNITS = resolve(REPO, 'tests/fixtures/judge-units');
const FN = functionId('FF-N01');

function layer(name: string, directories: string[], filePatterns: string[] = []): LayerDefinition {
  return { name, directories, naming: [], filePatterns, role: name };
}
const CLEAN_ARCH_LAYERS = [
  layer('domain', ['src/domain/**']), layer('application', ['src/application/**']), layer('infrastructure', ['src/infrastructure/**']),
];

function loadView(tree: string): JudgeGraphView {
  return JSON.parse(readFileSync(join(UNITS, tree, 'view.json'), 'utf8')) as JudgeGraphView;
}

function listTs(root: string, dir = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, dir)).sort()) {
    const rel = dir === '' ? name : `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...listTs(root, rel));
    else if (name.endsWith('.ts')) out.push(rel);
  }
  return out;
}

/** View of a golden fixture: layer from the `src/<layer>/` prefix (clean-arch spec globs). */
function fixtureView(fixture: string): JudgeGraphView {
  const files: JudgeGraphFile[] = listTs(resolve(REPO, 'fixtures', fixture)).map((p) => {
    const m = /^src\/(domain|application|infrastructure)\//.exec(p);
    return { path: p, layer: m?.[1] ?? null, isBarrel: false };
  });
  return { files, classes: [], interfaces: [], edges: [] };
}

function ids(units: readonly JudgeUnit[]): string[] {
  return units.map((u) => u.id);
}

describe('SEL-01 candidate filter', () => {
  it('counts one file per reason and keeps exactly the clean files', () => {
    const result = enumerateCandidates(loadView('reasons'), { excludePaths: ['src/domain/legacy/**'] }, join(UNITS, 'reasons'));
    for (const reason of EXCLUSION_REASONS) {
      expect({ reason, count: result.exclusions[reason] }).toEqual({ reason, count: 1 });
    }
    expect(result.files.map((f) => f.path)).toEqual(['src/domain/clean.ts', 'src/domain/late-marker.ts', 'src/domain/other.ts']);
    expect(result.uncoveredFiles).toEqual(['src/loose/unmapped.ts']);
    expect(result.files.every((f) => f.sizeChars > 0)).toBe(true);
  });

  it('without exclude globs the legacy file is a candidate', () => {
    const result = enumerateCandidates(loadView('reasons'), {}, join(UNITS, 'reasons'));
    expect(result.exclusions['exclude-paths']).toBe(0);
    expect(result.files.map((f) => f.path)).toContain('src/domain/legacy/old.ts');
  });

  it('counts a file under the first reason that applies (barrel before test-path)', () => {
    const view: JudgeGraphView = {
      files: [{ path: 'src/domain/__tests__/index.ts', layer: 'domain', isBarrel: true }], classes: [], interfaces: [], edges: [],
    };
    const result = enumerateCandidates(view, {}, join(UNITS, 'reasons'));
    expect(result.exclusions.barrel).toBe(1);
    expect(result.exclusions['test-path']).toBe(0);
  });

  it('matches generated paths by whole segment, including prisma/client', () => {
    const view: JudgeGraphView = {
      files: [
        { path: 'src/notgenerated/a.ts', layer: 'domain', isBarrel: false },
        { path: 'src/prisma/client/b.ts', layer: 'domain', isBarrel: false },
        { path: 'src/prisma/clients/c.ts', layer: 'domain', isBarrel: false },
      ],
      classes: [], interfaces: [], edges: [],
    };
    const result = enumerateCandidates(view, {}, join(UNITS, 'reasons'));
    expect(result.exclusions['generated-path']).toBe(1);
    expect(result.files.map((f) => f.path)).toEqual(['src/notgenerated/a.ts', 'src/prisma/clients/c.ts']);
  });
});

describe('SEL-02 unit kinds', () => {
  const view: JudgeGraphView = {
    ...fixtureView('correct-reference'),
    classes: [{ name: 'Task', file: 'src/domain/entities/Task.ts' }, { name: 'TaskController', file: 'src/infrastructure/controllers/TaskController.ts' }],
  };
  const root = resolve(REPO, 'fixtures/correct-reference');

  it('module for FF-N01 (integrity default), file for FF-N02, Class@file for class', () => {
    const modules = buildCandidateSet(view, { judgeUnit: 'module' }, root, CLEAN_ARCH_LAYERS);
    expect(modules.kind).toBe('module');
    expect(modules.units.every((u) => u.kind === 'module')).toBe(true);
    const files = buildCandidateSet(view, { judgeUnit: 'file' }, root, CLEAN_ARCH_LAYERS);
    expect(files.units.map((u) => u.id)).toEqual(view.files.map((f) => f.path));
    expect(files.units.every((u) => u.kind === 'file' && u.filePaths.length === 1 && u.filePaths[0] === u.id)).toBe(true);
    const classes = buildCandidateSet(view, { judgeUnit: 'class' }, root, CLEAN_ARCH_LAYERS);
    expect(ids(classes.units)).toEqual(['Task@src/domain/entities/Task.ts', 'TaskController@src/infrastructure/controllers/TaskController.ts']);
    expect(classes.units[0]?.layer).toBe('domain');
  });
});

describe('SEL-03 module coalescing on the golden fixtures', () => {
  function modulesOf(fixture: string): { id: string; files: readonly string[]; single: boolean }[] {
    const root = resolve(REPO, 'fixtures', fixture);
    const candidates = enumerateCandidates(fixtureView(fixture), {}, root);
    return buildModuleUnits(candidates, CLEAN_ARCH_LAYERS).map((u) => ({ id: u.id, files: u.filePaths, single: u.singleFile }));
  }

  it('variant-a: one-file application module, repositories module and a one-file infrastructure module', () => {
    expect(modulesOf('variant-a-structural')).toEqual([
      { id: 'src/application', files: ['src/application/use-cases/CreateTaskUseCase.ts'], single: true },
      { id: 'src/domain', files: ['src/domain/entities/Task.ts', 'src/domain/repositories/ITaskRepository.ts'], single: false },
      { id: 'src/infrastructure', files: ['src/infrastructure/config/InfraConfig.ts'], single: true },
      {
        id: 'src/infrastructure/repositories',
        files: ['src/infrastructure/repositories/CircularHelper.ts', 'src/infrastructure/repositories/InMemoryTaskRepository.ts'],
        single: false,
      },
    ]);
  });

  it('variant-d: every one-file directory passes up to its layer root; no file outside a module', () => {
    const modules = modulesOf('variant-d-subtle');
    expect(modules.map((m) => [m.id, m.files.length])).toEqual([['src/application', 2], ['src/domain', 2], ['src/infrastructure', 3]]);
    expect(modules.flatMap((m) => m.files).sort()).toEqual(fixtureView('variant-d-subtle').files.map((f) => f.path).sort());
  });
});

describe('SEL-03 mapped roots (BLM §4.1, ADR-017 item 4) on the NestJS remap tree', () => {
  interface Expected {
    scenarios: { name: string; layers: { name: string; directories: string[]; filePatterns: string[] }[];
      modules: { id: string; layer: string; filePaths: string[]; singleFile: boolean }[] }[];
  }
  const expected = JSON.parse(readFileSync(join(UNITS, 'nestjs-remap/expected-modules.json'), 'utf8')) as Expected;
  const base = loadView('nestjs-remap');

  it.each(expected.scenarios.map((s) => [s.name, s] as const))('%s', (_name, scenario) => {
    const names = new Set(scenario.layers.map((l) => l.name));
    const view: JudgeGraphView = { ...base, files: base.files.map((f) => ({ ...f, layer: f.layer !== null && names.has(f.layer) ? f.layer : null })) };
    const candidates = enumerateCandidates(view, {}, join(UNITS, 'nestjs-remap'));
    const units = buildModuleUnits(candidates, scenario.layers.map((l) => layer(l.name, l.directories, l.filePatterns)));
    expect(units.map((u) => ({ id: u.id, layer: u.layer, filePaths: u.filePaths, singleFile: u.singleFile }))).toEqual(scenario.modules);
    for (const unit of units.filter((u) => u.layer === 'domain')) {
      expect(unit.filePaths.some((p) => p.endsWith('.service.ts') || p.endsWith('.controller.ts'))).toBe(false);
    }
  });

  it.each([
    ['src/domain/**', { shape: 'P', root: 'src/domain' }],
    ['./src/domain/**', { shape: 'P', root: 'src/domain' }],
    ['src/**/*.ts', { shape: 'P', root: 'src' }],
    ['src/domain/', { shape: 'P', root: 'src/domain' }],
    ['**/domain/**', { shape: 'S', prefix: ['**', 'domain'] }],
    ['src/**/domain/**', { shape: 'S', prefix: ['src', '**', 'domain'] }],
    ['**/*.entity.ts', { shape: 'F' }],
    ['**/*', { shape: 'F' }],
    ['*.ts', { shape: 'F' }],
  ])('classifies %s', (glob, shape) => {
    expect(classifyGlob(glob)).toEqual(shape);
  });

  it('S roots match whole segments only (billingdomain is not domain)', () => {
    const view: JudgeGraphView = {
      files: [
        { path: 'src/billingdomain/a.ts', layer: 'domain', isBarrel: false },
        { path: 'src/billingdomain/b.ts', layer: 'domain', isBarrel: false },
      ],
      classes: [], interfaces: [], edges: [],
    };
    const units = buildModuleUnits(enumerateCandidates(view, {}, UNITS), [layer('domain', ['**/domain/**'])]);
    expect(ids(units)).toEqual(['src/billingdomain']);
  });
});

describe('SEL-03 partition property over 200 seeded random trees (D-U4-11)', () => {
  function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const LAYERS = ['application', 'domain', 'infrastructure'];
  const DIRS = ['a', 'b', 'c', 'domain', 'x'];

  it('modules partition the candidates, never mix layers, and contain only files under their directory', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rnd = mulberry32(seed);
      const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
      const files = new Map<string, JudgeGraphFile>();
      const n = 1 + Math.floor(rnd() * 25);
      for (let i = 0; i < n; i++) {
        const shape = rnd();
        let p: string;
        let lay: string;
        if (shape < 0.6) {
          lay = pick(LAYERS);
          const depth = Math.floor(rnd() * 4);
          p = ['src', lay, ...Array.from({ length: depth }, () => pick(DIRS)), `f${String(i)}.ts`].join('/');
        } else if (shape < 0.8) {
          lay = 'domain';
          p = ['src', pick(DIRS), pick(DIRS), `e${String(i)}.entity.ts`].join('/');
        } else {
          lay = pick(LAYERS);
          p = ['lib', pick(DIRS), `g${String(i)}.ts`].join('/');
        }
        files.set(p, { path: p, layer: lay, isBarrel: false });
      }
      const view = sortJudgeGraphView({ files: [...files.values()], classes: [], interfaces: [], edges: [] });
      const layers = [
        layer('application', ['src/application/**']),
        layer('domain', ['src/domain/**', '**/domain/**'], ['**/*.entity.ts']),
        layer('infrastructure', ['src/infrastructure/**']),
      ];
      const candidates = enumerateCandidates(view, {}, UNITS);
      const units = buildModuleUnits(candidates, layers);
      const seen = new Map<string, string>();
      for (const unit of units) {
        const dir = unit.id.split('#')[0] ?? '';
        for (const p of unit.filePaths) {
          expect(seen.has(p)).toBe(false);
          seen.set(p, unit.id);
          expect(files.get(p)?.layer).toBe(unit.layer);
          expect(dir === '.' || p.startsWith(`${dir}/`)).toBe(true);
        }
      }
      expect([...seen.keys()].sort()).toEqual(candidates.files.map((f) => f.path).sort());
      expect(new Set(ids(units)).size).toBe(units.length);
    }
  });
});

describe('SEL-04 seeded order and cap', () => {
  const view = loadView('three-layer-cap');
  const units = buildCandidateSet(view, { judgeUnit: 'file' }, join(UNITS, 'three-layer-cap'), []).units;

  it('is deterministic across runs', () => {
    expect(selectUnits(units, DEFAULT_SELECTION_RULE, FN)).toEqual(selectUnits([...units].reverse(), DEFAULT_SELECTION_RULE, FN));
  });

  it('cap 2 over three layers picks two different layers (round-robin in layer order)', () => {
    const result = selectUnits(units, { ...DEFAULT_SELECTION_RULE, cap: 2 }, FN);
    expect(result.units).toHaveLength(2);
    expect(result.units.map((u) => u.layer).sort()).toEqual(['application', 'domain']);
    expect(result.unitsCapped).toBe(7);
    const appRanked = units.filter((u) => u.layer === 'application')
      .sort((a, b) => (rankOf(DEFAULT_SELECTION_RULE.seed, a.id) < rankOf(DEFAULT_SELECTION_RULE.seed, b.id) ? -1 : 1));
    expect(result.units.find((u) => u.layer === 'application')?.id).toBe(appRanked[0]?.id);
  });

  it('cap 4 takes one per layer, then the next ranked unit of the first layer', () => {
    const result = selectUnits(units, { ...DEFAULT_SELECTION_RULE, cap: 4 }, FN);
    const perLayer = result.units.reduce<Record<string, number>>((acc, u) => ({ ...acc, [u.layer]: (acc[u.layer] ?? 0) + 1 }), {});
    expect(perLayer).toEqual({ application: 2, domain: 1, infrastructure: 1 });
  });

  it('returns the judged set in id order with the selection record', () => {
    const result = selectUnits(units, { ...DEFAULT_SELECTION_RULE, cap: 3 }, FN);
    expect(ids(result.units)).toEqual([...ids(result.units)].sort());
    expect(result.selection).toEqual({ functionId: FN, candidateUnitIds: ids(units), selectedUnitIds: ids(result.units), source: 'own' });
  });

  it('rank is sha256(seed \\0 id)', () => {
    expect(rankOf('s', 'u')).toMatch(/^[0-9a-f]{64}$/);
    expect(rankOf('s', 'u')).not.toBe(rankOf('t', 'u'));
  });

  it('a minSizeTokens above a unit size makes it ineligible (declared 0 by default)', () => {
    const result = selectUnits(units, { ...DEFAULT_SELECTION_RULE, minSizeTokens: 1000 }, FN);
    expect(result.units).toEqual([]);
    expect(result.unitsCapped).toBe(units.length);
  });

  it.each(['correct-reference', 'variant-a-structural', 'variant-b-pattern', 'variant-c-everything', 'variant-d-subtle'])(
    '%s: unitsCapped = 0 for file and module units',
    (fixture) => {
      const root = resolve(REPO, 'fixtures', fixture);
      for (const judgeUnit of ['file', 'module'] as const) {
        const set = buildCandidateSet(fixtureView(fixture), { judgeUnit }, root, CLEAN_ARCH_LAYERS);
        const result = selectUnits(set.units, DEFAULT_SELECTION_RULE, FN);
        expect(result.unitsCapped).toBe(0);
        expect(result.units).toHaveLength(set.units.length);
      }
    },
  );

  it('a seeded list (development only) is taken first, then the seeded order', () => {
    const seeded = ['src/infrastructure/part1/file1.ts', 'missing.ts'];
    const result = selectUnits(units, { ...DEFAULT_SELECTION_RULE, cap: 2, seededList: seeded }, FN);
    expect(ids(result.units)).toContain('src/infrastructure/part1/file1.ts');
    expect(result.units).toHaveLength(2);
  });
});

describe('SEL-07 baseline reuse', () => {
  const unit = (id: string, lay = 'domain'): JudgeUnit => ({ id, kind: 'module', layer: lay, filePaths: [`${id}/a.ts`], sizeTokens: 1, singleFile: true });
  const baseline: BaselineSelection = {
    functionId: FN,
    candidateUnitIds: ['src/a', 'src/b', 'src/c'],
    selectedUnitIds: ['src/a', 'src/c'],
    source: 'own',
  };

  it('judges the baseline ids plus a module the variant created, and reports removed ids', () => {
    const variantUnits = [unit('src/a'), unit('src/b'), unit('src/new')];
    const rule: UnitSelectionRule = { ...DEFAULT_SELECTION_RULE, baseline };
    const result = selectUnits(variantUnits, rule, FN);
    expect(result.units.map((u) => [u.id, u.origin])).toEqual([['src/a', undefined], ['src/new', 'addedByVariant']]);
    expect(result.addedByVariant).toEqual(['src/new']);
    expect(result.removedByVariant).toEqual(['src/c']);
    expect(result.unitsCapped).toBe(1);
    expect(result.selection).toEqual({
      functionId: FN, candidateUnitIds: ['src/a', 'src/b', 'src/new'], selectedUnitIds: ['src/a', 'src/new'], source: 'baseline',
    });
  });

  it('ignores the cap on a variant run (the baseline decided the selection)', () => {
    const result = selectUnits([unit('src/a'), unit('src/c'), unit('src/z')], { ...DEFAULT_SELECTION_RULE, cap: 1, baseline }, FN);
    expect(ids(result.units)).toEqual(['src/a', 'src/c', 'src/z']);
  });

  it('a variant judged without the baseline report selects on its own (source own)', () => {
    expect(selectUnits([unit('src/a')], DEFAULT_SELECTION_RULE, FN).selection.source).toBe('own');
  });

  it('resolves the function row, and a missing row is LLM_BASELINE_SELECTION_MISSING', () => {
    expect(resolveBaselineSelection(FN, undefined)).toEqual({ success: true, data: undefined });
    expect(resolveBaselineSelection(FN, [baseline])).toEqual({ success: true, data: baseline });
    const missing = resolveBaselineSelection(functionId('FF-N02'), [baseline]);
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.errors[0]?.code).toBe('LLM_BASELINE_SELECTION_MISSING');
  });
});
