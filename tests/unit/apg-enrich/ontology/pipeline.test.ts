/**
 * Ontology v0 pipeline on the planted ground-truth cases, replayed from the recorded-fixture cassettes
 * (`tests/fixtures/v1.3-ontology/cassettes-mock`, recorded from the scripted mock answers): no provider is called.
 * The scripted answers are not model output; these tests check the pipeline, the validator, the cache and the scorer.
 */
import { MockFailure, MockOntologyProvider, NoCallProvider, aggregate, createScriptedResponder, diskReader, estimateOntology, runOntology, scoreCase } from '../../../../src/apg-enrich/ontology/index.js';
import type { CaseScore, OntologyInput, OntologyResult } from '../../../../src/apg-enrich/ontology/index.js';
import { canonicalJSON } from '../../../../src/llm-critic/canonical-json.js';
import { CASES, FIXTURES, fixtureInput, manifest, mockAnswers, tempDir } from './helpers.js';

const MOCK = { provider: 'mock', model: 'mock-ontology', temperature: null } as const;

async function replay(input: OntologyInput, caseId: string): Promise<OntologyResult> {
  return (await runOntology(input, { provider: new NoCallProvider(MOCK), cacheMode: 'replay', cacheDir: `${FIXTURES}/cassettes-mock/${caseId}` })).result;
}

describe('ontology pipeline on the planted cases (cassette replay)', () => {
  const inputs = new Map<string, OntologyInput>();
  const results = new Map<string, OntologyResult>();
  const scores: CaseScore[] = [];

  beforeAll(async () => {
    for (const c of CASES) {
      const input = await fixtureInput(c);
      inputs.set(c, input);
      const before = canonicalJSON(input.apg);
      const r = await replay(input, c);
      expect(canonicalJSON(input.apg)).toBe(before); // symbolic facts are never modified
      results.set(c, r);
      scores.push(scoreCase(manifest(c), r, { cheap: input.cheap, apg: input.apg }));
    }
  }, 180_000);

  it('answers every call from the cassettes', () => {
    for (const r of results.values()) {
      expect(r.calls).toMatchObject({ providerCalls: 0, cassetteMisses: 0, invalid: 0 });
      expect(r.calls.cacheHits).toBeGreaterThan(0);
      expect(r.stopped).toBeNull();
    }
  });

  it('keeps every Sem label and edge type in the Sem namespace, with provenance and grounded evidence', () => {
    for (const r of results.values()) {
      for (const n of r.nodes) {
        expect(n.label).toMatch(/^Sem/);
        expect(n.id).toMatch(/^sem:Sem/);
        expect(n.provenance).toMatchObject({ model: 'mock-ontology', runId: r.runId, temperature: null });
        expect(n.evidence.length).toBeGreaterThan(0);
        expect(n.evidence.every((e) => e.grounded === true as boolean)).toBe(true);
      }
      for (const e of r.edges) expect(e.type).toMatch(/^Sem[A-Z_]+$/);
    }
  });

  it('finds the three planted semantic defects the cheap proxies miss, and no forbidden one', () => {
    const agg = aggregate(scores);
    expect(agg).toMatchObject({ expected: 3, found: 3, forbiddenHits: 0, unexpected: 0, cheapCaughtExpected: 0, cheapFlaggedForbidden: 1 });
    const dup = results.get('case-01-rule-dup-shapes')?.findings[0];
    expect(dup).toMatchObject({ kind: 'semantic-rule-duplication', components: ['checkout', 'invoicing'], verification: { verified: true, method: 'comparison-pattern' } });
    expect(results.get('case-02-misplaced-pricing')?.findings).toEqual([expect.objectContaining({ kind: 'misplaced-responsibility', naturalLayer: 'domain', classLayer: 'application' })]);
    expect(results.get('case-03-concept-fragmentation')?.findings).toEqual([expect.objectContaining({ kind: 'concept-fragmentation', concept: 'Customer', components: ['accounts', 'billing', 'sales'] })]);
  });

  it('rejects the four planted hallucinations and reports run agreement', () => {
    const h = [...results.values()].flatMap((r) => r.hallucinations);
    expect(h).toHaveLength(4);
    expect(h.every((x) => x.runIndex === 1)).toBe(true);
    expect(new Set(h.flatMap((x) => x.reasons.map((r) => r.reason)))).toEqual(new Set(['quote-mismatch', 'span-out-of-range', 'unknown-node', 'node-outside-item']));
    const a02 = results.get('case-02-misplaced-pricing')?.agreement.responsibility;
    expect(a02?.meanJaccard).toBeLessThan(1); // the planted disagreement (PlaceOrderUseCase natural layer)
    expect(results.get('case-04a-control-near-miss-rules')?.agreement.adjudicate).toMatchObject({ items: 1, meanJaccard: 1 });
  });

  it('is deterministic: a second replay gives byte-identical results', async () => {
    const c = 'case-01-rule-dup-shapes';
    const input = inputs.get(c);
    if (input === undefined) throw new Error('no input');
    expect(canonicalJSON(await replay(input, c))).toBe(canonicalJSON(results.get(c)));
  }, 60_000);

  it('the recorded cassettes match a fresh record from the scripted answers (prompts have not drifted)', async () => {
    const c = 'case-04a-control-near-miss-rules';
    const input = inputs.get(c);
    if (input === undefined) throw new Error('no input');
    const tmp = tempDir('ontology-rec-');
    try {
      const mock = new MockOntologyProvider(createScriptedResponder(mockAnswers(c), input.apg, diskReader(input.projectRoot)));
      const fresh = (await runOntology(input, { provider: mock, cacheMode: 'record', cacheDir: tmp.dir })).result;
      expect(canonicalJSON({ ...fresh, calls: null })).toBe(canonicalJSON({ ...results.get(c), calls: null }));
    } finally {
      tmp.cleanup();
    }
  }, 60_000);

  it('estimates the calls without calling, and the estimate bounds the real count', () => {
    for (const c of CASES) {
      const input = inputs.get(c);
      const r = results.get(c);
      if (input === undefined || r === undefined) throw new Error('no input');
      const e = estimateOntology(input, { provider: new NoCallProvider(MOCK), cacheMode: 'replay', cacheDir: `${FIXTURES}/cassettes-mock/${c}` });
      expect(e.calls.responsibility + e.calls.rules).toBeLessThanOrEqual(r.calls.cacheHits);
      expect(e.cachedKnown).toBe(e.calls.responsibility + e.calls.rules);
      expect(e.totalUpperBound).toBeGreaterThanOrEqual(r.calls.cacheHits);
    }
  });

  it('stops on a usage limit, keeps what was recorded, and resumes from the cache', async () => {
    const c = 'case-03-concept-fragmentation';
    const input = inputs.get(c);
    if (input === undefined) throw new Error('no input');
    const tmp = tempDir('ontology-stop-');
    try {
      const scripted = createScriptedResponder(mockAnswers(c), input.apg, diskReader(input.projectRoot));
      let n = 0;
      const limited = new MockOntologyProvider((req) => (++n > 5 ? new MockFailure('LLM_USAGE_LIMIT', "You've hit your limit") : scripted(req)));
      const first = (await runOntology(input, { provider: limited, cacheMode: 'record', cacheDir: tmp.dir })).result;
      expect(first.stopped).toMatchObject({ code: 'LLM_USAGE_LIMIT', pass: 'responsibility' });
      expect(first.calls.providerCalls).toBe(6);
      const resumed = new MockOntologyProvider(scripted);
      const second = (await runOntology(input, { provider: resumed, cacheMode: 'record', cacheDir: tmp.dir })).result;
      expect(second.stopped).toBeNull();
      expect(second.calls.cacheHits).toBe(5);
      expect(second.findings).toEqual(results.get(c)?.findings);
    } finally {
      tmp.cleanup();
    }
  }, 60_000);

  it('skips calls beyond the per-project budget', async () => {
    const c = 'case-03-concept-fragmentation';
    const input = inputs.get(c);
    if (input === undefined) throw new Error('no input');
    const mock = new MockOntologyProvider(createScriptedResponder(mockAnswers(c), input.apg, diskReader(input.projectRoot)));
    const r = (await runOntology(input, { provider: mock, budget: 4 })).result;
    expect(r.calls.providerCalls).toBe(4);
    expect(r.calls.skippedForBudget).toBeGreaterThan(0);
    expect(mock.received()).toHaveLength(4);
  }, 60_000);
});
