/**
 * FR-1 fidelity for calls through ports (v1.5.6, `ops/notes/v15-calls-through-ports.md`): CALLS_VIA_PORT against
 * (a) a hand-checked list on the HEXDDD-01 S2 seed and (b) the language-service truth (`port-call-truth.ts`) on
 * committed dev trees. Every one of the 91 DETECT-02 dev trees agreed with the language service when the relation was
 * built (732 of 732 edges, 0 missing, 0 extra); the committed trees here keep that check in the suite.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { portCallTruth } from './port-call-truth.js';

const REPO = path.resolve(__dirname, '../../..');
let scratch = '';
beforeAll(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v156-port-calls-')); });
afterAll(() => { fs.rmSync(scratch, { recursive: true, force: true }); });

describe('CALLS_VIA_PORT fidelity', () => {
  it('HEXDDD-01 S2 seed: the six hand-checked port calls, each to its one adapter; controllers call concrete use cases', async () => {
    const r = await portCallTruth(path.join(REPO, 'experiments/pilot-hexddd-01/seeds/s2-ddd-debt'), scratch);
    // Hand read of src/**/application, acl and api: every `this.<port>.<member>(…)` on an interface-typed field.
    // OrderingAcl reaches OrderSummaryQuery through the ordering barrel (`export type … from`), GetOrderSummary implements it.
    expect(r.extracted).toEqual([
      'GetOrderSummary.summaryOf@src/ordering/application/GetOrderSummary.ts -> InMemoryOrderRepository.byId@src/ordering/infrastructure/InMemoryOrderRepository.ts',
      'IssueInvoice.execute@src/billing/application/IssueInvoice.ts -> InMemoryInvoiceRepository.save@src/billing/infrastructure/InMemoryInvoiceRepository.ts',
      'IssueInvoice.execute@src/billing/application/IssueInvoice.ts -> OrderingAcl.billableOrder@src/billing/acl/OrderingAcl.ts',
      'OrderingAcl.billableOrder@src/billing/acl/OrderingAcl.ts -> GetOrderSummary.summaryOf@src/ordering/application/GetOrderSummary.ts',
      'PlaceOrder.execute@src/ordering/application/PlaceOrder.ts -> InMemoryCustomerRepository.byId@src/ordering/infrastructure/InMemoryCustomerRepository.ts',
      'PlaceOrder.execute@src/ordering/application/PlaceOrder.ts -> InMemoryOrderRepository.save@src/ordering/infrastructure/InMemoryOrderRepository.ts',
    ]);
    expect(r.missing).toEqual([]);
    expect(r.extra).toEqual([]);
  }, 120_000);

  it.each([
    ['experiments/pilot-hexddd-01/seeds/s1-hex-debt', 18],
    ['experiments/puzzle-01/puzzles/p1-transfers/solutions/clean', 15],
    ['experiments/detect-02/fixtures/graph-scale/tree', 1],
  ])('%s: equal to the language-service truth (%i edges)', async (tree, n) => {
    const r = await portCallTruth(path.join(REPO, tree), scratch);
    expect({ missing: r.missing, extra: r.extra }).toEqual({ missing: [], extra: [] });
    expect(r.truth).toHaveLength(n);
  }, 120_000);
});
