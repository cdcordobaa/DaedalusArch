import { Project } from 'ts-morph';
import { densityOf } from '../../../../src/apg-enrich/cheap/behaviour.js';
import { runOn } from './helpers.js';

describe('logic density', () => {
  it('counts branches, value comparisons, numeric arithmetic and validation throws', () => {
    const sf = new Project({ useInMemoryFileSystem: true }).createSourceFile('a.ts', `function f(q: number, p: number, s: string, o?: object) {
  if (o === undefined) throw new Error('missing');
  if (typeof s === 'string' && q > 0) { return q * p + 1; }
  const label = s + 'x';
  for (const c of label) { if (c !== 'y') break; }
  throw new Error('end');
}`);
    const d = densityOf(sf.getFunctions()[0]?.getBody());
    // branches: 2 if + for + inner if = 4; comparisons: q > 0, c !== 'y' = 2 (null and typeof checks excluded);
    // arithmetic: q * p, (q * p) + 1 = 2 (string concatenation excluded); validation throws: 1 (the last is unguarded).
    expect(d).toEqual({ branches: 4, comparisons: 2, arithmetic: 2, validationThrows: 1, density: 9 });
  });

  it('flags a controller handler holding a rule and aggregates density per role', async () => {
    const fx = await runOn({
      'src/order/presentation/order.controller.ts': `import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
@Controller('orders')
export class OrderController {
  @Post()
  create(@Body() dto: { quantity: number }): number {
    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }
    return dto.quantity;
  }
  @Post()
  map(@Body() dto: { quantity: number }): number {
    const q = dto.quantity;
    return q;
  }
}
`,
    }, ['logic-density']);
    try {
      expect(fx.flags('logic-density').map((f) => `${f.kind}:${f.methodName ?? ''}`)).toEqual(['controller-logic-density:create']);
      expect(fx.enrichment.summaries['logic-density']?.perRole).toEqual({ controller: { methods: 2, mean: 1.5, max: 3, aboveThreshold: 1 } });
    } finally {
      fx.cleanup();
    }
  });
});
