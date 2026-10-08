/**
 * U3-R14 (BR-U3-45, BR-U3-70 item 3): with the shipped `CYCLE_STRATEGY = 'cypher'` the SCC path is
 * present but off: FF-S02 runs its Cypher query even when the context holds an APG.
 */
import { CYCLE_STRATEGY } from '../../../src/evaluation-engine/scc-cycles.js';
import { SymbolicEvaluateCommand } from '../../../src/pipeline/commands/symbolic-evaluate-command.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { functionId, runId } from '../../../src/shared/types/value-objects.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { APGResult } from '../../../src/shared/types/apg.js';

describe("CYCLE_STRATEGY 'cypher' (shipped default)", () => {
  it('FF-S02 is answered by its Cypher query; the APG is not read', async () => {
    expect(CYCLE_STRATEGY).toBe('cypher');
    const seen: string[] = [];
    const repo: GraphRepository = {
      executeQuery(cypher: string): Promise<DomainResult<QueryResult>> {
        seen.push(cypher);
        return Promise.resolve(DomainResult.ok({ records: [], summary: { counters: {} } }));
      },
      clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
      healthCheck: () => Promise.resolve(true),
      close: () => Promise.resolve(),
    };
    const context = new FirewallContext(runId('scc-default'));
    context.setApgResult({ nodes: [], edges: [], parseCoverage: { total: 0, parsed: 0, percentage: 0, skipped: [] }, warnings: [] } as unknown as APGResult);
    context.setCompiledFunctions({
      symbolicQueries: [{ functionId: functionId('FF-S02'), name: 'no-cyclic-deps', cypher: 'CYCLE QUERY', params: {}, dimension: 'structural', severity: 'major', route: 'symbolic', source: 'template' }],
      neuronalInstructions: [], hybridPairs: [], totalCompiled: 1, disabledFunctions: [], warnings: [],
    });
    expect((await new SymbolicEvaluateCommand(repo).execute(context)).success).toBe(true);
    expect(seen).toEqual(['CYCLE QUERY']);
    expect(context.getEvaluationResults().symbolicResults.map((r) => [String(r.functionId), r.passed])).toEqual([['FF-S02', true]]);
  });
});
