/**
 * R12 (Docs/v1.3/post-merge-review-2026-10-16.md): an ADR symbolic rule's Cypher is not rewritten to an edge view
 * (Docs/v1.3/edge-views.md says so on purpose), so on the v1.3 graph a query over IMPORTS sees the literal barrel edge
 * and the resolved viaReExport edge together. The query text is left as written; the compiler now warns the author
 * (COMPILER_005) when edge views are on and an ADR query reads IMPORTS without choosing a view.
 */
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import type { CompilerInput } from '../../../src/fitness-compiler/types.js';
import type { ADRRule } from '../../../src/shared/types/spec.js';

const adr = (query: string): ADRRule => ({
  id: 'adr-001', title: 'No domain to application', format: 'MADR',
  symbolicRule: { query, params: {}, description: 'test' },
  semanticCriterion: { rule: 'r', rubric: { pass: 'p', fail: 'f', evidenceRequired: 'e' } },
  rawContent: 'test',
});

const input = (a: ADRRule): CompilerInput => ({
  fitnessFunctions: [],
  adrRules: [a],
  layerModel: { layers: [{ name: 'domain', directories: ['src/domain/**'], filePatterns: [], kind: 'domain' }] } as unknown as CompilerInput['layerModel'],
  scoringWeights: { structural: 1, coupling: 0, pattern: 0, solid: 0, convention: 0, semantic: 0, integrity: 0 },
});

const READS = "MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.layer='domain' AND b.layer='application' RETURN a.filePath";

function codes(i: CompilerInput, options = {}): string[] {
  const r = compileFunctions(i, options);
  if (!r.success) throw new Error('compile failed');
  return r.data.warnings.map((w) => w.code);
}

describe('R12: ADR symbolic rules on a two-view graph', () => {
  it('warns when edge views are on and the ADR query reads IMPORTS without a view predicate; the query is unchanged', () => {
    expect(codes(input(adr(READS)), V13_COMPILE_OPTIONS)).toContain('COMPILER_005');
    const r = compileFunctions(input(adr(READS)), V13_COMPILE_OPTIONS);
    if (r.success) expect(r.data.hybridPairs[0]?.symbolicQuery.cypher).toBe(READS);
  });

  it('is silent on the frozen options, on a query that names a view, and on a query without IMPORTS', () => {
    expect(codes(input(adr(READS)))).not.toContain('COMPILER_005');
    expect(codes(input(adr("MATCH (a:File)-[r:IMPORTS]->(b:File) WHERE NOT coalesce(r.viaReExport, false) RETURN a.filePath")), V13_COMPILE_OPTIONS)).not.toContain('COMPILER_005');
    expect(codes(input(adr('MATCH (c:Class) RETURN c')), V13_COMPILE_OPTIONS)).not.toContain('COMPILER_005');
  });
});
