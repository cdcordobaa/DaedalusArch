/**
 * v1.4 U2 fixture delta, listed exactly (design §6 test 5; plan step 9.7). The committed delta
 * (`results/v1.4-u2/fixture-delta.json`, written by `scripts/v1.4/u2-fixture-delta.ts` over every committed
 * fixture/spec pair) must be reproduced in process for a light subset, and the ADR effect tables must list exactly its
 * rows. A change outside the list fails. cypher-interp, symbolic-only: no Neo4j, no network, no model.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeDelta, deltaTable, lightPairs } from '../../../scripts/v1.4/u2-fixture-delta.js';
import type { Baseline, Delta } from '../../../scripts/v1.4/u2-fixture-delta.js';
import { ROOT } from './helpers.js';

jest.setTimeout(180_000);

const read = (rel: string): unknown => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as unknown;

/** Table rows of every delta table (header `| Pair | Change | Rule |`) in a Markdown text. */
function deltaRowsIn(text: string): string[] {
  const lines = text.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!(lines[i] ?? '').startsWith('| Pair | Change | Rule |')) continue;
    for (let j = i + 2; j < lines.length && (lines[j] ?? '').startsWith('|'); j++) out.push(lines[j] ?? '');
  }
  return out;
}

describe('U2 fixture delta', () => {
  const committed = read('results/v1.4-u2/fixture-delta.json') as Delta;

  it('the committed delta: post-seal off reproduces the baseline on every pair', () => {
    expect(committed.offEqualsBaseline).toBe(true);
    expect(committed.offMismatches).toEqual([]);
  });

  it('re-running the light subset in process gives the committed rows for those pairs', async () => {
    const baseline = read('results/v1.4-u2/baseline.json') as Baseline;
    const pairs = lightPairs(ROOT);
    expect(pairs.length).toBe(8);
    const fresh = await computeDelta(baseline, pairs, false, ROOT);
    expect(fresh.offEqualsBaseline).toBe(true);
    const ids = new Set(pairs.map((p) => p.id));
    expect(fresh.rows).toEqual(committed.rows.filter((r) => ids.has(r.pair)));
  });

  it('the ADR effect tables list exactly the committed delta rows (ADR-V14-01 the FF-S02 rows, ADR-V14-02 the FF-P07 rows)', () => {
    const adr = fs.readFileSync(path.join(ROOT, 'Docs/v1.4/adr-v14.md'), 'utf8');
    const second = adr.indexOf('## ADR-V14-02');
    expect(second).toBeGreaterThan(0);
    const expectedRows = (rule: string): string[] => deltaTable(committed.rows.filter((r) => r.rule === rule)).split('\n').slice(2);
    expect(deltaRowsIn(adr.slice(0, second))).toEqual(expectedRows('FF-S02'));
    expect(deltaRowsIn(adr.slice(second))).toEqual(expectedRows('FF-P07'));
    expect(committed.rows.every((r) => r.rule === 'FF-S02' || r.rule === 'FF-P07')).toBe(true);
  });

  it('the Markdown delta matches the JSON delta', () => {
    const md = fs.readFileSync(path.join(ROOT, 'results/v1.4-u2/fixture-delta.md'), 'utf8');
    expect(deltaRowsIn(md)).toEqual(deltaTable(committed.rows).split('\n').slice(2));
  });
});
