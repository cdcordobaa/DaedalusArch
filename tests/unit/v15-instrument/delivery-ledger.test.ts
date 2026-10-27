/**
 * v1.5 combined delivery: the shared finding ledger (design note §1.2, §4; step 2 "done when"). Pure, zero calls.
 */
import { attribute, FindingLedger, type PullScope } from '../../../src/v15-instrument/delivery/ledger.js';
import type { KeyedFinding } from '../../../src/v15-instrument/edit-gate/gate.js';

const f = (rule: string, file: string, command: string, aggregates: string[] = ['Order']): KeyedFinding => ({
  rule, file, line: 10, ruleText: 'r', why: `${command} (${file}:10)`, fix: 'x', writes: [], command, aggregates,
  key: [rule, file, command, aggregates.join(',')].join('|'),
} as unknown as KeyedFinding);

const consistency: PullScope = { files: null, covers: (r) => r === 'R-D4' || r === 'R-XCTX' };
const A = f('R-D4', 'src/sales/application/PlaceOrder.ts', 'PlaceOrder.execute', ['Customer', 'Order']);
const B = f('R-XCTX', 'src/billing/application/IssueInvoice.ts', 'IssueInvoice.execute', ['Order']);
const L = f('FF-S01', 'src/sales/domain/Order.ts', 'FF-S01', []);

describe('delivery ledger: one identity across push and pull', () => {
  it('numbers keys in order of first exposure, by either channel', () => {
    const l = new FindingLedger();
    expect(l.pull([B], consistency)).toEqual([{ key: B.key, number: 1, status: 'new' }]);
    expect(l.push([A, B]).fresh.map((x) => x.number)).toEqual([2]);
    expect(l.numberOf(A.key)).toBe(2);
    expect(l.numberOf(B.key)).toBe(1);
  });

  it('withholds from push a key that pull already showed', () => {
    const l = new FindingLedger();
    l.pull([A], consistency);
    const p = l.push([A]);
    expect(p.fresh).toEqual([]);
    expect(p.withheld).toEqual([{ key: A.key, number: 1, shownBy: 'pull' }]);
  });

  it('marks a pull answer "already reported" for a key push showed', () => {
    const l = new FindingLedger();
    l.push([A]);
    expect(l.pull([A, B], consistency)).toEqual([
      { key: A.key, number: 1, status: 'already reported' },
      { key: B.key, number: 2, status: 'new' },
    ]);
  });

  it('resolves a key that disappears, then treats it as new when it comes back (same number)', () => {
    const l = new FindingLedger();
    l.push([A]);
    const gone = l.push([]);
    expect(gone.resolved.map((x) => x.number)).toEqual([1]);
    const back = l.push([A]);
    expect(back.fresh.map((x) => x.number)).toEqual([1]);
    expect(l.table()[0]).toMatchObject({ number: 1, cameBack: true, open: true, resolvedAt: null });
  });

  it('a pull resolves only keys in its scope and of the rules it checks', () => {
    const l = new FindingLedger();
    l.push([A, L]);
    l.pull([], { files: ['src/billing/application/IssueInvoice.ts'], covers: consistency.covers });
    expect(l.openFindings().map((x) => x.number)).toEqual([1, 2]);
    l.pull([], consistency);
    expect(l.openFindings().map((x) => x.number)).toEqual([2]);
    expect(l.table()[0]).toMatchObject({ resolvedBy: 'pull', open: false });
  });

  it('Stop lists every open key of both channels, and blocks once per turn', () => {
    const l = new FindingLedger();
    l.push([A]);
    l.pull([B], { files: [B.file], covers: consistency.covers });
    expect(l.openFindings().map((x) => x.number)).toEqual([1, 2]);
    expect(l.claimStop('t1')).toBe(true);
    expect(l.claimStop('t1')).toBe(false);
    expect(l.claimStop('t2')).toBe(true);
  });

  it('a scripted session pushes no key twice while it stays open (0 double reports)', () => {
    const l = new FindingLedger();
    const pushed: string[] = [];
    const script: (() => void)[] = [
      () => pushed.push(...l.push([A]).fresh.map((x) => x.key)),
      () => l.pull([A, B], consistency),
      () => pushed.push(...l.push([A, B]).fresh.map((x) => x.key)),
      () => pushed.push(...l.push([A, B, L]).fresh.map((x) => x.key)),
      () => pushed.push(...l.push([B, L]).fresh.map((x) => x.key)),
      () => pushed.push(...l.push([B, L]).fresh.map((x) => x.key)),
    ];
    for (const s of script) s();
    expect(pushed).toEqual([A.key, L.key]);
  });
});

describe('delivery ledger: attribution rule (§4)', () => {
  it('attributes by the exposures before the resolving event', () => {
    expect(attribute({ exposures: [{ channel: 'push', seq: 1 }], resolvedAt: 3 }, false)).toBe('push only');
    expect(attribute({ exposures: [{ channel: 'pull', seq: 2 }, { channel: 'push', seq: 4 }], resolvedAt: 5 }, false)).toBe('pull first, then push');
    expect(attribute({ exposures: [{ channel: 'push', seq: 1 }, { channel: 'pull', seq: 6 }], resolvedAt: 5 }, false)).toBe('push only');
    expect(attribute({ exposures: [], resolvedAt: null }, false)).toBe('unexposed');
    expect(attribute({ exposures: [{ channel: 'push', seq: 1 }], resolvedAt: null }, true)).toBeNull();
  });
});
