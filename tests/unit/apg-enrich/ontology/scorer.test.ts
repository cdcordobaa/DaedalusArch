/** Ontology v0 scorer: findings against expected-semantic manifests, with cheap and judge outcomes. */
import { aggregate, cheapOutcome, findingMatches, scoreCase } from '../../../../src/apg-enrich/ontology/index.js';
import type { CodeSite, ExpectedSemanticManifest, OntologyFinding, OntologyResult, RuleDuplicationFinding } from '../../../../src/apg-enrich/ontology/index.js';
import type { CheapEnrichment } from '../../../../src/apg-enrich/cheap/types.js';
import type { APGResult } from '../../../../src/shared/types/apg.js';
import { CASES, manifest } from './helpers.js';

const site = (file: string, className: string, methodName?: string, component = 'c'): CodeSite =>
  ({ nodeId: `${className}.${methodName ?? ''}`, file, className, ...(methodName !== undefined ? { methodName } : {}), component });

function result(findings: OntologyFinding[], hallucinations = 0): OntologyResult {
  return {
    runId: 'r', provider: { provider: 'mock', model: 'm' }, nodes: [], edges: [], findings,
    hallucinations: Array.from({ length: hallucinations }, () => ({ pass: 'rules' as const, itemId: 'x', runIndex: 0, assertionKind: 'rule' as const, assertion: '', reasons: [] })),
    acceptedAssertions: { responsibility: 6, capability: 2, rules: 2, adjudicate: 0 },
    agreement: { responsibility: { items: 0, meanJaccard: null, agreedAssertions: 0, totalAssertions: 0 }, capability: { items: 0, meanJaccard: null, agreedAssertions: 0, totalAssertions: 0 }, rules: { items: 0, meanJaccard: null, agreedAssertions: 0, totalAssertions: 0 }, adjudicate: { items: 0, meanJaccard: null, agreedAssertions: 0, totalAssertions: 0 } },
    calls: { providerCalls: 0, cacheHits: 0, invalid: 0, skippedForBudget: 0, cassetteMisses: 0, usage: { inputTokens: 0, outputTokens: 0 } },
    budget: 1, stopped: null,
  };
}

const DUP: RuleDuplicationFinding = {
  kind: 'semantic-rule-duplication', ruleId: 'r', statement: 's', components: ['checkout', 'invoicing'], confidence: 0.9,
  verification: { verified: true, method: 'comparison-pattern', detail: '' },
  sites: [site('src/checkout/domain/shipping-policy.ts', 'ShippingPolicy', 'shippingFor'), site('src/invoicing/application/invoice-assembler.ts', 'InvoiceAssembler', 'assemble')],
};

describe('ontology scorer', () => {
  it('every manifest parses and has the four finding kinds on both sides', () => {
    for (const c of CASES) {
      const m: ExpectedSemanticManifest = manifest(c);
      expect(m.case).toBe(c);
      for (const k of ['ruleDuplications', 'misplacedResponsibilities', 'conceptFragmentations', 'capabilityScatter'] as const) {
        expect(Array.isArray(m.expect[k])).toBe(true);
        expect(Array.isArray(m.forbid[k])).toBe(true);
      }
    }
  });

  it('scores a found planted duplication, a miss, and counts unexpected findings', () => {
    const m = manifest('case-01-rule-dup-shapes');
    const found = scoreCase(m, result([DUP], 2));
    expect(found.items.find((i) => i.polarity === 'expected')).toMatchObject({ ontology: 'found', cheap: 'not-recorded', judge: 'not-recorded' });
    expect(found.counts.ruleDuplications).toEqual({ expected: 1, found: 1, forbidden: 0, forbiddenHits: 0, unexpected: 0 });
    expect(found.hallucinations).toBe(2);
    const missed = scoreCase(m, result([{ ...DUP, sites: DUP.sites.slice(0, 1) }]));
    expect(missed.items.find((i) => i.polarity === 'expected')?.ontology).toBe('missed');
    expect(missed.counts.ruleDuplications.unexpected).toBe(1);
  });

  it('marks a forbidden hit on a control and requires the natural layer when the manifest names one', () => {
    const m04a = manifest('case-04a-control-near-miss-rules');
    const bad: OntologyFinding = { ...DUP, sites: [site('src/catalog/domain/bulk-discount.ts', 'BulkDiscount', 'rateFor'), site('src/shipping/domain/free-shipping.ts', 'FreeShippingRule', 'costFor')] };
    const s = scoreCase(m04a, result([bad]));
    expect(s.items.filter((i) => i.ontology === 'forbidden-hit')).toHaveLength(1);
    expect(s.counts.ruleDuplications).toMatchObject({ forbiddenHits: 1, unexpected: 1 });

    const mis = (naturalLayer: 'domain' | 'infrastructure'): OntologyFinding => ({
      kind: 'misplaced-responsibility', responsibilityId: 'x', responsibility: 'pricing', classLayer: 'application', naturalLayer, citedLogicDensity: 4, confidence: 0.8,
      site: site('src/notifications/application/order-notification.service.ts', 'OrderNotificationService', 'sendConfirmation'),
    });
    const item = manifest('case-02-misplaced-pricing').expect.misplacedResponsibilities[0];
    expect(item).toBeDefined();
    if (item !== undefined) {
      expect(findingMatches(mis('domain'), item)).toBe(true);
      expect(findingMatches(mis('infrastructure'), item)).toBe(false);
    }
  });

  it('reads the cheap proxies and a judge outcome on the same items', () => {
    const m = manifest('case-04a-control-near-miss-rules');
    const apg = { nodes: [
      { id: 'm1', type: 'Method', filePath: 'src/catalog/domain/bulk-discount.ts', name: 'BulkDiscount.rateFor', decorators: [], properties: {} },
      { id: 'm2', type: 'Method', filePath: 'src/shipping/domain/free-shipping.ts', name: 'FreeShippingRule.costFor', decorators: [], properties: {} },
    ], edges: [] } as unknown as APGResult;
    const flag = (file: string, className: string, methodName: string): CheapEnrichment['flags'][number] => ({ proxy: 'shared-literals', kind: 'shared-number-literal', score: 1, evidence: { file, startLine: 1, endLine: 1 }, className, methodName, message: '' });
    const cheap: CheapEnrichment = { edges: [], nodeFacts: [], summaries: {}, timingsMs: {}, flags: [flag('src/catalog/domain/bulk-discount.ts', 'BulkDiscount', 'rateFor'), flag('src/shipping/domain/free-shipping.ts', 'FreeShippingRule', 'costFor')] };
    const forbidden0 = m.forbid.ruleDuplications[0];
    expect(forbidden0 !== undefined && cheapOutcome('ruleDuplications', forbidden0, cheap, apg)).toBe(true);
    const clone: CheapEnrichment = { ...cheap, flags: [], edges: [{ type: 'SAME_LOGIC_AS', proxy: 'clones', sourceId: 'm1', targetId: 'm2', score: 1, evidence: [], properties: {} }] };
    expect(forbidden0 !== undefined && cheapOutcome('ruleDuplications', forbidden0, clone, apg)).toBe(true);
    const s = scoreCase(m, result([]), { cheap, apg, judge: { source: 'test', failedFiles: ['src/catalog/domain/bulk-discount.ts'] } });
    expect(s.items[0]).toMatchObject({ ontology: 'clear', cheap: 'flagged', judge: 'flagged' });
    expect(s.items[1]).toMatchObject({ cheap: 'clear', judge: 'flagged' });
  });

  it('aggregates recall, precision and the hallucination rate', () => {
    const a = aggregate([scoreCase(manifest('case-01-rule-dup-shapes'), result([DUP], 3)), scoreCase(manifest('case-02-misplaced-pricing'), result([]))]);
    expect(a).toMatchObject({ cases: 2, expected: 2, found: 1, recall: 0.5, precision: 1, unexpected: 0, hallucinations: 3, acceptedAssertions: 20 });
    expect(a.hallucinationRate).toBeCloseTo(3 / 23);
    expect(aggregate([])).toMatchObject({ recall: null, precision: null, hallucinationRate: null });
  });
});
