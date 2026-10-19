/** Ontology v0 passes (a) responsibility, (b) capability and (c) rules, with the mock provider. */
import { MockOntologyProvider, createScriptedResponder, diskReader, runOntology } from '../../../../src/apg-enrich/ontology/index.js';
import type { OntologyInput, ScriptedAnswers, ScriptedEntry } from '../../../../src/apg-enrich/ontology/index.js';
import { fixtureInput, nodeId } from './helpers.js';

const c = (node: string, quote: string): { node: string; quote: string } => ({ node, quote });

function run(input: OntologyInput, responses: ScriptedEntry[], extra: Record<string, unknown> = {}): { mock: MockOntologyProvider; go: () => ReturnType<typeof runOntology> } {
  const script: ScriptedAnswers = { case: 'test', responses };
  const mock = new MockOntologyProvider(createScriptedResponder(script, input.apg, diskReader(input.projectRoot)));
  return { mock, go: () => runOntology(input, { provider: mock, ...extra }) };
}

describe('ontology passes (mock provider)', () => {
  let input: OntologyInput;
  beforeAll(async () => { input = await fixtureInput('case-02-misplaced-pricing'); }, 60_000);

  it('(a) asks every class twice with its numbered source, APG neighbourhood and cheap facts', async () => {
    const { mock, go } = run(input, []);
    await go();
    const a = mock.received().filter((r) => r.pass === 'responsibility');
    expect(a).toHaveLength(8);
    expect(a.map((r) => r.runIndex)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
    const ons = a.find((r) => r.itemName === 'OrderNotificationService');
    expect(ons?.prompt).toContain(' 9| ');
    expect(ons?.prompt).toContain('const discount = order.lines.length > 3');
    expect(ons?.prompt).toContain('CONSTRUCTOR_INJECTS Interface Mailer');
    expect(ons?.prompt).toContain('CALLS Method Order.subtotal');
    expect(ons?.prompt).toContain('logicDensity=');
    expect(ons?.prompt).toContain('Declared layer: application');
    expect(ons?.system).toContain('verbatim');
  }, 60_000);

  it('(a) builds SemResponsibility nodes with provenance and grounded evidence; SemMISPLACED_IN only on agreed layer mismatch', async () => {
    const resp: ScriptedEntry = { pass: 'responsibility', item: 'OrderNotificationService', answer: { responsibilities: [
      { name: 'Compute the discount', description: 'pricing', naturalLayer: 'domain', confidence: 0.8, evidence: [c('OrderNotificationService.sendConfirmation', 'const discount = order.lines.length > 3 ? subtotal * 0.1 : 0;')] },
    ], concepts: [] } };
    const { go } = run(input, [resp]);
    const { result } = await go();
    const node = result.nodes.find((n) => n.label === 'SemResponsibility');
    expect(node).toMatchObject({ name: 'Compute the discount', agreement: 'agreed', provenance: { model: 'mock-ontology', temperature: null } });
    expect(node?.provenance.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(node?.evidence[0]).toMatchObject({ grounded: true, startLine: 9, endLine: 9 });
    expect(result.edges.filter((e) => e.type === 'SemMISPLACED_IN').map((e) => e.targetId)).toEqual(['layer:domain']);
    expect(result.edges.find((e) => e.type === 'SemRESPONSIBLE_FOR')?.sourceId).toBe(nodeId(input, 'Class', 'OrderNotificationService'));
    expect(result.findings).toEqual([expect.objectContaining({ kind: 'misplaced-responsibility', classLayer: 'application', naturalLayer: 'domain', citedLogicDensity: expect.any(Number) as number })]);

    // the same answer in run 0 only: single-run, so no finding (but the edge is kept, marked single-run)
    const { go: go1 } = run(input, [{ ...resp, runs: [0] }]);
    const r1 = (await go1()).result;
    expect(r1.findings).toEqual([]);
    expect(r1.edges.find((e) => e.type === 'SemMISPLACED_IN')?.agreement).toBe('single-run');
    expect(r1.agreement.responsibility.agreedAssertions).toBe(0);
    // ... unless agreement is not required
    const { go: go2 } = run(input, [{ ...resp, runs: [0] }], { requireAgreement: false });
    expect((await go2()).result.findings).toHaveLength(1);
  }, 60_000);

  it('(a) rejects ungrounded assertions as hallucinations and keeps the rest', async () => {
    const { go } = run(input, [{ pass: 'responsibility', item: 'Order', answer: { responsibilities: [
      { name: 'Hold lines', description: '', naturalLayer: 'domain', confidence: 0.9, evidence: [c('Order.subtotal', 'return this.lines.reduce((acc, l) => acc + l.price * l.quantity, 0);')] },
      { name: 'Persist itself', description: '', naturalLayer: 'infrastructure', confidence: 0.9, evidence: [c('Order.subtotal', 'await db.save(this)')] },
    ], concepts: [{ name: 'Order', relation: 'defines', confidence: 0.9, evidence: [c('PlaceOrderUseCase', 'export class PlaceOrderUseCase {')] }] } }]);
    const { result } = await go();
    // The scripted responder cannot place a quote that is not in the file, so it cites lines 0-0.
    expect(result.hallucinations.map((h) => [h.assertionKind, h.reasons[0]?.reason])).toEqual([
      ['responsibility', 'span-out-of-range'], ['concept', 'node-outside-item'], ['responsibility', 'span-out-of-range'], ['concept', 'node-outside-item'],
    ]);
    expect(result.nodes.filter((n) => n.label === 'SemResponsibility').map((n) => n.name)).toEqual(['Hold lines']);
    expect(result.acceptedAssertions.responsibility).toBe(2);
  }, 60_000);

  it('(b) names capabilities per component with agreed responsibilities, and rejects a class outside the group', async () => {
    const { mock, go } = run(input, [
      { pass: 'responsibility', item: 'Order', answer: { responsibilities: [{ name: 'Hold the order lines', description: '', naturalLayer: 'domain', confidence: 0.9, evidence: [c('Order', 'export class Order {')] }], concepts: [] } },
      { pass: 'capability', item: 'component:ordering', answer: { capabilities: [
        { name: 'Order placement', description: '', realizedBy: ['Order', 'PlaceOrderUseCase'], confidence: 0.8, evidence: [c('PlaceOrderUseCase', 'export class PlaceOrderUseCase {')] },
        { name: 'Mailing', description: '', realizedBy: ['ConsoleMailer'], confidence: 0.8, evidence: [c('Order', 'export class Order {')] },
      ] } },
    ]);
    const { result } = await go();
    const b = mock.received().filter((r) => r.pass === 'capability');
    expect(b.map((r) => r.itemName)).toEqual(['component:notifications', 'component:notifications', 'component:ordering', 'component:ordering']);
    expect(b.find((r) => r.itemName === 'component:ordering')?.prompt).toContain('responsibilities: Hold the order lines');
    expect(result.nodes.filter((n) => n.label === 'SemCapability').map((n) => n.name)).toEqual(['Order placement']);
    expect(result.edges.filter((e) => e.type === 'SemREALIZES')).toHaveLength(2);
    expect(result.hallucinations.filter((h) => h.pass === 'capability').map((h) => h.reasons[0]?.reason)).toEqual(['node-outside-item', 'node-outside-item']);
  }, 60_000);

  it('(c) asks only the cheap proxies\' candidate classes and requires enforcedBy to be a candidate method', async () => {
    const { mock, go } = run(input, [{ pass: 'rules', item: 'OrderNotificationService', answer: { rules: [
      { statement: 'Large orders get 10% off', kind: 'business', subject: 'line count', operator: '>', threshold: 3, unit: 'lines', enforcedBy: 'OrderNotificationService.sendConfirmation', confidence: 0.9, evidence: [c('OrderNotificationService.sendConfirmation', 'order.lines.length > 3')] },
      { statement: 'Subtotal sums lines', kind: 'business', subject: 'subtotal', operator: 'other', threshold: null, unit: null, enforcedBy: 'Order.subtotal', confidence: 0.9, evidence: [c('OrderNotificationService.sendConfirmation', 'order.lines.length > 3')] },
    ] } }]);
    const { result } = await go();
    const asked = [...new Set(mock.received().filter((r) => r.pass === 'rules').map((r) => r.itemName))];
    expect(asked).toEqual(expect.arrayContaining(['OrderNotificationService']));
    expect(asked).not.toContain('ConsoleMailer');
    expect(mock.received().find((r) => r.pass === 'rules' && r.itemName === 'OrderNotificationService')?.prompt).toContain('Candidate methods (proposed by the cheap proxies)');
    expect(result.nodes.filter((n) => n.label === 'SemBusinessRule').map((n) => n.name)).toEqual(['Large orders get 10% off']);
    expect(result.edges.find((e) => e.type === 'SemENFORCES')?.sourceId).toBe(nodeId(input, 'Method', 'OrderNotificationService.sendConfirmation'));
    expect(result.hallucinations.filter((h) => h.pass === 'rules').every((h) => h.reasons.some((r) => r.reason === 'node-outside-item'))).toBe(true);
    expect(result.findings.filter((f) => f.kind === 'semantic-rule-duplication')).toEqual([]);
  }, 60_000);

  it('(b)+(d) capability scatter: one capability realized in three components', async () => {
    const input3 = await fixtureInput('case-03-concept-fragmentation');
    const capIn = (group: string, cls: string): ScriptedEntry => ({ pass: 'capability', item: `component:${group}`, answer: { capabilities: [
      { name: 'Customer management', description: '', realizedBy: [cls], confidence: 0.7, evidence: [c(cls, `export class ${cls} {`)] },
    ] } });
    const { go } = run(input3, [capIn('sales', 'Client'), capIn('billing', 'Buyer'), capIn('accounts', 'AccountHolder')]);
    const { result } = await go();
    const scatter = result.findings.filter((f) => f.kind === 'capability-scatter');
    expect(scatter).toEqual([expect.objectContaining({ capability: 'Customer management', components: ['accounts', 'billing', 'sales'] })]);
    expect(result.nodes.filter((n) => n.label === 'SemCapability')).toHaveLength(1);
    expect(result.edges.filter((e) => e.type === 'SemREALIZES')).toHaveLength(3);
    // two components only: no scatter
    const { go: go2 } = run(input3, [capIn('sales', 'Client'), capIn('billing', 'Buyer')]);
    expect((await go2()).result.findings.filter((f) => f.kind === 'capability-scatter')).toEqual([]);
  }, 60_000);
});
