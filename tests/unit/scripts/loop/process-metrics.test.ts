/**
 * Per-step process metrics from the MCP call logs (Docs/v1.3/mcp-call-log.md): computed by hand on a fake log written
 * by a stub agent; absent when the option is off or the arm is not daedalus-mcp.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { withCallLogArg, withCodexMcpServer } from '../../../../scripts/lib/loop/agents.js';
import { runDirFor, runLoop } from '../../../../scripts/lib/loop/loop.js';
import { loopRunId } from '../../../../scripts/lib/loop/plan.js';
import { callLogPathFor, nearestRank, stepProcess } from '../../../../scripts/lib/loop/process-metrics.js';
import type { LoopArm, StepAgent, StepRecord, TurnInput } from '../../../../scripts/lib/loop/types.js';
import { context, spec, stubAgent, tmpRoot } from './helpers.js';

let out: string;
beforeEach(() => {
  out = tmpRoot('loop-calls-');
});
afterEach(() => {
  fs.rmSync(out, { recursive: true, force: true });
});

function line(ts: string, tool: string, durationMs: number, over: Record<string, unknown> = {}): string {
  return JSON.stringify({ schema: 'mcp-call/v1', ts, seq: 1, tool, argsSha256: 'x', filesTouched: [], blockingCount: null, verdict: null, durationMs, error: null, treeChangedSinceStart: false, ...over });
}

/** The stub agent plus a fake MCP server: writes `lines(input)` to the turn's call-log path when it has one. */
function loggingAgent(lines: (input: TurnInput) => readonly string[], seen: TurnInput[] = []): StepAgent {
  const inner = stubAgent();
  return {
    adapterId: inner.adapterId,
    modelId: inner.modelId,
    runTurn: async (input) => {
      seen.push(input);
      if (input.callLogPath !== undefined) {
        fs.mkdirSync(path.dirname(input.callLogPath), { recursive: true });
        fs.writeFileSync(input.callLogPath, lines(input).map((l) => `${l}\n`).join(''));
      }
      return inner.runTurn(input);
    },
  };
}

async function steps(arm: LoopArm, agent: StepAgent, callLog: boolean): Promise<readonly StepRecord[]> {
  const r = await runLoop(context(out, agent, callLog ? { callLog: true } : {}), spec(arm));
  if (!r.success || r.data.kind !== 'completed') throw new Error('expected a completed run');
  return r.data.steps;
}

describe('process metrics', () => {
  it('nearest-rank percentiles', () => {
    expect(nearestRank([], 50)).toBeNull();
    expect(nearestRank([40], 95)).toBe(40);
    expect(nearestRank([10, 30, 20, 40], 50)).toBe(20);
    expect(nearestRank([10, 30, 20, 40], 95)).toBe(40);
    expect(nearestRank([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], 95)).toBe(19);
  });

  it('daedalus-mcp with the option: a log path outside the cwd per turn and a process block computed by hand', async () => {
    const seen: TurnInput[] = [];
    const agent = loggingAgent(
      (input) =>
        input.stepIndex === 0
          ? [line('2026-10-16T00:00:01.000Z', 'get_architecture_spec', 10), line('2026-10-16T00:00:02.000Z', 'check_file', 30, { treeChangedSinceStart: true }), line('2026-10-16T00:00:03.000Z', 'check_file', 20, { error: 'boom' }), line('2026-10-16T00:00:04.000Z', 'check_diff', 40)]
          : input.stepIndex === 1
            ? [line('2026-10-16T00:01:00.000Z', 'check_diff', 7, { treeChangedSinceStart: true })]
            : [],
      seen,
    );
    const records = await steps('daedalus-mcp', agent, true);
    const runDir = runDirFor(out, loopRunId(spec('daedalus-mcp')));
    expect(seen.map((s) => s.callLogPath)).toEqual(['step-01', 'step-02', 'step-03'].map((t) => callLogPathFor(runDir, t)));
    for (const s of seen) expect(path.relative(s.cwd, s.callLogPath ?? '').startsWith('..')).toBe(true);
    expect(records[0]?.process).toEqual({
      schema: 'loop-process/v1',
      logs: ['calls/step-01.jsonl'],
      logFound: true,
      calls: 4,
      errors: 1,
      callsByTool: { check_diff: 1, check_file: 2, get_architecture_spec: 1 },
      firstCallAt: '2026-10-16T00:00:01.000Z',
      firstCallBeforeFirstWrite: true,
      firstWriteEvidence: 'server-fingerprint',
      latencyMs: { p50: 20, p95: 40 },
    });
    expect(records[1]?.process).toMatchObject({ calls: 1, firstCallBeforeFirstWrite: false, latencyMs: { p50: 7, p95: 7 } });
    // A server that ran but got no call: an empty log, zero calls, order undetermined.
    expect(records[2]?.process).toMatchObject({ logFound: true, calls: 0, callsByTool: {}, firstCallAt: null, firstCallBeforeFirstWrite: null, firstWriteEvidence: 'none', latencyMs: { p50: null, p95: null } });
  });

  it('no process block and no log path without the option, or in another arm', async () => {
    const seen: TurnInput[] = [];
    const agent = loggingAgent(() => [line('2026-10-16T00:00:01.000Z', 'check_file', 1)], seen);
    for (const r of await steps('daedalus-mcp', agent, false)) expect('process' in r).toBe(false);
    fs.rmSync(out, { recursive: true, force: true });
    out = tmpRoot('loop-calls-');
    for (const r of await steps('gate', agent, true)) expect('process' in r).toBe(false);
    expect(seen.every((s) => s.callLogPath === undefined)).toBe(true);
    expect(fs.existsSync(path.join(runDirFor(out, loopRunId(spec('gate'))), 'calls'))).toBe(false);
  });

  it('mtime fallback: a first call after the earliest write is "after"; before it stays undetermined', () => {
    const runDir = tmpRoot('loop-proc-');
    const log = callLogPathFor(runDir, 'step-01');
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.writeFileSync(log, `${line('2026-10-16T00:00:10.000Z', 'check_file', 3, { treeChangedSinceStart: null })}\n{torn`);
    const bound = Date.parse('2026-10-16T00:00:05.000Z');
    expect(stepProcess(runDir, [{ logPath: log, firstWriteBoundMs: bound }])).toMatchObject({ calls: 1, firstCallBeforeFirstWrite: false, firstWriteEvidence: 'mtime-upper-bound' });
    expect(stepProcess(runDir, [{ logPath: log, firstWriteBoundMs: bound + 60_000 }])).toMatchObject({ firstCallBeforeFirstWrite: null, firstWriteEvidence: 'mtime-upper-bound' });
    expect(stepProcess(runDir, [{ logPath: path.join(runDir, 'missing.jsonl'), firstWriteBoundMs: null }])).toMatchObject({ logs: [], logFound: false, calls: 0 });
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  it('the agents pass --call-log to the server only when the turn has a path', () => {
    const config = { mcpServers: { 'daedalus-arch': { type: 'stdio', command: '/n', args: ['/e', '--spec', '/s'], env: {} } } };
    expect(withCallLogArg(config, undefined)).toBe(config);
    expect(withCallLogArg(config, '/h/calls/step-01.jsonl')).toEqual({ mcpServers: { 'daedalus-arch': { ...config.mcpServers['daedalus-arch'], args: ['/e', '--spec', '/s', '--call-log', '/h/calls/step-01.jsonl'] } } });
    expect(withCallLogArg(null, '/h/x.jsonl')).toBeNull();
    const input = { nodeBinary: '/n', serverEntry: '/e', specPath: '/s' };
    expect(withCodexMcpServer(['exec', '-'], input, '/w')).toEqual(withCodexMcpServer(['exec', '-'], input, '/w', undefined));
    expect(withCodexMcpServer(['exec', '-'], input, '/w', '/h/c.jsonl')).toContain('mcp_servers.daedalus-arch.args=["/e","--spec","/s","--project","/w","--call-log","/h/c.jsonl"]');
  });
});
