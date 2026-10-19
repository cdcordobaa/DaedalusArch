/**
 * U7 (v1.4): MEAN-01 meaning analysis (C3m), design `aidlc-docs/construction/v1.4/U7/functional-design/design.md` §8.
 * Synthetic samples (`tests/fixtures/v1.3-meaning/`) and synthetic sheets only: no label, no Neo4j, no network.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { kishEffectiveN, wilson } from '../../../../scripts/lib/stats.js';
import { agreement, passesGate } from '../../../../scripts/v1.3/lib/meaning/agreement.js';
import { analyse } from '../../../../scripts/v1.3/lib/meaning/analyse.js';
import { itemBootstrap, stratifiedClusterBootstrap } from '../../../../scripts/v1.3/lib/meaning/bootstrap.js';
import { crossTab, reasonCounts } from '../../../../scripts/v1.3/lib/meaning/crosstab.js';
import {
  MeaningInputError, checkDistinct, loadSample, loadSheet, scriptHashPaths, singleClusterStrata,
} from '../../../../scripts/v1.3/lib/meaning/load.js';
import { precision, readingGuide, stratifiedShare } from '../../../../scripts/v1.3/lib/meaning/precision.js';
import {
  NON_PROTOCOL, PREVALENCE_NOTE, SINGLE_RATER_AUTHOR, SYNTHETIC_BANNER, displayPath, renderJson, renderMarkdown,
} from '../../../../scripts/v1.3/lib/meaning/report.js';
import { SimulateError, simulateSheets, type Table4 } from '../../../../scripts/v1.3/lib/meaning/simulate.js';
import type { AnalysisConfig, Field, Sample, Sheet } from '../../../../scripts/v1.3/lib/meaning/types.js';
import { isUnderResults, main } from '../../../../scripts/v1.3/meaning-analysis.js';

jest.setTimeout(120_000);

const REPO = path.resolve(__dirname, '../../../..');
const FIX = path.join(REPO, 'tests/fixtures/v1.3-meaning');
const REAL_SAMPLE = 'results/v1.3-meaning/mean-01-sample.csv';
const HEADER = 'itemId,rater,A_practitioner,B_style_fidelity,why_not,note';

const S60: Sample = loadSample(fs.readFileSync(path.join(FIX, 'sample-60.csv'), 'utf-8'), 'sample-60.csv');
const S10: Sample = loadSample(fs.readFileSync(path.join(FIX, 'sample-10.csv'), 'utf-8'), 'sample-10.csv', { frameN: 100, items: 10 });
const ids = (s: Sample): string[] => s.items.map((x) => x.itemId);
/** A defined number, or a thrown error (keeps the assertions free of type casts). */
function num(v: number | null | undefined): number {
  if (v === null || v === undefined) throw new Error('expected a defined number');
  return v;
}

const cfg = (primary: Field = 'A_practitioner', resamples = 500, seed = 20261018): AnalysisConfig =>
  ({ primary, seed, resamples, frameN: 784, minN: 54, gate: 0.6 });

function sim(tableA: Table4, extra: { tableB?: Table4; unsureRater?: number; blank?: number; seed?: number } = {}, sample = S60): { rater: Sheet; author: Sheet } {
  const s = simulateSheets(sample, { tableA, seed: extra.seed ?? 1, ...extra });
  return { rater: loadSheet(s.rater, 'rater', 'rater.csv', sample), author: loadSheet(s.author, 'author', 'author.csv', sample) };
}

type RowSpec = readonly [string, string, string?, string?];
/** Inline sheet: id -> [A, B, why_not, note]; ids not listed are left out (blank). */
function sheetText(rows: Record<string, RowSpec>, rater = 'r1'): string {
  return [HEADER, ...Object.entries(rows).map(([id, [A, B, code, note]]) => `${id},${rater},${A},${B},${code ?? ''},${note ?? ''}`)].join('\n') + '\n';
}
const allRows = (s: Sample, f: (id: string, i: number) => RowSpec): Record<string, RowSpec> =>
  Object.fromEntries(ids(s).map((id, i) => [id, f(id, i)]));

const run = (rater: Sheet | null, author: Sheet | null, config = cfg(), sample = S60) =>
  analyse({ sample, samplePath: 'tests/fixtures/v1.3-meaning/sample-60.csv', rater, author, config, scriptHashes: [] });

describe('real sample (BR-01 on the current draw)', () => {
  it('loads results/v1.3-meaning/mean-01-sample.csv with the codebook §6 figures (fails, never skips, when absent)', () => {
    const text = fs.readFileSync(path.join(REPO, REAL_SAMPLE), 'utf-8');
    const s = loadSample(text, REAL_SAMPLE, { expectSha256: 'd4697ec5377d6fdc' });
    expect(s.items).toHaveLength(60);
    expect(s.strata).toHaveLength(18);
    expect(s.frameN).toBe(784);
    expect(s.items.filter((x) => x.testOrMock)).toHaveLength(4);
    expect(s.items.filter((x) => x.cycleViaBarrel)).toHaveLength(4);
    expect(singleClusterStrata(s.items)).toEqual(['FF-DS01', 'FF-DT02']);
    expect(kishEffectiveN(s.items.map((x) => x.Nh / x.nh)).toFixed(2)).toBe('38.83');
    expect(s.items.filter((x) => x.ruleId === 'FF-S01')).toHaveLength(13);
    expect(s.items.filter((x) => x.ruleId === 'FF-S02')).toHaveLength(11);
  });
});

describe('agreement (BR-10 to BR-19)', () => {
  it('T1: 20/10/5/25 gives p_o 0.75, κ 0.50, FAIL', () => {
    const { rater, author } = sim([20, 10, 5, 25]);
    const b = agreement(S60, rater, author, 'A_practitioner', cfg());
    expect(b.table).toEqual({ a: 20, b: 10, c: 5, d: 25 });
    expect(b.observed).toBeCloseTo(0.75, 12);
    expect(b.kappa).toBeCloseTo(0.5, 12);
    expect(b.result).toBe('FAIL');
    expect(b.n).toBe(60);
  });

  it('T2: 24/6/6/24 gives κ 0.60 exactly and PASS (1e-9 tolerance)', () => {
    const { rater, author } = sim([24, 6, 6, 24]);
    const b = agreement(S60, rater, author, 'A_practitioner', cfg());
    expect(b.kappa).toBeCloseTo(0.6, 12);
    expect(b.result).toBe('PASS');
    expect(passesGate(0.6 - 1e-12, 0.6)).toBe(true);
    expect(passesGate(0.599, 0.6)).toBe(false);
    expect(passesGate(null, 0.6)).toBe(false);
  });

  it('T3: 30/0/0/30 gives κ 1, PASS, intervals [1, 1]', () => {
    const { rater, author } = sim([30, 0, 0, 30]);
    const b = agreement(S60, rater, author, 'A_practitioner', cfg());
    expect(b.kappa).toBe(1);
    expect(b.result).toBe('PASS');
    expect([b.kappaItemInterval?.low, b.kappaItemInterval?.high]).toEqual([1, 1]);
    expect([b.kappaClusterInterval?.low, b.kappaClusterInterval?.high]).toEqual([1, 1]);
  });

  it('T4: 0/3/3/54 (prevalence) gives κ −0.0526, AC1 0.8895, FAIL and the BR-17 line', () => {
    const { rater, author } = sim([0, 3, 3, 54]);
    const b = agreement(S60, rater, author, 'A_practitioner', cfg());
    expect(b.observed).toBeCloseTo(0.9, 12);
    expect(b.kappa).toBeCloseTo(-0.0526, 4);
    expect(b.ac1).toBeCloseTo(0.8895, 4);
    expect(b.prevalenceIndex).toBeCloseTo(0.9, 12);
    expect(b.biasIndex).toBe(0);
    expect(b.pabak).toBeCloseTo(0.8, 12);
    expect(b.result).toBe('FAIL');
    expect(b.prevalenceNote).toBe(true);
    expect(renderMarkdown(run(rater, author))).toContain(PREVALENCE_NOTE);
  });

  it('BR-17: no prevalence note when κ passes', () => {
    const { rater, author } = sim([30, 0, 0, 30], { tableB: [28, 1, 1, 30] });
    const b = agreement(S60, rater, author, 'A_practitioner', cfg());
    expect(b.result).toBe('PASS');
    expect(b.prevalenceNote).toBe(false);
    expect(renderMarkdown(run(rater, author))).not.toContain(PREVALENCE_NOTE);
  });

  it('T5: all not-yes on both sheets gives κ undefined, FAIL, no crash, interval undefined', () => {
    // B differs between the sheets so the two files are not identical (BR-06 would stop the run).
    const { rater, author } = sim([0, 0, 0, 60], { tableB: [28, 1, 1, 30] });
    const b = agreement(S60, rater, author, 'A_practitioner', cfg());
    expect(b.kappa).toBeNull();
    expect(b.result).toBe('FAIL');
    expect(b.kappaItemInterval?.low).toBeNull();
    expect(b.kappaItemInterval?.undefinedResamples).toBe(500);
    expect(b.prevalenceNote).toBe(true);
    const md = renderMarkdown(run(rater, author));
    expect(md).toContain('κ = undefined');
    expect(md).toContain(PREVALENCE_NOTE);
    expect(md).not.toMatch(/NaN|null/);
  });

  it('T6: rater unsure vs author no on 6 items agree in binary, disagree in 3×3; sensitivity κ on n = 54', () => {
    const r = allRows(S60, (_, i) => (i < 6 ? ['unsure', 'no'] : i < 33 ? ['yes', 'yes'] : ['no', 'no']));
    const a = allRows(S60, (_, i) => (i < 6 ? ['no', 'no'] : i < 33 ? ['yes', 'yes'] : ['no', 'no']));
    const rater = loadSheet(sheetText(r), 'rater', 'r.csv', S60);
    const author = loadSheet(sheetText(a, 'au'), 'author', 'a.csv', S60);
    const b = agreement(S60, rater, author, 'A_practitioner', cfg());
    expect(b.table).toEqual({ a: 27, b: 0, c: 0, d: 33 });
    expect(b.kappa).toBe(1);
    expect(b.table3[2]?.[1]).toBe(6);
    expect(b.kappa3).not.toBeNull();
    expect(num(b.kappa3)).toBeLessThan(1);
    expect(b.noUnsure).toEqual({ n: 54, kappa: 1 });
  });

  it('T7: 7 author blanks give n 53, INCOMPLETE, dropped ids listed', () => {
    const { rater, author } = sim([20, 10, 5, 18], { blank: 7 });
    const b = agreement(S60, rater, author, 'A_practitioner', cfg());
    expect(b.n).toBe(53);
    expect(b.dropped).toHaveLength(7);
    expect(b.result).toBe('INCOMPLETE');
    const a = run(rater, author);
    expect(a.status).toBe('INCOMPLETE');
    const md = renderMarkdown(a);
    expect(md).toContain('INCOMPLETE (below protocol)');
    for (const id of b.dropped) expect(md).toContain(id);
  });

  it('T8: unsure rate 10/60 is flagged and the gate is unchanged', () => {
    const plain = sim([20, 10, 5, 25]);
    const { rater, author } = sim([20, 10, 5, 25], { unsureRater: 10 });
    const b = agreement(S60, rater, author, 'A_practitioner', cfg());
    expect(b.unsure.rater).toEqual({ unsure: 10, answered: 60, rate: 10 / 60, flagged: true });
    expect(b.unsure.author.flagged).toBe(false);
    expect(b.kappa).toBeCloseTo(num(agreement(S60, plain.rater, plain.author, 'A_practitioner', cfg()).kappa), 12);
    expect(b.result).toBe('FAIL');
    expect(renderMarkdown(run(rater, author))).toContain('codebook problem');
  });

  it('T19: every item blank in the author primary field gives n 0, every figure undefined, INCOMPLETE, no throw', () => {
    const r = allRows(S60, (_, i) => (i % 2 === 0 ? ['yes', 'yes'] : ['no', 'no']));
    const a = allRows(S60, (_, i) => ['', i % 2 === 0 ? 'yes' : 'no']);
    const rater = loadSheet(sheetText(r), 'rater', 'r.csv', S60);
    const author = loadSheet(sheetText(a, 'au'), 'author', 'a.csv', S60);
    const b = agreement(S60, rater, author, 'A_practitioner', cfg());
    expect(b.n).toBe(0);
    expect(b.result).toBe('INCOMPLETE');
    for (const v of [b.kappa, b.observed, b.observedInterval, b.ac1, b.prevalenceIndex, b.biasIndex, b.pabak, b.kappa3, b.kappaItemInterval, b.kappaClusterInterval]) {
      expect(v).toBeNull();
    }
    const md = renderMarkdown(run(rater, author));
    expect(md).toContain('κ = undefined');
    expect(md).not.toMatch(/NaN/);
  });
});

describe('precision (BR-20 to BR-29)', () => {
  const s10Sheet = (rows: Record<string, RowSpec>): Sheet => loadSheet(sheetText(rows), 'rater', 'r.csv', S10);

  it('T9: two strata N (90, 10), yes (1/5, 5/5) give p̂ 0.28, unweighted 0.60', () => {
    const rater = s10Sheet(allRows(S10, (_, i) => (i === 0 || i >= 5 ? ['yes', 'yes'] : ['no', 'no'])));
    const p = precision(S10, { rater, author: null }, 'A_practitioner', cfg());
    expect(p.headline.estimate).toBeCloseTo(0.9 * 0.2 + 0.1 * 1.0, 12);
    expect(p.headline.frameUsed).toBe(100);
    expect(p.unweighted.share).toBeCloseTo(0.6, 12);
    expect(p.unweighted.wilson).toEqual(wilson(6, 10));
    expect(p.kishN).toBeCloseTo(kishEffectiveN([18, 18, 18, 18, 18, 2, 2, 2, 2, 2]), 12);
  });

  it('T10: a stratum with every item blank is left out, N\' shrinks, the stratum is named', () => {
    const rater = s10Sheet(allRows(S10, (_, i) => (i >= 5 ? ['', ''] : i === 0 ? ['yes', 'yes'] : ['no', 'no'])));
    const p = precision(S10, { rater, author: null }, 'A_practitioner', cfg());
    expect(p.headline.estimate).toBeCloseTo(0.2, 12);
    expect(p.headline.frameUsed).toBe(90);
    expect(p.headline.emptyStrata).toEqual(['S-B']);
    expect(p.blank).toHaveLength(5);
    expect(renderMarkdown(run(rater, null, cfg(), S10))).toContain('S-B');
  });

  it('BR-42: a resample whose drawn cells of a stratum hold no answered item renormalises and is counted', () => {
    // S-B: only M06 (proj-f01) answered; resamples that draw proj-f02 twice leave S-B empty.
    const rater = s10Sheet(allRows(S10, (id, i) => (i < 5 ? ['yes', 'yes'] : id === 'M06' ? ['no', 'no'] : ['', ''])));
    const p = precision(S10, { rater, author: null }, 'A_practitioner', cfg());
    expect(p.headline.interval.resamplesWithEmptyStratum).toBeGreaterThan(0);
    expect(p.headline.interval.undefinedResamples).toBe(0);
    expect(p.headline.interval.low).not.toBeNull();
  });

  it('BR-22: with nothing blank p̂ equals the Horvitz–Thompson ratio Σ w y / Σ w', () => {
    const { rater } = sim([20, 10, 5, 25]);
    const units = S60.items.map((item) => ({ item, success: rater.rows.get(item.itemId)?.A === 'yes' }));
    const w = (it: (typeof S60.items)[number]): number => it.Nh / it.nh;
    const ht = units.reduce((s, u) => s + (u.success ? w(u.item) : 0), 0) / units.reduce((s, u) => s + w(u.item), 0);
    expect(stratifiedShare(units).estimate).toBeCloseTo(ht, 12);
  });

  it('T11: per rule n = 13 gets Wilson (= wilson(k, 13)), n = 4 counts only', () => {
    const { rater, author } = sim([20, 10, 5, 25]);
    const p = precision(S60, { rater, author }, 'A_practitioner', cfg());
    const s01 = p.perRule.find((r) => r.ruleId === 'FF-S01');
    const s03 = p.perRule.find((r) => r.ruleId === 'FF-S03');
    expect(s01?.n).toBe(13);
    expect(s01?.wilson).toEqual(wilson(s01?.yes ?? -1, 13));
    expect(s03?.n).toBe(4);
    expect(s03?.share).toBeNull();
    expect(s03?.wilson).toBeNull();
    expect((s03?.yes ?? 0) + (s03?.no ?? 0) + (s03?.unsure ?? 0) + (s03?.blank ?? 0)).toBe(4);
  });

  it('BR-25: five sensitivities with two sheets; the testOrMock row drops the 2 flagged items', () => {
    const { rater, author } = sim([20, 10, 5, 25]);
    const p = precision(S60, { rater, author }, 'A_practitioner', cfg());
    expect(p.sensitivities.map((r) => r.label)).toEqual([
      "author's labels", 'yes by both raters', "rater's unsure dropped", 'testOrMock items dropped', 'items the rater coded M dropped',
    ]);
    expect(p.sensitivities[3]?.n).toBe(58);
    expect(p.reference).toBe('rater');
  });

  it('T12: reading-guide boundaries', () => {
    expect(readingGuide(0.75, 0.5)).toBe('meaningful');
    expect(readingGuide(0.1 + 0.2 + 0.45 - 1e-12, 0.5 - 1e-12)).toBe('meaningful');
    expect(readingGuide(0.5, 0.1)).toBe('rival');
    expect(readingGuide(0.5, 0.6)).toBe('rival');
    expect(readingGuide(0.76, 0.49)).toBe('mixed');
    expect(readingGuide(0.6, 0.4)).toBe('mixed');
    expect(readingGuide(null, null)).toBe('not-applicable');
    expect(readingGuide(0.8, null)).toBe('not-applicable');
  });
});

describe('cross-tables (BR-30, BR-31)', () => {
  it('T13: A×B off-diagonals and reason codes match the constructed sheet', () => {
    const rows = allRows(S60, () => ['yes', 'yes']);
    Object.assign(rows, {
      M01: ['no', 'yes', 'W'], M02: ['no', 'yes', 'F'], M03: ['yes', 'no', 'T'], M04: ['no', 'no', 'M'], M05: ['no', 'no', ''],
      M06: ['yes', 'yes', 'X'], M07: ['', ''],
    });
    const sheet = loadSheet(sheetText(rows), 'rater', 'r.csv', S60);
    expect(sheet.warnings.some((w) => w.includes('M06'))).toBe(true);
    const c = crossTab(S60, sheet);
    expect(c.bYesANo).toBe(2);
    expect(c.aYesBNo).toBe(1);
    expect(c.table[3]?.[3]).toBe(1);
    expect(c.table.flat().reduce((a, b) => a + b, 0)).toBe(60);
    const rc = reasonCounts(S60, sheet);
    expect(rc.items).toBe(5);
    expect(rc.pooled).toEqual({ T: 1, W: 1, F: 1, M: 1, C: 0, X: 0, blank: 1 });
    expect(rc.perRule.find((r) => r.ruleId === 'FF-S01')?.items).toBe(5);
  });
});

describe('validation (BR-01 to BR-06, BR-09)', () => {
  const fails = (fn: () => unknown, ...needles: string[]): void => {
    let err: unknown;
    try { fn(); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(MeaningInputError);
    for (const n of needles) expect((err as Error).message).toContain(n);
  };

  it('T14: bad value, unknown id, duplicate id, calibration id, bad code, same file twice', () => {
    fails(() => loadSheet(sheetText({ M01: ['Yes!', 'yes'] }), 'rater', 'r.csv', S60), 'M01', 'Yes!', 'r.csv');
    fails(() => loadSheet(sheetText({ M01: ['y', 'yes'] }), 'rater', 'r.csv', S60), 'M01');
    fails(() => loadSheet(sheetText({ M99: ['yes', 'yes'] }), 'rater', 'r.csv', S60), 'M99', 'not in the sample');
    fails(() => loadSheet(`${HEADER}\nM01,r,yes,yes,,\nM01,r,no,no,,\n`, 'rater', 'r.csv', S60), 'M01', 'twice');
    fails(() => loadSheet(sheetText({ C3: ['yes', 'yes'] }), 'rater', 'r.csv', S60), 'C3', 'calibration');
    fails(() => loadSheet(sheetText({ M02: ['no', 'no', 'Z'] }), 'rater', 'r.csv', S60), 'M02', 'why_not');
    const text = sheetText({ M01: ['yes', 'yes'] });
    const a = loadSheet(text, 'rater', 'r.csv', S60);
    const b = loadSheet(text, 'author', 'a.csv', S60);
    fails(() => { checkDistinct(a, b); }, 'same file passed twice');
    fails(() => run(a, b), 'same file passed twice');
  });

  it('accepts case and whitespace variants of the exact values (trim, lower-case answers, upper-case codes)', () => {
    const s = loadSheet(sheetText({ M01: [' YES ', 'No', 'w'], M02: ['Unsure', '', ''] }), 'rater', 'r.csv', S60);
    expect(s.rows.get('M01')).toMatchObject({ A: 'yes', B: 'no', whyNot: 'W' });
    expect(s.rows.get('M02')).toMatchObject({ A: 'unsure', B: null });
  });

  it('BR-01: strict True/False flags, constant N_h, Σ N_h, and the expected sha256', () => {
    const text = fs.readFileSync(path.join(FIX, 'sample-60.csv'), 'utf-8');
    fails(() => loadSample(text.replace(',False,False,"Synthetic finding 1,', ',false,False,"Synthetic finding 1,'), 's.csv'), 'cycleViaBarrel', 'True or False');
    fails(() => loadSample(text.replace('M01,v-synthetic-001,FF-S01/ddd,200,', 'M01,v-synthetic-001,FF-S01/ddd,201,'), 's.csv'), 'N_h is not constant');
    fails(() => loadSample(text, 's.csv', { frameN: 785 }), 'Σ N_h = 784');
    fails(() => loadSample(text, 's.csv', { expectSha256: '0000000000000000' }), 'does not match');
    // the rounded weight column is ignored: weights come from N_h / n_h
    const p = loadSample(text.replace(',200,7,28.6,', ',200,7,99.9,'), 's.csv');
    expect(p.items[0]?.Nh).toBe(200);
  });

  it('T20: a BOM header loads; a ;-separated sheet, a missing column and an unquoted comma throw with the line', () => {
    const ok = loadSheet(String.fromCharCode(0xfeff) + sheetText({ M01: ['yes', 'no', 'T'] }), 'rater', 'r.csv', S60);
    expect(ok.rows.get('M01')?.A).toBe('yes');
    fails(() => loadSheet('itemId;rater;A_practitioner;B_style_fidelity;why_not;note\nM01;r;yes;yes;;\n', 'rater', 'r.csv', S60), 'line 1', 'one-column header', "';'");
    fails(() => loadSheet('itemId,rater,A_practitioner,B_style_fidelity,why_not\nM01,r,yes,yes,\n', 'rater', 'r.csv', S60), 'line 1', 'header');
    fails(() => loadSheet(`${HEADER}\nM01,r,yes,yes,,fine\nM02,r,no,no,M,mapped wrong, I think\n`, 'rater', 'r.csv', S60), 'line 3', '7 cells');
    fails(() => loadSheet(`${HEADER}\nM01,r,yes,yes\n`, 'rater', 'r.csv', S60), 'line 2', '4 cells');
    // a quoted comma and a quoted newline are fine
    const q = loadSheet(`${HEADER}\r\nM01,r,yes,yes,,"a, b\nc"\r\nM02,r,no,no,C,\r\n`, 'rater', 'r.csv', S60);
    expect(q.rows.get('M01')?.note).toBe('a, b\nc');
    expect(q.rows.get('M02')?.whyNot).toBe('C');
  });

  it('T20: the line number after a quoted newline is the physical line', () => {
    let err: unknown;
    try { loadSheet(`${HEADER}\nM01,r,yes,yes,,"a, b\nc"\nM02,r,no\n`, 'rater', 'r.csv', S60); } catch (e) { err = e; }
    expect((err as Error).message).toContain('line 4');
  });
});

describe('bootstrap (BR-40 to BR-43)', () => {
  it('item and cluster bootstrap on empty input return an undefined interval and never call quantileSorted([])', () => {
    const stat = (): { value: number } => ({ value: 1 });
    const a = itemBootstrap([], stat, { seed: 1, resamples: 10 });
    const b = stratifiedClusterBootstrap<{ stratum: string; project: string; itemId: string }>([], (x) => x, stat, { seed: 1, resamples: 10 });
    expect([a.low, a.high, a.undefinedResamples]).toEqual([null, null, 10]);
    expect([b.low, b.high, b.undefinedResamples]).toEqual([null, null, 10]);
  });

  it('one fresh RNG per call: the same call twice gives the same interval', () => {
    const { rater, author } = sim([20, 10, 5, 25]);
    const x = agreement(S60, rater, author, 'A_practitioner', cfg());
    const y = agreement(S60, rater, author, 'A_practitioner', cfg());
    expect(x.kappaItemInterval).toEqual(y.kappaItemInterval);
    expect(x.kappaItemInterval?.low).not.toEqual(x.kappaClusterInterval?.low);
  });

  it('T15: intervals contain the point estimate and lie in [−1, 1] and [0, 1]', () => {
    const { rater, author } = sim([20, 10, 5, 25]);
    const a = run(rater, author);
    const ag = a.agreement?.primary;
    for (const i of [ag?.kappaItemInterval, ag?.kappaClusterInterval]) {
      expect(num(i?.low)).toBeLessThanOrEqual(num(ag?.kappa));
      expect(num(i?.high)).toBeGreaterThanOrEqual(num(ag?.kappa));
      expect(num(i?.low)).toBeGreaterThanOrEqual(-1);
      expect(num(i?.high)).toBeLessThanOrEqual(1);
    }
    const h = a.precision.primary.headline;
    expect(num(h.interval.low)).toBeLessThanOrEqual(num(h.estimate));
    expect(num(h.interval.high)).toBeGreaterThanOrEqual(num(h.estimate));
    expect(num(h.interval.low)).toBeGreaterThanOrEqual(0);
    expect(num(h.interval.high)).toBeLessThanOrEqual(1);
  });

  it('T15: two runs at 10,000 resamples give byte-identical JSON and Markdown', () => {
    const { rater, author } = sim([20, 10, 5, 25], { tableB: [24, 6, 6, 24] });
    const a = run(rater, author, cfg('A_practitioner', 10_000));
    const b = run(rater, author, cfg('A_practitioner', 10_000));
    expect(renderJson(a)).toBe(renderJson(b));
    expect(renderMarkdown(a)).toBe(renderMarkdown(b));
    expect(a.protocol).toBe(true);
    expect(renderJson(a)).not.toMatch(/NaN/);
  });
});

describe('report (BR-50 to BR-54) and modes', () => {
  it('T16: simulated sheets give the SYNTHETIC banner; a note never appears in the output', () => {
    const s = simulateSheets(S60, { tableA: [20, 10, 5, 25], seed: 3 });
    const withNote = s.rater.replace(/^M01,simulated,(\w*),(\w*),,$/m, 'M01,simulated,$1,$2,,Secret remark about a named person');
    const rater = loadSheet(withNote, 'rater', 'r.csv', S60);
    const author = loadSheet(s.author, 'author', 'a.csv', S60);
    expect(rater.rows.get('M01')?.note).toBe('Secret remark about a named person');
    const a = run(rater, author);
    expect(a.synthetic).toBe(true);
    const md = renderMarkdown(a);
    expect(md.split('\n')[0]).toBe(SYNTHETIC_BANNER);
    expect(md).not.toContain('Secret remark');
    expect(renderJson(a)).not.toContain('Secret remark');
    expect(a.notes.rater).toBe(1);
  });

  it('T17: single-rater mode (author only): no κ block, labelled, reading guide prefixed', () => {
    const { author } = sim([20, 10, 5, 25]);
    const a = run(null, author);
    expect(a.agreement).toBeNull();
    expect(a.status).toBe('single-rater');
    expect(a.precision.primary.reference).toBe('author');
    expect(a.precision.primary.readingText.startsWith('descriptive only: ')).toBe(true);
    expect(a.precision.primary.notApplicable).toEqual(["author's labels", 'yes by both raters']);
    const md = renderMarkdown(a);
    expect(md).toContain(SINGLE_RATER_AUTHOR);
    expect(md).not.toContain("Cohen's κ");
  });

  it('BR-08: rater only states that agreement was not computed', () => {
    const { rater } = sim([20, 10, 5, 25]);
    const md = renderMarkdown(run(rater, null));
    expect(md).toContain('agreement not computed');
  });

  it('T18: the secondary field gets the same block, not gated; swapping --primary swaps the gate', () => {
    const { rater, author } = sim([20, 10, 5, 25], { tableB: [24, 6, 6, 24] });
    const a = run(rater, author, cfg('A_practitioner'));
    expect(a.status).toBe('FAIL');
    expect(a.agreement?.primary.field).toBe('A_practitioner');
    expect(a.agreement?.secondary).toMatchObject({ field: 'B_style_fidelity', gated: false, result: 'PASS' });
    expect(a.agreement?.secondary.kappa).toBeCloseTo(0.6, 12);
    expect(a.precision.secondary.field).toBe('B_style_fidelity');
    const md = renderMarkdown(a);
    expect(md).toContain('## 2. Agreement, secondary field (not gated)');
    expect(md).toContain('## 4. Secondary field (not the headline)');
    const b = run(rater, author, cfg('B_style_fidelity'));
    expect(b.status).toBe('PASS');
    expect(b.agreement?.secondary).toMatchObject({ field: 'A_practitioner', gated: false, result: 'FAIL' });
  });

  it('BR-50: sections appear in the fixed order', () => {
    const { rater, author } = sim([20, 10, 5, 25]);
    const md = renderMarkdown(run(rater, author));
    const order = ['**Status:**', '## 1.', '## 2.', '## 3.', '## 4.', '## 5.', '## 6.', '## 7.'].map((h) => md.indexOf(h));
    expect(order.every((x) => x >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it('BR-53: display paths are repo-relative or <outside repo>/<basename>', () => {
    expect(displayPath('/x/repo/results/a.csv', '/x/repo')).toBe('results/a.csv');
    expect(displayPath('/elsewhere/tmp/answers-rater.csv', '/x/repo')).toBe('<outside repo>/answers-rater.csv');
  });

  it('BR-60: table sums are checked against the item count minus blanks', () => {
    expect(() => simulateSheets(S60, { tableA: [20, 10, 5, 24], seed: 1 })).toThrow(SimulateError);
    expect(() => simulateSheets(S60, { tableA: [20, 10, 5, 25], blank: 1, seed: 1 })).toThrow(SimulateError);
    const s = simulateSheets(S60, { tableA: [20, 10, 5, 25], tableB: [24, 6, 6, 24], seed: 1 });
    const rater = loadSheet(s.rater, 'rater', 'r.csv', S60);
    const c = crossTab(S60, rater);
    expect(c.bYesANo + c.aYesBNo).toBeGreaterThan(0);
  });
});

describe('CLI guards (BR-07, BR-43, BR-54, BR-60)', () => {
  const capture = (): { io: { stdout: (s: string) => void; stderr: (s: string) => void }; out: () => string; err: () => string } => {
    let o = '';
    let e = '';
    return { io: { stdout: (s) => { o += s; }, stderr: (s) => { e += s; } }, out: () => o, err: () => e };
  };
  let scratch: string;
  beforeAll(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u7-meaning-'));
    const real = loadSample(fs.readFileSync(path.join(REPO, REAL_SAMPLE), 'utf-8'), REAL_SAMPLE);
    const r = allRows(real, (_, i) => (i % 3 === 0 ? ['no', 'yes', 'M'] : ['yes', 'yes']));
    const a = allRows(real, (_, i) => (i % 4 === 0 ? ['no', 'no'] : ['yes', 'yes']));
    fs.writeFileSync(path.join(scratch, 'answers-rater.csv'), sheetText(r, 'test-rater'));
    fs.writeFileSync(path.join(scratch, 'answers-author.csv'), sheetText(a, 'test-author'));
  });
  afterAll(() => { fs.rmSync(scratch, { recursive: true, force: true }); });

  it('T21: simulate --out under results/ exits 2 and writes nothing', () => {
    const c = capture();
    const target = 'results/v1.3-meaning/labels-u7-test';
    expect(main(['simulate', '--sample', REAL_SAMPLE, '--table-a', '20,10,5,25', '--seed', '1', '--out', target], REPO, c.io)).toBe(2);
    expect(fs.existsSync(path.join(REPO, target))).toBe(false);
    expect(c.err()).toContain('refused');
  });

  it('T21: simulate --out Results/... (another case) exits 2 and writes nothing', () => {
    const c = capture();
    const target = 'Results/v1.3-meaning/labels-u7-case-test';
    expect(main(['simulate', '--sample', REAL_SAMPLE, '--table-a', '20,10,5,25', '--seed', '1', '--out', target], REPO, c.io)).toBe(2);
    expect(fs.existsSync(path.join(REPO, 'results/v1.3-meaning/labels-u7-case-test'))).toBe(false);
    expect(c.err()).toContain('refused');
  });

  it('T21: the results guard folds case and follows a symlinked route to the root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'u7-guard-'));
    try {
      fs.mkdirSync(path.join(root, 'repo', 'results'), { recursive: true });
      const repo = path.join(root, 'repo');
      fs.symlinkSync(repo, path.join(root, 'link'));
      expect(isUnderResults(path.join(repo, 'RESULTS', 'x'), repo)).toBe(true);
      expect(isUnderResults(path.join(root, 'link', 'results', 'new', 'deeper'), repo)).toBe(true);
      expect(isUnderResults(path.join(repo, 'results'), path.join(root, 'link'))).toBe(true);
      expect(isUnderResults(path.join(repo, 'resultsX'), repo)).toBe(false);
      expect(isUnderResults(path.join(root, 'elsewhere'), repo)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('T21: a SYNTHETIC analyse --out under results/ exits 2', () => {
    const c = capture();
    expect(main(['simulate', '--sample', REAL_SAMPLE, '--table-a', '20,10,5,25', '--seed', '1', '--out', path.join(scratch, 'sim')], REPO, c.io)).toBe(0);
    const d = capture();
    const target = 'results/v1.3-meaning/analysis-u7-test';
    expect(main(['analyse', '--sample', REAL_SAMPLE, '--rater', path.join(scratch, 'sim/answers-rater.csv'), '--author', path.join(scratch, 'sim/answers-author.csv'),
      '--primary', 'A_practitioner', '--resamples', '100', '--out', target], REPO, d.io)).toBe(2);
    expect(fs.existsSync(path.join(REPO, target))).toBe(false);
  });

  it('T21: seed 7 on non-simulated sheets prints NON-PROTOCOL; scratch paths print as <outside repo>/<basename>', () => {
    const c = capture();
    expect(main(['analyse', '--sample', REAL_SAMPLE, '--rater', path.join(scratch, 'answers-rater.csv'), '--author', path.join(scratch, 'answers-author.csv'),
      '--primary', 'A_practitioner', '--seed', '7', '--resamples', '100'], REPO, c.io)).toBe(0);
    const md = c.out();
    expect(md).toContain(NON_PROTOCOL);
    expect(md).not.toContain(SYNTHETIC_BANNER);
    expect(md).toContain('<outside repo>/answers-rater.csv');
    expect(md).toContain(`| sample | ${REAL_SAMPLE} |`);
    expect(md).not.toMatch(/\/Users\/|\/Volumes\/|\/private\/|\/tmp\//);
  });

  it('T21: --out writes analysis.json (protocol false) and analysis.md outside the repo', () => {
    const c = capture();
    const out = path.join(scratch, 'out');
    expect(main(['analyse', '--sample', REAL_SAMPLE, '--rater', path.join(scratch, 'answers-rater.csv'), '--author', path.join(scratch, 'answers-author.csv'),
      '--primary', 'B_style_fidelity', '--seed', '7', '--resamples', '100', '--out', out], REPO, c.io)).toBe(0);
    const json = JSON.parse(fs.readFileSync(path.join(out, 'analysis.json'), 'utf-8')) as { protocol: boolean; synthetic: boolean };
    expect(json.protocol).toBe(false);
    expect(json.synthetic).toBe(false);
    expect(fs.readFileSync(path.join(out, 'analysis.md'), 'utf-8')).toContain(NON_PROTOCOL);
  });

  it('T21: a wrong --expect-sample-sha256 exits 2; the recorded prefix is accepted', () => {
    const base = ['analyse', '--sample', REAL_SAMPLE, '--rater', path.join(scratch, 'answers-rater.csv'), '--primary', 'A_practitioner', '--resamples', '50'];
    const c = capture();
    expect(main([...base, '--expect-sample-sha256', 'ffffffffffffffff'], REPO, c.io)).toBe(2);
    expect(c.err()).toContain('does not match');
    expect(main([...base, '--expect-sample-sha256', 'd4697ec5377d6fdc'], REPO, capture().io)).toBe(0);
  });

  it('--primary is required and must be one of the two fields; the same file twice exits 2', () => {
    const r = path.join(scratch, 'answers-rater.csv');
    expect(main(['analyse', '--sample', REAL_SAMPLE, '--rater', r], REPO, capture().io)).toBe(2);
    expect(main(['analyse', '--sample', REAL_SAMPLE, '--rater', r, '--primary', 'A'], REPO, capture().io)).toBe(2);
    expect(main(['analyse', '--sample', REAL_SAMPLE, '--rater', r, '--author', r, '--primary', 'A_practitioner', '--resamples', '10'], REPO, capture().io)).toBe(2);
  });

  it('T22: the hash list names stats.ts and audit.ts beside the meaning files', () => {
    const paths = scriptHashPaths(fs.readdirSync(path.join(REPO, 'scripts/v1.3/lib/meaning')));
    expect(paths).toEqual(expect.arrayContaining([
      'scripts/lib/stats.ts', 'scripts/v1.3/lib/labelling/audit.ts', 'scripts/v1.3/meaning-analysis.ts',
      'scripts/v1.3/lib/meaning/load.ts', 'scripts/v1.3/lib/meaning/agreement.ts', 'scripts/v1.3/lib/meaning/precision.ts',
    ]));
    const c = capture();
    main(['analyse', '--sample', REAL_SAMPLE, '--rater', path.join(scratch, 'answers-rater.csv'), '--primary', 'A_practitioner', '--resamples', '20'], REPO, c.io);
    expect(c.out()).toContain('| script | scripts/lib/stats.ts |');
    expect(c.out()).toContain('| script | scripts/v1.3/lib/labelling/audit.ts |');
  });
});
