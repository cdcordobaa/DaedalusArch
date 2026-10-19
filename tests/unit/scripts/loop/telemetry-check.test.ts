/**
 * Gate D6 completeness checker (`scripts/lib/loop/telemetry-check.ts`) on dry-run loop out-roots written by the stub
 * agent: a complete store passes; each missing piece is reported.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runDirFor, runLoop } from '../../../../scripts/lib/loop/loop.js';
import { loopRunId } from '../../../../scripts/lib/loop/plan.js';
import { callLineProblems, checkTelemetry } from '../../../../scripts/lib/loop/telemetry-check.js';
import type { LoopArm, StepAgent, StepRecord } from '../../../../scripts/lib/loop/types.js';
import { context, spec, stubAgent, tmpRoot } from './helpers.js';

let out: string;
beforeEach(() => {
  out = tmpRoot('loop-telemetry-');
});
afterEach(() => {
  fs.rmSync(out, { recursive: true, force: true });
});

/** A clock whose last reading the fake MCP server stamps its lines with (so they fall inside the step window). */
function clock(): { now: () => Date; last: () => string } {
  let t = Date.parse('2026-01-01T00:00:00Z');
  return { now: () => new Date((t += 1000)), last: () => new Date(t).toISOString() };
}

function line(ts: string, tool: string, over: Record<string, unknown> = {}): string {
  return JSON.stringify({ schema: 'mcp-call/v1', ts, seq: 1, tool, argsSha256: 'ab', filesTouched: [], blockingCount: null, verdict: null, durationMs: 3, error: null, treeChangedSinceStart: false, ...over });
}

function loggingAgent(last: () => string, tool = 'get_architecture_spec', extra: Record<string, unknown> = {}): StepAgent {
  const inner = stubAgent();
  return {
    adapterId: inner.adapterId,
    modelId: inner.modelId,
    runTurn: async (input) => {
      if (input.callLogPath !== undefined) {
        fs.mkdirSync(path.dirname(input.callLogPath), { recursive: true });
        fs.writeFileSync(input.callLogPath, `${line(last(), tool, extra)}\n`);
      }
      return inner.runTurn(input);
    },
  };
}

async function run(arm: LoopArm, agent?: StepAgent, callLog = false, c = clock()): Promise<string> {
  const r = await runLoop(context(out, agent ?? loggingAgent(c.last), { now: c.now, ...(callLog ? { callLog: true } : {}) }), spec(arm));
  if (!r.success || r.data.kind !== 'completed') throw new Error('expected a completed run');
  return runDirFor(out, loopRunId(spec(arm)));
}

describe('loop telemetry check (D6)', () => {
  it('a complete dry-run store passes for none, gate and daedalus-mcp (with the call log)', async () => {
    await run('none');
    await run('gate');
    await run('daedalus-mcp', undefined, true);
    const r = checkTelemetry(out);
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.runs).toBe(3);
    expect(r.mcpCalls).toBe(3);
  });

  it('a daedalus-mcp run without the call log is reported', async () => {
    await run('daedalus-mcp');
    const r = checkTelemetry(out);
    expect(r.ok).toBe(false);
    expect(r.problems.map((p) => p.problem)).toEqual(
      expect.arrayContaining(['daedalus-mcp run was not created with the call log (--call-log)', 'daedalus-mcp step has no process block', 'call log missing']),
    );
  });

  it('a denied or unknown tool, and a line outside the step window, are reported', async () => {
    const c = clock();
    await run('daedalus-mcp', loggingAgent(c.last, 'evaluate_project'), true, c);
    expect(checkTelemetry(out).problems.some((p) => p.problem.endsWith('denied tool evaluate_project was called'))).toBe(true);
    const w = { startMs: Date.parse('2026-01-01T00:00:00Z'), endMs: Date.parse('2026-01-01T00:00:10Z') };
    expect(callLineProblems(line('2026-01-01T00:00:05Z', 'which_layer'), w)).toEqual([]);
    expect(callLineProblems(line('2026-01-01T00:00:05Z', 'Bash'), w)).toEqual(['tool Bash is not an allowed arm tool']);
    expect(callLineProblems(line('2026-01-02T00:00:00Z', 'which_layer'), w)[0]).toMatch(/outside the step window/);
    expect(callLineProblems('{"schema":"x"}', w)).toEqual(['call-log line is not mcp-call/v1']);
  });

  it('null usage, a missing prompt text and an interruption without its pause are reported', async () => {
    const dir = await run('none');
    const file = path.join(dir, 'steps', 'step-01.json');
    const rec = JSON.parse(fs.readFileSync(file, 'utf8')) as StepRecord;
    const t = rec.turns[0];
    if (t === undefined) throw new Error('no turn');
    const broken = {
      ...rec,
      turns: [{ ...t, result: { ...t.result, usage: { ...t.result.usage, cacheReadTokens: null }, interruptions: [{ at: rec.startedAt, subtype: 'usage-limit', movedTo: 'x' }] } }],
    };
    fs.writeFileSync(file, JSON.stringify(broken));
    fs.rmSync(path.join(dir, 'turns', 'step-02', 'prompt-step-02.txt'));
    const problems = checkTelemetry(out).problems.map((p) => `${p.step ?? ''} ${p.problem}`);
    expect(problems).toEqual(['step-01 usage.cacheReadTokens is null', 'step-01 interruption 0 has no pause duration (S1)', 'step-02 prompt text missing']);
  });

  it('an empty out-root and an incomplete run are reported', () => {
    expect(checkTelemetry(out).ok).toBe(false);
    const dir = path.join(out, 'runs', 'a', 'run-0');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({ schema: 'loop-run/v1', runId: 'a/run-0', spec: { arm: 'none' }, steps: 1 }));
    expect(checkTelemetry(out).problems.map((p) => p.problem)).toEqual(['run not completed']);
    expect(checkTelemetry(out, { allowIncomplete: true }).ok).toBe(true);
  });
});
