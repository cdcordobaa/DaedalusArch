/**
 * U3-R14 (BR-U3-45; TF-11 wiring): with `CYCLE_STRATEGY` overridden to `'scc'` in this test,
 * the C6 command and `ScoreCommand` both receive the context's `APGResult`; FF-S02 is answered
 * from the APG (no Cypher query) and `'scc'` without an APG is a visible function failure.
 * The shipped default stays `'cypher'` (BR-U3-70 item 3, pinned in scc-cycles.test.ts).
 */
jest.mock('../../../src/evaluation-engine/scc-cycles.js', () => ({
  ...jest.requireActual<Record<string, unknown>>('../../../src/evaluation-engine/scc-cycles.js'),
  CYCLE_STRATEGY: 'scc',
}));

jest.mock('../../../src/evaluation-engine/index.js', () => {
  const actual = jest.requireActual<Record<string, unknown> & { evaluateSymbolic: (...args: unknown[]) => unknown }>('../../../src/evaluation-engine/index.js');
  return { ...actual, evaluateSymbolic: jest.fn((...args: unknown[]) => actual.evaluateSymbolic(...args)) };
});

jest.mock('../../../src/scoring-engine/index.js', () => ({
  ...jest.requireActual<Record<string, unknown>>('../../../src/scoring-engine/index.js'),
  computeScoredReport: jest.fn(() => Promise.resolve({ success: false, errors: [{ code: 'SPY', message: 'spy only', stage: 'scoring-engine', critical: true }] })),
}));

import { evaluateSymbolic } from '../../../src/evaluation-engine/index.js';
import { evaluateSymbolic as evaluateSymbolicDirect } from '../../../src/evaluation-engine/symbolic-evaluator.js';
import { CYCLE_STRATEGY } from '../../../src/evaluation-engine/scc-cycles.js';
import { computeScoredReport } from '../../../src/scoring-engine/index.js';
import { SymbolicEvaluateCommand } from '../../../src/pipeline/commands/symbolic-evaluate-command.js';
import { ScoreCommand } from '../../../src/pipeline/commands/score-command.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { functionId, runId } from '../../../src/shared/types/value-objects.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import type { CompiledFunctions, CypherQuery } from '../../../src/shared/types/evaluation.js';

const file = (path: string): Record<string, unknown> => ({ id: `file:${path}`, type: 'File', filePath: path, name: path, decorators: [], properties: {} });
const imports = (from: string, to: string): Record<string, unknown> => ({ id: `${from}->${to}`, sourceId: `file:${from}`, targetId: `file:${to}`, type: 'IMPORTS', properties: {} });

const APG = {
  nodes: [file('src/a.ts'), file('src/b.ts'), file('src/gen/c.ts'), file('src/gen/d.ts')],
  edges: [imports('src/a.ts', 'src/b.ts'), imports('src/b.ts', 'src/a.ts'), imports('src/gen/c.ts', 'src/gen/d.ts'), imports('src/gen/d.ts', 'src/gen/c.ts')],
  parseCoverage: { total: 4, parsed: 4, percentage: 100, skipped: [] },
  warnings: [],
  importResolution: { resolvedInternal: 4, external: 0, unresolved: 0, unsupportedDynamic: 0, externalOutOfRootAlias: 0, droppedNoFileNode: 0 },
} as unknown as APGResult;

function query(name: string, id: string, params: Record<string, unknown> = {}): CypherQuery {
  return { functionId: functionId(id), name, cypher: `/* ${name} */ RETURN 1`, params, dimension: 'structural', severity: 'major', route: 'symbolic', source: 'template' };
}

function repo(seen: string[]): GraphRepository {
  return {
    executeQuery(cypher: string): Promise<DomainResult<QueryResult>> {
      seen.push(cypher);
      return Promise.resolve(DomainResult.ok({ records: [], summary: { counters: {} } }));
    },
    clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
    healthCheck: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
}

function compiled(queries: CypherQuery[]): CompiledFunctions {
  return { symbolicQueries: queries, neuronalInstructions: [], hybridPairs: [], totalCompiled: queries.length, disabledFunctions: [], warnings: [] };
}

describe("CYCLE_STRATEGY overridden to 'scc' (BR-U3-45)", () => {
  beforeEach(() => jest.clearAllMocks());

  it('the override is in effect for this file only', () => {
    expect(CYCLE_STRATEGY).toBe('scc');
  });

  it('SymbolicEvaluateCommand passes the context APGResult to C6; FF-S02 runs no Cypher and reports the SCC', async () => {
    const context = new FirewallContext(runId('scc-wiring'));
    context.setApgResult(APG);
    context.setCompiledFunctions(compiled([query('no-cyclic-deps', 'FF-S02', { excludePatterns: ['^src/gen/.*$'] }), query('dependency-direction', 'FF-S01')]));
    const seen: string[] = [];
    const result = await new SymbolicEvaluateCommand(repo(seen)).execute(context);
    expect(result.success).toBe(true);

    const input = (evaluateSymbolic as jest.Mock<unknown, [unknown]>).mock.calls[0]?.[0] as { apg?: unknown };
    expect(input.apg).toBe(APG);
    expect(seen).toEqual(['/* dependency-direction */ RETURN 1']);

    const s02 = context.getEvaluationResults().symbolicResults.find((r) => String(r.functionId) === 'FF-S02');
    expect(s02?.passed).toBe(false);
    expect(s02?.violations.map((v) => [v.filePath, v.discriminator, v.evidence, v.tag])).toEqual([
      ['src/a.ts', ['scc'], ['cycle=["src/a.ts","src/b.ts","src/a.ts"]'], 'topological'],
    ]);
  });

  it('ScoreCommand passes the context APGResult to scoring (metric path)', async () => {
    const context = new FirewallContext(runId('scc-wiring-score'));
    context.setApgResult(APG);
    context.setCompiledFunctions(compiled([]));
    context.setEvaluationResults({ symbolicResults: [], neuronalResults: [], failures: [] });
    const command = new ScoreCommand(repo([]), {
      scoringWeights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 },
      verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
      confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
      evaluationMode: 'symbolic-only',
      projectPath: '/p',
      specVersion: '1.0.0',
      fitnessFunctions: [],
    });
    await command.execute(context);
    const input = (computeScoredReport as jest.Mock<unknown, [unknown]>).mock.calls[0]?.[0] as { apg?: unknown };
    expect(input.apg).toBe(APG);
  });

  it("'scc' without an APG: FF-S02 is a visible EVAL_001 failure with code APG_MISSING, no result row", async () => {
    const seen: string[] = [];
    const out = await evaluateSymbolicDirect({ queries: [query('no-cyclic-deps', 'FF-S02')], graphRepository: repo(seen) });
    if (!out.success) throw new Error('unexpected');
    expect(seen).toEqual([]);
    expect(out.data.results).toEqual([]);
    expect(out.data.failures.map((f) => [String(f.functionId), f.code])).toEqual([['FF-S02', 'EVAL_001']]);
    expect(out.data.warnings.map((w) => [w.code, w.context?.code])).toEqual([['EVAL_001', 'APG_MISSING']]);
  });
});
