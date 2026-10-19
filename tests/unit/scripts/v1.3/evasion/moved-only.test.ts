/**
 * U5 evasion check, A2 (design §2.4): every planted case of `tests/fixtures/v1.4-evasion/` gives its `expected.json`;
 * the dependency-inversion fix is `none`; a pure rename gives no eligible diff (EV-06b); the class order is fixed and
 * every fired signal is kept (EV-04). Synthetic fixtures; no model, no Neo4j.
 */
import { defaultIdentity } from '../../../../../scripts/v1.3/lib/evasion/identity.js';
import { blockingFunctions, guardIndex, parseTierTable, placementModel, specGuardedPairs } from '../../../../../scripts/v1.3/lib/evasion/import-graph.js';
import { SIGNAL_ORDER, analyseTransition, classifyDiff, declarationsOf, jaccard, snapshotOf, tokenSet } from '../../../../../scripts/v1.3/lib/evasion/moved-only.js';
import type { TransitionCounts, TransitionContext } from '../../../../../scripts/v1.3/lib/evasion/moved-only.js';
import { ALL_CASES, loadCase, loadSpec, specPathOf, tierText } from './helpers.js';
import type { Case } from './helpers.js';

async function ctxFor(c: Case): Promise<TransitionContext> {
  const spec = await loadSpec(specPathOf(c));
  const model = placementModel(spec);
  return { model, guard: guardIndex(specGuardedPairs(model, blockingFunctions(spec, parseTierTable(tierText().text)))), identityOf: defaultIdentity };
}

async function run(name: string): Promise<{ c: Case; r: ReturnType<typeof analyseTransition>; counts: TransitionCounts }> {
  const c = loadCase(name);
  const counts: TransitionCounts = { endpointUnresolved: 0, cycleMembersUnknown: 0, edgeless: 0 };
  const r = analyseTransition(await ctxFor(c), { prev: snapshotOf(c.t0), cur: snapshotOf(c.t1), rho: c.rename, prevFindings: c.f0, curFindings: c.f1, history: [] }, counts);
  return { c, r, counts };
}

describe('A2: each planted case gives its expected kind, signals and class', () => {
  it.each(ALL_CASES.filter((n) => n !== 'outside-context' && n !== 'observed-pair'))('%s', async (name: string) => {
    const { c, r } = await run(name);
    expect(r.kind).toBe(c.expected.kind);
    expect([...r.signals]).toEqual(c.expected.signals);
    expect(r.class).toBe(c.expected.class);
  });

  it('the dependency-inversion fix (port in the domain, adapter implements it) is a removal of class none', async () => {
    const { r } = await run('true-fix-dip');
    expect(r.kind).toBe('removal');
    expect(r.class).toBe('none');
    expect(r.removed).toHaveLength(1);
  });

  it('EV-06b: a pure rename of the violating file gives no eligible diff, and without the rename map it would', async () => {
    const { r } = await run('rename-only');
    expect(r.kind).toBeNull();
    expect(r.newIdentities).toBe(0);
    const c = loadCase('rename-only');
    const counts: TransitionCounts = { endpointUnresolved: 0, cycleMembersUnknown: 0, edgeless: 0 };
    const unmapped = analyseTransition(await ctxFor(c), { prev: snapshotOf(c.t0), cur: snapshotOf(c.t1), rho: { map: new Map(), renameDetection: 'full' }, prevFindings: c.f0, curFindings: c.f1, history: [] }, counts);
    expect(unmapped.kind).toBe('removal');
  });

  it('the raw-specifier target of the stub is resolved from filePath', async () => {
    const { r, counts } = await run('stub-specifier-target');
    expect(counts.endpointUnresolved).toBe(0);
    expect(r.removed[0]?.pairs).toEqual(['src/domain/todo.ts -> src/infrastructure/todo-store.ts']);
  });

  it('an edgeless finding is counted and can only be deleted or none', async () => {
    const { r, counts } = await run('edgeless');
    expect(counts.edgeless).toBe(1);
    expect(r.class).toBe('deleted');
  });

  it('a cycle is tested on its member edges gone at t; unknown members only allow deleted or none', async () => {
    const { r } = await run('cycle');
    expect(r.removed[0]?.pairs).toEqual(['src/business/b.ts -> src/business/a.ts']);
    const c = loadCase('cycle');
    const lonely = [{ ...c.f0[0], filePath: 'src/business/a.ts' } as (typeof c.f0)[number]];
    const counts: TransitionCounts = { endpointUnresolved: 0, cycleMembersUnknown: 0, edgeless: 0 };
    const u = analyseTransition(await ctxFor(c), { prev: snapshotOf(c.t0), cur: snapshotOf(c.t1), rho: c.rename, prevFindings: lonely, curFindings: [], history: [] }, counts);
    expect(counts.cycleMembersUnknown).toBe(1);
    expect(u.class).toBe('none');
  });

  it('an unresolved endpoint leaves the identity out of every signal test (counted)', async () => {
    const c = loadCase('relocated-unmapped');
    const ghost = [{ ...c.f0[0], target: 'src/persistence/missing.ts' } as (typeof c.f0)[number]];
    const counts: TransitionCounts = { endpointUnresolved: 0, cycleMembersUnknown: 0, edgeless: 0 };
    const r = analyseTransition(await ctxFor(c), { prev: snapshotOf(c.t0), cur: snapshotOf(c.t1), rho: c.rename, prevFindings: ghost, curFindings: [], history: [] }, counts);
    expect(counts.endpointUnresolved).toBe(1);
    expect(r.signals).toEqual([]);
  });

  it('a step with a new identity is not avoided-eligible', async () => {
    const c = loadCase('avoided');
    const extra = [...c.f1, { ...c.f1[0], filePath: 'src/presentation/invoices-page.ts' } as (typeof c.f1)[number]];
    const counts: TransitionCounts = { endpointUnresolved: 0, cycleMembersUnknown: 0, edgeless: 0 };
    const r = analyseTransition(await ctxFor(c), { prev: snapshotOf(c.t0), cur: snapshotOf(c.t1), rho: c.rename, prevFindings: c.f0, curFindings: extra, history: [] }, counts);
    expect(r.kind).toBeNull();
    expect(r.newIdentities).toBe(1);
  });
});

describe('EV-04 class order and helpers', () => {
  it('the most severe fired signal wins, in the fixed order', () => {
    expect(SIGNAL_ORDER).toEqual(['dynamic-escape', 'relocated-unmapped', 'wrapped', 'inlined', 'relocated-unguarded', 'deleted']);
    expect(classifyDiff(['deleted', 'wrapped', 'relocated-unguarded'])).toBe('wrapped');
    expect(classifyDiff(['inlined', 'dynamic-escape'])).toBe('dynamic-escape');
    expect(classifyDiff([])).toBe('none');
  });

  it('declarations and token Jaccard ignore comments and whitespace', () => {
    const a = tokenSet('class A { run(x: number) { return x; } } // comment one');
    const b = tokenSet('class   A {\n  run(x: number) {\n    return x; /* other */\n  }\n}');
    expect(jaccard(a, b)).toBe(1);
    const d = declarationsOf('x.ts', 'export class A {}\nconst b = 1;\nexport { b };\ninterface C {}\n');
    expect([...d.keys()].sort()).toEqual(['A', 'C', 'b']);
    expect(d.get('b')?.exported).toBe(true);
    expect(d.get('C')?.exported).toBe(false);
  });
});
