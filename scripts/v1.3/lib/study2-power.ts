/**
 * Study 2 power simulation: an INFORMAL DESIGN AID, NOT A PRE-REGISTRATION (Docs/v1.3/study2-outline.md §6,
 * Docs/v1.3/study2-power-notes.md). Every number in `DEFAULT_ASSUMPTIONS` is a working guess; nothing here is binding,
 * hashed or registered, and no sealed task is named or used. Pure; no I/O.
 *
 * Data model, per block (task × model × replicate) and arm (`none`, `gate`, `mcp`), steps s = 1..k:
 *   λ_run = exp(u_task + v_model + w_run)              u, v, w ~ N(0, sd²) on the log scale; u, v shared by the arms
 *   b_task = slopePerStep · exp(g_task)                g ~ N(0, sdSlopeTask²), shared by the arms
 *   r_arm,task = effect_arm + e_arm,task               e ~ N(0, sdEffectTask²) (arm × task interaction); r ≤ 1
 *   μ_s = λ_run · (baseCount + b_task · (1 − r_arm,task) · (s − 1))
 *   Y_s ~ Poisson(μ_s), or negative binomial (gamma–Poisson, size `dispersion`)
 * The fallback outcome (advisory violations per KLOC) replaces μ_s by a density per KLOC times the step's KLOC, which
 * grows linearly with lognormal noise, and scores Y_s / KLOC_s; the arms' effect on it is `advisorySpillover` × the
 * blocking effect (the gate shows blocking findings only).
 *
 * Analysis (the outline's candidate 1): one OLS slope per run; per block, the slope difference arm − none; a paired
 * sign-flip permutation test of the mean difference (two-sided); Holm over the two contrasts (gate vs none, mcp vs
 * none) at α = 0.05. The task-level variant averages the differences within each task first and flips signs per
 * task, which is what clustering by task (outline §5.3) amounts to with few tasks.
 */
import { createRng } from '../../lib/stats.js';
import type { SeededRng } from '../../lib/stats.js';

export const ARMS = ['none', 'gate', 'mcp'] as const;
export type Arm = (typeof ARMS)[number];

export interface PowerAssumptions {
  /** Expected blocking violations at step 1 in `none` (before any erosion). */
  readonly baseCount: number;
  /** Expected new blocking violations per step in `none`. */
  readonly slopePerStep: number;
  readonly sdTask: number;
  readonly sdModel: number;
  readonly sdRun: number;
  readonly sdSlopeTask: number;
  /** Negative binomial size θ (variance μ + μ²/θ); null = Poisson. */
  readonly dispersion: number | null;
  /** Relative reduction of the erosion slope per arm (0.5 halves it). */
  readonly effects: { readonly gate: number; readonly mcp: number };
  /** SD of the reduction across tasks (arm × task interaction). */
  readonly sdEffectTask: number;
  /** Fallback outcome: advisory violations per KLOC at step 1, and added per KLOC per step, in `none`. */
  readonly advisoryBasePerKloc: number;
  readonly advisorySlopePerKloc: number;
  /** Share of the blocking effect that reaches the advisory rules. */
  readonly advisorySpillover: number;
  /** KLOC after step 1, KLOC added per step, lognormal SD of a run's size. */
  readonly kloc0: number;
  readonly klocPerStep: number;
  readonly sdKloc: number;
}

export const DEFAULT_ASSUMPTIONS: PowerAssumptions = {
  baseCount: 1.5,
  slopePerStep: 1.0,
  sdTask: 0.5,
  sdModel: 0.3,
  sdRun: 0.4,
  sdSlopeTask: 0.3,
  dispersion: 2,
  effects: { gate: 0.5, mcp: 0.25 },
  sdEffectTask: 0.15,
  advisoryBasePerKloc: 6,
  advisorySlopePerKloc: 1.0,
  advisorySpillover: 0.5,
  kloc0: 0.6,
  klocPerStep: 0.35,
  sdKloc: 0.25,
};

export interface DesignOption {
  readonly name: string;
  readonly tasks: number;
  readonly models: number;
  readonly replicates: number;
  readonly steps: number;
}

export const DESIGN_OPTIONS: readonly DesignOption[] = [
  { name: 'A: 6 tasks × 2 models × 3 reps, k = 5', tasks: 6, models: 2, replicates: 3, steps: 5 },
  { name: 'B: 6 × 3 × 3, k = 5 (outline working grid)', tasks: 6, models: 3, replicates: 3, steps: 5 },
  { name: 'C: 6 × 3 × 5, k = 5', tasks: 6, models: 3, replicates: 5, steps: 5 },
  { name: 'D: 6 × 3 × 3, k = 4', tasks: 6, models: 3, replicates: 3, steps: 4 },
  { name: 'E: 6 × 3 × 3, k = 6', tasks: 6, models: 3, replicates: 3, steps: 6 },
  { name: 'F: 12 × 3 × 2, k = 5 (hypothetical: 6 tasks beyond the sealed list)', tasks: 12, models: 3, replicates: 2, steps: 5 },
];

export type Outcome = 'blocking' | 'advisory-per-kloc';
export type Analysis = 'block' | 'task';

// ── Random variates ───────────────────────────────────────────────────────────

export function normal(rng: SeededRng): number {
  let u = 0;
  while (u === 0) u = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

/** Gamma(shape, scale 1), Marsaglia–Tsang (shape < 1 by the boost). */
export function gamma(rng: SeededRng, shape: number): number {
  if (shape < 1) return gamma(rng, shape + 1) * Math.pow(Math.max(rng.next(), 1e-300), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng.next();
    if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function poisson(rng: SeededRng, lambda: number): number {
  if (!(lambda > 0)) return 0;
  if (lambda > 200) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal(rng)));
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng.next();
  } while (p > l);
  return k - 1;
}

export function count(rng: SeededRng, mean: number, dispersion: number | null): number {
  if (dispersion === null) return poisson(rng, mean);
  return poisson(rng, (mean * gamma(rng, dispersion)) / dispersion);
}

// ── One simulated study ───────────────────────────────────────────────────────

export function olsSlope(y: readonly number[]): number {
  const k = y.length;
  const xm = (k + 1) / 2;
  const ym = y.reduce((a, b) => a + b, 0) / k;
  let num = 0;
  let den = 0;
  y.forEach((v, i) => {
    num += (i + 1 - xm) * (v - ym);
    den += (i + 1 - xm) ** 2;
  });
  return den === 0 ? 0 : num / den;
}

export interface BlockDiffs {
  readonly task: number;
  readonly gate: number;
  readonly mcp: number;
}

/** One study's per-block slope differences (arm − none). */
export function simulateStudy(design: DesignOption, a: PowerAssumptions, outcome: Outcome, rng: SeededRng): BlockDiffs[] {
  const tasks = Array.from({ length: design.tasks }, () => ({
    u: a.sdTask * normal(rng),
    g: a.sdSlopeTask * normal(rng),
    e: { gate: a.sdEffectTask * normal(rng), mcp: a.sdEffectTask * normal(rng) },
  }));
  const models = Array.from({ length: design.models }, () => a.sdModel * normal(rng));
  const out: BlockDiffs[] = [];
  tasks.forEach((t, ti) => {
    for (const v of models) {
      for (let r = 0; r < design.replicates; r += 1) {
        const slopes: Record<Arm, number> = { none: 0, gate: 0, mcp: 0 };
        for (const arm of ARMS) {
          const lambda = Math.exp(t.u + v + a.sdRun * normal(rng));
          const red = arm === 'none' ? 0 : Math.min(1, a.effects[arm] + t.e[arm]);
          const y: number[] = [];
          if (outcome === 'blocking') {
            const b = a.slopePerStep * Math.exp(t.g);
            for (let s = 1; s <= design.steps; s += 1) y.push(count(rng, lambda * Math.max(0, a.baseCount + b * (1 - red) * (s - 1)), a.dispersion));
          } else {
            const b = a.advisorySlopePerKloc * Math.exp(t.g);
            const size = Math.exp(a.sdKloc * normal(rng));
            for (let s = 1; s <= design.steps; s += 1) {
              const kloc = (a.kloc0 + a.klocPerStep * (s - 1)) * size;
              const density = lambda * Math.max(0, a.advisoryBasePerKloc + b * (1 - red * a.advisorySpillover) * (s - 1));
              y.push(count(rng, density * kloc, a.dispersion) / kloc);
            }
          }
          slopes[arm] = olsSlope(y);
        }
        out.push({ task: ti, gate: slopes.gate - slopes.none, mcp: slopes.mcp - slopes.none });
      }
    }
  });
  return out;
}

/** Two-sided sign-flip p-value of the mean of `d` (exact up to 2^14 patterns, else `flips` Monte Carlo flips). */
export function signFlipP(d: readonly number[], flips: number, rng: SeededRng): number {
  const n = d.length;
  if (n === 0) return 1;
  const obs = Math.abs(d.reduce((x, y) => x + y, 0));
  const eps = 1e-12 * (1 + obs);
  if (n <= 14) {
    let hits = 0;
    const total = 2 ** n;
    for (let m = 0; m < total; m += 1) {
      let s = 0;
      for (let i = 0; i < n; i += 1) s += (m >> i) & 1 ? -(d[i] ?? 0) : d[i] ?? 0;
      if (Math.abs(s) >= obs - eps) hits += 1;
    }
    return hits / total;
  }
  let hits = 1;
  for (let b = 0; b < flips; b += 1) {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += rng.next() < 0.5 ? -(d[i] ?? 0) : d[i] ?? 0;
    if (Math.abs(s) >= obs - eps) hits += 1;
  }
  return hits / (flips + 1);
}

/** Holm at level α over p-values; returns which are rejected. */
export function holmReject(p: readonly number[], alpha = 0.05): boolean[] {
  const order = p.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]);
  const out = p.map(() => false);
  for (let j = 0; j < order.length; j += 1) {
    const entry = order[j];
    if (entry === undefined) break;
    const [v, i] = entry;
    if (v <= alpha / (order.length - j)) out[i] = true;
    else break;
  }
  return out;
}

const taskMeans = (d: readonly BlockDiffs[], arm: 'gate' | 'mcp', tasks: number): number[] =>
  Array.from({ length: tasks }, (_, t) => {
    const xs = d.filter((x) => x.task === t).map((x) => x[arm]);
    return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  });

// ── Power ─────────────────────────────────────────────────────────────────────

export interface PowerCell {
  readonly design: string;
  readonly blocks: number;
  readonly runs: number;
  readonly stepTurns: number;
  readonly outcome: Outcome;
  readonly analysis: Analysis;
  readonly effects: { readonly gate: number; readonly mcp: number };
  readonly sims: number;
  /** Holm-rejection rates. */
  readonly powerGate: number;
  readonly powerMcp: number;
  readonly powerAny: number;
  /** Monte Carlo standard error of a power near 0.5 (the widest). */
  readonly mcSe: number;
  /** Mean over simulations of |d_z|, the standardised within-block difference (gate − none), and the outline's normal approximation of power from it (z = 2.24, Holm's first step). */
  readonly meanDzGate: number;
  readonly approxPowerGate: number;
  /** Smallest attainable two-sided p of the analysis (task level: 2 / 2^tasks). */
  readonly minP: number;
}

function phi(x: number): number {
  // Abramowitz–Stegun 7.1.26 via erf.
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export interface PowerOptions {
  readonly sims: number;
  readonly flips: number;
  readonly seed: number;
  readonly alpha?: number;
}

export function power(design: DesignOption, a: PowerAssumptions, outcome: Outcome, analysis: Analysis, o: PowerOptions): PowerCell {
  const rng = createRng(o.seed);
  const alpha = o.alpha ?? 0.05;
  let g = 0;
  let m = 0;
  let any = 0;
  let dzSum = 0;
  for (let i = 0; i < o.sims; i += 1) {
    const d = simulateStudy(design, a, outcome, rng);
    const dg = analysis === 'block' ? d.map((x) => x.gate) : taskMeans(d, 'gate', design.tasks);
    const dm = analysis === 'block' ? d.map((x) => x.mcp) : taskMeans(d, 'mcp', design.tasks);
    const [rg, rm] = holmReject([signFlipP(dg, o.flips, rng), signFlipP(dm, o.flips, rng)], alpha);
    if (rg === true) g += 1;
    if (rm === true) m += 1;
    if (rg === true || rm === true) any += 1;
    const bg = d.map((x) => x.gate);
    const mean = bg.reduce((x, y) => x + y, 0) / bg.length;
    const sd = Math.sqrt(bg.reduce((x, y) => x + (y - mean) ** 2, 0) / Math.max(1, bg.length - 1));
    dzSum += sd > 0 ? Math.abs(mean) / sd : 0;
  }
  const blocks = design.tasks * design.models * design.replicates;
  const meanDz = dzSum / o.sims;
  return {
    design: design.name, blocks, runs: blocks * ARMS.length, stepTurns: blocks * ARMS.length * design.steps, outcome, analysis,
    effects: a.effects, sims: o.sims, powerGate: g / o.sims, powerMcp: m / o.sims, powerAny: any / o.sims,
    mcSe: 0.5 / Math.sqrt(o.sims), meanDzGate: meanDz,
    approxPowerGate: phi(meanDz * Math.sqrt(blocks) - 2.2414),
    minP: analysis === 'task' ? 2 / 2 ** design.tasks : 2 / 2 ** Math.min(blocks, 52),
  };
}

export interface PowerGrid {
  readonly note: string;
  readonly assumptions: PowerAssumptions;
  readonly options: PowerOptions;
  readonly cells: readonly PowerCell[];
  readonly sensitivity: readonly { readonly label: string; readonly outcome: Outcome; readonly cell: PowerCell }[];
}

export const EFFECT_GRID: readonly { gate: number; mcp: number }[] = [
  { gate: 0, mcp: 0 },
  { gate: 0.2, mcp: 0.1 },
  { gate: 0.35, mcp: 0.2 },
  { gate: 0.5, mcp: 0.25 },
  { gate: 0.5, mcp: 0.5 },
];

export function powerGrid(a: PowerAssumptions, o: PowerOptions, designs: readonly DesignOption[] = DESIGN_OPTIONS, effects = EFFECT_GRID): PowerGrid {
  const cells: PowerCell[] = [];
  let seed = o.seed;
  for (const d of designs) {
    for (const e of effects) {
      for (const outcome of ['blocking', 'advisory-per-kloc'] as const) {
        for (const analysis of ['block', 'task'] as const) {
          seed += 1;
          cells.push(power(d, { ...a, effects: e }, outcome, analysis, { ...o, seed }));
        }
      }
    }
  }
  // Sensitivity of the working grid (B, gate halves the slope) to the variance assumptions, block analysis.
  const b = designs.find((d) => d.name.startsWith('B')) ?? designs[0];
  const sens: { label: string; a: PowerAssumptions; outcome: Outcome }[] = [
    { label: 'Poisson counts (no overdispersion)', a: { ...a, dispersion: null }, outcome: 'blocking' },
    { label: 'Strong overdispersion (θ = 0.8)', a: { ...a, dispersion: 0.8 }, outcome: 'blocking' },
    { label: 'No arm × task interaction (sdEffectTask = 0)', a: { ...a, sdEffectTask: 0 }, outcome: 'blocking' },
    { label: 'Large arm × task interaction (sdEffectTask = 0.35)', a: { ...a, sdEffectTask: 0.35 }, outcome: 'blocking' },
    { label: 'Slow erosion (slopePerStep = 0.5)', a: { ...a, slopePerStep: 0.5 }, outcome: 'blocking' },
    { label: 'Fast erosion (slopePerStep = 2)', a: { ...a, slopePerStep: 2 }, outcome: 'blocking' },
    { label: 'Noisy runs (sdRun = 0.7)', a: { ...a, sdRun: 0.7 }, outcome: 'blocking' },
    { label: 'Advisory: full spillover (advisorySpillover = 1)', a: { ...a, advisorySpillover: 1 }, outcome: 'advisory-per-kloc' },
    { label: 'Advisory: steep erosion (3 per KLOC per step) and full spillover', a: { ...a, advisorySlopePerKloc: 3, advisorySpillover: 1 }, outcome: 'advisory-per-kloc' },
  ];
  const sensitivity = b === undefined ? [] : sens.map((x) => {
    seed += 1;
    return { label: x.label, outcome: x.outcome, cell: power(b, { ...x.a, effects: { gate: 0.5, mcp: 0.25 } }, x.outcome, 'block', { ...o, seed }) };
  });
  return { note: 'Informal design aid, not a pre-registration (Docs/v1.3/study2-power-notes.md).', assumptions: a, options: o, cells, sensitivity };
}

const p2 = (x: number): string => x.toFixed(2);

export function renderAssumptions(a: PowerAssumptions): string[] {
  return [
    `- Blocking violations at step 1 (arm none): mean ${String(a.baseCount)}; new blocking violations per step: mean ${String(a.slopePerStep)}.`,
    `- Log-scale heterogeneity (SD): task ${String(a.sdTask)}, model ${String(a.sdModel)}, run ${String(a.sdRun)}; task slope ${String(a.sdSlopeTask)}.`,
    `- Counts: ${a.dispersion === null ? 'Poisson' : `negative binomial, size θ = ${String(a.dispersion)} (variance μ + μ²/θ)`}.`,
    `- Effect: relative reduction of the erosion slope per arm (grid below); arm × task interaction SD ${String(a.sdEffectTask)}.`,
    `- Fallback outcome: advisory violations per KLOC, ${String(a.advisoryBasePerKloc)} at step 1 plus ${String(a.advisorySlopePerKloc)} per step; size ${String(a.kloc0)} KLOC after step 1 plus ${String(a.klocPerStep)} KLOC per step (lognormal SD ${String(a.sdKloc)}); the arms reach the advisory rules at ${String(a.advisorySpillover)} × the blocking effect.`,
  ];
}

export function renderPowerMarkdown(g: PowerGrid): string {
  const out = ['# Study 2 power simulation (informal design aid, not a pre-registration)', '', `Seed ${String(g.options.seed)}, ${String(g.options.sims)} simulated studies per cell, ${String(g.options.flips)} sign flips where not exact. Holm over the two contrasts at α = 0.05 (two-sided). Monte Carlo SE of a power estimate ≤ ${p2(0.5 / Math.sqrt(g.options.sims))}.`, '', '## Assumptions', '', ...renderAssumptions(g.assumptions), ''];
  for (const outcome of ['blocking', 'advisory-per-kloc'] as const) {
    out.push(`## Outcome: ${outcome === 'blocking' ? 'erosion slope of blocking violations' : 'fallback: advisory violations per KLOC, slope'}`, '');
    out.push('| Design | Blocks | Runs | Step turns | Effect gate / mcp | Power gate (block) | Power mcp (block) | Power any (block) | Mean abs. d_z gate | Normal approx. | Power gate (task-level) | Min p (task-level) |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
    const block = g.cells.filter((c) => c.outcome === outcome && c.analysis === 'block');
    for (const c of block) {
      const t = g.cells.find((x) => x.outcome === outcome && x.analysis === 'task' && x.design === c.design && x.effects.gate === c.effects.gate && x.effects.mcp === c.effects.mcp);
      out.push(`| ${c.design} | ${String(c.blocks)} | ${String(c.runs)} | ${String(c.stepTurns)} | ${String(c.effects.gate)} / ${String(c.effects.mcp)} | ${p2(c.powerGate)} | ${p2(c.powerMcp)} | ${p2(c.powerAny)} | ${p2(c.meanDzGate)} | ${p2(c.approxPowerGate)} | ${t === undefined ? 'n/a' : p2(t.powerGate)} | ${t === undefined ? '' : t.minP.toFixed(3)} |`);
    }
    out.push('');
  }
  out.push('## Sensitivity (design B, gate halves the slope, mcp quarters it; block analysis)', '', '| Assumption changed | Outcome | Power gate | Power mcp | Mean abs. d_z gate |', '|---|---|---|---|---|');
  for (const s of g.sensitivity) out.push(`| ${s.label} | ${s.outcome} | ${p2(s.cell.powerGate)} | ${p2(s.cell.powerMcp)} | ${p2(s.cell.meanDzGate)} |`);
  return out.join('\n') + '\n';
}
