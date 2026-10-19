/** Ontology v0 pass (d): deterministic candidate pairs, then model adjudication; text helpers. */
import { candidatePairs, cluster } from '../../../../src/apg-enrich/ontology/clustering.js';
import type { ClusterItem } from '../../../../src/apg-enrich/ontology/clustering.js';
import { AgreementTally } from '../../../../src/apg-enrich/ontology/passes.js';
import type { PassContext } from '../../../../src/apg-enrich/ontology/passes.js';
import { equalUpToDecimalScale, jaccard, normName, tokens } from '../../../../src/apg-enrich/ontology/text.js';
import { MockOntologyProvider, ModelCaller, OntologyCache, PASS_IDS } from '../../../../src/apg-enrich/ontology/index.js';
import type { GroundingIndex, MockResponder, PassId } from '../../../../src/apg-enrich/ontology/index.js';

const rule = (key: string, component: string, text: string, subject: string, operator: '>=' | '>' | 'other', threshold: number | null): ClusterItem =>
  ({ key, kind: 'rule', component, text, where: component, quotes: [], rule: { subject, operator, threshold } });
const concept = (key: string, component: string, text: string, fields?: string[]): ClusterItem =>
  ({ key, kind: 'concept', component, text, where: component, quotes: [], ...(fields !== undefined ? { fields } : {}) });

function ctx(responder: MockResponder, runs = 2): { p: PassContext; mock: MockOntologyProvider } {
  const mock = new MockOntologyProvider(responder);
  const caller = new ModelCaller({ provider: mock, cache: new OntologyCache('off', null), budget: 100, runId: 'r', promptVersion: 'v' });
  const p: PassContext = {
    caller, index: {} as GroundingIndex, runs, hallucinations: [],
    accepted: Object.fromEntries(PASS_IDS.map((x) => [x, 0])) as Record<PassId, number>,
    tallies: Object.fromEntries(PASS_IDS.map((x) => [x, new AgreementTally()])) as Record<PassId, AgreementTally>,
  };
  return { p, mock };
}

describe('text helpers', () => {
  it('tokenises camelCase, drops stop words and plural s', () => {
    expect(tokens('freeShippingRules for the Orders')).toEqual(['free', 'order', 'rule', 'shipping']);
    expect(normName('Customer Accounts')).toBe('account customer');
    expect(jaccard(['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3);
    expect(jaccard([], [])).toBe(1);
  });

  it('matches thresholds up to a decimal scale only', () => {
    expect(equalUpToDecimalScale(50, 5000)).toBe(true);
    expect(equalUpToDecimalScale(5000, 50, 2)).toBe(true);
    expect(equalUpToDecimalScale(50, 5000, 1)).toBe(false);
    expect(equalUpToDecimalScale(50, 51)).toBe(false);
    expect(equalUpToDecimalScale(18, 50)).toBe(false);
    expect(equalUpToDecimalScale(0, 0)).toBe(true);
    expect(equalUpToDecimalScale(-5, 500)).toBe(false);
  });
});

describe('candidate pairs', () => {
  it('pairs rules across components by operator and decimal-scaled threshold or subject tokens; never within a component', () => {
    const items = [
      rule('r1', 'checkout', 'Free shipping from 50', 'order total', '>=', 50),
      rule('r2', 'invoicing', 'Shipping waived at 5000 cents', 'invoice sum', '>=', 5000),
      rule('r3', 'accounts', 'Adults only', 'customer age', '>=', 18),
      rule('r4', 'checkout', 'Bulk from 50', 'quantity', '>=', 50),
      rule('r5', 'catalog', 'Order total cap', 'order total', '>', 900),
      rule('r6', 'shipping', 'Order total above', 'order total', '>', 10),
    ];
    const pairs = candidatePairs(items, 3).map((p) => `${p.a.key}-${p.b.key}`);
    expect(pairs).toEqual(expect.arrayContaining(['r1-r2', 'r2-r4', 'r5-r6']));
    expect(pairs).not.toContain('r1-r4');
    expect(pairs.some((p) => p.includes('r3'))).toBe(false);
  });

  it('pairs concepts by name tokens or shared field names', () => {
    const pairs = candidatePairs([
      concept('a', 'sales', 'Customer', ['id', 'email']),
      concept('b', 'accounts', 'Customer account', ['holderId']),
      concept('c', 'billing', 'Invoice', ['id', 'email', 'total']),
      concept('d', 'shipping', 'Parcel', ['weight']),
    ], 3).map((p) => `${p.a.key}-${p.b.key}`);
    expect(pairs).toEqual(expect.arrayContaining(['a-b', 'a-c']));
    expect(pairs.some((p) => p.includes('d'))).toBe(false);
  });

  it('N4: pairs concepts inside one declared context, not inside an undeclared component, and still across components', () => {
    const declared = (key: string, component: string, text: string, context: string | null, fields?: string[]): ClusterItem =>
      ({ ...concept(key, component, text, fields), context });
    const pairs = candidatePairs([
      declared('s1', 'sales', 'Customer', 'sales', ['id', 'email']),
      declared('s2', 'sales', 'Client', 'sales', ['id', 'email']),
      declared('u1', 'crm', 'Customer', null, ['id', 'email']),
      declared('u2', 'crm', 'Client', null, ['id', 'email']),
      declared('b1', 'billing', 'Payer', 'billing', ['id', 'email']),
    ], 3).map((p) => `${p.a.key}-${p.b.key}`);
    expect(pairs).toContain('s1-s2'); // declared same-context pair: proposed (new)
    expect(pairs).not.toContain('u1-u2'); // undeclared same-component pair: not proposed
    expect(pairs).toEqual(expect.arrayContaining(['s1-b1', 'u1-b1'])); // cross-component: still proposed
  });

  it('never pairs rules within a component, even with a declared context', () => {
    const items = [
      { ...rule('r1', 'sales', 'Limit 20', 'units', '>=', 20), context: 'sales' },
      { ...rule('r2', 'sales', 'Limit 20 again', 'units', '>=', 20), context: 'sales' },
    ];
    expect(candidatePairs(items, 3)).toEqual([]);
  });
});

describe('cluster', () => {
  it('merges exact names without a call, and a candidate pair only when every run says same', async () => {
    const items = [
      concept('a', 'sales', 'Customer'), concept('b', 'billing', 'Customer'),
      concept('c', 'accounts', 'Customer account'), concept('d', 'shipping', 'Customer accounts ledger'),
    ];
    const { p, mock } = ctx((r) => ({ same: r.itemName.includes('ledger') ? r.runIndex === 0 : true, confidence: 0.8, rationale: '' }));
    const res = await cluster(p, items, { maxPairs: 10, decimalScaleMaxPower: 3 });
    expect(res.clusters).toEqual([['a', 'b', 'c'], ['d']]);
    expect(res.adjudications.find((a) => a.b === 'd' || a.a === 'd')).toMatchObject({ verdicts: [true, false], merged: false });
    expect(mock.received().every((r) => r.pass === 'adjudicate')).toBe(true);
    expect(p.tallies.adjudicate.result().items).toBeGreaterThan(0);
  });

  it('respects the adjudication cap and counts the pairs left over', async () => {
    const items = [rule('x1', 'a', 'A', 'order total', '>=', 50), rule('x2', 'b', 'B', 'order total', '>=', 50), rule('x3', 'c', 'C', 'order total', '>=', 50)];
    const { p, mock } = ctx(() => ({ same: false, confidence: 0.5, rationale: '' }));
    const res = await cluster(p, items, { maxPairs: 1, decimalScaleMaxPower: 3 });
    expect(res.adjudications).toHaveLength(1);
    expect(res.droppedPairs).toBe(2);
    expect(mock.received()).toHaveLength(2);
    expect(res.clusters).toHaveLength(3);
  });
});
