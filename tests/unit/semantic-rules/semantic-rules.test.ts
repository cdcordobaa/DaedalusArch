/**
 * Semantic tests of the scored fitness-function rules: each case runs the rule's real compiled Cypher (the catalogue
 * text, compiled by the v1.3 pipeline's options) on a small hand-built graph in the in-process interpreter
 * (`cypher-interp`) and compares the findings with the expected set. No Neo4j, no LLM.
 *
 * Cases: `cases.ts` (a violating, a clean and a near-miss case per rule, plus the blind spots of
 * Docs/DiagnosticRuns/v1.3-rule-mutation-2026-10-16.md §6 A). Findings are compared as sets: row order is not part of
 * the result, except where BR-U1-28 makes it so (the cycle cap keeps the first 100 cycles by `ORDER BY cycle`).
 *
 * FF-P05 controller-no-entity: under `V13_COMPILE_OPTIONS.signatureTypes` its query is a `CALL { … UNION … }`, which
 * the interpreter does not run. Its cases compile with `signatureTypes: false`, so they test the frozen branch (the
 * catalogue template) and not the SIGNATURE_USES branch.
 */
import { CASES } from './cases.js';
import { evaluate, Graph, STYLE_SPECS } from './semantic-harness.js';

const RULES = [...new Set(CASES.map((c) => `${c.style} ${c.ruleId}`))].sort();

describe('semantic rules: each case is a hand-built graph with its expected findings', () => {
  for (const c of CASES) {
    it(`${c.style} ${c.ruleId} [${c.kind}] ${c.id}`, async () => {
      const g = new Graph();
      c.build(g);
      const r = await evaluate(c.style, c.ruleId, g, c.compile);
      expect(r.keys).toEqual([...c.expected].sort());
      expect([...new Set(r.warnings.map((w) => w.split(':')[0]))].sort()).toEqual([...(c.expectedWarnings ?? [])].sort());
    });
  }
});

describe('semantic rules: coverage of the case table', () => {
  it('has a violating, a clean or near-miss case for every rule it covers', () => {
    for (const rule of RULES) {
      const kinds = new Set(CASES.filter((c) => `${c.style} ${c.ruleId}` === rule).map((c) => c.kind));
      expect([rule, kinds.has('violating')]).toEqual([rule, true]);
      expect([rule, kinds.has('clean') || kinds.has('near-miss')]).toEqual([rule, true]);
    }
  });
  it('covers the 14 blind spots A1..A14', () => {
    const covered = new Set(CASES.flatMap((c) => c.blindSpot ?? []));
    expect([...covered].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))).toEqual(Array.from({ length: 14 }, (_, i) => `A${String(i + 1)}`));
  });
  it('uses ids that are unique and styles that have a spec', () => {
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    for (const c of CASES) expect(Object.keys(STYLE_SPECS)).toContain(c.style);
  });
});
