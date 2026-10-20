/**
 * Stage C per-rule exposure (scripts/v1.4/lib/exposure.ts; Docs/v1.4/exposure-definitions.md): the opportunity
 * queries derived from the compiled Layered rules, counted on small in-memory graphs, a zero-opportunity rule, and the
 * derivation against the pipeline's own compiled text on a tiny Layered project.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { MemoryGraphRepository } from '../../../../src/cypher-interp/repository';
import { createPipeline } from '../../../../src/pipeline/pipeline-factory';
import type { FirewallContext } from '../../../../src/shared/context/firewall-context';
import {
  aggregate, blockingRules, deletePredicate, ExposureDerivationError, opportunityQuery, ruleExposure, type RuleQuery,
} from '../../../../scripts/v1.4/lib/exposure';

// The compiled text of presets/layered.yaml (v1.3 compile options), as the pipeline emits it.
const S01: RuleQuery = {
  functionId: 'FF-S01', name: 'dependency-direction', params: { layerOrder: ['persistence', 'business', 'presentation'] },
  cypher: `WITH $layerOrder AS layerOrder
MATCH (src:File)-[i:IMPORTS|RE_EXPORTS WHERE NOT coalesce(i.viaReExport, false)]->(tgt:File)
WHERE src.layer IS NOT NULL AND tgt.layer IS NOT NULL
  AND src.layer <> tgt.layer
WITH src, tgt, i,
     apoc.coll.indexOf(layerOrder, src.layer) AS srcIdx,
     apoc.coll.indexOf(layerOrder, tgt.layer) AS tgtIdx
WHERE srcIdx >= 0 AND tgtIdx >= 0 AND srcIdx < tgtIdx
RETURN src.filePath AS source, tgt.filePath AS target, src.layer AS srcLayer, tgt.layer AS tgtLayer,
       type(i) AS relType,
       i.line AS line
ORDER BY source, target, relType`,
};
const S03: RuleQuery = {
  functionId: 'FF-S03', name: 'no-layer-skip', params: { allowedTransitions: ['business>persistence', 'presentation>business'] },
  cypher: `MATCH (src:File)-[i:IMPORTS|RE_EXPORTS WHERE NOT coalesce(i.viaReExport, false)]->(tgt:File)
WHERE src.layer IS NOT NULL AND tgt.layer IS NOT NULL
  AND src.layer <> tgt.layer
  AND NOT (src.layer + '>' + tgt.layer) IN $allowedTransitions
RETURN src.filePath AS source, tgt.filePath AS target, src.layer AS srcLayer, tgt.layer AS tgtLayer,
       type(i) AS relType,
       i.line AS line
ORDER BY source, target, relType`,
};
const P01: RuleQuery = {
  functionId: 'FF-P01', name: 'domain-purity', params: { domainLayer: 'business', forbiddenImports: ['express', '@nestjs/*'] },
  cypher: `MATCH (src:File)-[i:IMPORTS|RE_EXPORTS WHERE NOT coalesce(i.reExportHop, false)]->(p:Package)
WHERE src.layer = $domainLayer
  AND ANY(fp IN $forbiddenImports WHERE p.name = fp OR (fp ENDS WITH '/*' AND p.name STARTS WITH left(fp, size(fp) - 1)))
RETURN src.filePath AS source, p.name AS target, type(i) AS relType,
       i.line AS line
ORDER BY source, target, relType`,
};
const S02: RuleQuery = {
  functionId: 'FF-S02', name: 'no-cyclic-deps', params: {},
  cypher: `MATCH p = (f:File)-[_ev0:IMPORTS|RE_EXPORTS*2..10]->(f)
WHERE ALL(_evr IN _ev0 WHERE NOT coalesce(_evr.viaReExport, false)) AND ALL(n IN nodes(p) WHERE n.filePath >= f.filePath)
  AND size(apoc.coll.toSet(nodes(p)[1..])) = length(p)
WITH DISTINCT [n IN nodes(p) | n.filePath] AS cycle, relationships(p)[0].line AS firstLine
WITH cycle, min(firstLine) AS line
RETURN cycle, cycle[1] AS target, line
ORDER BY cycle
LIMIT 101`,
};

interface Node { id: string; label: 'File' | 'Package'; layer?: string; name?: string }
type Edge = [string, string, 'IMPORTS' | 'RE_EXPORTS', Record<string, unknown>?];

async function graph(nodes: readonly Node[], edges: readonly Edge[]): Promise<MemoryGraphRepository> {
  const repo = new MemoryGraphRepository();
  for (const label of ['File', 'Package'] as const) {
    const batch = nodes.filter((n) => n.label === label).map((n) => (label === 'File'
      ? { id: n.id, filePath: n.id, ...(n.layer !== undefined ? { layer: n.layer } : {}) }
      : { id: n.id, name: n.name ?? n.id }));
    if (batch.length > 0) expect((await repo.executeQuery(`UNWIND $batch AS node CREATE (n:APGNode:${label}) SET n = node`, { batch })).success).toBe(true);
  }
  for (const type of ['IMPORTS', 'RE_EXPORTS'] as const) {
    const batch = edges.filter((e) => e[2] === type).map(([s, t, , props]) => ({ sourceId: s, targetId: t, props: { line: 1, ...(props ?? {}) } }));
    if (batch.length > 0) {
      const r = await repo.executeQuery(`UNWIND $batch AS edge MATCH (src:APGNode {id: edge.sourceId}) MATCH (tgt:APGNode {id: edge.targetId}) CREATE (src)-[r:${type}]->(tgt) SET r = edge.props`, { batch });
      expect(r.success).toBe(true);
    }
  }
  return repo;
}

const P = 'src/presentation/';
const B = 'src/business/';
const D = 'src/persistence/';
const files: Node[] = [
  { id: `${P}app.ts`, label: 'File', layer: 'presentation' },
  { id: `${P}view.ts`, label: 'File', layer: 'presentation' },
  { id: `${B}svc.ts`, label: 'File', layer: 'business' },
  { id: `${B}model.ts`, label: 'File', layer: 'business' },
  { id: `${D}repo.ts`, label: 'File', layer: 'persistence' },
  { id: 'src/util.ts', label: 'File' },
];

describe('opportunity derivation', () => {
  it('deletes exactly the violation predicate of each edge rule', () => {
    expect(opportunityQuery(S01)?.cypher).not.toContain('srcIdx < tgtIdx');
    expect(opportunityQuery(S01)?.cypher).toContain('WHERE srcIdx >= 0 AND tgtIdx >= 0');
    expect(opportunityQuery(S03)?.cypher).not.toContain('$allowedTransitions');
    expect(opportunityQuery(S03)?.cypher).toContain('src.layer <> tgt.layer');
    expect(opportunityQuery(P01)?.cypher).not.toContain('$forbiddenImports');
    expect(opportunityQuery(P01)?.cypher).toContain('src.layer = $domainLayer');
    const s02 = opportunityQuery(S02);
    expect(s02?.unit).toBe('module-dependency-edge');
    expect(s02?.cypher).toContain('MATCH (f:File)-[r:IMPORTS|RE_EXPORTS]->(g:File)');
    expect(s02?.cypher).toContain('NOT coalesce(r.viaReExport, false)');
  });

  it('fails loudly when the compiled text has drifted', () => {
    expect(() => opportunityQuery({ ...S01, cypher: S01.cypher.replace('AND srcIdx < tgtIdx', 'AND srcIdx > tgtIdx') })).toThrow(ExposureDerivationError);
    expect(() => deletePredicate('a X b X', /X/, 'r')).toThrow(/2 times/);
    expect(opportunityQuery({ ...S01, name: 'module-fan-out' })).toBeNull();
  });

  it('keeps only blocking rules of the style and lists the blocking rules not compiled', () => {
    const r = blockingRules([S03, S01, { ...S01, functionId: 'FF-C02', name: 'module-fan-out' }], [{ id: 'FF-P03', reason: 'n/a' }, { id: 'FF-CV05', reason: 'n/a' }], 'layered');
    expect(r.compiled.map((q) => q.functionId)).toEqual(['FF-S01', 'FF-S03']);
    expect(r.notCompiled).toEqual([{ ruleId: 'FF-P03', reason: 'n/a' }]);
    expect(blockingRules([S03], [], 'clean-architecture').compiled).toEqual([]);
  });
});

describe('counts on a fixture graph', () => {
  // presentation→business (allowed), presentation→persistence (skip), business→persistence (allowed),
  // persistence→business (upward), business→business (same layer), util→business (undeclared), a re-export view hop.
  const edges: Edge[] = [
    [`${P}app.ts`, `${B}svc.ts`, 'IMPORTS'],
    [`${P}app.ts`, `${D}repo.ts`, 'IMPORTS'],
    [`${B}svc.ts`, `${D}repo.ts`, 'IMPORTS'],
    [`${D}repo.ts`, `${B}model.ts`, 'IMPORTS'],
    [`${B}svc.ts`, `${B}model.ts`, 'IMPORTS'],
    ['src/util.ts', `${B}model.ts`, 'IMPORTS'],
    [`${P}view.ts`, `${D}repo.ts`, 'IMPORTS', { viaReExport: true }],
  ];

  it('cross-layer edges are the direction and skip opportunities', async () => {
    const repo = await graph(files, edges);
    const s01 = await ruleExposure(repo, S01, 1);
    expect(s01).toMatchObject({ status: 'exercised', opportunities: 4, violations: 1, violationRows: 1, rowsOutsideOpportunities: 0, violationsPerOpportunity: 0.25 });
    const s03 = await ruleExposure(repo, S03, 2);
    // the skip and the upward edge both break strict layering
    expect(s03).toMatchObject({ opportunities: 4, violationRows: 2, rowsOutsideOpportunities: 0, violationsPerOpportunity: 0.5 });
  });

  it('a cycle is checked edge by edge against the module dependency edges', async () => {
    const repo = await graph(files, edges);
    const s02 = await ruleExposure(repo, S02, 1);
    // No chain closes (the re-export view edge is not an opportunity); adding model→repo closes repo→model→repo.
    expect(s02).toMatchObject({ opportunities: 6, violationRows: 0, rowsOutsideOpportunities: 0 });
    const cyclic = await graph(files, [...edges, [`${B}model.ts`, `${D}repo.ts`, 'IMPORTS']]);
    const c = await ruleExposure(cyclic, S02, 1);
    expect(c).toMatchObject({ status: 'exercised', opportunities: 7, violationRows: 1, rowsOutsideOpportunities: 0 });
  });

  it('a rule with zero opportunities is not exercised, never conformant', async () => {
    const repo = await graph(files, edges); // the business layer imports no package
    const p01 = await ruleExposure(repo, P01, 0);
    expect(p01).toEqual({
      ruleId: 'FF-P01', template: 'domain-purity', unit: 'restricted-layer-package-import', status: 'not-exercised',
      opportunities: 0, violations: 0, violationRows: 0, rowsOutsideOpportunities: 0, violationsPerOpportunity: null,
    });
    const empty = await ruleExposure(await graph([], []), S01, 0);
    expect(empty.status).toBe('not-exercised');
  });

  it('package imports of the restricted layer are the purity opportunities', async () => {
    const pk: Node[] = [...files, { id: 'pkg:express', label: 'Package', name: 'express' }, { id: 'pkg:zod', label: 'Package', name: 'zod' }, { id: 'pkg:@nestjs/common', label: 'Package', name: '@nestjs/common' }];
    const repo = await graph(pk, [
      [`${B}svc.ts`, 'pkg:express', 'IMPORTS'],
      [`${B}model.ts`, 'pkg:zod', 'IMPORTS'],
      [`${B}model.ts`, 'pkg:@nestjs/common', 'IMPORTS'],
      [`${P}app.ts`, 'pkg:express', 'IMPORTS'], // not in the restricted layer
    ]);
    const p01 = await ruleExposure(repo, P01, 2);
    expect(p01).toMatchObject({ status: 'exercised', opportunities: 3, violationRows: 2, rowsOutsideOpportunities: 0 });
    expect(p01.violationsPerOpportunity).toBeCloseTo(2 / 3);
  });

  it('aggregates per group and rule, pooling only exercised snapshots', () => {
    const a = aggregate([
      { group: 'g', rule: { ruleId: 'FF-P01', template: 'domain-purity', unit: 'restricted-layer-package-import', status: 'not-exercised', opportunities: 0, violations: 0, violationRows: 0, rowsOutsideOpportunities: 0, violationsPerOpportunity: null } },
      { group: 'g', rule: { ruleId: 'FF-S03', template: 'no-layer-skip', unit: 'cross-layer-import-edge', status: 'exercised', opportunities: 4, violations: 1, violationRows: 1, rowsOutsideOpportunities: 0, violationsPerOpportunity: 0.25 } },
      { group: 'g', rule: { ruleId: 'FF-S03', template: 'no-layer-skip', unit: 'cross-layer-import-edge', status: 'exercised', opportunities: 6, violations: 2, violationRows: 2, rowsOutsideOpportunities: 0, violationsPerOpportunity: 1 / 3 } },
    ]);
    expect(a).toEqual([
      { group: 'g', ruleId: 'FF-P01', snapshots: 1, exercised: 0, notExercised: 1, opportunities: 0, violations: 0, violationsPerOpportunity: null },
      { group: 'g', ruleId: 'FF-S03', snapshots: 2, exercised: 2, notExercised: 0, opportunities: 10, violations: 3, violationsPerOpportunity: 0.3 },
    ]);
  });
});

describe('derivation against the pipeline compiled text', () => {
  it('derives every compiled Layered blocking rule of presets/layered.yaml on a tiny project', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exposure-unit-'));
    try {
      const write = (rel: string, text: string): void => {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), text);
      };
      write('tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'commonjs', moduleResolution: 'node', noEmit: true }, include: ['src/**/*.ts'] }));
      write('src/persistence/repo.ts', 'export const rows = (): number[] => [];\n');
      write('src/business/svc.ts', "import { rows } from '../persistence/repo';\nexport const total = (): number => rows().length;\n");
      write('src/presentation/app.ts', "import { total } from '../business/svc';\nimport { rows } from '../persistence/repo';\nexport const show = (): string => `${total()} ${rows().length}`;\n");
      const repo = new MemoryGraphRepository();
      const bundle = createPipeline({
        projectPath: dir, specFilePath: path.resolve('presets/layered.yaml'), neo4jUri: '', neo4jUser: '', neo4jPassword: '',
        evaluationMode: 'symbolic-only', pipelineMode: 'stateless', persist: false, diff: false, verbose: false,
        apgStorePath: path.join(dir, '.apg'), scoringMode: 'v1.3', graphEngine: 'cypher-interp', graphRepository: repo,
      });
      const context: FirewallContext = bundle.context;
      const res = await bundle.executor.execute();
      await bundle.cleanup();
      expect(res.success).toBe(true);
      const compiled = context.getCompiledFunctions();
      const { compiled: blocking, notCompiled } = blockingRules(
        compiled.symbolicQueries.map((q) => ({ functionId: String(q.functionId), name: q.name, cypher: q.cypher, params: q.params })),
        compiled.disabledFunctions.map((d) => ({ id: String(d.id), reason: d.reason ?? '' })),
        'layered',
      );
      expect(blocking.map((q) => q.functionId)).toEqual(['FF-P01', 'FF-S01', 'FF-S02', 'FF-S03']);
      expect(notCompiled.map((n) => n.ruleId)).toEqual(['FF-P03', 'FF-P06', 'FF-S04']);
      const by = new Map<string, Awaited<ReturnType<typeof ruleExposure>>>();
      for (const q of blocking) by.set(q.functionId, await ruleExposure(repo, q, 0));
      expect(by.get('FF-S01')).toMatchObject({ opportunities: 3, violationRows: 0 });
      expect(by.get('FF-S03')).toMatchObject({ opportunities: 3, violationRows: 1, rowsOutsideOpportunities: 0 });
      expect(by.get('FF-S02')).toMatchObject({ opportunities: 3, violationRows: 0 });
      expect(by.get('FF-P01')).toMatchObject({ status: 'not-exercised', opportunities: 0 });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
