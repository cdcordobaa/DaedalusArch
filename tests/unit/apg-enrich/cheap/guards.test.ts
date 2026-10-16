/**
 * Guard-normalised clone units (`src/apg-enrich/cheap/guards.ts`, `CheapOptions.cloneGuardUnits`): short duplicated
 * `if (…) throw …` guards are caught on condition + error type + message template; trivial null checks on parameters
 * and locals are excluded (the rule fixed before the evaluation run).
 */
import { Project } from 'ts-morph';
import type { IfStatement } from 'ts-morph';
import { guardKey, guardShape, isTrivialParamNullCheck } from '../../../../src/apg-enrich/cheap/guards.js';
import { runOn } from './helpers.js';

function firstIf(body: string): IfStatement {
  const sf = new Project({ useInMemoryFileSystem: true }).createSourceFile('a.ts', `declare const MAX: number;\nfunction f(p: any, q: any) {\n  const local: any = p;\n  ${body}\n}`);
  const st = sf.getFunctions()[0]?.getBody()?.getChildSyntaxList()?.getChildren().find((c) => c.getKindName() === 'IfStatement');
  if (st === undefined) throw new Error('no if');
  return st as IfStatement;
}

describe('guard shape', () => {
  const keyOf = (src: string): string => {
    const g = guardShape(firstIf(src));
    if (g === undefined) throw new Error('not a guard');
    return guardKey(g);
  };

  it('keys a guard on its normalised condition, error type and message template', () => {
    const g = guardShape(firstIf('if (!isOrderStatus(p)) throw new DomainError("invalid", `Unknown ${p} state`);'));
    expect(g).toEqual({ condition: '! isOrderStatus ( $v )', errorType: 'DomainError', message: 'invalid | Unknown ${} state' });
    // A renamed local keeps the key; a different message or error type changes it.
    const k = keyOf('if (!isOrderStatus(p)) throw new DomainError("invalid", `Unknown ${p} state`);');
    expect(keyOf('if (!isOrderStatus(q)) { throw new DomainError("invalid", `Unknown ${q} state`); }')).toBe(k);
    expect(keyOf('if (!isOrderStatus(p)) throw new DomainError("invalid", "other");')).not.toBe(k);
    expect(keyOf('if (!isOrderStatus(p)) throw new Error("invalid", `Unknown ${p} state`);')).not.toBe(k);
  });

  it('keeps property names and literal values in the condition', () => {
    expect(guardShape(firstIf('if (p.lines.length === 0) throw new Error("x");'))?.condition).toBe('$v . lines . length === 0');
    expect(guardShape(firstIf('if (p.qty > MAX) throw new Error("x");'))?.condition).toBe('$v . qty > $v');
  });

  it('is not a guard with an else branch, several statements, or no throw', () => {
    expect(guardShape(firstIf('if (p.a) throw new Error("x"); else return;'))).toBeUndefined();
    expect(guardShape(firstIf('if (p.a) { log(); throw new Error("x"); }'))).toBeUndefined();
    expect(guardShape(firstIf('if (p.a) return;'))).toBeUndefined();
  });
});

describe('exclusion rule: trivial null checks on parameters and locals', () => {
  it.each([
    'if (!p) throw new Error("p is required");',
    'if (p == null) throw new Error("x");',
    'if (p === undefined) throw new Error("x");',
    'if (null === p) throw new Error("x");',
    "if (typeof p === 'undefined') throw new Error(\"x\");",
    'if (!p || q === null) throw new Error("x");',
    'if (!local) throw new NotFound("Order not found");',
  ])('excluded: %s', (src) => {
    expect(isTrivialParamNullCheck(firstIf(src))).toBe(true);
  });

  it.each([
    'if (!p.customerId) throw new Error("customerId is required");',
    'if (!isOrderStatus(p)) throw new Error("x");',
    'if (p <= 0) throw new Error("x");',
    'if (!MAX) throw new Error("x");',
    'if (!p && !q) throw new Error("x");',
    'if (p !== null) throw new Error("x");',
  ])('kept: %s', (src) => {
    expect(isTrivialParamNullCheck(firstIf(src))).toBe(false);
  });
});

const service = (cls: string, method: string, guard: string, pre = ''): string => `${pre}export class ${cls} {
  ${method}(request: { customerId?: string; status: unknown }): void {
    ${guard}
  }
}
`;
const STATUS = `export function isOrderStatus(s: unknown): boolean { return s === 'open'; }\nexport class DomainError extends Error { constructor(c: string, m: string) { super(m); } }\n`;
const IMPORT = "import { isOrderStatus, DomainError } from '../../domain/order-status';\n";
const GUARD = 'if (!isOrderStatus(request.status)) throw new DomainError("invalid", "Unknown order state");';

describe('clones proxy with guard units', () => {
  it('catches a short duplicated guard within one component (same-component-guard) and across components (cross-component-guard)', async () => {
    const fx = await runOn({
      'src/domain/order-status.ts': STATUS,
      'src/order/application/advance.ts': service('AdvanceOrderUseCase', 'execute', GUARD, IMPORT),
      'src/order/application/list.ts': service('ListOrdersUseCase', 'validateExecute', GUARD, IMPORT),
      'src/billing/application/bill.ts': service('BillUseCase', 'execute', GUARD, IMPORT),
    }, ['clones']);
    try {
      const kinds = fx.flags('clones').map((f) => `${f.className ?? ''}:${f.kind}`).sort();
      expect(kinds).toEqual([
        'AdvanceOrderUseCase:cross-component-guard', 'AdvanceOrderUseCase:same-component-guard',
        'BillUseCase:cross-component-guard', 'BillUseCase:cross-component-guard',
        'ListOrdersUseCase:cross-component-guard', 'ListOrdersUseCase:same-component-guard',
      ]);
      expect(fx.enrichment.edges.filter((e) => e.properties.granularity === 'guard')).toHaveLength(3);
      expect(fx.enrichment.summaries.clones).toMatchObject({ guardUnits: 3, guardPairs: 3, sameComponentPairs: 1, crossComponentPairs: 2 });
    } finally {
      fx.cleanup();
    }
  });

  it('a different message is a different rule: no pair', async () => {
    const fx = await runOn({
      'src/domain/order-status.ts': STATUS,
      'src/order/application/advance.ts': service('AdvanceOrderUseCase', 'execute', GUARD, IMPORT),
      'src/order/application/list.ts': service('ListOrdersUseCase', 'execute', GUARD.replace('Unknown order state', 'Bad status'), IMPORT),
    }, ['clones']);
    try {
      expect(fx.flags('clones')).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  it('ignores repeated trivial parameter null checks, and guard units are off with cloneGuardUnits: false', async () => {
    const nullCheck = 'if (!request) throw new Error("request is required");';
    const fx = await runOn({
      'src/order/application/a.ts': service('AUseCase', 'execute', nullCheck),
      'src/billing/application/b.ts': service('BUseCase', 'execute', nullCheck),
    }, ['clones']);
    const off = await runOn({
      'src/domain/order-status.ts': STATUS,
      'src/order/application/advance.ts': service('AdvanceOrderUseCase', 'execute', GUARD, IMPORT),
      'src/billing/application/bill.ts': service('BillUseCase', 'execute', GUARD, IMPORT),
    }, ['clones'], { cloneGuardUnits: false });
    try {
      expect(fx.flags('clones')).toEqual([]);
      expect(fx.enrichment.summaries.clones).toMatchObject({ guardUnits: 0, excludedTrivialGuards: 2 });
      expect(off.flags('clones')).toEqual([]);
      expect(off.enrichment.summaries.clones).not.toHaveProperty('guardUnits');
    } finally {
      fx.cleanup();
      off.cleanup();
    }
  });

  it('constructor invariant guards are guard units (no Method node: flag without an edge)', async () => {
    const vo = (cls: string): string => `export class ${cls} {\n  constructor(readonly amount: number) {\n    if (amount < 0) throw new Error("Amount must not be negative");\n  }\n}\n`;
    const fx = await runOn({ 'src/order/domain/a.ts': vo('Price'), 'src/billing/domain/b.ts': vo('Charge') }, ['clones']);
    try {
      expect(fx.flags('clones').map((f) => `${f.className ?? ''}.${f.methodName ?? ''}:${f.kind}`).sort()).toEqual([
        'Charge.constructor:cross-component-guard', 'Price.constructor:cross-component-guard',
      ]);
      expect(fx.enrichment.edges).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });
});
