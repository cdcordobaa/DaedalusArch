import { adjustedRandIndex, louvain, modularity } from '../../../../src/apg-enrich/cheap/louvain.js';
import { runOn } from './helpers.js';

const clique = (ns: string[]): { a: string; b: string; w: number }[] => ns.flatMap((a, i) => ns.slice(i + 1).map((b) => ({ a, b, w: 1 })));

describe('louvain and ARI', () => {
  it('separates two cliques joined by one edge, deterministically', () => {
    const nodes = ['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4'];
    const edges = [...clique(['a1', 'a2', 'a3', 'a4']), ...clique(['b1', 'b2', 'b3', 'b4']), { a: 'a4', b: 'b1', w: 1 }];
    const r = louvain(nodes, edges);
    expect(new Set(['a1', 'a2', 'a3', 'a4'].map((n) => r.community.get(n))).size).toBe(1);
    expect(new Set(['b1', 'b2', 'b3', 'b4'].map((n) => r.community.get(n))).size).toBe(1);
    expect(r.community.get('a1')).not.toBe(r.community.get('b1'));
    expect(r.modularity).toBeCloseTo(modularity(nodes, edges, r.community));
    expect(r.modularity).toBeGreaterThan(0.4);
    expect(louvain(nodes, edges).community).toEqual(r.community);
  });

  it('computes the adjusted Rand index', () => {
    const a = new Map([['x', 0], ['y', 0], ['z', 1], ['w', 1]]);
    expect(adjustedRandIndex(a, new Map([['x', 'p'], ['y', 'p'], ['z', 'q'], ['w', 'q']]))).toBe(1);
    expect(adjustedRandIndex(a, new Map([['x', 'p'], ['y', 'q'], ['z', 'p'], ['w', 'q']]))).toBeLessThan(0);
  });
});

describe('communities proxy', () => {
  it('compares the file graph partition with components and flags a file that clusters elsewhere', async () => {
    const fx = await runOn({
      'src/a/domain/a1.ts': "import { a2 } from './a2';\nimport { a3 } from './a3';\nexport const a1 = a2 + a3;\n",
      'src/a/domain/a2.ts': "import { a3 } from './a3';\nexport const a2 = a3;\n",
      'src/a/domain/a3.ts': 'export const a3 = 1;\n',
      'src/b/domain/b1.ts': "import { a1 } from '../../a/domain/a1';\nimport { a2 } from '../../a/domain/a2';\nimport { a3 } from '../../a/domain/a3';\nexport const b1 = a1 + a2 + a3;\n",
      'src/b/domain/b2.ts': "import { b3 } from './b3';\nexport const b2 = b3;\n",
      'src/b/domain/b3.ts': 'export const b3 = 2;\n',
    }, ['communities']);
    try {
      const s = fx.enrichment.summaries.communities as { communities: number; ariComponents: number; mismatchedFiles: string[] };
      expect(s.communities).toBe(2);
      expect(s.mismatchedFiles).toEqual(['src/b/domain/b1.ts']);
      expect(s.ariComponents).toBeLessThan(1);
      expect(fx.enrichment.nodeFacts.filter((n) => n.key === 'community')).toHaveLength(6);
    } finally {
      fx.cleanup();
    }
  });
});
