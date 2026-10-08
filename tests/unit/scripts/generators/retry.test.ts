/**
 * Retries, usage limits and timeouts (U5a plan Step 21; Q19; risk R5; BR-U5a-50). Fake CLI runner, fake clock and
 * sleeper; the outcome is built by `finaliseRun` exactly as the adapter does.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessResult } from '../../../../src/shared/interfaces/process-runner.js';
import { parseEnvelope } from '../../../../scripts/lib/generators/envelope.js';
import { agentFileCount, attemptDisposition, finaliseRun } from '../../../../scripts/lib/generators/outcome.js';
import { removeTree } from '../../../../scripts/lib/generators/skeleton.js';
import {
  DEFAULT_RETRY_POLICY,
  backoffFor,
  runWithRetries,
  usagePauseMs,
} from '../../../../scripts/lib/generators/retry.js';
import type { AttemptReport, Clock } from '../../../../scripts/lib/generators/retry.js';
import type { GenerationOutcome } from '../../../../scripts/lib/generators/types.js';
import { FakeGeneratorRunner, PROMPT, REPO, envelope, makeHarness, prepareCell, request, sourceFiles } from './fake-generator-runner.js';
import type { CliScript, Harness } from './fake-generator-runner.js';

let h: Harness;
beforeEach(() => {
  h = makeHarness();
});
afterEach(() => {
  h.cleanup();
});

class FakeClock implements Clock {
  t = Date.parse('2026-10-08T10:00:00.000Z');
  now(): number {
    return this.t;
  }
}

interface CellRun {
  readonly outcome: GenerationOutcome;
  readonly sleeps: number[];
  readonly runner: FakeGeneratorRunner;
}

/** The adapter's composition (Step 22), inlined: retries around fake CLI calls, then `finaliseRun`. */
async function runCell(scripts: CliScript[]): Promise<CellRun> {
  const runner = new FakeGeneratorRunner(h.binary, scripts);
  const req = request(h);
  const clock = new FakeClock();
  const sleeps: number[] = [];
  prepareCell(h, req);
  const r = await runWithRetries<ProcessResult | null>(
    {
      runAttempt: async () => {
        const call = await runner.run(h.binary, ['-p', 'x'], { cwd: req.outputDir, env: {}, timeoutMs: h.config.timeoutMs });
        clock.t += 1000;
        const cli = call.success ? call.data : null;
        const p = cli === null ? null : parseEnvelope(cli.stdout, []);
        const env = p?.success === true ? p.data : null;
        const report: AttemptReport<ProcessResult | null> = {
          disposition: attemptDisposition(cli, env, agentFileCount(req.outputDir)),
          value: cli,
        };
        return DomainResult.ok(report);
      },
      onInterruption: (i) => {
        const rel = path.posix.join('interruptions', req.runId, String(i));
        const to = path.join(h.outRoot, ...rel.split('/'));
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.renameSync(req.outputDir, to);
        prepareCell(h, req);
        return DomainResult.ok(rel);
      },
      onRetry: () => {
        removeTree(req.outputDir);
        prepareCell(h, req);
        return DomainResult.ok(undefined);
      },
    },
    DEFAULT_RETRY_POLICY,
    clock,
    (ms) => {
      sleeps.push(ms);
      clock.t += ms;
      return Promise.resolve();
    },
  );
  if (!r.success) throw new Error(r.errors.map((e) => e.code).join(','));
  const out = await finaliseRun({
    runner,
    repoRoot: REPO,
    config: h.config,
    req,
    install: h.install,
    prompt: PROMPT,
    cli: r.data.last.value,
    infrastructureExhausted: r.data.exhausted,
    attempts: r.data.attempts,
    interruptions: r.data.interruptions,
    knownSecrets: [],
  });
  if (!out.success) throw new Error(out.errors.map((e) => e.code).join(','));
  return { outcome: out.data, sleeps, runner };
}

describe('BR-U5a-50 retries and usage limits', () => {
  it('usage limit then ok → one attempt, one interruption (directory moved to interruptions/), paused until reset', async () => {
    const resetSec = Math.floor(Date.parse('2026-10-08T12:00:00.000Z') / 1000);
    const { outcome, sleeps, runner } = await runCell([
      { files: { 'src/partial.ts': 'export {};\n' }, stdout: `Claude AI usage limit reached|${String(resetSec)}`, exitCode: 1 },
      { files: sourceFiles(21), stdout: envelope() },
    ]);
    expect(runner.cliCalls).toHaveLength(2);
    expect(outcome.status).toBe('ok');
    expect(outcome.attempts).toHaveLength(1);
    expect(outcome.attempts[0]?.outcome).toBe('completed');
    expect(outcome.interruptions).toHaveLength(1);
    const it0 = outcome.interruptions[0];
    expect(it0?.subtype).toBe('usage-limit');
    expect(it0?.movedTo).toBe(`interruptions/${request(h).runId}/0`);
    expect(fs.existsSync(path.join(h.outRoot, ...(it0?.movedTo ?? '').split('/'), 'src', 'partial.ts'))).toBe(true);
    expect(fs.existsSync(path.join(request(h).outputDir, 'src', 'partial.ts'))).toBe(false);
    expect(outcome.fileCount).toBe(21);
    // Reset at 12:00, call ended at 10:00:01 → pause = 2 h − 1 s + 60 s margin.
    expect(sleeps).toEqual([2 * 3600 * 1000 - 1000 + 60 * 1000]);
  });

  it('three infrastructure failures → failed-agent infrastructure with three attempts and two back-offs', async () => {
    const infra: CliScript = { stdout: '', stderr: 'connect ECONNRESET', exitCode: 1 };
    const { outcome, sleeps, runner } = await runCell([infra, { spawnFails: true }, { stdout: '', exitCode: -1, timedOut: true }]);
    expect(runner.cliCalls).toHaveLength(3);
    expect(outcome.status).toBe('failed-agent');
    expect(outcome.failureReason).toBe('infrastructure');
    expect(outcome.attempts.map((a) => a.outcome)).toEqual(['exit-1-before-first-turn', 'spawn-failed', 'timeout-no-files']);
    expect(outcome.interruptions).toEqual([]);
    expect(sleeps).toEqual([30_000, 120_000]);
    expect(outcome.typecheck).toBeNull();
    expect(outcome.treeSha).toBeNull();
  });

  it('timeout with files written → timeout, not retried', async () => {
    const { outcome, sleeps, runner } = await runCell([
      { files: sourceFiles(4), stdout: '', exitCode: -1, timedOut: true },
      { files: sourceFiles(21), stdout: envelope() },
    ]);
    expect(runner.cliCalls).toHaveLength(1);
    expect(outcome.status).toBe('failed-agent');
    expect(outcome.failureReason).toBe('timeout');
    expect(outcome.attempts).toEqual([{ startedAt: '2026-10-08T10:00:00.000Z', outcome: 'timeout' }]);
    expect(sleeps).toEqual([]);
    expect(outcome.fileCount).toBe(4);
  });

  it('an infrastructure failure followed by success → ok with two attempts; model failures are never retried', async () => {
    const retried = await runCell([{ stdout: '', exitCode: 1 }, { files: sourceFiles(21), stdout: envelope() }]);
    expect(retried.outcome.status).toBe('ok');
    expect(retried.outcome.attempts.map((a) => a.outcome)).toEqual(['exit-1-before-first-turn', 'completed']);
    h.cleanup();
    h = makeHarness();
    const failed = await runCell([{ files: sourceFiles(21), stdout: envelope({ isError: true }) }, { files: sourceFiles(21), stdout: envelope() }]);
    expect(failed.runner.cliCalls).toHaveLength(1);
    expect(failed.outcome.failureReason).toBe('agent-error');
  });

  it('policy: back-off list, pause without a reset time, persisting usage limit stops the grid', async () => {
    expect(DEFAULT_RETRY_POLICY.maxInfrastructureRetries).toBe(2);
    expect([0, 1, 5].map((i) => backoffFor(DEFAULT_RETRY_POLICY, i))).toEqual([30_000, 120_000, 120_000]);
    expect(usagePauseMs(DEFAULT_RETRY_POLICY, 0, undefined)).toBe(30 * 60 * 1000);
    expect(usagePauseMs(DEFAULT_RETRY_POLICY, 10_000, 5_000)).toBe(60_000);
    const report: AttemptReport<null> = { disposition: { kind: 'usage-limit', usage: { subtype: 'rate-limit' }, label: 'usage-limit' }, value: null };
    const r = await runWithRetries<null>(
      { runAttempt: () => Promise.resolve(DomainResult.ok(report)), onInterruption: () => DomainResult.ok('x'), onRetry: () => DomainResult.ok(undefined) },
      { ...DEFAULT_RETRY_POLICY, maxInterruptions: 3 },
      new FakeClock(),
      () => Promise.resolve(),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors[0]?.code).toBe('GEN_USAGE_LIMIT_PERSISTS');
  });
});
