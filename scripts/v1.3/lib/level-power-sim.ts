/**
 * Study 2 level-outcome power simulation (readiness gate D3; Docs/v1.3/floor-escape-design-2026-10-16.md §3.7).
 * A DESIGN AID, NOT A PRE-REGISTRATION. Pure; no I/O, no model call, no Neo4j. Entry: scripts/v1.3/level-power-sim.ts.
 * Report: Docs/v1.3/level-power-sim-2026-10-16.md.
 *
 * Outcome, per run: Y = distinct blocking violating edges (file → target; FF-S01/FF-S03 on one edge count once) in the
 * step-k snapshot (design §3.4). Cells per block (task × replicate): none@L2, none@L3, none@L4, mcp@L2, mcp@L4 (§3.3).
 *
 * Data model. A style has a none@L2 mean μ_k and a negative binomial size θ (variance μ + μ²/θ; θ = ∞ is Poisson),
 * both fitted by moments to the measured step-k values (`STYLE_DATA`). A scenario-wide rate ratio r is the effect of
 * each contrast on the mean:
 *   none@L2 = μ, none@L3 = μr, mcp@L2 = μr, none@L4 = μr, mcp@L4 = μr²
 * so H3 starts from a base already lowered by the spec (none@L4 = none@L3, an assumption: the spec file is taken to
 * lower the level as much as one sentence per rule, no more).
 * Correlation inside a block:
 *   independent  every cell draws its own NB(μ_cell, θ)                          (no pairing benefit; conservative)
 *   shared       one gamma frailty G/θ per block, cells Poisson(μ_cell · G/θ)   (all overdispersion is between blocks;
 *                                                                                 the pairing benefit is maximal)
 * Both give the same NB(μ_cell, θ) marginal; the truth lies between them.
 *
 * Analysis (design §3.5): per hypothesis, block differences d_b = Y_a − Y_b; paired two-sided block-level sign-flip
 * on Σd; exact enumeration when 2^n ≤ 99,999, else 99,999 random flips with p = (1 + hits) / (1 + flips); Holm at
 * α = 0.05 over H1 (none@L2 vs none@L3), H2 (none@L2 vs mcp@L2), H3 (none@L4 vs mcp@L4).
 * In the simulation the exact p is computed by a subset-sum count (identical to enumeration) and, in the random-flip
 * regime, the Monte Carlo hit count is drawn as Binomial(flips, p_exact), which is its exact sampling distribution
 * when flips are drawn independently. `signFlipMcP` is the literal procedure; the tests check the two agree.
 *
 * Drift outcome (`outcome: 'drift'`, s2d-01 §3; the section at the end of this file): D = new blocking identities at
 * steps 2..k from a shared step-1 tree (`RunTrajectory.newPerStep`), cells `CELLS_DRIFT`, hypotheses
 * `HYPOTHESES_DRIFT` with Holm over 2, blocks = tasks × replicates × generators, and the drift record §4 input mode
 * (each generator's pilot-mean lower bound over a θ band). Reading: Docs/v1.4/drift-power-sim.md.
 */
import { createRng } from '../../lib/stats.js';
import type { SeededRng } from '../../lib/stats.js';
import { gamma, holmReject, normal, poisson } from './study2-power.js';

export const FLIPS = 99_999;
export const ALPHA = 0.05;
export const SEED = 20261016;
/** Per step turn, API-equivalent USD, from the loop pilot (design §3.7). */
export const USD_PER_TURN = { low: 0.15, high: 0.42 } as const;

export const CELLS = ['noneL2', 'noneL3', 'noneL4', 'mcpL2', 'mcpL4'] as const;
export type Cell = (typeof CELLS)[number];

export const HYPOTHESES = [
  { id: 'H1', a: 'noneL2', b: 'noneL3', label: 'none@L2 vs none@L3 (SO5, spec level)' },
  { id: 'H2', a: 'noneL2', b: 'mcpL2', label: 'none@L2 vs mcp@L2 (SO3, firewall as deployed)' },
  { id: 'H3', a: 'noneL4', b: 'mcpL4', label: 'none@L4 vs mcp@L4 (SO3, information held constant)' },
] as const satisfies readonly { id: string; a: Cell; b: Cell; label: string }[];
export type HypothesisId = (typeof HYPOTHESES)[number]['id'];

export const SWEEP = {
  tasks: [2, 4, 6],
  replicates: [2, 3, 4],
  k: [4, 6],
  rateRatios: [0.25, 0.5, 0.75],
} as const;

/** none@L2 means for the collapse curve (toward the floor). */
export const COLLAPSE_MEANS = [5.33, 4, 3, 2, 1.5, 1, 0.5, 0.25, 0.1, 0] as const;

// ── Measured data ───────────────────────────────────────────────────────────

/** One none-arm run: distinct blocking edges per step, steps 1..n. */
export interface RunTrajectory {
  readonly task: string;
  readonly edgesPerStep: readonly number[];
  /** Drift outcome: new distinct blocking identities per step, steps 1..n (step 1 never counts in D). */
  readonly newPerStep?: readonly number[];
}

export interface StyleData {
  readonly id: string;
  readonly label: string;
  readonly source: string;
  readonly runs: readonly RunTrajectory[];
}

/**
 * Distinct (file, target) blocking edges per step, recomputed from the blockingFindings of each step JSON.
 * Floor probe 1: results/v1.3-floor-probe/<task>/none/step-NN.json (Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md;
 * one Claude session by hand, Layered preset before the §3.6 composition-slot repair). Raw counts 4/3/6 at step 1 dedup to
 * 2/2/4, as the design states. "Repaired" removes the presentation → persistence edges (the server file wiring stores,
 * which the composition slot of design §3.6 takes out of scope); it does not settle Q2 (type-only edges).
 * Zero: loop pilot (origin/v1.3-pilot-run experiments/loop-pilot/run-2026-10-16/analysis/steps.json, none arm, Clean
 * market-vendors and Hexagonal shelter-adoptions, reevalBlocking 0 at every step) and floor probe 3 (#227, Hexagonal
 * repair-cafe and Clean school-bus, 0 at every step); Sonnet 5.5 in the loop harness.
 */
export const STYLE_DATA: readonly StyleData[] = [
  {
    id: 'layered-measured',
    label: 'Layered, as measured (probe 1)',
    source: 'floor probe 1, none arm, presets/layered.yaml as merged',
    runs: [
      { task: 'market-vendors', edgesPerStep: [2, 2, 2, 3] },
      { task: 'youth-league', edgesPerStep: [2, 4, 4, 4, 4] },
      { task: 'hive-health', edgesPerStep: [4, 7, 9, 9, 9] },
    ],
  },
  {
    id: 'layered-repaired',
    label: 'Layered, composition-root edges removed (probe 1)',
    source: 'floor probe 1, none arm, presentation -> persistence edges dropped (design §3.6 repair)',
    runs: [
      { task: 'market-vendors', edgesPerStep: [2, 2, 2, 3] },
      { task: 'youth-league', edgesPerStep: [1, 1, 1, 1, 1] },
      { task: 'hive-health', edgesPerStep: [2, 3, 4, 4, 4] },
    ],
  },
  {
    id: 'zero',
    label: 'Clean / Hexagonal (loop pilot + probe 3)',
    source: 'loop pilot none arm (2 scored runs) and floor probe 3 (2 runs), Sonnet 5.5, k = 4',
    runs: [
      { task: 'pilot market-vendors (Clean)', edgesPerStep: [0, 0, 0, 0] },
      { task: 'pilot shelter-adoptions (Hexagonal)', edgesPerStep: [0, 0, 0, 0] },
      { task: 'probe3 repair-cafe (Hexagonal)', edgesPerStep: [0, 0, 0, 0] },
      { task: 'probe3 school-bus (Clean)', edgesPerStep: [0, 0, 0, 0] },
    ],
  },
];

export type Extrapolation = 'locf' | 'linear';

/**
 * Mean per-step increment from step 3 on (after the step-1/2 set-up the probes describe), pooled over runs.
 */
export function lateIncrement(runs: readonly RunTrajectory[]): number {
  let sum = 0;
  let n = 0;
  for (const r of runs) {
    for (let s = 2; s < r.edgesPerStep.length; s += 1) {
      sum += (r.edgesPerStep[s] ?? 0) - (r.edgesPerStep[s - 1] ?? 0);
      n += 1;
    }
  }
  return n === 0 ? 0 : sum / n;
}

/**
 * Y at step k for one run. Past the last observed step: last value carried forward ('locf', the probes' reading that
 * the level is set early and replicated) or grown by the style's late increment per step ('linear', sensitivity).
 */
export function valueAtStep(run: RunTrajectory, k: number, mode: Extrapolation, increment: number): number {
  const n = run.edgesPerStep.length;
  if (n === 0) throw new Error(`run ${run.task} has no steps`);
  if (k <= n) return run.edgesPerStep[k - 1] ?? 0;
  const last = run.edgesPerStep[n - 1] ?? 0;
  return mode === 'locf' ? last : last + (k - n) * increment;
}

export interface NbFit {
  readonly n: number;
  readonly values: readonly number[];
  readonly mean: number;
  readonly variance: number;
  /** Infinity = Poisson (variance ≤ mean); NaN when the mean is 0 (point mass at 0). */
  readonly theta: number;
}

/** Method-of-moments negative binomial fit (sample variance, n − 1). */
export function fitNb(values: readonly number[]): NbFit {
  const n = values.length;
  if (n < 2) throw new Error('fitNb needs at least 2 values');
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const theta = mean === 0 ? Number.NaN : variance > mean ? (mean * mean) / (variance - mean) : Number.POSITIVE_INFINITY;
  return { n, values, mean, variance, theta };
}

export interface StyleParams {
  readonly id: string;
  readonly label: string;
  readonly k: number;
  readonly mode: Extrapolation;
  readonly fit: NbFit;
}

export function styleParams(style: StyleData, k: number, mode: Extrapolation): StyleParams {
  const inc = lateIncrement(style.runs);
  return { id: style.id, label: style.label, k, mode, fit: fitNb(style.runs.map((r) => valueAtStep(r, k, mode, inc))) };
}

// ── Variates and tests ──────────────────────────────────────────────────────

/** NB(mean, θ) as gamma–Poisson; θ = ∞ is Poisson; mean ≤ 0 gives 0. */
export function nbDraw(rng: SeededRng, mean: number, theta: number): number {
  if (!(mean > 0)) return 0;
  if (!Number.isFinite(theta)) return poisson(rng, mean);
  return poisson(rng, (mean * gamma(rng, theta)) / theta);
}

/** Binomial(n, p): inversion when the expected count of either outcome is small, else a rounded normal. */
export function binomialDraw(rng: SeededRng, n: number, p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return n;
  if (n * p < 30) {
    let k = 0;
    let pmf = Math.pow(1 - p, n);
    let cdf = pmf;
    const u = rng.next();
    while (u > cdf && k < n) {
      pmf *= ((n - k) / (k + 1)) * (p / (1 - p));
      k += 1;
      cdf += pmf;
    }
    return k;
  }
  if (n * (1 - p) < 30) return n - binomialDraw(rng, n, 1 - p);
  const x = Math.round(n * p + Math.sqrt(n * p * (1 - p)) * normal(rng));
  return Math.min(n, Math.max(0, x));
}

function assertIntegers(d: readonly number[]): void {
  for (const x of d) if (!Number.isInteger(x)) throw new Error(`sign-flip: differences must be integers, got ${x}`);
}

/**
 * Exact two-sided sign-flip p for Σd: the share of the 2^n sign vectors with |Σ s_i d_i| ≥ |Σ d_i|. Counted by
 * subset sums (Σ s_i |d_i| = S − 2·(sum of the flipped |d_i|)), which equals full enumeration.
 */
export function signFlipExactP(d: readonly number[]): number {
  assertIntegers(d);
  const n = d.length;
  if (n === 0) return 1;
  const a = d.map((x) => Math.abs(x));
  const total = a.reduce((x, y) => x + y, 0);
  const obs = Math.abs(d.reduce((x, y) => x + y, 0));
  if (obs === 0) return 1;
  let ways = new Float64Array(total + 1);
  ways[0] = 1;
  let reach = 0;
  for (const v of a) {
    const next = new Float64Array(total + 1);
    for (let j = 0; j <= reach; j += 1) {
      const w = ways[j] ?? 0;
      if (w === 0) continue;
      next[j] = (next[j] ?? 0) + w;
      next[j + v] = (next[j + v] ?? 0) + w;
    }
    reach += v;
    ways = next;
  }
  let hits = 0;
  for (let j = 0; j <= total; j += 1) if (Math.abs(total - 2 * j) >= obs) hits += ways[j] ?? 0;
  return hits / 2 ** n;
}

/** The registered Monte Carlo procedure: p = (1 + #{|T*| ≥ |T|}) / (1 + flips). */
export function signFlipMcP(d: readonly number[], flips: number, rng: SeededRng): number {
  assertIntegers(d);
  const obs = Math.abs(d.reduce((x, y) => x + y, 0));
  let hits = 0;
  for (let b = 0; b < flips; b += 1) {
    let s = 0;
    for (const x of d) s += rng.next() < 0.5 ? -x : x;
    if (Math.abs(s) >= obs) hits += 1;
  }
  return (1 + hits) / (1 + flips);
}

/** Exact enumeration when 2^n ≤ flips (it is then the smaller job), else random flips. */
export function usesExact(n: number, flips: number = FLIPS): boolean {
  return 2 ** n <= flips;
}

/** The registered test as run on real data. */
export function signFlipTest(d: readonly number[], rng: SeededRng, flips: number = FLIPS): { p: number; exact: boolean } {
  return usesExact(d.length, flips) ? { p: signFlipExactP(d), exact: true } : { p: signFlipMcP(d, flips, rng), exact: false };
}

/** The same test's p-value, drawn from its exact sampling distribution (fast; used inside the power loop). */
export function signFlipSimP(d: readonly number[], rng: SeededRng, flips: number = FLIPS): number {
  const pe = signFlipExactP(d);
  if (usesExact(d.length, flips)) return pe;
  return (1 + binomialDraw(rng, flips, pe)) / (1 + flips);
}

/** Smallest p the exact test can return with n non-zero blocks (all the same sign). */
export function minAttainableP(n: number): number {
  return n === 0 ? 1 : Math.min(1, 2 / 2 ** n);
}

export { holmReject };

// ── Simulation ──────────────────────────────────────────────────────────────

export type Correlation = 'independent' | 'shared';

export interface CellMeanInput {
  readonly mean: number;
  readonly theta: number;
}

/** Cell means for one block, from the none@L2 mean and the rate ratio. */
export function cellMeans(mu: number, rr: number): Record<Cell, number> {
  return { noneL2: mu, noneL3: mu * rr, noneL4: mu * rr, mcpL2: mu * rr, mcpL4: mu * rr * rr };
}

export function drawBlock(rng: SeededRng, style: CellMeanInput, rr: number, corr: Correlation): Record<Cell, number> {
  const m = cellMeans(style.mean, rr);
  const out = {} as Record<Cell, number>;
  if (corr === 'shared' && Number.isFinite(style.theta) && style.mean > 0) {
    const f = gamma(rng, style.theta) / style.theta;
    for (const c of CELLS) out[c] = poisson(rng, m[c] * f);
  } else {
    for (const c of CELLS) out[c] = nbDraw(rng, m[c], style.theta);
  }
  return out;
}

export interface Grid {
  readonly tasks: number;
  readonly replicates: number;
  readonly k: number;
}

export const blocksOf = (g: Grid): number => g.tasks * g.replicates;
/** Confirmatory step turns: blocks × 5 cells × k. */
export const stepTurnsOf = (g: Grid): number => blocksOf(g) * CELLS.length * g.k;

export interface PowerResult {
  readonly power: Record<HypothesisId, number>;
  /** All three rejected in the same study. */
  readonly all: number;
  readonly sims: number;
}

/** One cell of the sweep. `styles[t % styles.length]` gives task t's style (mixed strata). */
export function simulatePower(
  styles: readonly CellMeanInput[],
  grid: Grid,
  rr: number,
  corr: Correlation,
  sims: number,
  rng: SeededRng,
  flips: number = FLIPS,
): PowerResult {
  if (styles.length === 0) throw new Error('simulatePower: no style');
  const hits: Record<HypothesisId, number> = { H1: 0, H2: 0, H3: 0 };
  let all = 0;
  const n = blocksOf(grid);
  for (let s = 0; s < sims; s += 1) {
    const diffs: number[][] = HYPOTHESES.map(() => []);
    for (let t = 0; t < grid.tasks; t += 1) {
      const style = styles[t % styles.length] as CellMeanInput;
      for (let r = 0; r < grid.replicates; r += 1) {
        const y = drawBlock(rng, style, rr, corr);
        HYPOTHESES.forEach((h, i) => (diffs[i] as number[]).push(y[h.a] - y[h.b]));
      }
    }
    const p = diffs.map((d) => (d.length === n ? signFlipSimP(d, rng, flips) : 1));
    const rej = holmReject(p, ALPHA);
    HYPOTHESES.forEach((h, i) => {
      if (rej[i]) hits[h.id] += 1;
    });
    if (rej.every(Boolean)) all += 1;
  }
  return { power: { H1: hits.H1 / sims, H2: hits.H2 / sims, H3: hits.H3 / sims }, all: all / sims, sims };
}

/** Stable per-cell seed, so each cell's result does not depend on the order cells run in. */
export function cellSeed(base: number, key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (base + h) % 2 ** 31;
}

export interface SweepRow {
  readonly scenario: string;
  readonly corr: Correlation;
  readonly tasks: number;
  readonly replicates: number;
  readonly k: number;
  readonly rr: number;
  readonly blocks: number;
  readonly stepTurns: number;
  readonly exact: boolean;
  readonly minP: number;
  readonly power: Record<HypothesisId, number>;
  readonly all: number;
}

export interface Scenario {
  readonly id: string;
  readonly label: string;
  /** Style params per k (a style may differ at k = 4 and k = 6). */
  readonly stylesAtK: (k: number) => readonly CellMeanInput[];
}

export function runSweep(scenarios: readonly Scenario[], corrs: readonly Correlation[], sims: number, seed: number): SweepRow[] {
  const rows: SweepRow[] = [];
  for (const sc of scenarios)
    for (const corr of corrs)
      for (const k of SWEEP.k)
        for (const tasks of SWEEP.tasks)
          for (const replicates of SWEEP.replicates)
            for (const rr of SWEEP.rateRatios) {
              const grid = { tasks, replicates, k };
              const key = `${sc.id}|${corr}|${tasks}|${replicates}|${k}|${rr}`;
              const res = simulatePower(sc.stylesAtK(k), grid, rr, corr, sims, createRng(cellSeed(seed, key)));
              const n = blocksOf(grid);
              rows.push({
                scenario: sc.id, corr, tasks, replicates, k, rr, blocks: n, stepTurns: stepTurnsOf(grid),
                exact: usesExact(n), minP: minAttainableP(n), power: res.power, all: res.all,
              });
            }
  return rows;
}

export interface CollapseRow {
  readonly mean: number;
  readonly theta: number;
  readonly pZero: number;
  readonly corr: Correlation;
  readonly rr: number;
  readonly grid: Grid;
  readonly power: Record<HypothesisId, number>;
  readonly all: number;
}

/** P(Y = 0) under NB(mean, θ). */
export function nbZeroProb(mean: number, theta: number): number {
  if (!(mean > 0)) return 1;
  if (!Number.isFinite(theta)) return Math.exp(-mean);
  return Math.pow(theta / (theta + mean), theta);
}

export function runCollapse(
  means: readonly number[],
  theta: number,
  grids: readonly Grid[],
  corrs: readonly Correlation[],
  sims: number,
  seed: number,
): CollapseRow[] {
  const rows: CollapseRow[] = [];
  for (const grid of grids)
    for (const corr of corrs)
      for (const rr of SWEEP.rateRatios)
        for (const mean of means) {
          const key = `collapse|${mean}|${theta}|${grid.tasks}|${grid.replicates}|${grid.k}|${corr}|${rr}`;
          const res = simulatePower([{ mean, theta }], grid, rr, corr, sims, createRng(cellSeed(seed, key)));
          rows.push({ mean, theta, pZero: nbZeroProb(mean, theta), corr, rr, grid, power: res.power, all: res.all });
        }
  return rows;
}

/** Smallest grid (by step turns, then blocks, then k) whose power reaches `target` on `pick`; null when none does. */
export function smallestGrid(rows: readonly SweepRow[], pick: (r: SweepRow) => number, target = 0.8): SweepRow | null {
  const ok = rows.filter((r) => pick(r) >= target);
  ok.sort((x, y) => x.stepTurns - y.stepTurns || x.blocks - y.blocks || x.k - y.k || x.tasks - y.tasks);
  return ok[0] ?? null;
}

// ── Rendering ───────────────────────────────────────────────────────────────

const f2 = (x: number): string => x.toFixed(2);
const fTheta = (t: number): string => (Number.isNaN(t) ? 'n/a (all 0)' : Number.isFinite(t) ? t.toFixed(2) : '∞ (Poisson)');

export function renderStyleTable(params: readonly StyleParams[]): string {
  const lines = ['| Style | k | Extrapolation | Y at step k, per run | Mean | Variance | θ (MoM) |', '|---|---|---|---|---|---|---|'];
  for (const p of params)
    lines.push(
      `| ${p.label} | ${p.k} | ${p.mode} | ${p.fit.values.map((v) => (Number.isInteger(v) ? String(v) : v.toFixed(2))).join(', ')} | ${f2(p.fit.mean)} | ${f2(p.fit.variance)} | ${fTheta(p.fit.theta)} |`,
    );
  return lines.join('\n');
}

export function renderSweepTable(rows: readonly SweepRow[], scenario: string, corr: Correlation): string {
  const sel = rows.filter((r) => r.scenario === scenario && r.corr === corr);
  const lines = [
    '| Tasks × reps (blocks) | k | Step turns | Test | RR | H1 | H2 | H3 | All three |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of sel)
    lines.push(
      `| ${r.tasks} × ${r.replicates} (${r.blocks}) | ${r.k} | ${r.stepTurns} | ${r.exact ? 'exact' : 'MC'} | ${r.rr} | ${f2(r.power.H1)} | ${f2(r.power.H2)} | ${f2(r.power.H3)} | ${f2(r.all)} |`,
    );
  return lines.join('\n');
}

export function renderSmallestTable(rows: readonly SweepRow[], scenario: string, corr: Correlation): string {
  const sel = rows.filter((r) => r.scenario === scenario && r.corr === corr);
  const lines = ['| RR | H1 | H2 | H3 | All three |', '|---|---|---|---|---|'];
  const fmt = (r: SweepRow | null, v: (x: SweepRow) => number): string =>
    r === null ? '**none in the sweep**' : `${r.tasks} × ${r.replicates}, k = ${r.k} (${r.stepTurns} turns; ${f2(v(r))})`;
  for (const rr of SWEEP.rateRatios) {
    const at = sel.filter((r) => r.rr === rr);
    const cols = (['H1', 'H2', 'H3'] as const).map((h) => fmt(smallestGrid(at, (r) => r.power[h]), (r) => r.power[h]));
    lines.push(`| ${rr} | ${cols.join(' | ')} | ${fmt(smallestGrid(at, (r) => r.all), (r) => r.all)} |`);
  }
  return lines.join('\n');
}

export function renderCollapseTable(rows: readonly CollapseRow[], grid: Grid, corr: Correlation, rr: number): string {
  const sel = rows.filter(
    (r) => r.corr === corr && r.rr === rr && r.grid.tasks === grid.tasks && r.grid.replicates === grid.replicates && r.grid.k === grid.k,
  );
  const lines = ['| none@L2 mean | P(Y = 0) at none@L2 | H1 | H2 | H3 | All three |', '|---|---|---|---|---|---|'];
  for (const r of sel) lines.push(`| ${r.mean} | ${f2(r.pZero)} | ${f2(r.power.H1)} | ${f2(r.power.H2)} | ${f2(r.power.H3)} | ${f2(r.all)} |`);
  return lines.join('\n');
}

// ── Drift outcome (s2d-01 §3; drift record Docs/v1.4/study2-deviation-2026-10-19-drift.md §4) ─────────────────────

/**
 * Drift D per run: the new distinct blocking identities introduced at steps 2..k (s2d-01 §1),
 * D = Σ_{t=2..k} |E_t \ ∪_{s<t} E_s|, from a shared step-1 tree. Cells per block (task × replicate × generator):
 * none@L2, none@L3, mcp@L2; H1 none@L2 vs none@L3, H2 none@L2 vs mcp@L2; Holm over 2. The cell model, the correlation
 * models and the sign-flip test are the level outcome's, restricted to the three cells.
 */
export type Outcome = 'level' | 'drift';

/** `xs[i]`, or a thrown error for an index out of range (never reached by the callers below). */
function at<T>(xs: readonly T[], i: number): T {
  const v = xs[i];
  if (v === undefined) throw new RangeError(`index ${String(i)} out of range`);
  return v;
}

export const OUTCOMES: readonly Outcome[] = ['level', 'drift'];

/** The drift seed of s2d-01 §3. */
export const DRIFT_SEED = 20261018;

export const CELLS_DRIFT = ['noneL2', 'noneL3', 'mcpL2'] as const;
export type DriftCell = (typeof CELLS_DRIFT)[number];

export const HYPOTHESES_DRIFT = [
  { id: 'H1', a: 'noneL2', b: 'noneL3', label: 'none@L2 vs none@L3 (SO5, one sentence per rule)' },
  { id: 'H2', a: 'noneL2', b: 'mcpL2', label: 'none@L2 vs mcp@L2 (delivery plus checking)' },
] as const satisfies readonly { id: string; a: DriftCell; b: DriftCell; label: string }[];
export type DriftHypothesisId = (typeof HYPOTHESES_DRIFT)[number]['id'];

/** RRs of the drift tables, and the RR the power rule reads (drift record §4: MDE RR ≤ 0.25 only). */
export const DRIFT_RATE_RATIOS = [0.25, 0.5, 0.75] as const;
export const POWER_RULE_RR = 0.25;
export const POWER_RULE_TARGET = 0.8;

/**
 * Probe 1, none arm, new identities per step (step 1 = the step-1 tree's identities, never counted in D). Probe 1
 * removed 0 identities at any none step (s2d-01 §1, recomputed from `results/v1.3-floor-probe/<task>/none/step-NN.json`),
 * so the new count per step is the level increment of `STYLE_DATA` 'layered-measured'.
 */
export const DRIFT_DATA: StyleData = {
  id: 'layered-drift-probe1',
  label: 'Layered drift, probe 1 (Opus by hand; placeholder for the pilot)',
  source: 'floor probe 1, none arm, presets/layered.yaml as merged; new = level increments (0 removals)',
  runs: [
    { task: 'market-vendors', edgesPerStep: [2, 2, 2, 3], newPerStep: [2, 0, 0, 1] },
    { task: 'youth-league', edgesPerStep: [2, 4, 4, 4, 4], newPerStep: [2, 2, 0, 0, 0] },
    { task: 'hive-health', edgesPerStep: [4, 7, 9, 9, 9], newPerStep: [4, 3, 2, 0, 0] },
  ],
};

function newPerStepOf(run: RunTrajectory): readonly number[] {
  if (run.newPerStep === undefined) throw new Error(`run ${run.task} has no newPerStep`);
  return run.newPerStep;
}

/** Mean new identities per step from step 3 on, pooled over runs (the drift analogue of `lateIncrement`). */
export function lateNewIncrement(runs: readonly RunTrajectory[]): number {
  let sum = 0;
  let n = 0;
  for (const r of runs) {
    const nps = newPerStepOf(r);
    for (let s = 2; s < nps.length; s += 1) {
      sum += nps[s] ?? 0;
      n += 1;
    }
  }
  return n === 0 ? 0 : sum / n;
}

/** D at horizon k: Σ newPerStep over steps 2..k; past the last step, 0 new per step ('locf') or the late increment ('linear'). */
export function driftAtStep(run: RunTrajectory, k: number, mode: Extrapolation, increment: number): number {
  const nps = newPerStepOf(run);
  if (nps.length === 0) throw new Error(`run ${run.task} has no steps`);
  if (k < 2) return 0;
  let d = 0;
  for (let s = 1; s < Math.min(k, nps.length); s += 1) d += nps[s] ?? 0;
  if (k > nps.length && mode === 'linear') d += (k - nps.length) * increment;
  return d;
}

export function driftParams(style: StyleData, k: number, mode: Extrapolation): StyleParams {
  const inc = lateNewIncrement(style.runs);
  return { id: style.id, label: style.label, k, mode, fit: fitNb(style.runs.map((r) => driftAtStep(r, k, mode, inc))) };
}

export function cellMeansDrift(mu: number, rr: number): Record<DriftCell, number> {
  return { noneL2: mu, noneL3: mu * rr, mcpL2: mu * rr };
}

/** One block's D per cell. `shared`: one gamma frailty per block (all cells grow from one step-1 tree). */
export function drawBlockDrift(rng: SeededRng, style: CellMeanInput, rr: number, corr: Correlation): Record<DriftCell, number> {
  const m = cellMeansDrift(style.mean, rr);
  const out = {} as Record<DriftCell, number>;
  if (corr === 'shared' && Number.isFinite(style.theta) && style.mean > 0) {
    const f = gamma(rng, style.theta) / style.theta;
    for (const c of CELLS_DRIFT) out[c] = poisson(rng, m[c] * f);
  } else {
    for (const c of CELLS_DRIFT) out[c] = nbDraw(rng, m[c], style.theta);
  }
  return out;
}

export interface DriftGrid {
  readonly tasks: number;
  readonly replicates: number;
  readonly generators: number;
  readonly k: number;
}

export const blocksOfDrift = (g: DriftGrid): number => g.tasks * g.replicates * g.generators;
/** Step turns: per block, step 1 once (shared start) plus 3 cells × (k − 1) steps. */
export const stepTurnsOfDrift = (g: DriftGrid): number => blocksOfDrift(g) * (1 + CELLS_DRIFT.length * (g.k - 1));

export interface DriftPowerResult {
  readonly power: Record<DriftHypothesisId, number>;
  readonly all: number;
  readonly sims: number;
}

/**
 * Power of the drift contrasts. Units are task × generator; unit u = task · generators + generator takes
 * `styles[u % styles.length]`, so per-generator inputs go in as `[gen0, gen1]`.
 */
export function simulateDriftPower(
  styles: readonly CellMeanInput[],
  grid: DriftGrid,
  rr: number,
  corr: Correlation,
  sims: number,
  rng: SeededRng,
  flips: number = FLIPS,
): DriftPowerResult {
  if (styles.length === 0) throw new Error('simulateDriftPower: no style');
  const hits: Record<DriftHypothesisId, number> = { H1: 0, H2: 0 };
  let all = 0;
  const units = grid.tasks * grid.generators;
  const n = blocksOfDrift(grid);
  for (let s = 0; s < sims; s += 1) {
    const diffs: number[][] = HYPOTHESES_DRIFT.map(() => []);
    for (let u = 0; u < units; u += 1) {
      const style = at(styles, u % styles.length);
      for (let r = 0; r < grid.replicates; r += 1) {
        const y = drawBlockDrift(rng, style, rr, corr);
        HYPOTHESES_DRIFT.forEach((h, i) => at(diffs, i).push(y[h.a] - y[h.b]));
      }
    }
    const p = diffs.map((d) => (d.length === n ? signFlipSimP(d, rng, flips) : 1));
    const rej = holmReject(p, ALPHA);
    HYPOTHESES_DRIFT.forEach((h, i) => {
      if (rej[i]) hits[h.id] += 1;
    });
    if (rej.every(Boolean)) all += 1;
  }
  return { power: { H1: hits.H1 / sims, H2: hits.H2 / sims }, all: all / sims, sims };
}

export interface DriftRow {
  readonly label: string;
  readonly mean: number;
  readonly theta: number;
  readonly corr: Correlation;
  readonly grid: DriftGrid;
  readonly rr: number;
  readonly blocks: number;
  readonly stepTurns: number;
  readonly power: Record<DriftHypothesisId, number>;
  readonly all: number;
}

/** One power cell with its own stable seed (`cellSeed`). `mean`/`theta` record the first style's input. */
export function driftRow(
  label: string, styles: readonly CellMeanInput[], grid: DriftGrid, rr: number, corr: Correlation, sims: number, seed: number,
): DriftRow {
  const inputs = styles.map((s) => `${String(s.mean)}:${String(s.theta)}`).join(',');
  const key = ['drift', label, inputs, grid.tasks, grid.replicates, grid.generators, grid.k, corr, rr].map(String).join('|');
  const res = simulateDriftPower(styles, grid, rr, corr, sims, createRng(cellSeed(seed, key)));
  const first = at(styles, 0);
  return {
    label, mean: first.mean, theta: first.theta, corr, grid, rr, blocks: blocksOfDrift(grid), stepTurns: stepTurnsOfDrift(grid), power: res.power, all: res.all,
  };
}

// ── Student t and the pilot lower bound (drift record §4) ───────────────────

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** ln Γ(x), Lanczos (g = 7, n = 9). */
export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const z = x - 1;
  let a = at(LANCZOS, 0);
  const t = z + 7.5;
  for (let i = 1; i < 9; i += 1) a += at(LANCZOS, i) / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Lentz continued fraction of the incomplete beta. */
function betaContinuedFraction(x: number, a: number, b: number): number {
  const tiny = 1e-300;
  const guard = (v: number): number => (Math.abs(v) < tiny ? tiny : v);
  let c = 1;
  let d = 1 / guard(1 - ((a + b) * x) / (a + 1));
  let h = d;
  for (let m = 1; m <= 300; m += 1) {
    const m2 = 2 * m;
    const even = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 / guard(1 + even * d);
    c = guard(1 + even / c);
    h *= d * c;
    const odd = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 / guard(1 + odd * d);
    c = guard(1 + odd / c);
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (front * betaContinuedFraction(x, a, b)) / a : 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

/** Student t CDF with `df` degrees of freedom. */
export function studentTCdf(t: number, df: number): number {
  if (!(df > 0)) throw new Error('studentTCdf: df must be positive');
  const tail = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** Student t quantile (bisection on the CDF). */
export function studentTQuantile(p: number, df: number): number {
  if (!(p > 0 && p < 1)) throw new Error('studentTQuantile: p must be in (0, 1)');
  if (p < 0.5) return -studentTQuantile(1 - p, df);
  let lo = 0;
  let hi = 1;
  while (studentTCdf(hi, df) < p) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-12; i += 1) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface MeanLowerBound {
  readonly n: number;
  readonly mean: number;
  readonly sd: number;
  readonly level: number;
  readonly tQuantile: number;
  /** max(0, mean − t_{level, n−1} · sd / √n). */
  readonly lowerBound: number;
}

/** One-sided t-based lower confidence bound of a mean at `level` (drift record §4: the pilot mean's lower bound). */
export function meanLowerBound(values: readonly number[], level: number): MeanLowerBound {
  const n = values.length;
  if (n < 2) throw new Error('meanLowerBound needs at least 2 values');
  if (!(level > 0.5 && level < 1)) throw new Error('meanLowerBound: level must be in (0.5, 1)');
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const tq = studentTQuantile(level, n - 1);
  return { n, mean, sd, level, tQuantile: tq, lowerBound: Math.max(0, mean - (tq * sd) / Math.sqrt(n)) };
}

/** `1,4,inf` → [1, 4, ∞]. */
export function parseThetaBand(text: string): number[] {
  const parts = text.split(',').map((s) => s.trim().toLowerCase()).filter((s) => s !== '');
  if (parts.length === 0) throw new Error('theta band is empty');
  return parts.map((s) => {
    const v = s === 'inf' || s === 'infinity' || s === '∞' ? Number.POSITIVE_INFINITY : Number(s);
    if (!(v > 0)) throw new Error(`theta band: ${s} is not a positive number or inf`);
    return v;
  });
}

export interface PilotInput {
  /** Per generator, the pilot D of each run (none@L2, k = 5). */
  readonly generators: Readonly<Record<string, readonly number[]>>;
}

export function validatePilot(raw: unknown): PilotInput {
  const g = (raw as { generators?: unknown } | null)?.generators;
  if (typeof g !== 'object' || g === null || Array.isArray(g) || Object.keys(g).length === 0) {
    throw new Error('pilot file: { generators: { <name>: [D, ...] } }');
  }
  for (const [name, v] of Object.entries(g as Record<string, unknown>)) {
    if (!Array.isArray(v) || v.length < 2 || !v.every((x) => Number.isInteger(x) && (x as number) >= 0)) {
      throw new Error(`pilot file: generators.${name} must list at least 2 non-negative integer D values`);
    }
  }
  return raw as PilotInput;
}

export interface PilotVerdict {
  readonly perTheta: readonly { readonly theta: number; readonly power: number }[];
  /** Power ≥ 0.80 at RR 0.25 under independent cells for every θ of the band; otherwise demoted to secondary. */
  readonly keep: boolean;
}

export interface PilotPowerReport {
  readonly level: number;
  readonly band: readonly number[];
  readonly grid: DriftGrid;
  readonly bounds: Readonly<Record<string, MeanLowerBound>>;
  readonly rows: readonly DriftRow[];
  readonly verdict: Readonly<Record<DriftHypothesisId, PilotVerdict>>;
}

/**
 * Drift record §4: power at 32 blocks (4 tasks × 4 replicates × the pilot's generators, k = 5), each generator's
 * input mean being the one-sided lower bound of its pilot mean D, over a θ band, both correlation models.
 */
export function pilotPower(
  pilot: PilotInput, level: number, band: readonly number[], sims: number, seed: number,
  grid: DriftGrid = { tasks: 4, replicates: 4, generators: Object.keys(pilot.generators).length, k: 5 },
): PilotPowerReport {
  const names = Object.keys(pilot.generators);
  const lbs = names.map((n) => meanLowerBound(pilot.generators[n] ?? [], level));
  const bounds: Record<string, MeanLowerBound> = Object.fromEntries(names.map((n, i) => [n, at(lbs, i)]));
  const rows: DriftRow[] = [];
  for (const theta of band)
    for (const corr of ['independent', 'shared'] as const)
      for (const rr of DRIFT_RATE_RATIOS) {
        const styles = lbs.map((b) => ({ mean: b.lowerBound, theta }));
        rows.push(driftRow(`pilot lower bound, θ ${fTheta(theta)}`, styles, grid, rr, corr, sims, seed));
      }
  const rule = rows.filter((r) => r.corr === 'independent' && r.rr === POWER_RULE_RR);
  const verdict = {} as Record<DriftHypothesisId, PilotVerdict>;
  for (const h of HYPOTHESES_DRIFT) {
    const perTheta = band.map((theta, i) => ({ theta, power: at(rule, i).power[h.id] }));
    verdict[h.id] = { perTheta, keep: perTheta.every((x) => x.power >= POWER_RULE_TARGET) };
  }
  return { level, band, grid, bounds, rows, verdict };
}

// ── Drift rendering ─────────────────────────────────────────────────────────

const fm = (x: number): string => (Number.isInteger(x) ? String(x) : x.toFixed(2));

export function renderDriftTable(rows: readonly DriftRow[]): string {
  const lines = [
    '| Input | Mean D | θ | Model | Tasks × reps × generators (blocks) | Step turns | RR | H1 | H2 | Both |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rows) {
    const grid = `${String(r.grid.tasks)} × ${String(r.grid.replicates)} × ${String(r.grid.generators)} (${String(r.blocks)})`;
    lines.push(
      `| ${r.label} | ${fm(r.mean)} | ${fTheta(r.theta)} | ${r.corr} | ${grid} | ${String(r.stepTurns)} | ${String(r.rr)} | ${f2(r.power.H1)} | ${f2(r.power.H2)} | ${f2(r.all)} |`,
    );
  }
  return lines.join('\n');
}

export function renderPilotReport(rep: PilotPowerReport): string {
  const lines = [
    `Lower bound: one-sided ${String(rep.level)} t bound of each generator's pilot mean D, floored at 0.`,
    '',
    '| Generator | n | Mean D | SD | t quantile | Lower bound |',
    '|---|---|---|---|---|---|',
  ];
  for (const [name, b] of Object.entries(rep.bounds))
    lines.push(`| ${name} | ${String(b.n)} |${f2(b.mean)} | ${f2(b.sd)} | ${b.tQuantile.toFixed(4)} | ${f2(b.lowerBound)} |`);
  lines.push('', renderDriftTable(rep.rows), '', `Power rule (RR ${String(POWER_RULE_RR)}, independent cells, every θ of the band ≥ ${String(POWER_RULE_TARGET)}):`, '');
  for (const h of HYPOTHESES_DRIFT) {
    const v = rep.verdict[h.id];
    const per = v.perTheta.map((x) => `θ ${fTheta(x.theta)}: ${f2(x.power)}`).join('; ');
    lines.push(`- ${h.id} ${h.label}: ${per} → **${v.keep ? 'keep as confirmatory' : 'demote to secondary'}**`);
  }
  return lines.join('\n');
}
