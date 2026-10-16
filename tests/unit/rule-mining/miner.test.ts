/**
 * Rule mining (src/rule-mining): the miner on synthetic inputs (every rule kind, its evidence and exceptions), the
 * emitter (allowed_dependencies, layer order, switched-off functions) and one end-to-end proposal on the
 * clean-architecture reference project (the emitted spec validates and compiles to existing templates).
 */
import * as path from 'node:path';
import YAML from 'yaml';
import { emitMinedSpec, layerPairStats, linearAllowed, mineRules, proposeRules, roleSuffix, topologicalOrder } from '../../../src/rule-mining/index.js';
import type { MiningInput, MinedRule } from '../../../src/rule-mining/index.js';

type Decl = MiningInput['declarations'][number];

function input(over: Partial<MiningInput> & { files: Record<string, string | null> }): MiningInput {
  const files = Object.keys(over.files).sort();
  return {
    files,
    layerOf: new Map(Object.entries(over.files)),
    layers: over.layers ?? ['domain', 'application', 'infrastructure'],
    layerKinds: over.layerKinds ?? new Map([['domain', 'domain'], ['application', 'application'], ['infrastructure', 'infrastructure']]),
    fileEdges: over.fileEdges ?? [],
    packageImports: over.packageImports ?? [],
    declarations: over.declarations ?? [],
    typeEdges: over.typeEdges ?? [],
    ...(over.components !== undefined ? { components: over.components } : {}),
    ...(over.literalEdges !== undefined ? { literalEdges: over.literalEdges } : {}),
  };
}

const D = (n: number): string => `src/domain/D${String(n)}.ts`;
const A = (n: number): string => `src/application/A${String(n)}.ts`;
const I = (n: number): string => `src/infrastructure/I${String(n)}.ts`;

/** Four domain, four application, four infrastructure files; application -> domain, infrastructure -> both. */
function layered(extra: { from: string; to: string }[] = []): MiningInput {
  const files: Record<string, string> = {};
  for (let i = 1; i <= 4; i++) { files[D(i)] = 'domain'; files[A(i)] = 'application'; files[I(i)] = 'infrastructure'; }
  const edges = [];
  for (let i = 1; i <= 4; i++) {
    edges.push({ from: A(i), to: D(i) }, { from: I(i), to: A(i) }, { from: I(i), to: D(i) });
  }
  return input({ files, fileEdges: [...edges, ...extra] });
}

const byKind = (rules: readonly MinedRule[], kind: MinedRule['kind']): MinedRule[] => rules.filter((r) => r.kind === kind);

describe('rule mining: layer rules', () => {
  it('computes pair statistics', () => {
    const p = layerPairStats(layered()).find((x) => x.from === 'application' && x.to === 'domain');
    expect(p).toEqual(expect.objectContaining({ fromFiles: 4, edges: 4, reverseEdges: 0, importingFiles: 4, support: 1, absence: 0, direction: 0 }));
  });

  it('proposes "inner must not depend on outer" from direction evidence, with no exception on a clean graph', () => {
    const r = mineRules(layered(), 'clean-architecture');
    const dir = byKind(r.rules, 'layer-direction').map((x) => `${x.subject}>${String(x.object)}`).sort();
    expect(dir).toEqual(['application>infrastructure', 'domain>application', 'domain>infrastructure']);
    expect(byKind(r.rules, 'layer-direction').every((x) => x.exceptions.length === 0)).toBe(true);
    expect(r.allowed).toEqual(['application>domain', 'infrastructure>application', 'infrastructure>domain']);
  });

  it('flags the minority edge against the majority direction as an exception', () => {
    const r = mineRules(layered([{ from: D(1), to: A(2) }]), 'clean-architecture');
    const rule = byKind(r.rules, 'layer-direction').find((x) => x.subject === 'domain' && x.object === 'application');
    expect(rule?.exceptions).toEqual([{ file: D(1), target: A(2) }]);
    expect(rule?.evidence).toEqual({ fromFiles: 4, importingFiles: 1, edges: 1, reverseEdges: 4 });
    // smoothed: 4/(1+4+1) * (4-1)/(4+1)
    expect(rule?.confidence).toBeCloseTo(0.4, 3);
    expect(rule?.compilesTo?.template).toBe('dependency-direction');
    expect(r.allowed).not.toContain('domain>application');
  });

  it('proposes no direction rule when too many files import against the direction', () => {
    const back = [1, 2].map((i) => ({ from: D(i), to: A(i) }));
    const r = mineRules(layered(back), 'clean-architecture');
    expect(byKind(r.rules, 'layer-direction').find((x) => x.subject === 'domain' && x.object === 'application')).toBeUndefined();
    expect(r.allowed).toContain('domain>application');
  });

  it('proposes a low-confidence rare-edge rule and an unobserved-pair rule without direction evidence', () => {
    const files: Record<string, string> = {};
    for (let i = 1; i <= 4; i++) { files[D(i)] = 'domain'; files[A(i)] = 'application'; files[I(i)] = 'infrastructure'; }
    const edges = [1, 2, 3, 4].map((i) => ({ from: A(i), to: D(i) }));
    const r = mineRules(input({ files, fileEdges: [...edges, { from: I(1), to: D(1) }] }), 'hexagonal');
    const rare = byKind(r.rules, 'layer-rare-edge');
    expect(rare.map((x) => `${x.subject}>${String(x.object)}`)).toEqual(['infrastructure>domain']);
    expect(rare[0]?.level).toBe('low');
    expect(rare[0]?.compilesTo?.template).toBe('layer-skip-graph');
    const unobserved = byKind(r.rules, 'layer-unobserved').map((x) => `${x.subject}>${String(x.object)}`);
    expect(unobserved).toEqual(['application>infrastructure', 'infrastructure>application']);
    expect(r.allowed).toEqual(['application>domain']);
    expect(mineRules(input({ files, fileEdges: [...edges, { from: I(1), to: D(1) }] }), 'hexagonal', { forbidKinds: ['layer-direction'] }).allowed)
      .toEqual(['application>domain', 'infrastructure>domain']);
  });

  it('marks pair rules a total order cannot express as not representable', () => {
    const files: Record<string, string> = { [D(1)]: 'domain', [A(1)]: 'application', [I(1)]: 'infrastructure' };
    const r = mineRules(input({ files, fileEdges: [{ from: A(1), to: D(1) }, { from: I(1), to: D(1) }] }), 'clean-architecture');
    const u = byKind(r.rules, 'layer-unobserved');
    expect(u.length).toBeGreaterThan(0);
    expect(u.every((x) => x.compilesTo === null && (x.notRepresentable ?? '').includes('totally'))).toBe(true);
    const l = mineRules(input({ files, layers: ['infrastructure', 'domain', 'application'], fileEdges: [{ from: A(1), to: D(1) }, { from: I(1), to: D(1) }] }), 'layered');
    expect(byKind(l.rules, 'layer-unobserved').every((x) => x.compilesTo?.template === 'no-layer-skip')).toBe(true);
  });
});

describe('rule mining: other kinds', () => {
  it('proposes acyclicity with the cycle edges as exceptions', () => {
    const files: Record<string, string> = {};
    for (let i = 1; i <= 25; i++) files[D(i)] = 'domain';
    const edges = [{ from: D(1), to: D(2) }, { from: D(2), to: D(1) }, { from: D(3), to: D(4) }];
    const r = mineRules(input({ files, fileEdges: edges }), 'clean-architecture');
    const a = byKind(r.rules, 'acyclic-files')[0];
    expect(a?.evidence).toEqual({ files: 25, filesOnCycles: 2, cycles: 1 });
    expect(a?.exceptions.map((e) => `${e.file}>${String(e.target)}`).sort()).toEqual([`${D(1)}>${D(2)}`, `${D(2)}>${D(1)}`]);
    expect(a?.compilesTo?.template).toBe('no-cyclic-deps');
  });

  it('proposes port implementation, with a class that implements no foreign interface as the exception', () => {
    const cls = (name: string, file: string): Decl => ({ name, kind: 'class', file });
    const port = (name: string): Decl => ({ name, kind: 'interface', file: D(1) });
    const [ra, rb, rc, rd] = [cls('ARepository', I(1)), cls('BRepository', I(2)), cls('CRepository', I(3)), cls('DRepository', I(4))];
    const [pa, pb, pc] = [port('ARepo'), port('BRepo'), port('CRepo')];
    const decls = [ra, rb, rc, rd, pa, pb, pc];
    const impl = (c: Decl, p: Decl) => ({ kind: 'implements' as const, from: c, to: p });
    const r = mineRules({ ...layered(), declarations: decls, typeEdges: [impl(ra, pa), impl(rb, pb), impl(rc, pc)] }, 'clean-architecture');
    const p = byKind(r.rules, 'port-implementation')[0];
    expect(p?.subject).toBe('infrastructure/Repository');
    expect(p?.exceptions).toEqual([{ file: I(4), target: 'DRepository', detail: 'implements no interface' }]);
    expect(p?.compilesTo?.template).toBe('repository-pattern');
    expect(mineRules({ ...layered(), declarations: decls, typeEdges: [] }, 'clean-architecture').rules.some((x) => x.kind === 'port-implementation')).toBe(false);
  });

  it('proposes interface injection for the application layer', () => {
    const uc = (n: number): Decl => ({ name: `UC${String(n)}`, kind: 'class', file: A(n) });
    const port: Decl = { name: 'Port', kind: 'interface', file: D(1) };
    const concrete: Decl = { name: 'Impl', kind: 'class', file: I(1) };
    const inj = (from: Decl, to: Decl) => ({ kind: 'injects' as const, from, to });
    const r = mineRules({ ...layered(), typeEdges: [inj(uc(1), port), inj(uc(2), port), inj(uc(3), port), inj(uc(4), concrete)] }, 'hexagonal');
    const i = byKind(r.rules, 'inject-abstractions')[0];
    expect(i?.evidence).toEqual({ crossLayerInjections: 4, ofInterfaces: 3 });
    expect(i?.exceptions).toEqual([{ file: A(4), target: I(1), detail: 'UC4 injects class Impl' }]);
    expect(i?.compilesTo?.template).toBe('port-dependency-inversion');
  });

  it('proposes a framework-free core from the packages outer layers use', () => {
    const pk = [{ file: I(1), pkg: '@nestjs/common' }, { file: A(1), pkg: 'zod' }, { file: D(1), pkg: 'zod' }];
    const r = mineRules({ ...layered(), packageImports: pk }, 'clean-architecture');
    const c = byKind(r.rules, 'core-package-free')[0];
    expect(c?.subject).toBe('domain');
    expect(c?.params).toEqual({ forbidden_imports: ['@nestjs/common'] });
    expect(c?.compilesTo?.template).toBe('domain-purity');
  });

  it('proposes component direction and public-API rules from APG v2 components', () => {
    const comps = [
      { name: 'a', kind: 'folder' as const, files: [D(1), D(2), D(3), D(4)], entries: [D(1)], publicApiDeclared: false },
      { name: 'b', kind: 'folder' as const, files: [A(1), A(2), A(3), A(4)], entries: [], publicApiDeclared: false },
    ];
    const lit = [{ from: A(1), to: D(1) }, { from: A(2), to: D(1) }, { from: A(3), to: D(1) }, { from: A(4), to: D(2) }];
    const r = mineRules({ ...layered(), components: comps, literalEdges: lit }, 'clean-architecture');
    const cd = byKind(r.rules, 'component-direction');
    expect(cd.map((x) => `${x.subject}>${String(x.object)}`)).toEqual(['folder:a>folder:b']);
    const api = byKind(r.rules, 'public-api')[0];
    expect(api?.evidence).toEqual({ incomingImports: 4, viaEntryFiles: 3, entryFiles: 1 });
    expect(api?.exceptions).toEqual([{ file: A(4), target: D(2), detail: 'deep import' }]);
    expect(api?.compilesTo?.template).toBe('deep-import-inferred-api');
  });

  it('extracts role suffixes', () => {
    expect(roleSuffix('InMemoryRoomRepository')).toBe('Repository');
    expect(roleSuffix('PgOrderRepositoryImpl')).toBe('Repository');
    expect(roleSuffix('lower')).toBeNull();
  });
});

describe('rule mining: emission', () => {
  it('orders layers topologically and reports what a total order cannot say', () => {
    expect(topologicalOrder(['infrastructure', 'application', 'domain'], ['application>domain', 'infrastructure>application'])).toEqual(['domain', 'application', 'infrastructure']);
    expect(topologicalOrder(['a', 'b'], ['a>b', 'b>a'])).toBeNull();
    expect(linearAllowed(['p', 'b', 'u'], 'layered')).toEqual(['b>p', 'u>b']);
    expect(linearAllowed(['d', 'a', 'i'], 'clean-architecture')).toEqual(['a>d', 'i>a', 'i>d']);
  });

  const hexSpec = `spec_version: "1.0.0"
architecture:
  style: hexagonal
  layers:
    - { name: domain, kind: domain, directories: [src/domain/**] }
    - { name: application, kind: application, directories: [src/application/**] }
    - { name: infrastructure, kind: infrastructure, directories: [src/infrastructure/**] }
  allowed_dependencies:
    - { from: application, to: [domain] }
fitness_functions:
  - { id: FF-S01, name: dependency-direction-graph, dimension: structural, severity: critical, route: symbolic }
  - { id: FF-P03, name: port-adapter-pattern, dimension: pattern, severity: critical, route: symbolic }
`;

  it('writes the mined allowed graph and switches off the functions no rule backs', () => {
    const r = mineRules(layered(), 'hexagonal');
    const out = YAML.parse(emitMinedSpec(hexSpec, r, ['test'])) as {
      architecture: { allowed_dependencies: { from: string; to: string[] }[] };
      fitness_functions: { id: string; name: string; enabled?: boolean }[];
    };
    expect(out.architecture.allowed_dependencies).toEqual([
      { from: 'application', to: ['domain'] },
      { from: 'infrastructure', to: ['application', 'domain'] },
    ]);
    const fns = new Map(out.fitness_functions.map((f) => [f.name, f]));
    expect(fns.get('dependency-direction-graph')?.enabled).toBeUndefined();
    expect(fns.get('port-adapter-pattern')?.enabled).toBe(false);
    expect(fns.get('layer-skip-graph')?.enabled).toBe(false);
  });
});

describe('rule mining: end to end', () => {
  it('proposes rules for the clean-architecture reference whose spec validates and compiles', async () => {
    const project = path.join(process.cwd(), 'tests/fixtures/v1.3-reference/clean-architecture/project');
    const p = await proposeRules(project, { presetsDir: path.join(process.cwd(), 'presets') });
    expect(p.style).toBe('clean-architecture');
    expect(p.check.valid).toBe(true);
    expect(p.check.compiled).toEqual(expect.arrayContaining(['dependency-direction', 'no-cyclic-deps']));
    expect(p.mining.allowed).toEqual(['application>domain', 'infrastructure>application', 'infrastructure>domain']);
    expect(p.mining.rules.filter((r) => r.kind === 'layer-direction').every((r) => r.exceptions.length === 0)).toBe(true);
    expect(p.specYaml).toContain('PROPOSED rules');
  }, 120_000);
});
