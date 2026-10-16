import { Project } from 'ts-morph';
import { jaccard, normalisedTokens, shinglesOf } from '../../../../src/apg-enrich/cheap/clones.js';
import { runOn } from './helpers.js';

const GUARD_A = `export class OrderService {
  create(quantity: number): number {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    return quantity;
  }
}
`;
const GUARD_B = `export class InvoiceService {
  validate(amount: number): void {
    if (amount <= 10) {
      throw new Error('Amount too small');
    }
  }
}
`;

describe('clones: normalisation and similarity', () => {
  it('maps identifiers, numbers and strings to type tokens and keeps keywords and operators', () => {
    const sf = new Project({ useInMemoryFileSystem: true }).createSourceFile('a.ts', "if (qty <= 0) { throw new Error('x'); }");
    const first = sf.getStatements()[0];
    if (first === undefined) throw new Error('no statement');
    expect(normalisedTokens(first)).toEqual(['if', '(', '$id', '<=', '$num', ')', '{', 'throw', 'new', '$id', '(', '$str', ')', ';', '}']);
  });

  it('computes shingle Jaccard', () => {
    const a = shinglesOf(['a', 'b', 'c', 'd'], 2);
    expect([...a]).toEqual(['a b', 'b c', 'c d']);
    expect(jaccard(a, shinglesOf(['a', 'b', 'c', 'x'], 2))).toBeCloseTo(2 / 4);
    expect(jaccard(a, a)).toBe(1);
  });
});

describe('clones proxy', () => {
  it('links a guard copied into another component with SAME_LOGIC_AS and flags both ends', async () => {
    const fx = await runOn({ 'src/order/application/order.service.ts': GUARD_A, 'src/invoice/application/invoice.service.ts': GUARD_B }, ['clones']);
    try {
      const edge = fx.enrichment.edges.find((e) => e.type === 'SAME_LOGIC_AS');
      expect(edge?.properties).toMatchObject({ similarity: 1, cloneType: 'exact-structural', granularity: 'fragment', crossComponent: true });
      expect(edge?.evidence.map((e) => e.file).sort()).toEqual(['src/invoice/application/invoice.service.ts', 'src/order/application/order.service.ts']);
      const flags = fx.flags('clones');
      expect(flags.map((f) => `${f.className ?? ''}.${f.methodName ?? ''}`).sort()).toEqual(['InvoiceService.validate', 'OrderService.create']);
      expect(flags[0]?.evidence.startLine).toBe(3);
    } finally {
      fx.cleanup();
    }
  });

  it('records a same-component clone without flagging it when cloneSameComponentFlags is off (the pre-fix proxy)', async () => {
    const fx = await runOn({ 'src/order/application/order.service.ts': GUARD_A, 'src/order/application/invoice.service.ts': GUARD_B }, ['clones'], { cloneSameComponentFlags: false });
    try {
      expect(fx.enrichment.edges.filter((e) => e.type === 'SAME_LOGIC_AS')).toHaveLength(1);
      expect(fx.enrichment.edges[0]?.properties.crossComponent).toBe(false);
      expect(fx.flags('clones')).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  it('flags a same-component clone as the separate advisory kind same-component-<type> by default', async () => {
    const fx = await runOn({ 'src/order/application/order.service.ts': GUARD_A, 'src/order/application/invoice.service.ts': GUARD_B }, ['clones']);
    try {
      expect(fx.flags('clones').map((f) => f.kind)).toEqual(['same-component-exact-structural', 'same-component-exact-structural']);
      expect(fx.enrichment.summaries.clones).toMatchObject({ crossComponentPairs: 0, sameComponentPairs: 1 });
    } finally {
      fx.cleanup();
    }
  });

  it('ignores bare existence guards and bodies shorter than the body minimum', async () => {
    const nullGuard = (cls: string): string => `export class ${cls} {
  find(id: string, items: Map<string, string>): string {
    const x = items.get(id);
    if (x === undefined) {
      throw new Error('not found');
    }
    return x;
  }
}
`;
    const fx = await runOn({ 'src/a/application/a.service.ts': nullGuard('AService'), 'src/b/application/b.service.ts': nullGuard('BService') }, ['clones'], { cloneMinBodyTokens: 1000 });
    try {
      expect(fx.enrichment.edges).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  it('finds near-clones at the Jaccard threshold', async () => {
    const body = (cls: string, extra: string): string => `export class ${cls} {
  total(lines: { price: number; qty: number }[]): number {
    let sum = 0;
    for (const l of lines) {
      sum += l.price * l.qty;
    }
    ${extra}
    return sum;
  }
}
`;
    const fx = await runOn({ 'src/a/domain/a.ts': body('A', ''), 'src/b/domain/b.ts': body('B', 'if (sum > 100) { sum = sum - 5; }') }, ['clones'], { nearCloneThreshold: 0.5, cloneMinBodyTokens: 20 });
    try {
      const near = fx.enrichment.edges.filter((e) => e.properties.cloneType === 'near' && e.properties.granularity === 'body');
      expect(near).toHaveLength(1);
      expect(near[0]?.score).toBeGreaterThanOrEqual(0.5);
      expect(near[0]?.score).toBeLessThan(1);
    } finally {
      fx.cleanup();
    }
  });
});
