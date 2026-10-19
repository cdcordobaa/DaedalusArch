import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSpec } from '../../../../src/spec-parser/index.js';
// v1.4 U2: the declared rules exactly, so the sealed rule set (the post-seal overlay would add FF-P07; Docs/v1.4/adr-v14.md).
import { compileFunctions, V13_SEALED_COMPILE_OPTIONS } from '../../../../src/fitness-compiler/index.js';
import { compilerInputFromSpec } from '../../../../src/fitness-compiler/compiler-input.js';
import { assignLayers } from '../../../../scripts/v1.3/lib/layer-assignment.js';
import {
  boundariesAllows, boundariesElement, classifyDcRule, compactLayers, escapeGlob, evaluateGraphRules, nxTagMatches,
  nxViolations, substituteGroups, toSpecYaml, translate,
} from '../../../../scripts/v1.3/declared-to-aac.js';
import type { BoundariesDecl, DepcruiseDecl, NxDecl, Translation } from '../../../../scripts/v1.3/declared-to-aac.js';

/** Parse the emitted spec with DaedalusArch's parser and assign layers with its own annotator. */
async function specRoundTrip(t: Translation): Promise<{ layerOf: Map<string, string | null>; allowed: Set<string>; compiled: string[] }> {
  const dir = mkdtempSync(join(tmpdir(), 'declared-aac-'));
  try {
    const p = join(dir, 'spec.yaml');
    writeFileSync(p, toSpecYaml(t, { repo: 'test/repo', sha: '0', configPath: 'cfg' }));
    const parsed = await parseSpec({ specFilePath: p });
    if (!parsed.success) throw new Error(parsed.errors.map((e) => e.message).join('; '));
    const spec = parsed.data;
    const files = [...t.layerOf.keys()];
    const a = assignLayers(files, spec.layerModel);
    const layerOf = new Map(a.assignments.map((x) => [x.file, x.layer]));
    const allowed = new Set((spec.layerModel.allowedDependencies ?? []).map((e) => `${e.from}>${e.to}`));
    const compiled = compileFunctions(compilerInputFromSpec(spec), V13_SEALED_COMPILE_OPTIONS);
    if (!compiled.success) throw new Error(compiled.errors.map((e) => e.message).join('; '));
    return { layerOf, allowed, compiled: compiled.data.symbolicQueries.map((c) => String(c.functionId)).sort() };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('declared-to-aac: dependency-cruiser', () => {
  const files = [
    'src/lib/a.ts', 'src/lib/b.ts', 'src/protocol/p.ts', 'src/types/t.ts', 'src/crdts/c.ts', 'src/internal.ts', 'src/index.ts',
  ];
  const decl: DepcruiseDecl = {
    family: 'depcruise',
    forbidden: [
      { name: 'illegal-import-from-libs', severity: 'error', from: { path: '^src/lib/' }, to: { pathNot: '^src/(globals|lib)/' } },
      { name: 'illegal-import-from-protocol', severity: 'error', from: { path: '^src/protocol/' }, to: { pathNot: '^src/(globals|protocol|lib)/' } },
      { name: 'no-circular', severity: 'warn', from: {}, to: { circular: true } },
      { name: 'not-to-dev-dep', severity: 'error', from: { path: '^src' }, to: { dependencyTypes: ['npm-dev'] } },
      { name: 'off', severity: 'ignore', from: { path: '^src' }, to: { path: '^src' } },
    ],
  };

  it('classifies path, non-path and inactive rules', () => {
    const cov = (n: number) => classifyDcRule(decl.forbidden?.[n] ?? {}, 'forbidden').coverage;
    expect(cov(0).status).toBe('partial'); // pathNot-only target also catches packages
    expect(cov(2).status).toBe('not-expressible');
    expect(cov(3).status).toBe('not-expressible');
    expect(cov(4).status).toBe('inactive');
    expect(classifyDcRule({ name: 'x', from: { path: '^a' }, to: { path: '^b' } }, 'forbidden').coverage.status).toBe('translated');
  });

  it('atomises by rule signature and forbids exactly the declared pairs', () => {
    const t = translate(decl, files);
    const atomOf = (f: string) => t.layerOf.get(f);
    expect(atomOf('src/lib/a.ts')).toBe(atomOf('src/lib/b.ts'));
    expect(atomOf('src/types/t.ts')).toBe(atomOf('src/index.ts')); // no rule tells them apart
    const v = evaluateGraphRules([
      { source: 'src/lib/a.ts', target: 'src/lib/b.ts' },
      { source: 'src/lib/a.ts', target: 'src/types/t.ts' },
      { source: 'src/protocol/p.ts', target: 'src/lib/a.ts' },
      { source: 'src/protocol/p.ts', target: 'src/crdts/c.ts' },
      { source: 'src/crdts/c.ts', target: 'src/protocol/p.ts' },
    ], (f) => t.layerOf.get(f) ?? null, new Set(t.allowed));
    expect(v.map((x) => `${x.source}>${x.target}`)).toEqual(['src/lib/a.ts>src/types/t.ts', 'src/protocol/p.ts>src/crdts/c.ts']);
    expect(t.intraAtomForbidden).toEqual([]);
  });

  it('expands $n group matching per captured value', () => {
    const d: DepcruiseDecl = {
      family: 'depcruise',
      forbidden: [{ name: 'no-cross-feature', from: { path: '^src/features/([^/]+)/' }, to: { path: '^src/features/([^/]+)/', pathNot: '^src/features/$1/' } }],
    };
    const fs = ['src/features/a/x.ts', 'src/features/a/y.ts', 'src/features/b/z.ts', 'src/shared/s.ts'];
    const t = translate(d, fs);
    expect(t.layerOf.get('src/features/a/x.ts')).toBe(t.layerOf.get('src/features/a/y.ts'));
    expect(t.layerOf.get('src/features/a/x.ts')).not.toBe(t.layerOf.get('src/features/b/z.ts'));
    const a = t.layerOf.get('src/features/a/x.ts') ?? '';
    const b = t.layerOf.get('src/features/b/z.ts') ?? '';
    const s = t.layerOf.get('src/shared/s.ts') ?? '';
    expect(t.allowed).not.toContain(`${a}>${b}`);
    expect(t.allowed).toContain(`${a}>${s}`);
    expect(substituteGroups('^src/$1/', ['a.b'])).toBe('^src/a\\.b/');
  });

  it('records a same-atom prohibition as not expressible', () => {
    const d: DepcruiseDecl = { family: 'depcruise', forbidden: [{ name: 'views-no-siblings', from: { path: '^src/views/' }, to: { path: '^src/views/' } }] };
    const t = translate(d, ['src/views/a.ts', 'src/views/b.ts', 'src/x.ts']);
    expect(t.intraAtomForbidden.map((x) => x.rules)).toEqual([['views-no-siblings']]);
    expect(t.coverage.some((c) => c.rule.startsWith('same-atom') && c.status === 'not-expressible')).toBe(true);
  });

  it('emits a spec that DaedalusArch parses, binds and assigns exactly like the atom map', async () => {
    const t = translate(decl, files);
    const rt = await specRoundTrip(t);
    for (const [f, l] of t.layerOf) expect(rt.layerOf.get(f)).toBe(l);
    for (const e of t.allowed) expect(rt.allowed.has(e)).toBe(true);
    expect(rt.compiled).toEqual(['FF-S01', 'FF-S03']);
  });
});

describe('declared-to-aac: eslint-plugin-boundaries', () => {
  const decl: BoundariesDecl = {
    family: 'boundaries',
    elements: [
      { type: 'frontend', mode: 'file', pattern: 'src/client/**/*' },
      { type: 'core', mode: 'file', pattern: ['src/core/!(tests)/**', 'src/core/!(tests)'] },
      { type: 'backend', mode: 'file', pattern: 'src/backend/**/*' },
      { type: 'feature', pattern: 'src/features/*', capture: ['name'] },
      { type: 'app', pattern: 'src/app' },
    ],
    options: {
      default: 'disallow',
      rules: [
        { from: 'frontend', allow: ['frontend', 'core'] },
        { from: 'core', allow: ['core'] },
        { from: 'backend', allow: ['backend', 'core'] },
        { from: 'feature', allow: [['feature', { name: '${from.name}' }], 'core'] },
        { from: 'app', allow: ['feature', 'core'] },
        { from: 'app', disallow: [['feature', { name: 'secret' }]] },
      ],
    },
  };

  it('assigns elements like the plugin (file and folder modes, captures)', () => {
    expect(boundariesElement('src/client/a/b.tsx', decl)?.type).toBe('frontend');
    expect(boundariesElement('src/core/util.ts', decl)?.type).toBe('core');
    expect(boundariesElement('src/core/tests/x.ts', decl)).toBeNull();
    const f = boundariesElement('src/features/cart/ui/button.ts', decl);
    expect(f).toEqual({ type: 'feature', elementPath: 'src/features/cart', capturedValues: { name: 'cart' } });
    expect(boundariesElement('src/app/main.ts', decl)?.elementPath).toBe('src/app');
  });

  it('evaluates rules in order, the last matching one winning', () => {
    const e = (p: string) => { const x = boundariesElement(p, decl); if (x === null) throw new Error(p); return x; };
    expect(boundariesAllows(decl, e('src/app/main.ts'), e('src/features/cart/a.ts')).allowed).toBe(true);
    expect(boundariesAllows(decl, e('src/app/main.ts'), e('src/features/secret/a.ts')).allowed).toBe(false);
    expect(boundariesAllows(decl, e('src/features/cart/a.ts'), e('src/features/cart/b.ts')).allowed).toBe(true);
    expect(boundariesAllows(decl, e('src/features/cart/a.ts'), e('src/features/news/b.ts')).allowed).toBe(false);
    expect(boundariesAllows(decl, e('src/core/a.ts'), e('src/client/b.ts')).allowed).toBe(false);
  });

  it('keeps unknown files out of every layer and splits instances that may not import each other', async () => {
    const d: BoundariesDecl = {
      family: 'boundaries',
      elements: [{ type: 'widget', pattern: 'src/widgets/*' }, { type: 'shared', pattern: 'src/shared' }],
      options: { default: 'disallow', rules: [{ from: 'widget', allow: ['shared'] }, { from: 'shared', allow: ['shared'] }] },
    };
    const fs = ['src/widgets/a/x.ts', 'src/widgets/a/y.ts', 'src/widgets/b/z.ts', 'src/shared/s.ts', 'src/main.ts'];
    const t = translate(d, fs);
    expect(t.layerOf.get('src/main.ts')).toBeNull();
    expect(t.layerOf.get('src/widgets/a/x.ts')).toBe(t.layerOf.get('src/widgets/a/y.ts'));
    expect(t.layerOf.get('src/widgets/a/x.ts')).not.toBe(t.layerOf.get('src/widgets/b/z.ts'));
    expect(t.intraAtomForbidden).toEqual([]);
    const rt = await specRoundTrip(t);
    for (const [f, l] of t.layerOf) expect(rt.layerOf.get(f)).toBe(l);
  });
});

describe('declared-to-aac: Nx', () => {
  const decl: NxDecl = {
    family: 'nx',
    projects: [
      { name: 'app', root: 'apps/app', tags: ['type:app', 'scope:shop'] },
      { name: 'feat', root: 'libs/feat', tags: ['type:feature', 'scope:shop'] },
      { name: 'util', root: 'libs/util', tags: ['type:util', 'scope:shared'] },
      { name: 'untagged', root: 'libs/untagged', tags: [] },
      { name: 'root', root: '.', tags: ['type:util'] },
    ],
    depConstraints: [
      { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:feature', 'type:util'] },
      { sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:util'] },
      { sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:util'] },
      { sourceTag: 'scope:shop', onlyDependOnLibsWithTags: ['scope:shop', 'scope:shared'] },
    ],
  };
  const p = (n: string) => { const x = decl.projects.find((y) => y.name === n); if (x === undefined) throw new Error(n); return x; };

  it('applies every matching constraint and the project-without-tags rule', () => {
    expect(nxViolations(decl, p('app'), p('feat'))).toEqual([]);
    expect(nxViolations(decl, p('feat'), p('app'))).toEqual(['type:feature:onlyDependOnLibsWithTags']);
    expect(nxViolations(decl, p('app'), p('root'))).toEqual(['scope:shop:onlyDependOnLibsWithTags']);
    expect(nxViolations(decl, p('untagged'), p('util'))[0]).toMatch(/^no-constraint-for-source/);
    expect(nxTagMatches('scope:*', 'scope:x')).toBe(true);
    expect(nxTagMatches('/^type:(ui|util)$/', 'type:ui')).toBe(true);
  });

  it('maps files to the deepest project root and round-trips through the spec', async () => {
    const fs = ['apps/app/src/main.ts', 'libs/feat/src/index.ts', 'libs/util/src/index.ts', 'libs/untagged/a.ts', 'tools/x.ts'];
    const t = translate(decl, fs);
    expect(t.atoms.map((a) => a.label).sort()).toEqual(['app', 'feat', 'root', 'untagged', 'util']);
    const rt = await specRoundTrip(t);
    for (const [f, l] of t.layerOf) expect(rt.layerOf.get(f)).toBe(l);
  });
});

describe('declared-to-aac: layer compaction', () => {
  it('owns whole directories when it can and lists the rest', () => {
    const m = new Map<string, string | null>([
      ['src/a/x.ts', 'A'], ['src/a/y.ts', 'A'], ['src/b/z.ts', 'B'], ['src/b/w.ts', 'A'], ['src/[id].tsx', 'B'], ['src/n.ts', null],
    ]);
    const c = compactLayers(m);
    expect(c.get('A')).toEqual({ directories: ['src/a/**'], filePatterns: ['src/b/w.ts'] });
    expect(c.get('B')).toEqual({ directories: [], filePatterns: ['src/\\[id\\].tsx', 'src/b/z.ts'] });
    expect(escapeGlob('a/(x)/[y].ts')).toBe('a/\\(x\\)/\\[y\\].ts');
  });
});

describe('declared-to-aac: per-file rule off (D6)', () => {
  it('turns files the team excludes into exclude_paths that the evaluation honours', async () => {
    const d: NxDecl = {
      family: 'nx',
      projects: [{ name: 'a', root: 'libs/a', tags: ['t:a'] }, { name: 'b', root: 'libs/b', tags: ['t:b'] }],
      depConstraints: [{ sourceTag: 't:a', onlyDependOnLibsWithTags: ['t:a'] }, { sourceTag: 't:b', onlyDependOnLibsWithTags: ['t:b'] }],
      disabledFiles: ['libs/a/src/x.ts', 'libs/a/src/y.ts'],
    };
    const fs = ['libs/a/src/x.ts', 'libs/a/src/y.ts', 'libs/a/z.ts', 'libs/b/src/i.ts'];
    const t = translate(d, fs);
    expect(t.excludedSources).toEqual(['libs/a/src/x.ts', 'libs/a/src/y.ts']);
    const dir = mkdtempSync(join(tmpdir(), 'declared-aac-'));
    try {
      const p = join(dir, 'spec.yaml');
      writeFileSync(p, toSpecYaml(t, { repo: 'r', sha: '0', configPath: 'c' }));
      const parsed = await parseSpec({ specFilePath: p });
      if (!parsed.success) throw new Error(parsed.errors.map((e) => e.message).join('; '));
      const ff = parsed.data.fitnessFunctions.find((f) => String(f.id) === 'FF-S03');
      expect(ff?.excludePaths).toEqual(['libs/a/src/**']);
      const compiled = compileFunctions(compilerInputFromSpec(parsed.data), V13_SEALED_COMPILE_OPTIONS);
      if (!compiled.success) throw new Error('compile');
      const q = compiled.data.symbolicQueries.find((x) => String(x.functionId) === 'FF-S03');
      const patterns = (q?.params.excludePatterns ?? []) as string[];
      expect(patterns.length).toBe(1);
      const v = evaluateGraphRules(
        [{ source: 'libs/a/src/x.ts', target: 'libs/b/src/i.ts' }, { source: 'libs/a/z.ts', target: 'libs/b/src/i.ts' }],
        (f) => t.layerOf.get(f) ?? null, new Set(t.allowed), patterns,
      );
      expect(v.map((x) => x.source)).toEqual(['libs/a/z.ts']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
