import { addedCommentLines, decide, expectedIndents, normaliseAdded, pairTwin, preferred } from '../../../../scripts/v1.3/judge-v22-check2.js';
import type { Check2Item } from '../../../../scripts/v1.3/judge-v22-check2.js';
import type { MutationOperator, MutationSite } from '../../../../scripts/lib/mutation/types.js';

const item = (targetId: string, kind: Check2Item['kind'], over: Partial<Check2Item> = {}): Check2Item => ({
  itemId: `check2|${targetId}|FF-N02|u-${targetId}`, round: 'check2', targetId, kind, functionId: 'FF-N02', unitId: `u-${targetId}`,
  baseId: 'b', operatorId: kind === 'clean' ? '' : 'AP-X', cluster: 'b', split: 'CHECK', family: kind === 'clean' ? '' : 'FRAMEWORK-LEAK',
  style: 'layered', layeredBusiness: false, ...over,
});

type V = 'pass' | 'fail' | 'warning' | 'invalid' | 'missing';
const judge = (fails: readonly string[]) => (i: { targetId: string }): V => (fails.includes(i.targetId) ? 'fail' : 'pass');

describe('CHECK-2 decision rule (Docs/v1.3/judge-v22-plan.md §5)', () => {
  const items: Check2Item[] = [
    item('s1', 'seed'), item('s2', 'seed'), item('s3', 'seed', { family: 'REPO-BYPASS', style: 'hexagonal' }),
    item('t1', 'twin'), item('t2', 'twin'),
    item('c1', 'clean', { layeredBusiness: true }), item('c2', 'clean', { layeredBusiness: true }), item('c3', 'clean', { style: 'clean-architecture' }),
  ];

  it('CANDIDATE when v2.2 removes the layered false fails and loses nothing', () => {
    const d = decide(items, judge(['s1', 's2', 's3', 'c1', 'c2']), judge(['s1', 's2', 's3']));
    expect(d.outcome).toBe('CANDIDATE');
    expect(d.checks.find((c) => c.id === 'D1')?.v22).toBe('0/2');
  });

  it('NOT CANDIDATE when v2.2 loses a real-construct seed (D6), even with fewer false fails', () => {
    const d = decide(items, judge(['s1', 's2', 's3', 'c1']), judge(['s1', 's2']));
    expect(d.outcome).toBe('NOT CANDIDATE');
    expect(d.checks.find((c) => c.id === 'D6')?.holds).toBe(false);
  });

  it('NOT CANDIDATE when v2.2 still fails two layered business clean units (D1)', () => {
    expect(decide(items, judge(['s1', 's2', 's3', 'c1', 'c2']), judge(['s1', 's2', 's3', 'c1', 'c2'])).outcome).toBe('NOT CANDIDATE');
  });

  it('NOT CANDIDATE when v2.2 adds a clean false fail anywhere (D5) or two twin false fails (D4)', () => {
    expect(decide(items, judge(['s1', 's2', 's3']), judge(['s1', 's2', 's3', 'c3'])).checks.find((c) => c.id === 'D5')?.holds).toBe(false);
    expect(decide(items, judge(['s1', 's2', 's3']), judge(['s1', 's2', 's3', 't1', 't2'])).checks.find((c) => c.id === 'D4')?.holds).toBe(false);
  });

  it('INCONCLUSIVE with more than two units without a majority verdict', () => {
    const v22 = (i: { targetId: string }): V => (['s1', 's2', 't1'].includes(i.targetId) ? 'invalid' : 'pass');
    expect(decide(items, judge(['s1']), v22).outcome).toBe('INCONCLUSIVE');
  });
});

describe('CHECK-2 seeding helpers', () => {
  const site = (filePath: string, detail: Record<string, string>): MutationSite => ({ filePath, line: 1, kind: 'k', detail });

  it('prefers non-error holders and, for MO-DF01, repository targets in the same ddd context', () => {
    const op = { id: 'MO-DF01' } as MutationOperator;
    const sites = [
      site('src/claims/domain/claim/ClaimError.ts', { class: 'ClaimError', targetName: 'InMemoryClaimRepository', targetFile: 'src/claims/infrastructure/InMemoryClaimRepository.ts' }),
      site('src/claims/domain/claim/Claim.ts', { class: 'Claim', targetName: 'InMemoryPolicyRepository', targetFile: 'src/policies/infrastructure/InMemoryPolicyRepository.ts' }),
      site('src/claims/domain/claim/Claim.ts', { class: 'Claim', targetName: 'InMemoryClaimRepository', targetFile: 'src/claims/infrastructure/InMemoryClaimRepository.ts' }),
    ];
    expect(preferred(sites, op, 'ddd').map((s) => s.detail.targetName)).toEqual(['InMemoryClaimRepository']);
    expect(preferred(sites, op, 'hexagonal')).toHaveLength(2);
  });

  it('pairs the twin at the same site, else the same member, else the mirror', () => {
    const pos = site('a.ts', { class: 'A', method: 'm' });
    expect(pairTwin(pos, [site('b.ts', { class: 'B', method: 'm' }), site('a.ts', { class: 'A', method: 'm' })])?.match).toBe('same-site');
    expect(pairTwin(site('c.ts', { controller: 'C', handler: 'h', method: 'x' }), [site('c.ts', { controller: 'C', handler: 'g' }), site('c.ts', { controller: 'C', handler: 'h' })])?.site.detail.handler).toBe('h');
    expect(pairTwin(site('d.ts', { class: 'Order', targetName: 'Repo' }), [site('r.ts', { class: 'Repo', targetName: 'Order' })])?.match).toBe('mirror');
  });

  it('puts operator-added lines into the file style and leaves unchanged lines alone', () => {
    const before = "import { A } from './a';\n\nexport class X {\n  a = 1;\n\n  run(n: number): void {\n    go(n);\n  }\n}\n";
    const after = "import { A } from './a';\nimport { R } from \"../r\";\n\nexport class X {\n    private readonly repo = new R();\n  a = 1;\n\n  run(n: number): void {\n    if (n < 0) {\n          throw new Error('n');\n        }\n    go(n);\n  }\n}\n";
    const r = normaliseAdded(before, after);
    expect(r.changed).toBe(true);
    expect(r.text).toBe("import { A } from './a';\nimport { R } from '../r';\n\nexport class X {\n  private readonly repo = new R();\n  a = 1;\n\n  run(n: number): void {\n    if (n < 0) {\n      throw new Error('n');\n    }\n    go(n);\n  }\n}\n");
    expect(normaliseAdded(before, before).changed).toBe(false);
    expect(expectedIndents(['a.catch((e) => {', 'x();', '});'], 2)).toEqual([0, 2, 0]);
  });

  it('finds comments the copy adds', () => {
    expect(addedCommentLines('a\n', 'a\n// note\nb /* c */\n')).toEqual(['// note', 'b /* c */']);
    expect(addedCommentLines('// kept\n', '// kept\n')).toEqual([]);
  });
});
