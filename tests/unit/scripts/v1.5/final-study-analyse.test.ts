import { analyse, blocksOf, decide, dropNoTrap, planted, taskSums, type Cell } from '../../../../scripts/v1.5/lib/final-study-analyse';

const cell = (task: string, rep: number, arm: 'none' | 'combined', D: number | null, trapFailed = D !== null && D > 0): Cell => ({ task, style: 'ddd', rep, arm, D, trapFailed, accepted: true });

describe('v1.5 final study analysis', () => {
  it('pairs arms into blocks and drops incomplete ones', () => {
    const bs = blocksOf([cell('a', 1, 'none', 2), cell('a', 1, 'combined', 0), cell('b', 1, 'none', 1), cell('b', 1, 'combined', null), cell('c', 1, 'none', 1)], 'ddd');
    expect(bs.map((b) => b.task)).toEqual(['a']);
  });

  it('sums task-level differences per task', () => {
    const bs = blocksOf([cell('a', 1, 'none', 2), cell('a', 1, 'combined', 0), cell('a', 2, 'none', 1), cell('a', 2, 'combined', 1), cell('b', 1, 'none', 0), cell('b', 1, 'combined', 1)], 'ddd');
    expect(taskSums(bs)).toEqual([-2, 1]);
    expect(dropNoTrap(bs).length).toBe(2);
  });

  it('rejects a planted halving and does not reject the null (12 + 13 tasks, r = 3)', () => {
    const run = (keep: number, seed: number): ReturnType<typeof decide> => {
      const cells = planted({ tasks: { ddd: 12, hexagonal: 13 }, reps: 3, trap: 0.6, keep, seed });
      return decide([analyse('H1', blocksOf(cells, 'ddd'), { draws: 999, resamples: 200 }), analyse('H2', blocksOf(cells, 'hexagonal'), { draws: 999, resamples: 200 })]);
    };
    const effect = run(0.25, 20261029);
    expect(effect.every((d) => d.supported)).toBe(true);
    const nul = run(1, 20261030);
    expect(nul.some((d) => d.reject)).toBe(false);
  });

  it('reads a rejection against the predicted sign as such', () => {
    const cells: Cell[] = [];
    for (let t = 0; t < 10; t++) { cells.push(cell(`t${String(t)}`, 1, 'none', 0)); cells.push(cell(`t${String(t)}`, 1, 'combined', 2)); }
    const [d] = decide([analyse('H1', blocksOf(cells, 'ddd'), { draws: 999, resamples: 100 }), analyse('H2', [], { draws: 9, resamples: 10 })]);
    expect(d!.reject).toBe(true);
    expect(d!.reading).toBe('rejected against the predicted direction');
  });
});
