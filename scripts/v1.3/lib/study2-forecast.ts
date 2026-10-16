/**
 * Study 2 budget forecaster (tooling, not a pre-registration): per-call bootstrap over committed E1 generations,
 * the gate fire rate from the floor probe, and a lane scheduler with 5-hour usage windows and the E1 pause policy.
 * Model and pass criterion: Docs/v1.3/study2-forecast.md. Reads no task file: tasks and steps are plan numbers.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRng, quantileSorted, shuffle } from '../../lib/stats.js';
import type { SeededRng } from '../../lib/stats.js';
import { parseCsv } from '../../lib/figures/draw.js';

export const WINDOW_MS = 5 * 3600 * 1000;
/** Generator protocol §8: pause until the reported reset plus 60 s. */
export const PAUSE_SLACK_MS = 60 * 1000;

/** One observed model call: an E1 generation. `costUsd` is null when the route has no metered cost (Codex). */
export interface TurnSample {
  readonly modelId: string;
  readonly adapterId: string;
  readonly costUsd: number | null;
  readonly durationMs: number;
  readonly agentTurns: number;
}

export interface Telemetry {
  readonly turns: readonly TurnSample[];
  /** Per-scoring overhead samples (E1 `total_ms`). */
  readonly evalMs: readonly number[];
  /** Gate-like step outcomes (true = a blocking finding before the fix). */
  readonly fireGate: readonly boolean[];
  /** Step outcomes with no feedback (the floor probe `none` arm). */
  readonly fireNone: readonly boolean[];
  /** Agent-proof wall seconds per turn (cross-check only). */
  readonly agentProofWallS: readonly number[];
  readonly sources: readonly string[];
}

export interface ForecastPlan {
  readonly description: string;
  readonly adapters: readonly { readonly adapterId: string; readonly modelId: string }[];
  readonly arms: readonly string[];
  readonly runs: number;
  readonly tasks: number;
  readonly stepsPerTask: number;
}

export interface ForecastOptions {
  readonly draws: number;
  readonly seed: number;
  readonly lanes: readonly number[];
  /** USD API-equivalent per 5-hour window per adapter account; absent = unbounded (windows spanned). */
  readonly windowUsd: Readonly<Record<string, number>>;
  readonly repairScale: number;
  readonly mcpScale: number;
  readonly fireSource: 'gate' | 'none';
}

export const DEFAULT_OPTIONS: ForecastOptions = {
  draws: 2000, seed: 20261016, lanes: [1, 2], windowUsd: {}, repairScale: 1, mcpScale: 1, fireSource: 'gate',
};

// ---------------------------------------------------------------------------------------------------------- loading

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Refuses any path into the sealed store (standard rule 2). */
export function assertNotSealed(p: string): void {
  if (path.resolve(p).split(path.sep).includes('daedalus-sealed')) throw new Error(`refusing to read a sealed path: ${p}`);
}

export function parseE1Runs(csvText: string): TurnSample[] {
  return parseCsv(csvText).rows.filter((r) => r.cell !== undefined && r.cell !== '').map((r) => {
    const c = JSON.parse(r.cell ?? '{}') as Record<string, unknown>;
    const cost = c.totalCostUsd;
    return {
      modelId: String(c.resolvedModelId ?? c.requestedModelId),
      adapterId: String(c.adapterId),
      costUsd: typeof cost === 'number' ? cost : null,
      durationMs: Number(c.generationDurationMs),
      agentTurns: Number(c.numTurns),
    };
  });
}

export function parseE1Latency(csvText: string): number[] {
  const byRun = new Map<string, number>();
  for (const r of parseCsv(csvText).rows) if (r.run_id && !byRun.has(r.run_id)) byRun.set(r.run_id, Number(r.total_ms));
  return [...byRun.values()].filter((v) => Number.isFinite(v));
}

export function parseFloorProbe(raw: unknown): { gate: boolean[]; none: boolean[] } {
  const gate: boolean[] = [];
  const none: boolean[] = [];
  const tasks = isRecord(raw) && Array.isArray(raw.tasks) ? raw.tasks : [];
  for (const t of tasks) {
    for (const s of isRecord(t) && Array.isArray(t.steps) ? t.steps : []) {
      if (!isRecord(s)) continue;
      if (isRecord(s.toolPre) && typeof s.toolPre.blocking === 'number') gate.push(s.toolPre.blocking > 0);
      if (isRecord(s.none) && typeof s.none.blocking === 'number') none.push(s.none.blocking > 0);
    }
  }
  return { gate, none };
}

export function parseAgentProofMeta(text: string): number | null {
  const m = /wall=(\d+)s/.exec(text);
  return m ? Number(m[1]) : null;
}

/** Scans telemetry directories for the known layouts (see the doc §1). */
export function loadTelemetry(dirs: readonly string[]): Telemetry {
  const turns: TurnSample[] = [];
  const evalMs: number[] = [];
  const fireGate: boolean[] = [];
  const fireNone: boolean[] = [];
  const agentProofWallS: number[] = [];
  const sources: string[] = [];
  for (const dir of dirs) {
    assertNotSealed(dir);
    const runs = path.join(dir, 'agg', 'runs.csv');
    if (fs.existsSync(runs)) {
      turns.push(...parseE1Runs(fs.readFileSync(runs, 'utf8')));
      sources.push(runs);
      const lat = path.join(dir, 'agg', 'latency.csv');
      if (fs.existsSync(lat)) { evalMs.push(...parseE1Latency(fs.readFileSync(lat, 'utf8'))); sources.push(lat); }
    }
    const summary = path.join(dir, 'summary.json');
    if (fs.existsSync(summary)) {
      const fp = parseFloorProbe(JSON.parse(fs.readFileSync(summary, 'utf8')));
      if (fp.gate.length + fp.none.length > 0) { fireGate.push(...fp.gate); fireNone.push(...fp.none); sources.push(summary); }
    }
    const tr = path.join(dir, 'transcripts');
    if (fs.existsSync(tr)) {
      for (const f of fs.readdirSync(tr).filter((n) => n.endsWith('.meta')).sort()) {
        const w = parseAgentProofMeta(fs.readFileSync(path.join(tr, f), 'utf8'));
        if (w !== null) agentProofWallS.push(w);
      }
      if (agentProofWallS.length > 0) sources.push(tr);
    }
  }
  return { turns, evalMs, fireGate, fireNone, agentProofWallS, sources };
}

export function validateForecastPlan(raw: unknown): ForecastPlan {
  if (!isRecord(raw)) throw new Error('the plan must be a JSON object');
  const f = isRecord(raw.forecast) ? raw.forecast : undefined;
  if (f === undefined) throw new Error('the plan needs a "forecast" block { tasks, stepsPerTask } (no task file is read)');
  const posInt = (v: unknown, name: string): number => {
    if (!Number.isInteger(v) || (v as number) < 1) throw new Error(`${name} must be a positive integer`);
    return v as number;
  };
  if (!Array.isArray(raw.adapters) || raw.adapters.length === 0) throw new Error('adapters must be a non-empty array');
  const adapters = raw.adapters.map((a) => {
    if (!isRecord(a) || typeof a.adapterId !== 'string' || typeof a.modelId !== 'string') throw new Error('an adapter is { adapterId, modelId }');
    return { adapterId: a.adapterId, modelId: a.modelId };
  });
  if (!Array.isArray(raw.arms) || raw.arms.length === 0 || !raw.arms.every((a) => typeof a === 'string')) throw new Error('arms must be a non-empty string array');
  return {
    description: typeof raw.description === 'string' ? raw.description : '',
    adapters,
    arms: raw.arms as string[],
    runs: posInt(raw.runs, 'runs'),
    tasks: posInt(f.tasks, 'forecast.tasks'),
    stepsPerTask: posInt(f.stepsPerTask, 'forecast.stepsPerTask'),
  };
}

// ------------------------------------------------------------------------------------------------------- simulation

interface Call { readonly costUsd: number | null; readonly ms: number; readonly agentTurns: number; readonly repair: boolean }
interface RunSeq { readonly arm: string; readonly modelId: string; readonly account: string; readonly calls: Call[] }

export interface Percentiles { readonly p10: number; readonly p50: number; readonly p90: number }

export interface ArmRow {
  readonly arm: string;
  readonly stepCalls: number;
  readonly repairCalls: Percentiles;
  readonly agentTurns: Percentiles;
  /** null when no draw has a metered cost. */
  readonly usd: Percentiles | null;
  readonly modelHours: Percentiles;
}

export interface WallRow { readonly lanes: number; readonly wallHours: Percentiles; readonly windows: Readonly<Record<string, Percentiles>> }

export interface Forecast {
  readonly plan: ForecastPlan;
  readonly options: ForecastOptions;
  readonly fireRate: Percentiles;
  readonly evalMsPerScoring: number;
  readonly arms: readonly ArmRow[];
  readonly total: ArmRow;
  readonly wall: readonly WallRow[];
  readonly pools: Readonly<Record<string, number>>;
  readonly assumptions: readonly string[];
}

export function percentiles(xs: readonly number[]): Percentiles {
  const s = [...xs].sort((a, b) => a - b);
  return { p10: quantileSorted(s, 0.1), p50: quantileSorted(s, 0.5), p90: quantileSorted(s, 0.9) };
}

const median = (xs: readonly number[]): number => quantileSorted([...xs].sort((a, b) => a - b), 0.5);
const pick = <T>(xs: readonly T[], rng: SeededRng): T => xs[rng.int(xs.length)] as T;

/**
 * Lane scheduler: runs go, in order, to the earliest free lane; a run's calls are sequential. Lanes on one account
 * share a window. A window opens at the first call after the previous one ended; a call that would exceed the
 * capacity pauses its lane until window end + 60 s, which opens the next window. Returns wall ms and windows opened.
 */
export function schedule(runs: readonly RunSeq[], lanes: number, windowUsd: Readonly<Record<string, number>>): { wallMs: number; windows: Record<string, number> } {
  const laneClock = new Array<number>(lanes).fill(0);
  const acct = new Map<string, { start: number; used: number; count: number }>();
  let next = 0;
  // Per lane: the run it is working on and the call index.
  const cur: ({ run: RunSeq; i: number } | null)[] = new Array(lanes).fill(null);
  for (;;) {
    for (let l = 0; l < lanes; l += 1) if (cur[l] === null && next < runs.length) cur[l] = { run: runs[next++] as RunSeq, i: 0 };
    let l = -1;
    for (let j = 0; j < lanes; j += 1) if (cur[j] !== null && (l < 0 || (laneClock[j] as number) < (laneClock[l] as number))) l = j;
    if (l < 0) break;
    const slot = cur[l] as { run: RunSeq; i: number };
    const call = slot.run.calls[slot.i] as Call;
    const cap = windowUsd[slot.run.account];
    let t = laneClock[l] as number;
    let w = acct.get(slot.run.account);
    if (w !== undefined && t < w.start) t = w.start; // the old window was exhausted by another lane
    if (w === undefined || t >= w.start + WINDOW_MS) {
      w = { start: t, used: 0, count: (w?.count ?? 0) + 1 };
      acct.set(slot.run.account, w);
    } else if (cap !== undefined && w.used > 0 && w.used + (call.costUsd ?? 0) > cap) {
      t = w.start + WINDOW_MS + PAUSE_SLACK_MS;
      w = { start: t, used: 0, count: w.count + 1 };
      acct.set(slot.run.account, w);
    }
    w.used += call.costUsd ?? 0;
    laneClock[l] = t + call.ms;
    slot.i += 1;
    if (slot.i >= slot.run.calls.length) cur[l] = null;
  }
  const windows: Record<string, number> = {};
  for (const [k, v] of acct) windows[k] = v.count;
  return { wallMs: Math.max(0, ...laneClock), windows };
}

export function forecast(plan: ForecastPlan, tel: Telemetry, options: ForecastOptions = DEFAULT_OPTIONS): Forecast {
  const pools = new Map<string, TurnSample[]>();
  for (const a of plan.adapters) {
    const pool = tel.turns.filter((t) => t.modelId === a.modelId && Number.isFinite(t.durationMs));
    if (pool.length === 0) throw new Error(`no telemetry turn for model ${a.modelId}`);
    pools.set(a.modelId, pool);
  }
  const fireObs = options.fireSource === 'gate' ? tel.fireGate : tel.fireNone;
  if (plan.arms.includes('gate') && fireObs.length === 0) throw new Error('the gate arm needs floor-probe step outcomes');
  const evalMs = tel.evalMs.length > 0 ? median(tel.evalMs) : 0;
  const rng = createRng(options.seed);
  const stepsPerRun = plan.stepsPerTask;

  const perArm = new Map<string, { repair: number[]; turns: number[]; usd: number[]; usdSeen: boolean; ms: number[] }>();
  for (const arm of [...plan.arms, '__total']) perArm.set(arm, { repair: [], turns: [], usd: [], usdSeen: false, ms: [] });
  const fireDraws: number[] = [];
  const wallDraws = new Map<number, { wall: number[]; windows: Map<string, number[]> }>();
  for (const l of options.lanes) wallDraws.set(l, { wall: [], windows: new Map() });

  for (let b = 0; b < options.draws; b += 1) {
    let fires = 0;
    for (let i = 0; i < fireObs.length; i += 1) if (pick(fireObs, rng)) fires += 1;
    const p = fireObs.length > 0 ? fires / fireObs.length : 0;
    fireDraws.push(p);
    const acc = new Map<string, { repair: number; turns: number; usd: number; usdSeen: boolean; ms: number }>();
    for (const arm of [...plan.arms, '__total']) acc.set(arm, { repair: 0, turns: 0, usd: 0, usdSeen: false, ms: 0 });
    const runs: RunSeq[] = [];
    // Block order as the loop schedule: run index, adapter, task, then every arm of the block.
    for (let r = 0; r < plan.runs; r += 1) {
      for (const a of plan.adapters) {
        const pool = pools.get(a.modelId) as TurnSample[];
        for (let t = 0; t < plan.tasks; t += 1) {
          for (const arm of plan.arms) {
            const calls: Call[] = [];
            const scale = arm === 'daedalus-mcp' ? options.mcpScale : 1;
            for (let s = 0; s < stepsPerRun; s += 1) {
              const d = pick(pool, rng);
              const fired = arm === 'gate' && rng.next() < p;
              calls.push({ costUsd: d.costUsd === null ? null : d.costUsd * scale, ms: d.durationMs * scale + evalMs, agentTurns: d.agentTurns * scale, repair: false });
              if (fired) {
                const e = pick(pool, rng);
                const k = options.repairScale;
                calls.push({ costUsd: e.costUsd === null ? null : e.costUsd * k, ms: e.durationMs * k + evalMs, agentTurns: e.agentTurns * k, repair: true });
              }
            }
            for (const key of [arm, '__total']) {
              const x = acc.get(key) as { repair: number; turns: number; usd: number; usdSeen: boolean; ms: number };
              for (const c of calls) {
                if (c.repair) x.repair += 1;
                x.turns += c.agentTurns;
                x.ms += c.ms - evalMs;
                if (c.costUsd !== null) { x.usd += c.costUsd; x.usdSeen = true; }
              }
            }
            runs.push({ arm, modelId: a.modelId, account: a.adapterId, calls });
          }
        }
      }
    }
    for (const [key, x] of acc) {
      const y = perArm.get(key) as { repair: number[]; turns: number[]; usd: number[]; usdSeen: boolean; ms: number[] };
      y.repair.push(x.repair); y.turns.push(x.turns); y.ms.push(x.ms);
      if (x.usdSeen) { y.usd.push(x.usd); y.usdSeen = true; }
    }
    for (const l of options.lanes) {
      const s = schedule(runs, l, options.windowUsd);
      const wd = wallDraws.get(l) as { wall: number[]; windows: Map<string, number[]> };
      wd.wall.push(s.wallMs / 3_600_000);
      for (const [k, v] of Object.entries(s.windows)) {
        if (!wd.windows.has(k)) wd.windows.set(k, []);
        (wd.windows.get(k) as number[]).push(v);
      }
    }
  }

  const row = (arm: string, stepCalls: number): ArmRow => {
    const y = perArm.get(arm) as { repair: number[]; turns: number[]; usd: number[]; usdSeen: boolean; ms: number[] };
    return {
      arm, stepCalls, repairCalls: percentiles(y.repair), agentTurns: percentiles(y.turns),
      usd: y.usdSeen ? percentiles(y.usd) : null, modelHours: percentiles(y.ms.map((m) => m / 3_600_000)),
    };
  };
  const stepCallsPerArm = plan.runs * plan.adapters.length * plan.tasks * stepsPerRun;
  const fireName = options.fireSource === 'gate' ? 'floor-probe tool-arm pre-fix steps' : 'floor-probe none-arm steps';
  const assumptions = [
    'Each step turn and each repair turn draws one E1 generation of the same model id (cost, duration, agent turns jointly).',
    `Repair turns cost repairScale = ${options.repairScale} of a step turn; daedalus-mcp turns cost mcpScale = ${options.mcpScale}.`,
    `Gate fire rate resampled from ${fireObs.length} ${fireName}.`,
    `Evaluator overhead per scoring: median E1 total_ms = ${Math.round(evalMs)} ms; a fired gate step is scored twice.`,
    'Lanes on one adapter share one account window; a window opens at the first call after the previous one ended.',
    `Window capacity (USD API-equivalent per 5 h): ${Object.keys(options.windowUsd).length === 0 ? 'unbounded (windows spanned only)' : JSON.stringify(options.windowUsd)}; hypothetical, calls per window are unmeasured.`,
    'A capped call pauses its lane until window end + 60 s (generator protocol §8). Interrupted-call waste is not modelled.',
    'Tokens: n/a (E1 envelopes with modelUsage are not committed). Codex has no metered USD.',
    'Infrastructure retries, failed-typecheck reruns and the self-review placebo arm are not modelled.',
  ];
  const windowsOut = (l: number): Record<string, Percentiles> => {
    const out: Record<string, Percentiles> = {};
    for (const [k, v] of (wallDraws.get(l) as { windows: Map<string, number[]> }).windows) out[k] = percentiles(v);
    return out;
  };
  return {
    plan, options,
    fireRate: percentiles(fireDraws),
    evalMsPerScoring: evalMs,
    arms: plan.arms.map((a) => row(a, stepCallsPerArm)),
    total: row('__total', stepCallsPerArm * plan.arms.length),
    wall: options.lanes.map((l) => ({ lanes: l, wallHours: percentiles((wallDraws.get(l) as { wall: number[] }).wall), windows: windowsOut(l) })),
    pools: Object.fromEntries([...pools].map(([k, v]) => [k, v.length])),
    assumptions,
  };
}

// --------------------------------------------------------------------------------------------------------- back-test

export interface BacktestRow { readonly label: string; readonly actual: number; readonly forecast: Percentiles; readonly relErr: number; readonly inBand: boolean }
export interface Backtest { readonly seed: number; readonly rows: readonly BacktestRow[]; readonly pass: boolean; readonly robustPassShare: number; readonly robustSplits: number }

/** Splits each model's turns in two (seeded shuffle), forecasts the held-out half's totals from the training half. */
export function backtestOnce(turns: readonly TurnSample[], seed: number, draws: number): BacktestRow[] {
  const rng = createRng(seed);
  const models = [...new Set(turns.map((t) => t.modelId))].sort();
  const train = new Map<string, TurnSample[]>();
  const test = new Map<string, TurnSample[]>();
  for (const m of models) {
    const s = shuffle(turns.filter((t) => t.modelId === m), rng);
    const h = Math.ceil(s.length / 2);
    train.set(m, s.slice(0, h));
    test.set(m, s.slice(h));
  }
  const simTotals = (sel: (t: TurnSample) => number | null, ms: readonly string[]): number[] => {
    const out: number[] = [];
    for (let b = 0; b < draws; b += 1) {
      let sum = 0;
      for (const m of ms) {
        const tr = train.get(m) as TurnSample[];
        const n = (test.get(m) as TurnSample[]).length;
        for (let i = 0; i < n; i += 1) sum += sel(pick(tr, rng)) ?? 0;
      }
      out.push(sum);
    }
    return out;
  };
  const actual = (sel: (t: TurnSample) => number | null, ms: readonly string[]): number =>
    ms.reduce((a, m) => a + (test.get(m) as TurnSample[]).reduce((b, t) => b + (sel(t) ?? 0), 0), 0);
  const mk = (label: string, sel: (t: TurnSample) => number | null, ms: readonly string[]): BacktestRow => {
    const f = percentiles(simTotals(sel, ms));
    const a = actual(sel, ms);
    return { label, actual: a, forecast: f, relErr: (f.p50 - a) / a, inBand: a >= f.p10 && a <= f.p90 };
  };
  const costed = models.filter((m) => turns.some((t) => t.modelId === m && t.costUsd !== null));
  const rows = [
    mk('USD (Claude pooled)', (t) => t.costUsd, costed),
    mk('generation hours (all pooled)', (t) => t.durationMs / 3_600_000, models),
  ];
  for (const m of models) {
    if (costed.includes(m)) rows.push(mk(`USD ${m}`, (t) => t.costUsd, [m]));
    rows.push(mk(`generation hours ${m}`, (t) => t.durationMs / 3_600_000, [m]));
  }
  return rows;
}

export function backtest(turns: readonly TurnSample[], seed: number, draws: number, robustSplits: number): Backtest {
  const rows = backtestOnce(turns, seed, draws);
  const passOf = (rs: readonly BacktestRow[]): boolean => rs.slice(0, 2).every((r) => Math.abs(r.relErr) <= 0.2);
  let ok = 0;
  for (let i = 1; i <= robustSplits; i += 1) if (passOf(backtestOnce(turns, seed + i, Math.min(draws, 400)))) ok += 1;
  return { seed, rows, pass: passOf(rows), robustPassShare: robustSplits > 0 ? ok / robustSplits : 0, robustSplits };
}

// ------------------------------------------------------------------------------------------------------- rendering

const f1 = (x: number): string => x.toFixed(1);
const f0 = (x: number): string => Math.round(x).toLocaleString('en-US');
const usd = (x: number): string => `$${x < 100 ? x.toFixed(2) : f0(x)}`;
const band = (p: Percentiles, fmt: (x: number) => string): string => `${fmt(p.p50)} (${fmt(p.p10)}–${fmt(p.p90)})`;

export function renderForecastMarkdown(fc: Forecast, title: string): string {
  const L: string[] = [];
  const p = fc.plan;
  L.push(`### ${title}`, '');
  L.push(`${p.tasks} tasks × ${p.stepsPerTask} steps × ${p.runs} runs × ${p.adapters.length} models (${p.adapters.map((a) => a.modelId).join(', ')}) × ${p.arms.length} arms (${p.arms.join(', ')}). Bootstrap draws ${fc.options.draws}, seed ${fc.options.seed}. Gate fire rate ${band(fc.fireRate, (x) => `${(x * 100).toFixed(0)}%`)}. Pools: ${Object.entries(fc.pools).map(([k, v]) => `${k} n=${v}`).join(', ')}.`, '');
  L.push('Cells: P50 (P10–P90).', '');
  L.push('| Arm | Step calls | Repair calls | CLI agent turns | Tokens | USD (API-equiv., metered models only) | Model hours |', '|---|---|---|---|---|---|---|');
  for (const r of [...fc.arms, fc.total]) {
    L.push(`| ${r.arm === '__total' ? '**total**' : r.arm} | ${f0(r.stepCalls)} | ${band(r.repairCalls, f0)} | ${band(r.agentTurns, f0)} | n/a | ${r.usd ? band(r.usd, usd) : 'n/a'} | ${band(r.modelHours, f1)} |`);
  }
  L.push('', '| Lanes | Wall hours (incl. pauses) | Wall days (P50) | 5-hour windows per account |', '|---|---|---|---|');
  for (const w of fc.wall) {
    L.push(`| ${w.lanes} | ${band(w.wallHours, f1)} | ${(w.wallHours.p50 / 24).toFixed(1)} | ${Object.entries(w.windows).map(([k, v]) => `${k}: ${band(v, f0)}`).join('; ')} |`);
  }
  L.push('');
  return L.join('\n');
}

export function renderBacktestMarkdown(bt: Backtest): string {
  const L = ['| Quantity (held-out half) | Actual | Forecast P50 (P10–P90) | Error of P50 | Actual in [P10, P90] |', '|---|---|---|---|---|'];
  for (const r of bt.rows) {
    const fmt = r.label.startsWith('USD') ? usd : (x: number): string => x.toFixed(2);
    L.push(`| ${r.label} | ${fmt(r.actual)} | ${band(r.forecast, fmt)} | ${(r.relErr * 100).toFixed(1)}% | ${r.inBand ? 'yes' : 'no'} |`);
  }
  L.push('', `**Pass (pre-declared split, seed ${bt.seed}): ${bt.pass ? 'yes' : 'no'}** (the first two rows within ±20 %). Robustness: ${(bt.robustPassShare * 100).toFixed(0)}% of ${bt.robustSplits} further random splits pass.`);
  return L.join('\n');
}
