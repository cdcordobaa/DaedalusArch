/**
 * v1.3 hexagonal fixture: a clean and a violating project, run through the real extractor, the real layer annotator
 * and the real compiler. Neo4j is not available to unit tests, so the five compiled hexagonal queries are evaluated
 * by `evaluate` below, a line-for-line mirror of their Cypher predicates over the extracted graph. The Cypher text
 * itself is pinned by the predicate assertions in the last block and is exercised against a database only by a
 * golden run (see Docs/v1.3-hexagonal-notes.md).
 */
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { annotateNodes } from '../../../src/neo4j-ingestion/layer-annotator.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { APGNode, APGResult } from '../../../src/shared/types/apg.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';

const ROOT = path.resolve(__dirname, '../../..');
const FIXTURES = path.join(ROOT, 'tests/fixtures/hexagonal');

interface Row { readonly fn: string; readonly source: string; readonly target?: string }

async function analyse(variant: 'clean' | 'violating'): Promise<{ rows: Row[]; queries: readonly CypherQuery[] }> {
  const parsed = await parseSpec({ specFilePath: path.join(ROOT, 'presets/hexagonal.yaml') }, { strictMode: true });
  if (!parsed.success) throw new Error(parsed.errors.map((e) => e.message).join('; '));
  const compiled = compileFunctions(compilerInputFromSpec(parsed.data));
  if (!compiled.success) throw new Error(compiled.errors.map((e) => e.message).join('; '));

  const apg = await extractAPG(path.join(FIXTURES, variant));
  if (!apg.success) throw new Error(apg.errors.map((e) => e.message).join('; '));
  const { annotations } = annotateNodes(apg.data.nodes, parsed.data.layerModel);
  const nodes: APGNode[] = apg.data.nodes.map((n) => ({ ...n, layer: annotations.get(n.id)?.layer ?? undefined }));
  const rows = compiled.data.symbolicQueries.flatMap((q) => evaluate(q, { ...apg.data, nodes }));
  return { rows, queries: compiled.data.symbolicQueries };
}

/** Mirror of the Cypher WHERE clauses of the five hexagonal templates. */
function evaluate(q: CypherQuery, apg: APGResult): Row[] {
  const byId = new Map(apg.nodes.map((n) => [n.id, n]));
  const list = (name: string): string[] => q.params[name] as string[];
  const imports = apg.edges
    .filter((e) => e.type === 'IMPORTS' || e.type === 'RE_EXPORTS')
    .flatMap((e) => {
      const src = byId.get(e.sourceId);
      const tgt = byId.get(e.targetId);
      return src?.type === 'File' && tgt?.type === 'File' && src.layer != null && tgt.layer != null && src.layer !== tgt.layer
        ? [{ src, tgt, forward: `${src.layer}>${tgt.layer}`, reverse: `${tgt.layer}>${src.layer}` }]
        : [];
    });
  const row = (fn: string, source: string, target?: string): Row => ({ fn, source, ...(target != null ? { target } : {}) });
  switch (q.name) {
    case 'dependency-direction-graph': {
      const allowed = list('allowedDependencies');
      return imports.filter((i) => !allowed.includes(i.forward) && allowed.includes(i.reverse)).map((i) => row(q.name, i.src.filePath, i.tgt.filePath));
    }
    case 'layer-skip-graph': {
      const allowed = list('allowedDependencies');
      return imports.filter((i) => !allowed.includes(i.forward) && !allowed.includes(i.reverse)).map((i) => row(q.name, i.src.filePath, i.tgt.filePath));
    }
    case 'core-isolation':
      return imports.filter((i) => i.src.layer === q.params.domainLayer).map((i) => row(q.name, i.src.filePath, i.tgt.filePath));
    case 'port-adapter-pattern': {
      const roles = list('adapterRoles');
      const ports = list('portLayers');
      return apg.nodes
        .filter((c) => c.type === 'Class' && c.layer === q.params.infraLayer && roles.some((r) => c.name.includes(r)))
        .filter((c) => !apg.edges.some((e) => e.type === 'IMPLEMENTS' && e.sourceId === c.id && ports.includes(byId.get(e.targetId)?.layer ?? '')
          && byId.get(e.targetId)?.type === 'Interface'))
        .map((c) => row(q.name, c.filePath));
    }
    case 'port-dependency-inversion': {
      const layers = list('applicationLayers');
      return apg.nodes
        .filter((c) => c.type === 'Class' && layers.includes(c.layer ?? ''))
        .filter((c) => {
          const deps = apg.edges.filter((e) => e.type === 'CONSTRUCTOR_INJECTS' && e.sourceId === c.id).map((e) => byId.get(e.targetId));
          return deps.length > 0 && deps.filter((d) => d?.type === 'Interface').length / deps.length < (q.params.threshold as number);
        })
        .map((c) => row(q.name, c.filePath));
    }
    default:
      return [];
  }
}

describe('hexagonal fixture', () => {
  it('the clean variant has no hexagonal violation', async () => {
    const { rows, queries } = await analyse('clean');
    expect(queries.map((q) => q.name)).toEqual(expect.arrayContaining(['dependency-direction-graph', 'layer-skip-graph', 'core-isolation', 'port-adapter-pattern', 'port-dependency-inversion']));
    expect(rows).toEqual([]);
  });

  it('the violating variant is detected, each defect by the template that owns it', async () => {
    const { rows } = await analyse('violating');
    const found = rows.map((r) => `${r.fn} ${r.source}${r.target != null ? ` -> ${r.target}` : ''}`).sort();
    expect(found).toEqual([
      'core-isolation src/domain/Order.ts -> src/adapters/outbound/SqlOrderGateway.ts',
      'dependency-direction-graph src/application/PlaceOrderUseCase.ts -> src/adapters/outbound/InMemoryOrderRepository.ts',
      'dependency-direction-graph src/domain/Order.ts -> src/adapters/outbound/SqlOrderGateway.ts',
      'layer-skip-graph src/adapters/inbound/OrderController.ts -> src/adapters/outbound/InMemoryOrderRepository.ts',
      'port-adapter-pattern src/adapters/outbound/SqlOrderGateway.ts',
      'port-dependency-inversion src/application/PlaceOrderUseCase.ts',
    ].sort());
  });

  it('the composition root may import every layer in both variants (no row for src/config)', async () => {
    for (const v of ['clean', 'violating'] as const) {
      const { rows } = await analyse(v);
      expect(rows.filter((r) => r.source.startsWith('src/config/'))).toEqual([]);
    }
  });

  it('the dependency templates split on the reverse edge: direction needs it, skip forbids it', async () => {
    const { queries } = await analyse('clean');
    const direction = queries.find((q) => q.name === 'dependency-direction-graph')?.cypher ?? '';
    const skip = queries.find((q) => q.name === 'layer-skip-graph')?.cypher ?? '';
    expect(direction).toContain("AND (tgt.layer + '>' + src.layer) IN $allowedDependencies");
    expect(skip).toContain("AND NOT (tgt.layer + '>' + src.layer) IN $allowedDependencies");
    for (const c of [direction, skip]) expect(c).toContain("AND NOT (src.layer + '>' + tgt.layer) IN $allowedDependencies");
  });
});
