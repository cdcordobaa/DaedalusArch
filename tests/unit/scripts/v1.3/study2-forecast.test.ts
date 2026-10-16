/**
 * Study 2 budget forecaster (tooling): telemetry parsers, the sealed-path guard, the plan validator, the lane
 * scheduler with usage windows and pauses, and the bootstrap's totals on a known pool.
 */
import * as path from 'node:path';
import {
  PAUSE_SLACK_MS, WINDOW_MS, assertNotSealed, backtestOnce, forecast, loadTelemetry, parseAgentProofMeta, parseE1Runs,
  parseFloorProbe, schedule, validateForecastPlan,
} from '../../../../scripts/v1.3/lib/study2-forecast.js';
import type { Telemetry, TurnSample } from '../../../../scripts/v1.3/lib/study2-forecast.js';

const H = 3_600_000;
const call = (costUsd: number | null, ms: number) => ({ costUsd, ms, agentTurns: 1, repair: false });
const run = (account: string, calls: ReturnType<typeof call>[]) => ({ arm: 'none', modelId: 'm', account, calls });

describe('telemetry parsers', () => {
  it('reads the E1 cell column, with null cost for unmetered routes', () => {
    const cell = (o: object): string => `"${JSON.stringify(o).replace(/"/g, '""')}"`;
    const csv = [
      'run_id,cell,seed',
      `a,${cell({ resolvedModelId: 'x', adapterId: 'claude-code-cli', totalCostUsd: 0.5, generationDurationMs: 1000, numTurns: 3 })},`,
      `b,${cell({ resolvedModelId: 'y', adapterId: 'codex-cli', generationDurationMs: 2000, numTurns: 4 })},`,
    ].join('\n');
    expect(parseE1Runs(csv)).toEqual([
      { modelId: 'x', adapterId: 'claude-code-cli', costUsd: 0.5, durationMs: 1000, agentTurns: 3 },
      { modelId: 'y', adapterId: 'codex-cli', costUsd: null, durationMs: 2000, agentTurns: 4 },
    ]);
  });

  it('reads floor-probe step outcomes and agent-proof walls', () => {
    const fp = parseFloorProbe({ tasks: [{ steps: [{ none: { blocking: 2 }, toolPre: { blocking: 0 } }, { none: { blocking: 0 }, toolPre: { blocking: 1 } }] }] });
    expect(fp).toEqual({ gate: [false, true], none: [true, false] });
    expect(parseAgentProofMeta('agent exit=0 wall=116s\ntsc exit=0')).toBe(116);
    expect(parseAgentProofMeta('nothing')).toBeNull();
  });

  it('loads the committed E1 and floor-probe telemetry', () => {
    const root = path.resolve(__dirname, '../../../..');
    const tel = loadTelemetry([path.join(root, 'results/e1-grid'), path.join(root, 'results/v1.3-floor-probe')]);
    expect(tel.turns).toHaveLength(72);
    expect(tel.fireGate).toHaveLength(28);
    expect(tel.fireNone).toHaveLength(28);
    expect(tel.evalMs.length).toBeGreaterThan(0);
  });

  it('refuses sealed paths', () => {
    expect(() => assertNotSealed('../daedalus-sealed/tasks.json')).toThrow(/sealed/);
    expect(() => assertNotSealed('results/e1-grid')).not.toThrow();
  });
});

describe('plan', () => {
  const base = { adapters: [{ adapterId: 'claude-code-cli', modelId: 'm' }], arms: ['none'], runs: 2 };
  it('needs a forecast block with counts', () => {
    expect(() => validateForecastPlan(base)).toThrow(/forecast/);
    expect(validateForecastPlan({ ...base, forecast: { tasks: 3, stepsPerTask: 4 } })).toMatchObject({ tasks: 3, stepsPerTask: 4, runs: 2 });
    expect(() => validateForecastPlan({ ...base, forecast: { tasks: 0, stepsPerTask: 4 } })).toThrow(/tasks/);
  });
});

describe('schedule', () => {
  it('runs sequentially on one lane and in parallel on two', () => {
    const runs = [run('a', [call(0, H), call(0, H)]), run('a', [call(0, H), call(0, H)])];
    expect(schedule(runs, 1, {}).wallMs).toBe(4 * H);
    expect(schedule(runs, 2, {}).wallMs).toBe(2 * H);
  });

  it('counts the windows a run spans when unbounded', () => {
    const runs = [run('a', Array.from({ length: 12 }, () => call(1, H)))];
    // windows open at 0, 5 h, 10 h
    expect(schedule(runs, 1, {}).windows).toEqual({ a: 3 });
  });

  it('pauses until window end + 60 s when the capacity would be exceeded', () => {
    const runs = [run('a', [call(6, H), call(6, H)])];
    const s = schedule(runs, 1, { a: 10 });
    expect(s.wallMs).toBe(WINDOW_MS + PAUSE_SLACK_MS + H);
    expect(s.windows).toEqual({ a: 2 });
  });

  it('keeps accounts apart', () => {
    const runs = [run('a', [call(6, H), call(6, H)]), run('b', [call(6, H)])];
    const s = schedule(runs, 2, { a: 10 });
    expect(s.windows).toEqual({ a: 2, b: 1 });
  });

  it('a lane behind an exhausted window waits for the new window', () => {
    const runs = [run('a', [call(9, 10 * 60_000), call(9, H)]), run('a', [call(0.5, 3 * H), call(9, H)])];
    const s = schedule(runs, 2, { a: 10 });
    expect(s.windows.a).toBeGreaterThanOrEqual(2);
    expect(s.wallMs).toBeGreaterThan(WINDOW_MS);
  });
});

describe('forecast', () => {
  const pool: TurnSample[] = [{ modelId: 'm', adapterId: 'claude-code-cli', costUsd: 1, durationMs: H, agentTurns: 10 }];
  const tel: Telemetry = { turns: pool, evalMs: [0], fireGate: [true, false], fireNone: [true], agentProofWallS: [], sources: [] };
  const plan = { description: '', adapters: [{ adapterId: 'claude-code-cli', modelId: 'm' }], arms: ['none', 'gate'], runs: 1, tasks: 2, stepsPerTask: 3 };
  const opts = { draws: 200, seed: 1, lanes: [1], windowUsd: {}, repairScale: 1, mcpScale: 1, fireSource: 'gate' as const };

  it('totals a constant pool exactly for the none arm and bounds the gate arm', () => {
    const fc = forecast(plan, tel, opts);
    const none = fc.arms.find((a) => a.arm === 'none');
    expect(none?.stepCalls).toBe(6);
    expect(none?.usd).toEqual({ p10: 6, p50: 6, p90: 6 });
    expect(none?.agentTurns.p50).toBe(60);
    const gate = fc.arms.find((a) => a.arm === 'gate');
    expect(gate?.repairCalls.p10).toBeGreaterThanOrEqual(0);
    expect(gate?.repairCalls.p90).toBeLessThanOrEqual(6);
    expect(gate?.usd?.p50).toBeGreaterThan(6);
    expect(fc.wall[0]?.wallHours.p10).toBeGreaterThanOrEqual(12);
  });

  it('is deterministic for a seed and fails without a pool for a model', () => {
    expect(forecast(plan, tel, opts)).toEqual(forecast(plan, tel, opts));
    expect(() => forecast({ ...plan, adapters: [{ adapterId: 'x', modelId: 'other' }] }, tel, opts)).toThrow(/other/);
  });

  it('fire source none uses the none-arm outcomes', () => {
    const fc = forecast(plan, tel, { ...opts, fireSource: 'none' });
    expect(fc.fireRate.p50).toBe(1);
    expect(fc.arms.find((a) => a.arm === 'gate')?.repairCalls.p50).toBe(6);
  });
});

describe('back-test', () => {
  it('is exact on a constant pool', () => {
    const turns: TurnSample[] = Array.from({ length: 10 }, () => ({ modelId: 'm', adapterId: 'a', costUsd: 2, durationMs: H, agentTurns: 1 }));
    const rows = backtestOnce(turns, 7, 50);
    expect(rows[0]?.relErr).toBe(0);
    expect(rows[1]?.actual).toBe(5);
  });
});
