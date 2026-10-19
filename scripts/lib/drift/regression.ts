/**
 * The published figures the drift module must reproduce (R1, R2 of `aidlc-docs/construction/v1.4/U4/functional-design/design.md`
 * §5), the review's sensitivity rows (S1, S2, DR-8), and their recomputation from the committed fix-mining outputs.
 * Shared by `tests/unit/scripts/drift/survival-regression.test.ts` and `scripts/v1.4/drift-check.ts`, so the test and
 * the entry file check the same thing. Zero calls, no Neo4j; reads `results/v1.3-fixes-mined/` only.
 *
 * Sources of the constants:
 * - R1: `Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md` §5a (and `results/v1.3-fixes-mined/summary.json`);
 * - R2: `Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md` §3 and §4;
 * - S1, S2: the design review's independent zero-call replication (2026-10-18), pinned in the U4 plan step 6.
 * S1 and S2 are sensitivity rows, printed beside the published figures and never in place of them.
 */
import { ruleTier } from '../../../src/scoring-engine/rule-tiers.js';
import {
  addPairCounts, emptyPairCounts, forEachMinedRepo, kmRow, pairCounts, poolSamples, storedTierMap, survival,
  SURVIVAL_GROUPS_5A, SURVIVAL_GROUPS_C5, windowCounts,
  type KmRow, type PairCounts, type SurvivalGroup, type SurvivalSample, type WindowCounts,
} from './metrics.js';

export interface PublishedRow {
  readonly group: string;
  readonly n: number;
  readonly ended: number;
  readonly median: number | '> obs.';
  readonly s365: number;
  readonly inPlacePct?: number;
}

/** R1: the fix-mining survival table §5a, digit for digit. */
export const PUBLISHED_5A: readonly PublishedRow[] = Object.freeze([
  { group: 'blocking, edge-shaped findings', n: 2413, ended: 874, median: 1561, s365: 0.709, inPlacePct: 44.62 },
  { group: 'blocking, edge-shaped, without FF-S02 cycles', n: 2080, ended: 654, median: '> obs.', s365: 0.760, inPlacePct: 42.66 },
  { group: 'blocking FF-S02 cycles only', n: 333, ended: 220, median: 150, s365: 0.373, inPlacePct: 50.45 },
  { group: 'advisory, edge-shaped findings', n: 35, ended: 13, median: '> obs.', s365: 0.873, inPlacePct: 38.46 },
  { group: 'advisory, file-level findings', n: 11436, ended: 3250, median: '> obs.', s365: 0.774, inPlacePct: 33.26 },
  { group: 'unflagged cross-layer import edges', n: 11211, ended: 3790, median: '> obs.', s365: 0.746, inPlacePct: 31.58 },
  { group: 'unflagged same-layer import edges', n: 18306, ended: 6073, median: '> obs.', s365: 0.754, inPlacePct: 37.81 },
  { group: 'unflagged import edges, unlayered file', n: 28639, ended: 16943, median: 339, s365: 0.490, inPlacePct: 27.96 },
] as const);

/** R2: the C5 note's pooled figures (§3) and its six KM rows (§4). */
export const PUBLISHED_C5 = Object.freeze({
  windows: { births: 2785, endings: 1288, endingsInPlace: 543, birthsNoS02: 2452, endingsNoS02: 975 },
  pairs: {
    validPairs: 4640, introduced: 802, introBotMass: 448, introRenameMatched: 24, introOther: 330, removed: 265,
    removedBy: { 'FILE-DELETED': 106, RENAMED: 52, 'MASS-OR-BOT': 19, 'RESOLVED-IN-PLACE': 7, 'FIXED-BY-DEV': 74, OTHER: 7 },
    netCheckFail: 0,
  },
  survival: [
    { group: 'blocking, all', n: 2785, ended: 1002, median: 1561, s365: 0.719 },
    { group: 'blocking, edge-shaped', n: 2413, ended: 874, median: 1561, s365: 0.709 },
    { group: 'blocking, edge-shaped, without FF-S02', n: 2080, ended: 654, median: '> obs.', s365: 0.760 },
    { group: 'blocking FF-S02', n: 333, ended: 220, median: 150, s365: 0.373 },
    { group: 'blocking, file-level', n: 372, ended: 128, median: '> obs.', s365: 0.779 },
    { group: 'unflagged cross-layer import edges', n: 11211, ended: 3790, median: '> obs.', s365: 0.746 },
  ] as readonly PublishedRow[],
});

/** S1 (left-censoring corrected) and S2 (moves censored), pinned to the review's replication. Sensitivity only. */
export const REVIEW_SENSITIVITY: readonly { readonly group: string; readonly S1: PublishedRow; readonly S2: PublishedRow }[] = Object.freeze([
  { group: 'blocking, edge-shaped', S1: { group: 'S1', n: 2361, ended: 840, median: 1561, s365: 0.707 }, S2: { group: 'S2', n: 2413, ended: 390, median: '> obs.', s365: 0.842 } },
  { group: 'blocking, edge-shaped, without FF-S02', S1: { group: 'S1', n: 2029, ended: 621, median: '> obs.', s365: 0.759 }, S2: { group: 'S2', n: 2080, ended: 279, median: '> obs.', s365: 0.877 } },
  { group: 'blocking FF-S02 only', S1: { group: 'S1', n: 332, ended: 219, median: 150, s365: 0.370 }, S2: { group: 'S2', n: 333, ended: 111, median: '> obs.', s365: 0.601 } },
  { group: 'unflagged cross-layer import edges', S1: { group: 'S1', n: 10863, ended: 3553, median: '> obs.', s365: 0.747 }, S2: { group: 'S2', n: 11211, ended: 1197, median: '> obs.', s365: 0.912 } },
  { group: 'blocking, all (C5)', S1: { group: 'S1', n: 2727, ended: 964, median: '> obs.', s365: 0.717 }, S2: { group: 'S2', n: 2785, ended: 449, median: '> obs.', s365: 0.850 } },
  { group: 'blocking, file-level (C5)', S1: { group: 'S1', n: 366, ended: 124, median: '> obs.', s365: 0.781 }, S2: { group: 'S2', n: 372, ended: 59, median: '> obs.', s365: 0.901 } },
]);

/** The Python `BLOCKING` set of `scripts/v1.3/drift-descriptive.py` (FF-S03 only for layered): compared, never used. */
export const C5_PY_BLOCKING: ReadonlySet<string> = new Set(['FF-S01', 'FF-S02', 'FF-S04', 'FF-P01', 'FF-P03', 'FF-P06', 'FF-DS01', 'FF-DS02', 'FF-DT01', 'FF-DT02', 'FF-DT03', 'FF-DT04']);
const pyBlocking = (rule: string, style: string): boolean => C5_PY_BLOCKING.has(rule) || (rule === 'FF-S03' && style.toLowerCase() === 'layered');

const byName = (groups: readonly SurvivalGroup[], name: string): SurvivalGroup => {
  const g = groups.find((x) => x.name === name);
  if (g === undefined) throw new Error(`no survival group ${name}`);
  return g;
};
/** The six C5 §4 groups, in the note's order, mapped onto the shared predicates. */
const C5_SIX: readonly SurvivalGroup[] = [
  byName(SURVIVAL_GROUPS_C5, 'blocking, all'),
  byName(SURVIVAL_GROUPS_5A, 'blocking, edge-shaped findings'),
  byName(SURVIVAL_GROUPS_5A, 'blocking, edge-shaped, without FF-S02 cycles'),
  byName(SURVIVAL_GROUPS_5A, 'blocking FF-S02 cycles only'),
  byName(SURVIVAL_GROUPS_C5, 'blocking, file-level'),
  byName(SURVIVAL_GROUPS_5A, 'unflagged cross-layer import edges'),
];
/** The six sensitivity groups, in `REVIEW_SENSITIVITY` order. */
const SENS_SIX: readonly SurvivalGroup[] = [C5_SIX[1], C5_SIX[2], C5_SIX[3], C5_SIX[5], C5_SIX[0], C5_SIX[4]] as SurvivalGroup[];

export interface MinedRegression {
  readonly repos: number;
  readonly survival5A: readonly (KmRow & { readonly group: string })[];
  readonly survivalC5: readonly (KmRow & { readonly group: string })[];
  readonly sensitivity: readonly { readonly group: string; readonly S1: KmRow; readonly S2: KmRow }[];
  readonly windows: Omit<WindowCounts, 'perPoint'>;
  readonly pairs: PairCounts;
  /** DR-3a: stored tier against the live table and the Python set (reported, never gating). */
  readonly tierCheck: {
    readonly pairRecords: number;
    readonly storedVsLive: number;
    readonly storedVsPython: number;
    readonly lineageRecords: number;
    readonly lineageStoredVsLive: number;
    readonly conflicts: readonly string[];
    /** Rules a pair count map named that no record of the repository tiers (resolved through the live table). */
    readonly liveFallbackRules: readonly string[];
  };
  /** DR-2: repositories whose grid point 0 failed, with the lineages at their first valid point. */
  readonly leftCensorArtefact: readonly { readonly id: string; readonly firstValid: number; readonly lineages: number; readonly blocking: number }[];
}

/** Recomputes R1, R2, S1 and S2 from `results/v1.3-fixes-mined/` (one repository in memory at a time). */
export function computeMinedRegression(fixesMinedDir: string): MinedRegression {
  const s5a: SurvivalSample[][] = SURVIVAL_GROUPS_5A.map(() => []);
  const sc5: SurvivalSample[][] = C5_SIX.map(() => []);
  const s1: SurvivalSample[][] = SENS_SIX.map(() => []);
  const s2: SurvivalSample[][] = SENS_SIX.map(() => []);
  let win = { births: 0, endings: 0, endingsInPlace: 0, birthsNoS02: 0, endingsNoS02: 0, edgeBirths: 0, edgeEndings: 0, xlBirths: 0, xlEndings: 0 };
  let pairs = emptyPairCounts();
  const tc = { pairRecords: 0, storedVsLive: 0, storedVsPython: 0, lineageRecords: 0, lineageStoredVsLive: 0 };
  const conflicts: string[] = [];
  const fallback = new Set<string>();
  const artefact: { id: string; firstValid: number; lineages: number; blocking: number }[] = [];
  let repos = 0;
  forEachMinedRepo(fixesMinedDir, (r) => {
    repos++;
    const style = r.entry.style;
    SURVIVAL_GROUPS_5A.forEach((g, i) => s5a[i]?.push(survival(r.lineages, r.grid, g.pick, r.capped)));
    C5_SIX.forEach((g, i) => sc5[i]?.push(survival(r.lineages, r.grid, g.pick, r.capped)));
    SENS_SIX.forEach((g, i) => {
      s1[i]?.push(survival(r.lineages, r.grid, g.pick, r.capped, { leftCensor: 'first-valid', firstValid: r.firstValid }));
      s2[i]?.push(survival(r.lineages, r.grid, g.pick, r.capped, { leftCensor: 'grid-index-0', movesCensored: true }));
    });
    const w = windowCounts(r.lineages, r.ok, r.capped);
    win = {
      births: win.births + w.births, endings: win.endings + w.endings, endingsInPlace: win.endingsInPlace + w.endingsInPlace,
      birthsNoS02: win.birthsNoS02 + w.birthsNoS02, endingsNoS02: win.endingsNoS02 + w.endingsNoS02,
      edgeBirths: win.edgeBirths + w.edgeBirths, edgeEndings: win.edgeEndings + w.edgeEndings,
      xlBirths: win.xlBirths + w.xlBirths, xlEndings: win.xlEndings + w.xlEndings,
    };
    const tm = storedTierMap(r.lineages, r.pairs);
    for (const c of tm.conflicts) conflicts.push(`${r.entry.id}:${c}`);
    const blockingRule = (rule: string): boolean => {
      const t = tm.tiers.get(rule);
      if (t !== undefined) return t === 'blocking';
      fallback.add(rule);
      return ruleTier(rule, style).tier === 'blocking';
    };
    pairs = addPairCounts(pairs, pairCounts(r.pairs, { blockingRule }));
    for (const p of r.pairs) {
      for (const f of [...p.disappeared, ...p.introduced]) {
        tc.pairRecords++;
        const stored = f.tier === 'blocking';
        if (stored !== (ruleTier(f.functionId, style).tier === 'blocking')) tc.storedVsLive++;
        if (stored !== pyBlocking(f.functionId, style)) tc.storedVsPython++;
      }
    }
    for (const l of r.lineages) {
      if (l.kind !== 'finding' || l.functionId === undefined || l.tier === undefined) continue;
      tc.lineageRecords++;
      if ((l.tier === 'blocking') !== (ruleTier(l.functionId, style).tier === 'blocking')) tc.lineageStoredVsLive++;
    }
    if (r.firstValid !== null && r.firstValid > 0) {
      const at = r.lineages.filter((l) => l.born === r.firstValid);
      artefact.push({ id: r.entry.id, firstValid: r.firstValid, lineages: at.length, blocking: at.filter((l) => l.kind === 'finding' && l.tier === 'blocking').length });
    }
  });
  return {
    repos,
    survival5A: SURVIVAL_GROUPS_5A.map((g, i) => ({ group: g.name, ...kmRow(poolSamples(s5a[i] ?? [])) })),
    survivalC5: C5_SIX.map((_, i) => ({ group: PUBLISHED_C5.survival[i]?.group ?? '', ...kmRow(poolSamples(sc5[i] ?? [])) })),
    sensitivity: SENS_SIX.map((_, i) => ({ group: REVIEW_SENSITIVITY[i]?.group ?? '', S1: kmRow(poolSamples(s1[i] ?? [])), S2: kmRow(poolSamples(s2[i] ?? [])) })),
    windows: win,
    pairs,
    tierCheck: { ...tc, conflicts, liveFallbackRules: [...fallback].sort() },
    leftCensorArtefact: artefact,
  };
}

const sameRow = (a: KmRow, b: PublishedRow, withInPlace: boolean): boolean =>
  a.n === b.n && a.ended === b.ended && a.median === b.median && a.s365 === b.s365 && (!withInPlace || b.inPlacePct === undefined || a.inPlacePct === b.inPlacePct);
const show = (r: KmRow | PublishedRow): string => `${String(r.n)} / ${String(r.ended)} / ${String(r.median)} / ${r.s365.toFixed(3)}`;

/** The differences between a recomputation and the published figures (R1, R2: fatal) and the review values (S1, S2: reported). */
export function compareMined(reg: MinedRegression): { readonly published: string[]; readonly sensitivity: string[] } {
  const published: string[] = [];
  const sensitivity: string[] = [];
  PUBLISHED_5A.forEach((p, i) => {
    const a = reg.survival5A[i];
    if (a === undefined || !sameRow(a, p, true)) published.push(`R1 ${p.group}: ${a !== undefined ? `${show(a)} (${String(a.inPlacePct)} %)` : 'missing'} != ${show(p)} (${String(p.inPlacePct)} %)`);
  });
  PUBLISHED_C5.survival.forEach((p, i) => {
    const a = reg.survivalC5[i];
    if (a === undefined || !sameRow(a, p, false)) published.push(`R2 KM ${p.group}: ${a !== undefined ? show(a) : 'missing'} != ${show(p)}`);
  });
  for (const [k, v] of Object.entries(PUBLISHED_C5.windows)) {
    const a = reg.windows[k as keyof typeof PUBLISHED_C5.windows];
    if (a !== v) published.push(`R2 windows ${k}: ${String(a)} != ${String(v)}`);
  }
  const pc = PUBLISHED_C5.pairs;
  for (const k of ['validPairs', 'introduced', 'introBotMass', 'introRenameMatched', 'introOther', 'removed', 'netCheckFail'] as const) {
    if (reg.pairs[k] !== pc[k]) published.push(`R2 pairs ${k}: ${String(reg.pairs[k])} != ${String(pc[k])}`);
  }
  for (const [c, v] of Object.entries(pc.removedBy)) {
    if ((reg.pairs.removedBy[c] ?? 0) !== v) published.push(`R2 pairs removed ${c}: ${String(reg.pairs.removedBy[c] ?? 0)} != ${String(v)}`);
  }
  REVIEW_SENSITIVITY.forEach((p, i) => {
    const a = reg.sensitivity[i];
    if (a === undefined) { sensitivity.push(`${p.group}: missing`); return; }
    if (!sameRow(a.S1, p.S1, false)) sensitivity.push(`S1 ${p.group}: ${show(a.S1)} != review ${show(p.S1)}`);
    if (!sameRow(a.S2, p.S2, false)) sensitivity.push(`S2 ${p.group}: ${show(a.S2)} != review ${show(p.S2)}`);
  });
  return { published, sensitivity };
}
