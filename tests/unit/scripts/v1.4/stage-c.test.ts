/**
 * Exploratory Study 2a, Stage C analysis helpers (scripts/v1.4/lib/stage-c.ts): moments, the cell summary, the paired
 * ratio, the stop rule of registration §7, the edge-kind heuristic and the seeded semantic-sample draw.
 */
import {
  betweenTaskVariance, cellRatio, drawSemanticSample, edgeKind, histogram, momentTheta, sampleVariance, stopCheck, summariseCell, y1ZeroShare,
  type RunD,
} from '../../../../scripts/v1.4/lib/stage-c';

const run = (cell: string, task: string, rep: number, D: number | null, Y1 = 1, Yk: number | null = 1, inheritedRemoved: number | null = 0): RunD => ({ cell, task, rep, D, Y1, Yk, inheritedRemoved });

describe('moments', () => {
  it('sample variance and the NB theta by moments', () => {
    expect(sampleVariance([1, 0, 1, 3, 2, 2])).toBeCloseTo(1.1, 10);
    // mean 1.5 > variance 1.1: no overdispersion, theta is reported as null (infinite).
    expect(momentTheta([1, 0, 1, 3, 2, 2])).toBeNull();
    // mean 2/3, variance 16/15: theta = (4/9) / (16/15 - 2/3) = 10/9.
    expect(momentTheta([2, 0, 0, 2, 0, 0])).toBeCloseTo(10 / 9, 10);
    expect(momentTheta([0, 0, 0])).toBeNull();
  });

  it('between-task variance by the method of moments, truncated at zero', () => {
    const b = betweenTaskVariance([[1, 0], [1, 3], [2, 2]]);
    expect(b.msb).toBeCloseTo(1.5, 10);
    expect(b.msw).toBeCloseTo(5 / 6, 10);
    expect(b.n0).toBe(2);
    expect(b.sigma2Task).toBeCloseTo(1 / 3, 10);
    expect(betweenTaskVariance([[2, 0], [0, 2], [0, 0]]).sigma2Task).toBe(0);
    expect(betweenTaskVariance([[1, 2]]).sigma2Task).toBeNull();
  });

  it('histogram keys ascend', () => {
    expect(histogram([3, 0, 1, 1])).toEqual({ 0: 1, 1: 2, 3: 1 });
  });
});

describe('summariseCell and cellRatio', () => {
  const ref = [run('a', 't1', 1, 1), run('a', 't1', 2, 0), run('a', 't2', 1, 2), run('a', 't2', 2, 3)];
  const cell = [run('b', 't1', 1, 0, 1, 0, 1), run('b', 't1', 2, 0, 1, 0, 1), run('b', 't2', 1, 2, 1, 3, 0), run('b', 't2', 2, 0, 1, 0, 1)];

  it('summarises the distribution, end states and D | R = 0', () => {
    const s = summariseCell('b', cell, 1, 200);
    expect(s.D.values).toEqual([0, 0, 2, 0]);
    expect(s.D.mean).toBe(0.5);
    expect(s.endStateZero).toBe(3);
    expect(s.allInheritedRemoved).toBe(3);
    expect(s.DgivenNoInheritedRemoval).toEqual({ runs: 1, values: [2], mean: 2 });
    expect(s.D.meanInterval?.low).toBeGreaterThanOrEqual(0);
  });

  it('pairs blocks by task and replicate', () => {
    const r = cellRatio(cell, ref, 1, 200);
    expect(r.blocks).toBe(4);
    expect(r.sumCell).toBe(2);
    expect(r.sumReference).toBe(6);
    expect(r.ratio?.estimate).toBeCloseTo(1 / 3, 10);
    expect(r.difference?.estimate).toBeCloseTo(-1, 10);
  });

  it('the Y1 = 0 share uses a Wilson interval', () => {
    const y = y1ZeroShare([{ Y1: 0 }, { Y1: 1 }, { Y1: 4 }, { Y1: null }]);
    expect(y.k).toBe(1);
    expect(y.n).toBe(3);
    expect(y.interval.high).toBeLessThan(1);
  });
});

describe('stopCheck (registration §7, Amendment 1)', () => {
  it('stops only when mean D < 0.5 and Y1 = 0 in at least 2 of 3 blocks', () => {
    expect(stopCheck([run('x', 'a', 1, 1, 4), run('x', 'b', 1, 2, 1), run('x', 'c', 1, 1, 1)]).stop).toBe(false);
    expect(stopCheck([run('x', 'a', 1, 0, 0), run('x', 'b', 1, 0, 0), run('x', 'c', 1, 1, 1)]).stop).toBe(true);
    // Mean below 0.5 but Y1 > 0 in two blocks: no stop.
    expect(stopCheck([run('x', 'a', 1, 0, 0), run('x', 'b', 1, 0, 1), run('x', 'c', 1, 1, 1)]).stop).toBe(false);
    // An incomplete block (D null) does not count.
    expect(stopCheck([run('x', 'a', 1, null, 0), run('x', 'b', 1, 0, 0), run('x', 'c', 1, 0, 0)]).blocks).toBe(2);
  });
});

describe('edgeKind', () => {
  it('classes FF-S03 edges from a presentation composition root as wiring', () => {
    expect(edgeKind({ functionId: 'FF-S03', filePath: 'src/presentation/server.ts' })).toBe('wiring');
    expect(edgeKind({ functionId: 'FF-S03', filePath: 'src/presentation/composition.ts' })).toBe('wiring');
    expect(edgeKind({ functionId: 'FF-S03', filePath: 'src/presentation/routes/hives.ts' })).toBe('layer-skip');
    expect(edgeKind({ functionId: 'FF-S01', filePath: 'src/persistence/x.ts' })).toBe('direction');
    expect(edgeKind({ functionId: 'FF-S02', filePath: 'a.ts,b.ts' })).toBe('cycle');
  });
});

describe('drawSemanticSample', () => {
  const cands = ['L2', 'L3', 'mcp'].flatMap((cell) => ['ice', 'youth', 'hive'].flatMap((task) => [1, 2].map((rep) => ({ cell, task, id: `${cell}/${task}/rep${String(rep)}` }))));

  it('draws m per stratum, at most 2 per task, deterministically', () => {
    const a = drawSemanticSample(cands, 4, 20261019);
    const b = drawSemanticSample(cands, 4, 20261019);
    expect(a).toEqual(b);
    expect(a).toHaveLength(12);
    for (const cell of ['L2', 'L3', 'mcp']) {
      const s = a.filter((x) => x.cell === cell);
      expect(s).toHaveLength(4);
      expect(new Set(s.map((x) => x.task)).size).toBeGreaterThanOrEqual(2);
    }
    expect(drawSemanticSample(cands, 4, 1)).not.toEqual(a);
  });
});
