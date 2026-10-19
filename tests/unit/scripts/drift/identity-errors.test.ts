/**
 * T-HC, the C1e part test of `ops/04-north-star.md` ("histories with renames and deletions; truth: the fix-mining
 * taxonomy, checked by hand; metric: identity errors"), in two halves (U4 design §5):
 * (a) planted synthetic histories (renames, deletions, bot and mass commits, re-pointed edges, cycle rotations, splits,
 *     merges, an out-of-root rename, a failed snapshot), each expected outcome written in this file before the code ran:
 *     identity errors must be 0 under LEGACY_FIXES_MINED and G08_PROPOSED;
 * (b) `handcheckSample` on the committed pairs: seeded (20261018), stratified by cause, every row with repo, commit
 *     link, rule, files and assigned cause. The author's labels of that packet give the real-history identity-error
 *     rate (Q9); the module does not invent the labels.
 * An identity error is one expected lineage the builder did not produce, or one it produced that was not expected.
 */
import * as path from 'node:path';
import { handcheckCsv, handcheckSample, type HandcheckRepo } from '../../../../scripts/lib/drift/handcheck.js';
import { buildLineages } from '../../../../scripts/lib/drift/lineage.js';
import { forEachMinedRepo } from '../../../../scripts/lib/drift/metrics.js';
import { G08_PROPOSED, LEGACY_FIXES_MINED, STUDY2_S2D01, type IdentityOptions, type IdFinding, type Lineage, type Snapshot, type Transition } from '../../../../scripts/lib/drift/types.js';
import { K, cyc, dep, fileLevel, snap } from './fixtures.js';

/** [key, born, ended, cause, finalKey, derivedFrom] with '' for absent. */
type Row = readonly [string, number, number | null, string?, string?, string[]?];
interface Planted {
  readonly name: string;
  readonly snaps: readonly Snapshot[];
  readonly tr?: readonly (Transition | undefined)[];
  readonly legacy: readonly Row[];
  readonly g08: readonly Row[];
}
const rowOf = (l: Lineage): string => JSON.stringify([l.key, l.born, l.ended, l.cause ?? '', l.finalKey ?? '', [...(l.derivedFrom ?? [])].sort()]);
const rowStr = (r: Row): string => JSON.stringify([r[0], r[1], r[2], r[3] ?? '', r[4] ?? '', [...(r[5] ?? [])].sort()]);
const R = (m: Record<string, string>, extra: Partial<Transition> = {}): Transition => ({ rename: new Map(Object.entries(m)), ...extra });
const one = (m: Record<string, string>, extra: Partial<Transition> = {}): (Transition | undefined)[] => [undefined, R(m, extra)];

const A = 'src/a.ts', A1 = 'src/a1.ts', A2 = 'src/a2.ts', B = 'src/b.ts', T = 'src/t.ts', T1 = 'src/t1.ts', T2 = 'src/t2.ts', U = 'src/u.ts', N = 'src/n.ts';
const AT = dep(A, T), A1T = dep(A1, T), A2T = dep(A2, T), BT = dep(B, T), AT2 = dep(A, T2);
const cA = 'a.ts', cB = 'b.ts', cC = 'c.ts', cD = 'd.ts';
const dt = (s: string): IdFinding => ({ functionId: 'FF-DT01', filePath: s, target: T, discriminator: ['UserService'], tier: 'blocking' });

const PLANTED: readonly Planted[] = [
  { name: 'unchanged edge', snaps: [snap('0', [AT]), snap('1', [AT])], legacy: [[K(AT), 0, null]], g08: [[K(AT), 0, null]] },
  { name: 'edge removed, files stay', snaps: [snap('0', [AT]), snap('1', [], { extraFiles: [A, T] })], legacy: [[K(AT), 0, 1, 'FIXED-BY-DEV']], g08: [[K(AT), 0, 1, 'FIXED-BY-DEV']] },
  { name: 'source deleted', snaps: [snap('0', [AT]), snap('1', [], { extraFiles: [T] })], legacy: [[K(AT), 0, 1, 'FILE-DELETED']], g08: [[K(AT), 0, 1, 'FILE-DELETED']] },
  { name: 'target deleted', snaps: [snap('0', [AT]), snap('1', [], { extraFiles: [A] })], legacy: [[K(AT), 0, 1, 'FILE-DELETED']], g08: [[K(AT), 0, 1, 'FILE-DELETED']] },
  { name: 'source renamed, finding follows', snaps: [snap('0', [AT]), snap('1', [A1T])], tr: one({ [A]: A1 }), legacy: [[K(AT), 0, 1, 'RENAMED'], [K(A1T), 1, null]], g08: [[K(AT), 0, null, '', K(A1T)]] },
  { name: 'target renamed, finding follows', snaps: [snap('0', [AT]), snap('1', [dep(A, T1)])], tr: one({ [T]: T1 }), legacy: [[K(AT), 0, 1, 'RENAMED'], [K(dep(A, T1)), 1, null]], g08: [[K(AT), 0, null, '', K(dep(A, T1))]] },
  { name: 'both ends renamed', snaps: [snap('0', [AT]), snap('1', [dep(A1, T1)])], tr: one({ [A]: A1, [T]: T1 }), legacy: [[K(AT), 0, 1, 'RENAMED'], [K(dep(A1, T1)), 1, null]], g08: [[K(AT), 0, null, '', K(dep(A1, T1))]] },
  { name: 'renamed and fixed in one commit', snaps: [snap('0', [AT]), snap('1', [], { extraFiles: [A1, T] })], tr: one({ [A]: A1 }), legacy: [[K(AT), 0, 1, 'RENAMED']], g08: [[K(AT), 0, 1, 'FIXED-BY-DEV']] },
  { name: 'renamed source, target deleted', snaps: [snap('0', [AT]), snap('1', [], { extraFiles: [A1] })], tr: one({ [A]: A1 }), legacy: [[K(AT), 0, 1, 'RENAMED']], g08: [[K(AT), 0, 1, 'FILE-DELETED']] },
  { name: 'bot or mass commit removes the edge', snaps: [snap('0', [AT]), snap('1', [], { extraFiles: [A, T] })], tr: [undefined, { massOrBot: true }], legacy: [[K(AT), 0, 1, 'MASS-OR-BOT']], g08: [[K(AT), 0, 1, 'MASS-OR-BOT']] },
  { name: 'mass rename keeps identity under G08', snaps: [snap('0', [AT]), snap('1', [A1T])], tr: one({ [A]: A1 }, { massOrBot: true }), legacy: [[K(AT), 0, 1, 'RENAMED'], [K(A1T), 1, null]], g08: [[K(AT), 0, null, '', K(A1T)]] },
  { name: 'finding gone, edge still there', snaps: [snap('0', [AT]), snap('1', [], { extraFiles: [A, T], extraEdges: [`${A}|${T}`] })], legacy: [[K(AT), 0, 1, 'OTHER']], g08: [[K(AT), 0, 1, 'OTHER']] },
  { name: 'file-level finding resolved in place', snaps: [snap('0', [fileLevel(A)]), snap('1', [], { extraFiles: [A] })], legacy: [[K(fileLevel(A)), 0, 1, 'RESOLVED-IN-PLACE']], g08: [[K(fileLevel(A)), 0, 1, 'RESOLVED-IN-PLACE']] },
  { name: 'file-level finding, file deleted', snaps: [snap('0', [fileLevel(A)]), snap('1', [], { extraFiles: [B] })], legacy: [[K(fileLevel(A)), 0, 1, 'FILE-DELETED']], g08: [[K(fileLevel(A)), 0, 1, 'FILE-DELETED']] },
  { name: 'file-level finding, file renamed', snaps: [snap('0', [fileLevel(A)]), snap('1', [fileLevel(A1)])], tr: one({ [A]: A1 }), legacy: [[K(fileLevel(A)), 0, 1, 'RENAMED'], [K(fileLevel(A1)), 1, null]], g08: [[K(fileLevel(A)), 0, null, '', K(fileLevel(A1))]] },
  { name: 'cycle reported from another start node', snaps: [snap('0', [cyc(cB, cC, cA, cB)]), snap('1', [cyc(cA, cB, cC, cA)])], legacy: [[K(cyc(cA, cB, cC, cA)), 0, null]], g08: [[K(cyc(cA, cB, cC, cA)), 0, null]] },
  { name: 'cycle member renamed', snaps: [snap('0', [cyc(cA, cB, cC, cA)]), snap('1', [cyc(cA, cB, 'z.ts', cA)])], tr: one({ [cC]: 'z.ts' }), legacy: [[K(cyc(cA, cB, cC, cA)), 0, 1, 'RENAMED'], [K(cyc(cA, cB, 'z.ts', cA)), 1, null]], g08: [[K(cyc(cA, cB, cC, cA)), 0, null, '', K(cyc(cA, cB, 'z.ts', cA))]] },
  { name: 'cycle rename moves the smallest node', snaps: [snap('0', [cyc(cA, cB, cC, cA)]), snap('1', [cyc(cA, cB, '0.ts', cA)])], tr: one({ [cC]: '0.ts' }), legacy: [[K(cyc(cA, cB, cC, cA)), 0, 1, 'RENAMED'], [K(cyc('0.ts', cA, cB, '0.ts')), 1, null]], g08: [[K(cyc(cA, cB, cC, cA)), 0, null, '', K(cyc('0.ts', cA, cB, '0.ts'))]] },
  { name: 'cycle broken by removing an edge', snaps: [snap('0', [cyc(cA, cB, cA)]), snap('1', [], { extraFiles: [cA, cB], extraEdges: [`${cA}|${cB}`] })], legacy: [[K(cyc(cA, cB, cA)), 0, 1, 'FIXED-BY-DEV']], g08: [[K(cyc(cA, cB, cA)), 0, 1, 'FIXED-BY-DEV']] },
  { name: 'cycle gone with every edge in place', snaps: [snap('0', [cyc(cA, cB, cA)]), snap('1', [], { extraFiles: [cA, cB], extraEdges: [`${cA}|${cB}`, `${cB}|${cA}`] })], legacy: [[K(cyc(cA, cB, cA)), 0, 1, 'OTHER']], g08: [[K(cyc(cA, cB, cA)), 0, 1, 'OTHER']] },
  {
    name: 'S4 cycle split', snaps: [snap('0', [cyc(cA, cB, cC, cD, cA)]), snap('1', [cyc(cA, cB, cA), cyc(cC, cD, cC)])],
    legacy: [[K(cyc(cA, cB, cC, cD, cA)), 0, 1, 'FIXED-BY-DEV'], [K(cyc(cA, cB, cA)), 1, null, '', '', [K(cyc(cA, cB, cC, cD, cA))]], [K(cyc(cC, cD, cC)), 1, null, '', '', [K(cyc(cA, cB, cC, cD, cA))]]],
    g08: [[K(cyc(cA, cB, cC, cD, cA)), 0, 1, 'FIXED-BY-DEV'], [K(cyc(cA, cB, cA)), 1, null, '', '', [K(cyc(cA, cB, cC, cD, cA))]], [K(cyc(cC, cD, cC)), 1, null, '', '', [K(cyc(cA, cB, cC, cD, cA))]]],
  },
  {
    name: 'M3 cycles merged', snaps: [snap('0', [cyc(cA, cB, cA), cyc(cB, cC, cB)]), snap('1', [cyc(cA, cB, cC, cA)])],
    legacy: [[K(cyc(cA, cB, cA)), 0, 1, 'FIXED-BY-DEV'], [K(cyc(cB, cC, cB)), 0, 1, 'FIXED-BY-DEV'], [K(cyc(cA, cB, cC, cA)), 1, null, '', '', [K(cyc(cA, cB, cA)), K(cyc(cB, cC, cB))]]],
    g08: [[K(cyc(cA, cB, cA)), 0, 1, 'FIXED-BY-DEV'], [K(cyc(cB, cC, cB)), 0, 1, 'FIXED-BY-DEV'], [K(cyc(cA, cB, cC, cA)), 1, null, '', '', [K(cyc(cA, cB, cA)), K(cyc(cB, cC, cB))]]],
  },
  { name: 'S3 re-pointed edge', snaps: [snap('0', [AT]), snap('1', [AT2], { extraFiles: [T] })], legacy: [[K(AT), 0, 1, 'FIXED-BY-DEV'], [K(AT2), 1, null]], g08: [[K(AT), 0, 1, 'RE-POINTED'], [K(AT2), 1, null, '', '', [K(AT)]]] },
  { name: 'S3 in a mass commit stays MASS-OR-BOT', snaps: [snap('0', [AT]), snap('1', [AT2], { extraFiles: [T] })], tr: [undefined, { massOrBot: true }], legacy: [[K(AT), 0, 1, 'MASS-OR-BOT'], [K(AT2), 1, null]], g08: [[K(AT), 0, 1, 'MASS-OR-BOT'], [K(AT2), 1, null]] },
  { name: 'M1 merge, tie in birth', snaps: [snap('0', [AT, BT]), snap('1', [AT])], tr: one({ [B]: A }), legacy: [[K(AT), 0, null], [K(BT), 0, 1, 'RENAMED']], g08: [[K(AT), 0, null], [K(BT), 0, 1, 'MERGED']] },
  {
    name: 'M1 merge, earliest birth wins', snaps: [snap('0', [BT]), snap('1', [AT, BT]), snap('2', [AT])], tr: [undefined, undefined, R({ [B]: A })],
    legacy: [[K(BT), 0, 2, 'RENAMED'], [K(AT), 1, null]], g08: [[K(BT), 0, null, '', K(AT)], [K(AT), 1, 2, 'MERGED']],
  },
  { name: 'M2 merge without a rename row', snaps: [snap('0', [AT, BT]), snap('1', [AT])], legacy: [[K(AT), 0, null], [K(BT), 0, 1, 'FILE-DELETED']], g08: [[K(AT), 0, null], [K(BT), 0, 1, 'FILE-DELETED']] },
  { name: 'S1 source file split', snaps: [snap('0', [AT]), snap('1', [AT, A2T])], legacy: [[K(AT), 0, null], [K(A2T), 1, null]], g08: [[K(AT), 0, null], [K(A2T), 1, null]] },
  { name: 'S2 source renamed and split', snaps: [snap('0', [AT]), snap('1', [A1T, A2T])], tr: one({ [A]: A1 }), legacy: [[K(AT), 0, 1, 'RENAMED'], [K(A1T), 1, null], [K(A2T), 1, null]], g08: [[K(AT), 0, null, '', K(A1T)], [K(A2T), 1, null]] },
  { name: 'rename out of the analysis root', snaps: [snap('0', [AT]), snap('1', [], { extraFiles: [T] })], tr: [undefined, { outOfRoot: new Set([A]) }], legacy: [[K(AT), 0, 1, 'RENAMED']], g08: [[K(AT), 0, 1, 'RENAMED']] },
  { name: 'rename into the root is an addition', snaps: [snap('0', [AT]), snap('1', [AT, dep(N, T)])], tr: one({}), legacy: [[K(AT), 0, null], [K(dep(N, T)), 1, null]], g08: [[K(AT), 0, null], [K(dep(N, T)), 1, null]] },
  {
    name: 'failed snapshot, rename across the gap', snaps: [snap('0', [AT]), snap('1', [], { ok: false }), snap('2', [A1T])], tr: [undefined, undefined, R({ [A]: A1 })],
    legacy: [[K(AT), 0, 2, 'RENAMED'], [K(A1T), 2, null]], g08: [[K(AT), 0, null, '', K(A1T)]],
  },
  { name: 'failed snapshot, then fixed', snaps: [snap('0', [AT]), snap('1', [], { ok: false }), snap('2', [], { extraFiles: [A, T] })], legacy: [[K(AT), 0, 2, 'FIXED-BY-DEV']], g08: [[K(AT), 0, 2, 'FIXED-BY-DEV']] },
  { name: 'a copy is not a rename', snaps: [snap('0', [AT]), snap('1', [AT, dep('src/a-copy.ts', T)])], tr: one({}), legacy: [[K(AT), 0, null], [K(dep('src/a-copy.ts', T)), 1, null]], g08: [[K(AT), 0, null], [K(dep('src/a-copy.ts', T)), 1, null]] },
  {
    name: 'two files swap names', snaps: [snap('0', [AT, dep(B, U)]), snap('1', [BT, dep(A, U)])], tr: one({ [A]: B, [B]: A }),
    legacy: [[K(AT), 0, 1, 'RENAMED'], [K(dep(B, U)), 0, 1, 'RENAMED'], [K(BT), 1, null], [K(dep(A, U)), 1, null]],
    g08: [[K(AT), 0, null, '', K(BT)], [K(dep(B, U)), 0, null, '', K(dep(A, U))]],
  },
  {
    name: 'two rules on one edge, one goes', snaps: [snap('0', [dep(A, T, 'FF-S01'), dep(A, T, 'FF-S03')]), snap('1', [dep(A, T, 'FF-S03')])],
    legacy: [[K(dep(A, T, 'FF-S01')), 0, 1, 'OTHER'], [K(dep(A, T, 'FF-S03')), 0, null]], g08: [[K(dep(A, T, 'FF-S01')), 0, 1, 'OTHER'], [K(dep(A, T, 'FF-S03')), 0, null]],
  },
  { name: 'a class-name discriminator survives a rename', snaps: [snap('0', [dt(A)]), snap('1', [dt(A1)])], tr: one({ [A]: A1 }), legacy: [[K(dt(A)), 0, 1, 'RENAMED'], [K(dt(A1)), 1, null]], g08: [[K(dt(A)), 0, null, '', K(dt(A1))]] },
  { name: 'a path containing #', snaps: [snap('0', [dep('src/#a.ts', T)]), snap('1', [dep('src/#b.ts', T)])], tr: one({ 'src/#a.ts': 'src/#b.ts' }), legacy: [[K(dep('src/#a.ts', T)), 0, 1, 'RENAMED'], [K(dep('src/#b.ts', T)), 1, null]], g08: [[K(dep('src/#a.ts', T)), 0, null, '', K(dep('src/#b.ts', T))]] },
  { name: 'a finding comes back after an absence', snaps: [snap('0', [AT]), snap('1', [], { extraFiles: [A, T] }), snap('2', [AT])], legacy: [[K(AT), 0, 1, 'FIXED-BY-DEV'], [K(AT), 2, null]], g08: [[K(AT), 0, 1, 'FIXED-BY-DEV'], [K(AT), 2, null]] },
  {
    name: 'a chain of two renames', snaps: [snap('0', [AT]), snap('1', [A1T]), snap('2', [A2T])], tr: [undefined, R({ [A]: A1 }), R({ [A1]: A2 })],
    legacy: [[K(AT), 0, 1, 'RENAMED'], [K(A1T), 1, 2, 'RENAMED'], [K(A2T), 2, null]], g08: [[K(AT), 0, null, '', K(A2T)]],
  },
];

describe('T-HC (a): planted histories, identity errors = 0', () => {
  const transitions = PLANTED.reduce((a, p) => a + p.snaps.filter((s) => s.ok).length - 1, 0);
  it(`plants about 40 transitions (${String(transitions)})`, () => {
    expect(transitions).toBeGreaterThanOrEqual(40);
  });
  for (const [label, opts, pick] of [['LEGACY_FIXES_MINED', LEGACY_FIXES_MINED, (p: Planted) => p.legacy], ['G08_PROPOSED', G08_PROPOSED, (p: Planted) => p.g08]] as const) {
    it(`${label}: identity errors = 0`, () => {
      const errors: string[] = [];
      for (const p of PLANTED) {
        const got = new Set(buildLineages(p.snaps, p.tr ?? [], opts).lineages.map(rowOf));
        const want = new Set(pick(p).map(rowStr));
        for (const w of want) if (!got.has(w)) errors.push(`${p.name}: missing ${w}`);
        for (const g of got) if (!want.has(g)) errors.push(`${p.name}: unexpected ${g}`);
      }
      expect(errors).toEqual([]);
    });
  }
});

/**
 * T-HC (a) on the edge grain (U4 verification): Study 2's unit is E, so the planted histories also run under
 * STUDY2_S2D01 (cycles as sorted file sets) and under its Q2 option explode-edges (one key per directed cycle edge),
 * with renames, a re-rotated cycle and a cycle edge shared with a plain FF-S01. Expected rows written before the run.
 */
interface EdgePlanted {
  readonly name: string;
  readonly snaps: readonly Snapshot[];
  readonly tr?: readonly (Transition | undefined)[];
  readonly sorted: readonly Row[];
  readonly explode: readonly Row[];
}
const E = (a: string, b: string): string => `${a}|${b}`;
const EDGE_PLANTED: readonly EdgePlanted[] = [
  { name: 'E: unchanged edge', snaps: [snap('0', [AT]), snap('1', [AT])], sorted: [[E(A, T), 0, null]], explode: [[E(A, T), 0, null]] },
  { name: 'E: FF-S01 and FF-S03 on one edge share it; it ends only when both go', snaps: [snap('0', [AT, dep(A, T, 'FF-S03')]), snap('1', [dep(A, T, 'FF-S03')]), snap('2', [], { extraFiles: [A, T] })],
    sorted: [[E(A, T), 0, 2, 'FIXED-BY-DEV']], explode: [[E(A, T), 0, 2, 'FIXED-BY-DEV']] },
  { name: 'E: source renamed', snaps: [snap('0', [AT]), snap('1', [A1T])], tr: one({ [A]: A1 }),
    sorted: [[E(A, T), 0, null, '', E(A1, T)]], explode: [[E(A, T), 0, null, '', E(A1, T)]] },
  { name: 'E: two-cycle renamed', snaps: [snap('0', [cyc(cA, cB, cA)]), snap('1', [cyc('z.ts', cB, 'z.ts')])], tr: one({ [cA]: 'z.ts' }),
    sorted: [['cycle-files#a.ts;b.ts', 0, null, '', 'cycle-files#b.ts;z.ts']],
    explode: [[E(cA, cB), 0, null, '', E('z.ts', cB)], [E(cB, cA), 0, null, '', E(cB, 'z.ts')]] },
  { name: 'E: three-cycle renamed, re-rotated by canonicalCycle', snaps: [snap('0', [cyc(cA, cB, cC, cA)]), snap('1', [cyc('z.ts', cB, cC, 'z.ts')])], tr: one({ [cA]: 'z.ts' }),
    sorted: [['cycle-files#a.ts;b.ts;c.ts', 0, null, '', 'cycle-files#b.ts;c.ts;z.ts']],
    explode: [[E(cA, cB), 0, null, '', E('z.ts', cB)], [E(cB, cC), 0, null], [E(cC, cA), 0, null, '', E(cC, 'z.ts')]] },
  { name: 'E: three-cycle renamed, a plain FF-S01 on one of its edges', snaps: [snap('0', [dep(cB, cC), cyc(cA, cB, cC, cA)]), snap('1', [dep(cB, cC), cyc('z.ts', cB, cC, 'z.ts')])], tr: one({ [cA]: 'z.ts' }),
    sorted: [[E(cB, cC), 0, null], ['cycle-files#a.ts;b.ts;c.ts', 0, null, '', 'cycle-files#b.ts;c.ts;z.ts']],
    explode: [[E(cA, cB), 0, null, '', E('z.ts', cB)], [E(cB, cC), 0, null], [E(cC, cA), 0, null, '', E(cC, 'z.ts')]] },
  { name: 'E: a cycle broken by removing one edge, files stay', snaps: [snap('0', [cyc(cC, cD, cC)]), snap('1', [], { extraFiles: [cC, cD], extraEdges: [E(cC, cD)] })],
    sorted: [['cycle-files#c.ts;d.ts', 0, 1, 'FIXED-BY-DEV']], explode: [[E(cC, cD), 0, 1, 'FIXED-BY-DEV'], [E(cD, cC), 0, 1, 'FIXED-BY-DEV']] },
];

describe('T-HC (a) on the edge grain: identity errors = 0', () => {
  const presets: readonly [string, IdentityOptions, (p: EdgePlanted) => readonly Row[]][] = [
    ['STUDY2_S2D01', STUDY2_S2D01, (p) => p.sorted],
    ['STUDY2_S2D01 + explode-edges', { ...STUDY2_S2D01, cycleIdentity: 'explode-edges' }, (p) => p.explode],
  ];
  for (const [label, opts, pick] of presets) {
    it(`${label}: identity errors = 0`, () => {
      const errors: string[] = [];
      for (const p of EDGE_PLANTED) {
        const got = new Set(buildLineages(p.snaps, p.tr ?? [], opts).lineages.map(rowOf));
        const want = new Set(pick(p).map(rowStr));
        for (const w of want) if (!got.has(w)) errors.push(`${p.name}: missing ${w}`);
        for (const g of got) if (!want.has(g)) errors.push(`${p.name}: unexpected ${g}`);
      }
      expect(errors).toEqual([]);
    });
  }
});

describe('T-HC (b): the hand-check packet of real disappearances', () => {
  const MINED = path.resolve(__dirname, '../../../../results/v1.3-fixes-mined');
  const repos: HandcheckRepo[] = [];
  beforeAll(() => {
    forEachMinedRepo(MINED, (r) => repos.push({ id: r.entry.id, repo: r.entry.repo, pairs: r.pairs }));
  });
  it('is deterministic for seed 20261018 and stratified by cause, up to 10 each', () => {
    const a = handcheckSample(repos, { seed: 20261018, perCause: 10 });
    const b = handcheckSample(repos, { seed: 20261018, perCause: 10 });
    expect(handcheckCsv(a)).toBe(handcheckCsv(b));
    const byCause = new Map<string, number>();
    for (const r of a) byCause.set(r.cause, (byCause.get(r.cause) ?? 0) + 1);
    for (const n of byCause.values()) expect(n).toBeLessThanOrEqual(10);
    expect(handcheckCsv(handcheckSample(repos, { seed: 1, perCause: 10 }))).not.toBe(handcheckCsv(a));
  });
  it('covers every cause present in the blocking pair records, and every row is complete with empty labels', () => {
    const present = new Set<string>();
    for (const r of repos) for (const p of r.pairs) if (p.parentOk && p.childOk) for (const f of p.disappeared) if (f.tier === 'blocking') present.add(f.cause ?? 'OTHER');
    const rows = handcheckSample(repos, { seed: 20261018, perCause: 10 });
    expect(new Set(rows.map((r) => r.cause))).toEqual(present);
    expect(present).toEqual(new Set(['RENAMED', 'FILE-DELETED', 'MASS-OR-BOT', 'RESOLVED-IN-PLACE', 'FIXED-BY-DEV', 'OTHER']));
    for (const r of rows) {
      expect(r.link).toBe(`https://github.com/${r.repo}/commit/${r.commit}`);
      expect(r.rule).not.toBe('');
      expect(r.files).not.toBe('');
      expect(r.sameViolation).toBe('');
      expect(r.causeRight).toBe('');
    }
    expect(handcheckCsv(rows).split('\n')[0]).toBe('repoId,repo,commit,parent,link,date,rule,tier,files,target,key,cause,sameViolation,causeRight');
  });
});
