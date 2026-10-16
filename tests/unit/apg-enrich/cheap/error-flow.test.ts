import { check, loadExpected, missingFrom, runFixture } from './batch2-helpers.js';
import { runOn } from './helpers.js';

describe('error-flow proxy (batch 2)', () => {
  it('flags every planted case of the fixture and nothing on its near misses', async () => {
    const fx = await runFixture('error-flow', ['error-flow']);
    try {
      expect(check(fx.flags('error-flow'), loadExpected('error-flow'))).toEqual({ missed: [], nearMissFlags: [], unexpected: [] });
    } finally {
      fx.cleanup();
    }
  });

  it('emits THROWS (direct and propagated through an interface) and CATCHES with the handling', async () => {
    const fx = await runFixture('error-flow', ['error-flow']);
    try {
      const edges = fx.enrichment.edges;
      const throws = edges.filter((e) => e.type === 'THROWS').map((e) => `${String(e.properties.unit)}>${String(e.properties.errorType)}:${e.properties.direct === true ? 'direct' : 'propagated'}`);
      expect(missingFrom(throws, [
        'Order.confirm>OrderError:direct',
        'ConfirmOrderService.confirm>OrderError:propagated',
        'Order.line>NotFoundException:direct',
        'IssueInvoice.run>InvoiceRejected:propagated',
      ])).toEqual([]);
      const catches = edges.filter((e) => e.type === 'CATCHES').map((e) => `${e.evidence[0]?.file ?? ''}:${String(e.properties.errorType)}:${String(e.properties.handling)}`);
      expect(missingFrom(catches, [
        'src/orders/presentation/order.controller.ts:OrderError:logged',
        'src/orders/presentation/order.controller.ts:OrderError:translated',
        'src/orders/presentation/order.controller.ts:OrderError:narrowed',
        'src/billing/infrastructure/invoice-job.ts:InvoiceRejected:rethrown',
        'src/billing/infrastructure/invoice-job.ts:InvoiceRejected:swallowed',
      ])).toEqual([]);
      const virtual = fx.enrichment.virtualNodes.filter((n) => n.kind === 'ErrorType').map((n) => `${n.id}:${String(n.properties.frameworkHttp)}`);
      expect(missingFrom(virtual, ['error:@nestjs/common#NotFoundException:true', 'error:@nestjs/common#BadRequestException:true'])).toEqual([]);
      // A project error class has an APG Class node: the THROWS edge targets it, not a virtual node.
      const orderError = fx.apg.nodes.find((n) => n.type === 'Class' && n.name === 'OrderError');
      expect(edges.some((e) => e.type === 'THROWS' && e.targetId === orderError?.id)).toBe(true);
    } finally {
      fx.cleanup();
    }
  });

  it('uses class roles when the project has no layer model', async () => {
    const fx = await runOn({
      'src/shop/order.repository.ts': `import { CartError } from './cart';
export class OrderRepository {
  save(n: number): boolean {
    try { check(n); return true; } catch { return false; }
  }
}
function check(n: number): void { if (n < 0) throw new CartError(); }
`,
      'src/shop/domain/cart.ts': 'export class CartError extends Error {}\n',
      'src/shop/cart.ts': "export { CartError } from './domain/cart';\n",
    }, ['error-flow'], {}, { layers: [] });
    try {
      expect(fx.flags('error-flow').map((f) => `${f.kind}:${f.className ?? ''}.${f.methodName ?? ''}`)).toEqual(['domain-error-swallowed:OrderRepository.save']);
    } finally {
      fx.cleanup();
    }
  });
});
