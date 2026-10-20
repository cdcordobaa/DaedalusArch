/**
 * Pipeline wiring of the construct switches: nothing is wired at the status quo; with a switch set, the evaluate
 * command runs the row stage over the run's APG (layers assigned from the spec, as ingestion does).
 */
import { SymbolicEvaluateCommand } from '../../../src/pipeline/commands/symbolic-evaluate-command.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { functionId, runId } from '../../../src/shared/types/value-objects.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { APGEdge, APGNode, APGResult } from '../../../src/shared/types/apg.js';
import { STATUS_QUO_ANSWERS, withAnswers } from '../../../src/shared/construct-switches.js';
import { constructRowTransform, constructTierResolver } from '../../../src/construct-switches/pipeline.js';
import { constructGraphFromApg } from '../../../src/construct-switches/graph.js';
import { presetSpec } from './fixtures.js';

const node = (id: string, type: APGNode['type'], filePath: string, name = id): APGNode => ({ id, type, filePath, name, decorators: [], properties: {} });
const edge = (id: string, type: APGEdge['type'], sourceId: string, targetId: string, properties: Record<string, unknown> = {}): APGEdge => ({ id, type, sourceId, targetId, properties });

const APG = {
  nodes: [
    node('f1', 'File', 'src/domain/entities/Loan.ts'),
    node('f2', 'File', 'src/application/ports/Clock.ts'),
    node('p1', 'Package', 'express', 'express'),
    node('c1', 'Class', 'src/domain/entities/Loan.ts', 'Loan'),
    node('m1', 'Method', 'src/domain/entities/Loan.ts', 'Loan.due'),
    node('i1', 'Interface', 'src/application/ports/Clock.ts', 'Clock'),
  ],
  edges: [
    edge('e1', 'IMPORTS', 'f1', 'f2', { isTypeOnly: true, line: 3 }),
    edge('e2', 'IMPORTS', 'f1', 'p1', { isTypeOnly: false }),
    edge('e3', 'CONTAINS', 'c1', 'm1'),
    edge('e4', 'CONSTRUCTOR_INJECTS', 'c1', 'i1', { parameterName: 'clock' }),
  ],
  parseCoverage: { total: 2, parsed: 2, percentage: 100, skipped: [] },
  warnings: [],
  importResolution: { resolvedInternal: 1, external: 1, unresolved: 0, unsupportedDynamic: 0, externalOutOfRootAlias: 0, droppedNoFileNode: 0 },
} as unknown as APGResult;

describe('construct switches in the pipeline', () => {
  it('nothing is wired at the status quo (every answer A)', async () => {
    expect(constructRowTransform(STATUS_QUO_ANSWERS)).toBeUndefined();
    expect(constructTierResolver(STATUS_QUO_ANSWERS, 'clean-architecture', (await presetSpec('clean-architecture')).layerModel)).toBeUndefined();
  });

  it('builds the graph from the APG with the ingestion layers', async () => {
    const g = constructGraphFromApg(APG, (await presetSpec('clean-architecture')).layerModel);
    expect([...g.files.entries()]).toEqual([['src/domain/entities/Loan.ts', 'domain'], ['src/application/ports/Clock.ts', 'application']]);
    expect(g.edges).toEqual([{ from: 'src/domain/entities/Loan.ts', to: 'src/application/ports/Clock.ts', type: 'IMPORTS', typeOnly: true, viaReExport: false, reExportHop: false, line: 3 }]);
    expect(g.packageEdges.map((p) => p.pkg)).toEqual(['express']);
    expect(g.classes.find((c) => c.name === 'Loan')).toMatchObject({ kind: 'Class', layer: 'domain', methods: ['due'] });
    expect(g.classEdges).toEqual([{ from: 'c1', to: 'i1', type: 'CONSTRUCTOR_INJECTS', field: 'clock' }]);
  });

  it('with Q2 B the evaluate command drops the type-only FF-S01 row before storing the results', async () => {
    const spec = await presetSpec('clean-architecture');
    const repo: GraphRepository = {
      executeQuery(): Promise<DomainResult<QueryResult>> {
        return Promise.resolve(DomainResult.ok({
          records: [{ source: 'src/domain/entities/Loan.ts', target: 'src/application/ports/Clock.ts', srcLayer: 'domain', tgtLayer: 'application', relType: 'IMPORTS', verb: 'imports', line: 3, lines: [3], isTypeOnly: true }],
          summary: { counters: {} },
        }));
      },
      clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
      healthCheck: () => Promise.resolve(true),
      close: () => Promise.resolve(),
    };
    const run = async (answers: typeof STATUS_QUO_ANSWERS): Promise<number> => {
      const context = new FirewallContext(runId('construct-switch'));
      context.setApgResult(APG);
      context.setParsedSpec(spec);
      context.setCompiledFunctions({
        symbolicQueries: [{ functionId: functionId('FF-S01'), name: 'dependency-direction', cypher: 'Q', params: {}, dimension: 'structural', severity: 'critical', route: 'symbolic', source: 'template' }],
        neuronalInstructions: [], hybridPairs: [], totalCompiled: 1, disabledFunctions: [], warnings: [],
      });
      const transform = constructRowTransform(answers);
      expect((await new SymbolicEvaluateCommand(repo, [], transform).execute(context)).success).toBe(true);
      return context.getEvaluationResults().symbolicResults[0]?.violations.length ?? -1;
    };
    expect(await run(STATUS_QUO_ANSWERS)).toBe(1);
    expect(await run(withAnswers({ Q2: 'B' }))).toBe(0);
  });
});
