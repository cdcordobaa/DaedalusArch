/**
 * R1 and R2 (U4 design §5): the drift module reproduces the published figures from the committed fix-mining outputs,
 * digit for digit, under LEGACY_FIXES_MINED (`leftCensor: 'grid-index-0'`) and stored tiers (DR-2, DR-3a).
 * - R1: `Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md` §5a, and the raw KM floats of
 *   `results/v1.3-fixes-mined/summary.json` `survival[]` to 1e-12.
 * - R2: `Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md` §3 and §4 (pinned as constants: the C5 results
 *   folder is not committed).
 * - S1, S2 (DR-8): sensitivity rows pinned to the design review's independent replication, printed beside the
 *   published figures, never in place of them.
 * - The stored tier against the live table and the Python set is reported, and does not gate R1 or R2.
 * Read-only; one repository in memory at a time; no Neo4j.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  compareMined, computeMinedRegression, PUBLISHED_5A, PUBLISHED_C5, REVIEW_SENSITIVITY, type MinedRegression, type PublishedRow,
} from '../../../../scripts/lib/drift/regression.js';
import type { KmRow } from '../../../../scripts/lib/drift/metrics.js';
import { at } from './fixtures.js';

const MINED = path.resolve(__dirname, '../../../../results/v1.3-fixes-mined');
const row = (r: KmRow): Omit<PublishedRow, 'group' | 'inPlacePct'> => ({ n: r.n, ended: r.ended, median: r.median, s365: r.s365 });
const pub = (p: PublishedRow): Omit<PublishedRow, 'group' | 'inPlacePct'> => ({ n: p.n, ended: p.ended, median: p.median, s365: p.s365 });

let reg: MinedRegression;
beforeAll(() => {
  reg = computeMinedRegression(MINED);
});

describe('R1: the fix-mining survival table §5a, exactly', () => {
  it('covers the 36 walked repositories', () => {
    expect(reg.repos).toBe(36);
  });
  it.each(PUBLISHED_5A.map((p, i) => [p.group, i] as const))('%s', (_g, i) => {
    const p = at(PUBLISHED_5A, i);
    const a = reg.survival5A[i] as KmRow & { group: string };
    expect(a.group).toBe(p.group);
    expect(row(a)).toEqual(pub(p));
    expect(a.inPlacePct).toBe(p.inPlacePct);
  });
  it('the raw KM median and S(365) equal summary.json survival[] to 1e-12', () => {
    const summary = JSON.parse(fs.readFileSync(path.join(MINED, 'summary.json'), 'utf8')) as { survival: { group: string; km: { n: number; events: number; median: number | null; s365: number } }[] };
    expect(summary.survival).toHaveLength(8);
    summary.survival.forEach((s, i) => {
      const a = reg.survival5A[i] as KmRow & { group: string };
      expect(a.group).toBe(s.group);
      expect(a.km.n).toBe(s.km.n);
      expect(a.km.events).toBe(s.km.events);
      if (s.km.median === null) expect(a.km.median).toBeNull();
      else expect(Math.abs((a.km.median ?? Number.NaN) - s.km.median)).toBeLessThan(1e-12);
      expect(Math.abs(a.km.s365 - s.km.s365)).toBeLessThan(1e-12);
    });
  });
});

describe('S1 and S2 sensitivity rows (DR-8), against the review replication', () => {
  it.each(REVIEW_SENSITIVITY.map((p, i) => [p.group, i] as const))('%s', (_g, i) => {
    const p = at(REVIEW_SENSITIVITY, i);
    const a = at(reg.sensitivity, i);
    expect(a.group).toBe(p.group);
    expect(row(a.S1)).toEqual(pub(p.S1));
    expect(row(a.S2)).toEqual(pub(p.S2));
  });
  it('the left-censoring artefact: 10 repositories whose grid point 0 failed (outline-server: point 49, 1,018 lineages, 112 blocking)', () => {
    expect(reg.leftCensorArtefact).toHaveLength(10);
    expect(reg.leftCensorArtefact.find((x) => x.id === 'outline-server')).toEqual({ id: 'outline-server', firstValid: 49, lineages: 1018, blocking: 112 });
    expect(reg.leftCensorArtefact.find((x) => x.id === 'etherpad')?.firstValid).toBe(136);
  });
  it("under S1 the C5 'blocking, all' median moves from 1561 to > obs. (Q8)", () => {
    expect(reg.survivalC5[0]?.median).toBe(1561);
    expect(reg.sensitivity[4]?.S1.median).toBe('> obs.');
  });
});

describe('R2: the C5 descriptive counts', () => {
  it('pooled grid windows', () => {
    expect(reg.windows).toMatchObject(PUBLISHED_C5.windows);
  });
  it('pair level: introduced split three ways, removed by cause, net check', () => {
    const { removedBy, ...rest } = PUBLISHED_C5.pairs;
    expect(reg.pairs).toMatchObject(rest);
    expect(reg.pairs.removedBy).toEqual(removedBy);
  });
  it.each(PUBLISHED_C5.survival.map((p, i) => [p.group, i] as const))('KM §4: %s', (_g, i) => {
    // The note's Python KM takes S(365) just before the first event time > 365 (`t > 365`); the TS kaplanMeier keeps
    // the value at the last time <= 365. On these data the two agree on every row (no correction needed).
    expect(row(reg.survivalC5[i] as KmRow)).toEqual(pub(at(PUBLISHED_C5.survival, i)));
  });
  it('compareMined finds no published difference and no sensitivity difference', () => {
    expect(compareMined(reg)).toEqual({ published: [], sensitivity: [] });
  });
});

describe('stored tier against the live table and the Python set (DR-3a, reported only)', () => {
  it('reports the counts (does not gate R1 or R2)', () => {
    const t = reg.tierCheck;
    console.log(`DR-3a tier check: ${String(t.pairRecords)} pair records (stored vs live ${String(t.storedVsLive)}, vs Python ${String(t.storedVsPython)}); ${String(t.lineageRecords)} finding lineages (stored vs live ${String(t.lineageStoredVsLive)}); conflicts ${String(t.conflicts.length)}; live fallbacks ${t.liveFallbackRules.join(',') || 'none'}`);
    expect(t.pairRecords).toBe(6647);
  });
});
