import picomatch from 'picomatch';
import {
  agreement, archunitChecks, boundariesGroups, CAPABILITY, cycleEdges, dcGlob, depcruiseRules, forbiddenPairs, KIND_UNIT, layerOf, packageName, table, TEMPLATE_KIND, wilson,
} from '../../../../scripts/v1.3/lib/convergent.js';
import type { Ir } from '../../../../scripts/v1.3/lib/convergent.js';

const LAYERS = ['domain', 'application', 'infrastructure'];

describe('convergent: forbidden layer pairs from the bound parameters', () => {
  it('dependency-direction: every inner-to-outer pair of layerOrder', () => {
    expect(forbiddenPairs('dependency-direction', { layerOrder: LAYERS }, LAYERS)).toEqual([
      ['domain', 'application'], ['domain', 'infrastructure'], ['application', 'infrastructure'],
    ]);
  });
  it('no-layer-skip: every pair but the allowed transitions', () => {
    const p = forbiddenPairs('no-layer-skip', { allowedTransitions: ['business>persistence', 'presentation>business'] }, ['persistence', 'business', 'presentation']);
    expect(p).toHaveLength(4);
    expect(p).toContainEqual(['presentation', 'persistence']);
    expect(p).not.toContainEqual(['business', 'persistence']);
  });
  it('domain rules: domain to every other layer', () => {
    expect(forbiddenPairs('core-isolation', { domainLayer: 'domain' }, LAYERS)).toEqual([['domain', 'application'], ['domain', 'infrastructure']]);
  });
  it('graph templates: against an allowed edge, or sideways with none', () => {
    const allowed = ['application>domain', 'in>application', 'out>application'];
    const names = ['domain', 'application', 'in', 'out'];
    expect(forbiddenPairs('dependency-direction-graph', { allowedDependencies: allowed }, names)).toEqual([['domain', 'application'], ['application', 'in'], ['application', 'out']]);
    const side = forbiddenPairs('layer-skip-graph', { allowedDependencies: allowed }, names);
    expect(side).toContainEqual(['in', 'out']);
    expect(side).toContainEqual(['out', 'in']);
    expect(side).not.toContainEqual(['application', 'domain']);
  });
});

describe('convergent: layer membership', () => {
  const layers = [{ name: 'a', dirs: ['src/a/**'], files: [] }, { name: 'b', dirs: ['src/**'], files: ['**/*.service.ts'] }];
  it('first layer by directories, then by file patterns', () => {
    expect(layerOf('src/a/x.ts', layers)).toBe('a');
    expect(layerOf('src/x.ts', layers)).toBe('b');
    expect(layerOf('lib/x.service.ts', layers)).toBe('b');
    expect(layerOf('lib/x.ts', layers)).toBeUndefined();
  });
});

const IR: Ir = {
  style: 'clean-architecture',
  layers: [{ name: 'domain', dirs: ['src/domain/**'], files: [] }, { name: 'application', dirs: ['src/application/**'], files: ['**/*.service.ts'] }],
  rules: [
    { id: 'FF-S01', template: 'dependency-direction', kind: 'layer-edge', view: 'literal', excludeRx: [], pairs: [['domain', 'application']] },
    { id: 'FF-P01', template: 'domain-purity', kind: 'package', view: 'resolved', excludeRx: [], srcLayer: 'domain', packages: ['@nestjs/*', 'typeorm'] },
    { id: 'FF-S02', template: 'no-cyclic-deps', kind: 'cycle', view: 'literal', excludeRx: [] },
  ],
  untranslated: [],
  extractorExcludes: ['**/*.spec.ts'],
};

describe('convergent: emitters', () => {
  it('dependency-cruiser: one rule per selector pair, packages and cycles', () => {
    const r = depcruiseRules(IR);
    expect(r.filter((x) => x.name.startsWith('FF-S01--'))).toHaveLength(2); // domain dirs × (application dirs, application files)
    expect(r.find((x) => x.name.startsWith('FF-P01--'))?.to?.path).toHaveLength(2);
    expect(r.find((x) => x.name.startsWith('FF-S02--'))?.to).toEqual({ circular: true });
  });
  it('boundaries: one run per rule, directories before file patterns', () => {
    const g = boundariesGroups(IR);
    expect(g.map((x) => x.ruleIds)).toEqual([['FF-S01'], ['FF-P01']]);
    expect(g[0]?.elements.map((e) => e.pattern)).toEqual([['src/domain/**'], ['src/application/**'], ['**/*.service.ts']]);
  });
  it('archunit: the file-pattern selector excludes every directory layer and the extractor excludes', () => {
    const checks = archunitChecks(IR);
    expect(checks.filter((c) => c.id === 'FF-P01')).toHaveLength(0); // no package nodes in its graph
    const s01 = checks.filter((c) => c.id === 'FF-S01' && c.op === 'not-depend');
    expect(s01).toHaveLength(2);
    const toFiles = new RegExp((s01[1] as { to: string }).to);
    expect(toFiles.test('src/x/a.service.ts')).toBe(true);
    expect(toFiles.test('src/domain/a.service.ts')).toBe(false);
    expect(toFiles.test('src/x/a.service.spec.ts')).toBe(false);
    const from = new RegExp((s01[0] as { from: string }).from);
    expect(from.test('src/domain/e/A.ts')).toBe(picomatch('src/domain/**', { dot: true })('src/domain/e/A.ts'));
  });
  it('capability table covers every kind for every tool', () => {
    const kinds = Object.keys(KIND_UNIT);
    for (const t of Object.values(CAPABILITY)) expect(Object.keys(t).sort()).toEqual([...kinds].sort());
    for (const v of Object.values(TEMPLATE_KIND)) expect(kinds).toContain(v.kind);
  });
});

describe('convergent: dependency-cruiser globs', () => {
  it('the negated-extglob last segment agrees with picomatch', () => {
    const paths = ['src/a/x.ts', 'src/a/b/x.module.ts', 'src/a/b/c/y.ts', 'src/a/x.module.ts', 'src/a/b/FooController.ts', 'src/a/index.ts', 'src/a/b/IndexA.ts', 'lib/a/x.ts'];
    for (const g of ['src/a/**/!(*.module).ts', 'src/a/**/!(*Controller|index).ts', 'src/a/**']) {
      const r = new RegExp(dcGlob(g));
      for (const p of paths) expect([g, p, r.test(p)]).toEqual([g, p, picomatch(g, { dot: true })(p)]);
    }
  });
});

describe('convergent: keys', () => {
  it('package names', () => {
    expect(packageName('@nestjs/common/decorators')).toBe('@nestjs/common');
    expect(packageName('node_modules/@types/express/index.d.ts')).toBe('express');
    expect(packageName('typeorm')).toBe('typeorm');
    expect(packageName('node_modules/@types/babel__core/index.d.ts')).toBe('@babel/core');
  });
  it('cycle edges from a closed or open path', () => {
    expect(cycleEdges(['a', 'b', 'a'])).toEqual([['a', 'b'], ['b', 'a']]);
    expect(cycleEdges(['a', 'b', 'c'])).toEqual([['a', 'b'], ['b', 'c'], ['c', 'a']]);
  });
});

describe('convergent: agreement', () => {
  it('2x2 table and Cohen kappa', () => {
    const t = table(new Set(['x', 'y']), new Set(['y', 'z']), 10);
    expect(t).toEqual({ both: 1, aOnly: 1, bOnly: 1, neither: 7 });
    const a = agreement(t);
    expect(a.po).toBeCloseTo(0.8);
    // pe = 0.2*0.2 + 0.8*0.8 = 0.68; kappa = (0.8 - 0.68) / 0.32
    expect(a.kappa).toBeCloseTo(0.375);
    expect(a.positiveAgreement).toBeCloseTo(0.5);
  });
  it('kappa is undefined when both raters say no to everything', () => {
    expect(agreement({ both: 0, aOnly: 0, bOnly: 0, neither: 5 }).kappa).toBeNull();
  });
  it('wilson interval', () => {
    const [lo, hi] = wilson(5, 5);
    expect(lo).toBeCloseTo(0.5655, 3);
    expect(hi).toBe(1);
  });
});
