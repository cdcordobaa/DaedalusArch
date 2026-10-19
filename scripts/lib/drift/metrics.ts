/**
 * Drift measures over a snapshot sequence (DR-1 to DR-8 of `aidlc-docs/construction/v1.4/U4/functional-design/design.md`),
 * ported from `survival()` in `scripts/v1.3/fixes-mined-report.ts` and `analyse()` in `scripts/v1.3/drift-descriptive.py`.
 *
 * - `readMinedRepo` / `readMinedLineages`: the committed fix-mining outputs of one repository (one at a time).
 * - `survival`: Kaplan-Meier inputs from grid lineages, with `leftCensor` (DR-2), the FF-S02 cap rule (ID-19) and the
 *   S2 moves-censored sensitivity (DR-8). KM itself is `kaplanMeier` of `scripts/v1.3/lib/fixes-mined.ts`.
 * - `SURVIVAL_GROUPS_5A`, `SURVIVAL_GROUPS_C5`: the group predicates (DR-5).
 * - `windowCounts` (grid windows, DR-1, DR-2, DR-7) and `pairCounts` (pair level, DR-3, DR-6, DR-7). They never mix.
 * - Tier (DR-3a): committed records carry the tier frozen at walk time, and regressions use it; `isBlocking` over
 *   the live table is for new data only.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { kaplanMeier, type KmResult, type SurvivalObs } from '../../v1.3/lib/fixes-mined.js';
import { ruleTier } from '../../../src/scoring-engine/rule-tiers.js';
import type { Lineage } from './types.js';

// ── Committed fix-mining records ────────────────────────────────────────────

/** A `lineages.json.gz` record (`lineages()` in `scripts/v1.3/fixes-mined-run.ts`). */
export interface MinedLineageRecord {
  readonly key: string;
  readonly kind: 'finding' | 'edge';
  readonly functionId?: string;
  readonly tier?: 'blocking' | 'advisory';
  readonly edgeShaped?: boolean;
  readonly edgeKind?: string;
  readonly born: number;
  readonly ended: number | null;
  readonly filesStay?: boolean;
}

/** A finding of a `pairs.json.gz` record. */
export interface MinedPairFinding {
  readonly key: string;
  readonly functionId: string;
  readonly tier: 'blocking' | 'advisory';
  readonly edgeShaped: boolean;
  readonly layers?: string;
  readonly cause?: string;
  readonly filePath: string;
  readonly target?: string;
  readonly line?: number;
  readonly message: string;
}

/** A `pairs.json.gz` record (one sampled commit and its first parent). */
export interface MinedPairRecord {
  readonly sha: string;
  readonly parent: string;
  readonly date: string;
  readonly bot: boolean;
  readonly mass: boolean;
  readonly parentOk: boolean;
  readonly childOk: boolean;
  readonly exposedByRule: Readonly<Record<string, number>>;
  readonly childByRule: Readonly<Record<string, number>>;
  readonly disappeared: readonly MinedPairFinding[];
  readonly introduced: readonly MinedPairFinding[];
}

export interface MinedCorpusEntry { readonly id: string; readonly repo: string; readonly style: string; readonly root: string }

/** A committed lineage record as a `Lineage` (with `kind: 'edge'` for the unflagged baseline). */
export function fromMinedLineage(r: MinedLineageRecord): Lineage {
  return {
    key: r.key,
    ruleIds: r.functionId !== undefined ? [r.functionId] : [],
    edgeShaped: r.kind === 'edge' ? true : r.edgeShaped === true,
    ...(r.tier !== undefined && { tier: r.tier }),
    born: r.born,
    ended: r.ended,
    ...(r.filesStay !== undefined && { filesStay: r.filesStay }),
    kind: r.kind,
    ...(r.functionId !== undefined && { functionId: r.functionId }),
    ...(r.edgeKind !== undefined && { edgeKind: r.edgeKind }),
  };
}

/** `lineages.json.gz`: the grid and the lineage records. */
interface MinedLineageFile { readonly grid: { sha: string; date: string }[]; readonly lineages: MinedLineageRecord[] }
const readGz = (p: string): unknown => JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString('utf8'));

export interface MinedLineages {
  readonly grid: readonly { readonly sha: string; readonly date: string }[];
  readonly lineages: readonly Lineage[];
  /** `childOk` of the pair at each grid point (the grid point's own snapshot). */
  readonly ok: readonly boolean[];
  /** The grid point holds the FF-S02 cap (`childByRule['FF-S02'] >= s02Cap`). */
  readonly capped: readonly boolean[];
  /** The first valid grid index (null: none). */
  readonly firstValid: number | null;
}

export interface MinedRepo extends MinedLineages {
  readonly entry: MinedCorpusEntry;
  readonly pairs: readonly MinedPairRecord[];
}

function lineagesFrom(grid: MinedLineages['grid'], recs: readonly MinedLineageRecord[], pairs: readonly MinedPairRecord[], s02Cap: number): MinedLineages {
  if (pairs.length !== grid.length || pairs.some((p, i) => p.sha !== grid[i]?.sha)) throw new Error('pairs and grid disagree');
  const ok = pairs.map((p) => p.childOk);
  const fv = ok.indexOf(true);
  return {
    grid,
    lineages: recs.map(fromMinedLineage),
    ok,
    capped: pairs.map((p) => (p.childByRule['FF-S02'] ?? 0) >= s02Cap),
    firstValid: fv < 0 ? null : fv,
  };
}

/** One repository's `lineages.json.gz` with the grid, the ok and capped flags from `pairs.json.gz`. */
export function readMinedLineages(repoDir: string, s02Cap = 100): MinedLineages {
  const l = readGz(path.join(repoDir, 'lineages.json.gz')) as MinedLineageFile;
  return lineagesFrom(l.grid, l.lineages, readGz(path.join(repoDir, 'pairs.json.gz')) as MinedPairRecord[], s02Cap);
}

/** The corpus entries that have a walk (`results/v1.3-fixes-mined/corpus.json`, as the report reads it). */
export function minedCorpus(fixesMinedDir: string): MinedCorpusEntry[] {
  const c = JSON.parse(fs.readFileSync(path.join(fixesMinedDir, 'corpus.json'), 'utf8')) as { entries: MinedCorpusEntry[] };
  return c.entries.filter((e) => fs.existsSync(path.join(fixesMinedDir, 'repos', e.id, 'walk.json')));
}

export function readMinedRepo(fixesMinedDir: string, entry: MinedCorpusEntry, s02Cap = 100): MinedRepo {
  const dir = path.join(fixesMinedDir, 'repos', entry.id);
  const l = readGz(path.join(dir, 'lineages.json.gz')) as MinedLineageFile;
  const pairs = readGz(path.join(dir, 'pairs.json.gz')) as MinedPairRecord[];
  return { entry, pairs, ...lineagesFrom(l.grid, l.lineages, pairs, s02Cap) };
}

/** Visits the repositories one at a time (about 25 MB decompressed in all), so only one is in memory. */
export function forEachMinedRepo(fixesMinedDir: string, fn: (r: MinedRepo) => void, s02Cap = 100): void {
  for (const e of minedCorpus(fixesMinedDir)) fn(readMinedRepo(fixesMinedDir, e, s02Cap));
}

// ── Tier (DR-3a) ────────────────────────────────────────────────────────────

/** New data only: the live tier table (`ruleTier` of `src/scoring-engine/rule-tiers.ts`). */
export function isBlocking(rule: string, style?: string): boolean {
  return ruleTier(rule, style).tier === 'blocking';
}

/**
 * The tiers frozen in one repository's records (finding lineages and pair findings): rule -> tier. Rules seen with two
 * tiers go to `conflicts`. Used for the per-rule count maps of a pair record, which carry no tier of their own.
 */
export function storedTierMap(lineages: readonly Lineage[], pairs: readonly MinedPairRecord[]): { tiers: Map<string, 'blocking' | 'advisory'>; conflicts: string[] } {
  const tiers = new Map<string, 'blocking' | 'advisory'>();
  const conflicts = new Set<string>();
  const add = (rule: string | undefined, tier: 'blocking' | 'advisory' | undefined): void => {
    if (rule === undefined || tier === undefined) return;
    const t = tiers.get(rule);
    if (t === undefined) tiers.set(rule, tier);
    else if (t !== tier) conflicts.add(rule);
  };
  for (const l of lineages) if (l.kind !== 'edge') add(l.functionId ?? l.ruleIds[0], l.tier);
  for (const p of pairs) for (const f of [...p.disappeared, ...p.introduced]) add(f.functionId, f.tier);
  return { tiers, conflicts: [...conflicts].sort() };
}

// ── Survival (DR-2, DR-4, DR-8, ID-19) ──────────────────────────────────────

const days = (a: string, b: string): number => (Date.parse(b) - Date.parse(a)) / 86_400_000;
const isS02 = (l: Lineage): boolean => l.functionId === 'FF-S02' || (l.functionId === undefined && l.ruleIds.includes('FF-S02'));

export interface SurvivalOptions {
  readonly leftCensor: 'grid-index-0' | 'first-valid';
  /** The repository's first valid grid index (`first-valid` only). */
  readonly firstValid?: number | null | undefined;
  /** S2 (DR-8): endings with `filesStay === false` are censored at their end date, not events. */
  readonly movesCensored?: boolean | undefined;
}

export interface SurvivalSample {
  readonly obs: SurvivalObs[];
  /** Endings counted as events. */
  readonly ended: number;
  /** Of those, every named file still in place. */
  readonly inPlace: number;
}

/** A faithful port of `survival()` in `scripts/v1.3/fixes-mined-report.ts` under `leftCensor: 'grid-index-0'`. */
export function survival(
  lineages: readonly Lineage[],
  grid: readonly { readonly date: string }[],
  pick: (l: Lineage) => boolean,
  capped: readonly boolean[],
  opts: SurvivalOptions = { leftCensor: 'grid-index-0' },
): SurvivalSample {
  const last = grid.at(-1)?.date ?? '';
  const cap = (i: number): boolean => capped[i] === true || capped[i - 1] === true;
  const fv = opts.firstValid ?? null;
  const obs: SurvivalObs[] = [];
  let inPlace = 0;
  let ended = 0;
  for (const l of lineages) {
    if (l.born === 0 || !pick(l)) continue;
    if (opts.leftCensor === 'first-valid' && fv !== null && l.born === fv) continue;
    if (isS02(l) && (cap(l.born) || (l.ended !== null && cap(l.ended)))) continue;
    const b = grid[l.born]?.date;
    if (b === undefined) continue;
    if (l.ended !== null) {
      const e = grid[l.ended]?.date ?? last;
      const t = Math.max(0, days(b, e));
      if (opts.movesCensored === true && l.filesStay === false) { obs.push({ t, event: false }); continue; }
      obs.push({ t, event: true });
      ended++;
      if (l.filesStay === true) inPlace++;
    } else obs.push({ t: Math.max(0, days(b, last)), event: false });
  }
  return { obs, inPlace, ended };
}

/** Pools samples (the report pools repositories before KM). */
export function poolSamples(xs: readonly SurvivalSample[]): SurvivalSample {
  const obs: SurvivalObs[] = [];
  let ended = 0;
  let inPlace = 0;
  for (const x of xs) { for (const o of x.obs) obs.push(o); ended += x.ended; inPlace += x.inPlace; }
  return { obs, ended, inPlace };
}

export interface KmRow {
  readonly n: number;
  readonly ended: number;
  /** Rounded days, or '> obs.' when the curve never reaches 0.5. */
  readonly median: number | '> obs.';
  /** S(365), 3 decimals. */
  readonly s365: number;
  /** Share of endings with every named file in place, as a percent with 2 decimals; null with no ending. */
  readonly inPlacePct: number | null;
  readonly km: KmResult;
}

/** KM of a pooled sample, formatted as the report's tables print it. */
export function kmRow(s: SurvivalSample): KmRow {
  const km = kaplanMeier(s.obs);
  return {
    n: km.n,
    ended: km.events,
    median: km.median !== null ? Math.round(km.median) : '> obs.',
    s365: Number(km.s365.toFixed(3)),
    inPlacePct: s.ended > 0 ? Number((100 * (s.inPlace / s.ended)).toFixed(2)) : null,
    km,
  };
}

export interface SurvivalGroup { readonly name: string; readonly pick: (l: Lineage) => boolean }

const finding = (l: Lineage): boolean => l.kind === 'finding';

/** The eight groups of the fix-mining report §5a (`sg` in `scripts/v1.3/fixes-mined-report.ts`). */
export const SURVIVAL_GROUPS_5A: readonly SurvivalGroup[] = Object.freeze([
  { name: 'blocking, edge-shaped findings', pick: (l) => finding(l) && l.tier === 'blocking' && l.edgeShaped },
  { name: 'blocking, edge-shaped, without FF-S02 cycles', pick: (l) => finding(l) && l.tier === 'blocking' && l.edgeShaped && l.functionId !== 'FF-S02' },
  { name: 'blocking FF-S02 cycles only', pick: (l) => finding(l) && l.functionId === 'FF-S02' },
  { name: 'advisory, edge-shaped findings', pick: (l) => finding(l) && l.tier === 'advisory' && l.edgeShaped },
  { name: 'advisory, file-level findings', pick: (l) => finding(l) && l.tier === 'advisory' && !l.edgeShaped },
  { name: 'unflagged cross-layer import edges', pick: (l) => l.kind === 'edge' && l.edgeKind === 'crossLayer' },
  { name: 'unflagged same-layer import edges', pick: (l) => l.kind === 'edge' && l.edgeKind === 'layered' },
  { name: 'unflagged import edges, unlayered file', pick: (l) => l.kind === 'edge' && l.edgeKind === 'other' },
]);

/** The two extra groups of the C5 note §4 (`Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md`). */
export const SURVIVAL_GROUPS_C5: readonly SurvivalGroup[] = Object.freeze([
  { name: 'blocking, all', pick: (l) => finding(l) && l.tier === 'blocking' },
  { name: 'blocking, file-level', pick: (l) => finding(l) && l.tier === 'blocking' && !l.edgeShaped },
]);

// ── Grid windows (DR-1, DR-2, DR-7) ─────────────────────────────────────────

export interface WindowCounts {
  readonly births: number;
  readonly endings: number;
  readonly endingsInPlace: number;
  readonly birthsNoS02: number;
  readonly endingsNoS02: number;
  readonly edgeBirths: number;
  readonly edgeEndings: number;
  readonly xlBirths: number;
  readonly xlEndings: number;
  /** Per valid grid point: blocking lineages alive, persisting from the previous valid point (DR-1), born, ended. */
  readonly perPoint: readonly { readonly i: number; readonly alive: number; readonly persisting: number; readonly introduced: number; readonly removed: number }[];
}

export interface WindowOptions {
  /** Blocking finding lineage (committed data: the stored tier, DR-3a). */
  readonly blocking?: ((l: Lineage) => boolean) | undefined;
  readonly leftCensor?: 'grid-index-0' | 'first-valid' | undefined;
  readonly firstValid?: number | null | undefined;
}

/**
 * Grid windows: consecutive valid grid points, which may span unsampled commits and carry only `filesStay`. A port of
 * the window part of `analyse()` in `scripts/v1.3/drift-descriptive.py`: births exclude left-censored lineages,
 * endings count every ended one; FF-S02 lineages touching a capped point (or the one before) are dropped.
 */
export function windowCounts(lineages: readonly Lineage[], ok: readonly boolean[], capped: readonly boolean[], opts: WindowOptions = {}): WindowCounts {
  const blocking = opts.blocking ?? ((l: Lineage) => l.tier === 'blocking');
  const cap = (i: number): boolean => capped[i] === true || (i > 0 && capped[i - 1] === true);
  const censored = (l: Lineage): boolean => l.born === 0 || (opts.leftCensor === 'first-valid' && opts.firstValid !== undefined && opts.firstValid !== null && l.born === opts.firstValid);
  const w = { births: 0, endings: 0, endingsInPlace: 0, birthsNoS02: 0, endingsNoS02: 0, edgeBirths: 0, edgeEndings: 0, xlBirths: 0, xlEndings: 0 };
  const kept: Lineage[] = [];
  for (const l of lineages) {
    if (l.kind === 'edge') {
      const xl = l.edgeKind === 'crossLayer';
      if (!censored(l)) { w.edgeBirths++; if (xl) w.xlBirths++; }
      if (l.ended !== null) { w.edgeEndings++; if (xl) w.xlEndings++; }
      continue;
    }
    if (!blocking(l)) continue;
    const s02 = isS02(l);
    if (s02 && (cap(l.born) || (l.ended !== null && cap(l.ended)))) continue;
    kept.push(l);
    if (!censored(l)) { w.births++; if (!s02) w.birthsNoS02++; }
    if (l.ended !== null) {
      w.endings++;
      if (!s02) w.endingsNoS02++;
      if (l.filesStay === true) w.endingsInPlace++;
    }
  }
  const perPoint: { i: number; alive: number; persisting: number; introduced: number; removed: number }[] = [];
  let prevValid: number | undefined;
  for (let i = 0; i < ok.length; i++) {
    if (ok[i] !== true) continue;
    let alive = 0;
    let persisting = 0;
    let introduced = 0;
    let removed = 0;
    for (const l of kept) {
      const end = l.ended ?? ok.length;
      if (l.born <= i && i < end) {
        alive++;
        if (prevValid !== undefined && l.born <= prevValid) persisting++;
      }
      if (l.born === i && prevValid !== undefined) introduced++;
      if (l.ended === i) removed++;
    }
    perPoint.push({ i, alive, persisting, introduced, removed });
    prevValid = i;
  }
  return { ...w, perPoint };
}

// ── Pair level (DR-3, DR-6, DR-7) ───────────────────────────────────────────

export const DISAPPEARANCE_CAUSES = ['RENAMED', 'FILE-DELETED', 'MASS-OR-BOT', 'RESOLVED-IN-PLACE', 'FIXED-BY-DEV', 'OTHER'] as const;

export interface PairCounts {
  validPairs: number;
  introduced: number;
  introBotMass: number;
  /** Per rule, an upper bound (DR-6; `renamePolicy: 'end'` only). */
  introRenameMatched: number;
  introOther: number;
  removed: number;
  removedBy: Record<string, number>;
  /** FIXED-BY-DEV for edge-shaped findings plus RESOLVED-IN-PLACE for file-level ones (DR-3). */
  credited: number;
  netFromPairs: number;
  pairsWithIntro: number;
  pairsWithRemoval: number;
  /** Pairs where introduced − removed ≠ count at the child − count at the parent (must be 0). */
  netCheckFail: number;
}

export function emptyPairCounts(): PairCounts {
  return {
    validPairs: 0, introduced: 0, introBotMass: 0, introRenameMatched: 0, introOther: 0, removed: 0,
    removedBy: Object.fromEntries(DISAPPEARANCE_CAUSES.map((c) => [c, 0])), credited: 0, netFromPairs: 0,
    pairsWithIntro: 0, pairsWithRemoval: 0, netCheckFail: 0,
  };
}

export function addPairCounts(a: PairCounts, b: PairCounts): PairCounts {
  const out = { ...a, removedBy: { ...a.removedBy } };
  for (const k of Object.keys(b) as (keyof PairCounts)[]) {
    if (k === 'removedBy') for (const [c, n] of Object.entries(b.removedBy)) out.removedBy[c] = (out.removedBy[c] ?? 0) + n;
    else out[k] = a[k] + b[k];
  }
  return out;
}

export interface PairOptions {
  /** Blocking rule for the per-rule count maps (committed data: `storedTierMap`, DR-3a). */
  readonly blockingRule: (rule: string) => boolean;
  /** Blocking finding record (default: its stored tier). */
  readonly blockingFinding?: ((f: MinedPairFinding) => boolean) | undefined;
  readonly s02Cap?: number | undefined;
}

/** Pair level, ported from the pair part of `analyse()` in `scripts/v1.3/drift-descriptive.py`. */
export function pairCounts(pairs: readonly MinedPairRecord[], opts: PairOptions): PairCounts {
  const cap = opts.s02Cap ?? 100;
  const blkF = opts.blockingFinding ?? ((f: MinedPairFinding) => f.tier === 'blocking');
  const pl = emptyPairCounts();
  for (const p of pairs) {
    if (!(p.parentOk && p.childOk)) continue;
    pl.validPairs++;
    const trunc = (p.exposedByRule['FF-S02'] ?? 0) >= cap || (p.childByRule['FF-S02'] ?? 0) >= cap;
    const keepRule = (r: string): boolean => opts.blockingRule(r) && !(r === 'FF-S02' && trunc);
    const keepF = (f: MinedPairFinding): boolean => blkF(f) && !(f.functionId === 'FF-S02' && trunc);
    const intro = p.introduced.filter(keepF);
    const gone = p.disappeared.filter(keepF);
    const botmass = p.bot || p.mass;
    const renByRule = new Map<string, number>();
    for (const f of gone) if (f.cause === 'RENAMED') renByRule.set(f.functionId, (renByRule.get(f.functionId) ?? 0) + 1);
    for (const f of intro) {
      pl.introduced++;
      if (botmass) pl.introBotMass++;
      else if ((renByRule.get(f.functionId) ?? 0) > 0) {
        renByRule.set(f.functionId, (renByRule.get(f.functionId) ?? 0) - 1);
        pl.introRenameMatched++;
      } else pl.introOther++;
    }
    for (const f of gone) {
      const c = f.cause ?? 'OTHER';
      pl.removed++;
      pl.removedBy[c] = (pl.removedBy[c] ?? 0) + 1;
      if ((f.edgeShaped && c === 'FIXED-BY-DEV') || (!f.edgeShaped && c === 'RESOLVED-IN-PLACE')) pl.credited++;
    }
    if (intro.length > 0) pl.pairsWithIntro++;
    if (gone.length > 0) pl.pairsWithRemoval++;
    const net = intro.length - gone.length;
    pl.netFromPairs += net;
    const sum = (m: Readonly<Record<string, number>>): number => Object.entries(m).filter(([r]) => keepRule(r)).reduce((s, [, n]) => s + n, 0);
    if (sum(p.childByRule) - sum(p.exposedByRule) !== net) pl.netCheckFail++;
  }
  return pl;
}
