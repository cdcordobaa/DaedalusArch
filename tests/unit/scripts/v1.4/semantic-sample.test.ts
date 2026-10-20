/**
 * The 2a semantic driver (scripts/v1.4/semantic-sample.ts; registration Amendment 2): the snapshot slugs match the
 * ids of the committed `--estimate` files, the runner's result line parses, and the registered sample is the one drawn
 * in Stage C (12 snapshots, 4 per cell, 17 blocking identities on the 4 none@L2 snapshots).
 */
import * as fs from 'node:fs';
import { parseCalls, sample, slugOf } from '../../../../scripts/v1.4/semantic-sample';

describe('semantic-sample driver', () => {
  it('slugs a sample id the way the 2a estimate files name it', () => {
    expect(slugOf('none@L2/ice-rink/rep1/step-05')).toBe('none-L2__ice-rink__rep1__step-05');
    const estimate = fs.readFileSync('results/v1.4-exploratory/stage-c/semantic/c1d-estimate.txt', 'utf8');
    for (const s of sample()) expect(estimate).toContain(`${slugOf(s.id)}:`);
  });

  it('reads the registered sample: 12 snapshots, 4 per cell, 17 blocking identities', () => {
    const s = sample();
    expect(s).toHaveLength(12);
    for (const cell of ['none@L2', 'none@L3', 'mcp@L2']) expect(s.filter((x) => x.cell === cell)).toHaveLength(4);
    expect(s.reduce((n, x) => n + x.blocking, 0)).toBe(17);
    expect(s.filter((x) => x.blocking > 0).every((x) => x.cell === 'none@L2')).toBe(true);
  });

  it('parses the runners\' per-snapshot result line, and returns null without one', () => {
    const line = 'x: 60 Sem nodes, 71 Sem edges, 1 findings, 0 rejected (hallucinations); calls 40, cache hits 2, invalid 1, budget-skipped 32, cassette misses 0';
    expect(parseCalls(`judge route ready\n${line}\n`)).toEqual({ line, calls: 40, cacheHits: 2, invalid: 1, budgetSkipped: 32 });
    expect(parseCalls('x: 2 blocking findings; calls 4, cache hits 0, invalid 0, budget-skipped 0, cassette misses 0')?.calls).toBe(4);
    expect(parseCalls('pre-flight failed')).toBeNull();
  });
});
