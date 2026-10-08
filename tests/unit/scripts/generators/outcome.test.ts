/**
 * Generation outcome and status decision (U5a plan Step 20; FR-28; BR-U5a-48, BR-U5a-49 at the outcome level;
 * business-logic-model §5.2). Fake CLI and harness tsc; real git for `treeSha`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProcessResult } from '../../../../src/shared/interfaces/process-runner.js';
import { parseEnvelope } from '../../../../scripts/lib/generators/envelope.js';
import {
  ENVELOPE_JSON,
  GENERATION_JSON,
  agentFileCount,
  attemptDisposition,
  countSourceFiles,
  decideStatus,
  finaliseRun,
  isFileCountInRange,
  makeGenerationOutcome,
  writeGenerationJson,
} from '../../../../scripts/lib/generators/outcome.js';
import type { StatusInputs } from '../../../../scripts/lib/generators/outcome.js';
import type { GenerationOutcome } from '../../../../scripts/lib/generators/types.js';
import {
  FakeGeneratorRunner,
  HELPER_MODEL,
  MODEL,
  PROMPT,
  REPO,
  envelope,
  makeHarness,
  prepareCell,
  request,
  sourceFiles,
} from './fake-generator-runner.js';
import type { CliScript, Harness } from './fake-generator-runner.js';

let h: Harness;
beforeEach(() => {
  h = makeHarness();
});
afterEach(() => {
  h.cleanup();
});

/** One finished call: prepare the cell, run the fake CLI once, finalise and write generation.json. */
async function runOnce(script: CliScript, tscErrors = 0): Promise<{ outcome: GenerationOutcome; disposition: string; dir: string }> {
  const runner = new FakeGeneratorRunner(h.binary, [script]);
  runner.tscErrors = [tscErrors];
  const req = request(h);
  prepareCell(h, req);
  const r = await runner.run(h.binary, ['-p', 'x'], { cwd: req.outputDir, env: {}, timeoutMs: 1000 });
  const cli: ProcessResult | null = r.success ? r.data : null;
  const parsed = cli === null ? null : parseEnvelope(cli.stdout, []);
  const env = parsed?.success === true ? parsed.data : null;
  const disposition = attemptDisposition(cli, env, agentFileCount(req.outputDir));
  const out = await finaliseRun({
    runner,
    repoRoot: REPO,
    config: h.config,
    req,
    install: h.install,
    prompt: PROMPT,
    cli,
    infrastructureExhausted: false,
    attempts: [{ startedAt: '2026-10-08T00:00:00.000Z', outcome: disposition.label }],
    interruptions: [],
    knownSecrets: [],
  });
  if (!out.success) throw new Error(out.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
  writeGenerationJson(req.outputDir, out.data);
  return { outcome: out.data, disposition: disposition.kind, dir: req.outputDir };
}

describe('decideStatus (§5.2 order)', () => {
  const base: StatusInputs = {
    infrastructure: false,
    timedOutWithFiles: false,
    envelopeReadable: true,
    skeletonIntact: true,
    modelValid: true,
    isError: false,
    typecheckErrors: 0,
  };
  it('applies rows 1–8 in order, the earliest failing row deciding', () => {
    expect(decideStatus(base)).toEqual({ status: 'ok' });
    expect(decideStatus({ ...base, typecheckErrors: 3 })).toEqual({ status: 'failed-typecheck', failureReason: 'typecheck' });
    expect(decideStatus({ ...base, typecheckErrors: 3, isError: true })).toEqual({ status: 'failed-agent', failureReason: 'agent-error' });
    expect(decideStatus({ ...base, isError: true, modelValid: false })).toEqual({ status: 'failed-agent', failureReason: 'model-mismatch' });
    expect(decideStatus({ ...base, modelValid: false, skeletonIntact: false })).toEqual({
      status: 'failed-agent',
      failureReason: 'skeleton-tampered',
    });
    expect(decideStatus({ ...base, skeletonIntact: false, envelopeReadable: false })).toEqual({
      status: 'failed-agent',
      failureReason: 'envelope-unreadable',
    });
    expect(decideStatus({ ...base, envelopeReadable: false, timedOutWithFiles: true })).toEqual({ status: 'failed-agent', failureReason: 'timeout' });
    expect(decideStatus({ ...base, timedOutWithFiles: true, infrastructure: true })).toEqual({
      status: 'failed-agent',
      failureReason: 'infrastructure',
    });
  });
});

describe('finaliseRun and generation.json (BR-U5a-48)', () => {
  it('ok: typecheck of record through <H>/bin/tsc, file count, tree sha, generation.json and envelope.json beside the tree', async () => {
    const { outcome, disposition, dir } = await runOnce({ files: sourceFiles(25), stdout: envelope() });
    expect(disposition).toBe('final');
    expect(outcome.status).toBe('ok');
    expect(outcome.failureReason).toBeUndefined();
    expect(outcome.requestedModelId).toBe(MODEL);
    expect(outcome.resolvedModelId).toBe(MODEL);
    expect(outcome.fileCount).toBe(25);
    expect(outcome.fileCountInRange).toBe(true);
    expect(outcome.typecheck).toEqual({ tscVersion: '5.9.3', errors: 0 });
    expect(outcome.treeSha).toMatch(/^[0-9a-f]{40}$/);
    expect(outcome.skeletonIntact).toBe(true);
    expect(outcome.envelopePath).toBe(ENVELOPE_JSON);
    expect(outcome.adapterId).toBe('claude-code-cli');
    const written = JSON.parse(fs.readFileSync(path.join(dir, GENERATION_JSON), 'utf8')) as GenerationOutcome;
    expect(written).toEqual(JSON.parse(JSON.stringify(outcome)) as GenerationOutcome);
    expect(fs.existsSync(path.join(dir, ENVELOPE_JSON))).toBe(true);
  });

  it('the type-check of record runs the harness-owned tsc with the per-run tsconfig, never a binary in cwd', async () => {
    const runner = new FakeGeneratorRunner(h.binary, [{ files: sourceFiles(20), stdout: envelope() }]);
    const req = request(h);
    prepareCell(h, req);
    const r = await runner.run(h.binary, [], { cwd: req.outputDir, env: {}, timeoutMs: 1000 });
    if (!r.success) throw new Error('spawn');
    const p = parseEnvelope(r.data.stdout, []);
    const out = await finaliseRun({
      runner,
      repoRoot: REPO,
      config: h.config,
      req,
      install: h.install,
      prompt: PROMPT,
      cli: r.data,
      infrastructureExhausted: false,
      attempts: [],
      interruptions: [],
      knownSecrets: [],
    });
    expect(out.success && p.success).toBe(true);
    expect(runner.tscCalls).toHaveLength(1);
    expect(runner.tscCalls[0]?.command).toBe(path.join(h.harnessRoot, 'bin', 'tsc'));
    expect(runner.tscCalls[0]?.args).toEqual([
      '--noEmit',
      '--incremental',
      'false',
      '-p',
      path.join(h.harnessRoot, 'runs', ...req.runId.split('/'), 'tsconfig.json'),
    ]);
    expect(runner.tscCalls[0]?.command.startsWith(req.outputDir)).toBe(false);
  });

  it('failed-typecheck: errors counted, a final outcome written once (BR-U5a-49 at the outcome level: not a retry case)', async () => {
    const { outcome, disposition, dir } = await runOnce({ files: sourceFiles(30), stdout: envelope() }, 4);
    expect(disposition).toBe('final');
    expect(outcome.status).toBe('failed-typecheck');
    expect(outcome.failureReason).toBe('typecheck');
    expect(outcome.typecheck?.errors).toBe(4);
    expect(outcome.attempts).toHaveLength(1);
    const written = JSON.parse(fs.readFileSync(path.join(dir, GENERATION_JSON), 'utf8')) as GenerationOutcome;
    expect(written.status).toBe('failed-typecheck');
  });

  it('failed-agent: is_error → agent-error, with skeleton, model and type-check still recorded', async () => {
    const { outcome } = await runOnce({ files: sourceFiles(22), stdout: envelope({ isError: true }) }, 2);
    expect(outcome.status).toBe('failed-agent');
    expect(outcome.failureReason).toBe('agent-error');
    expect(outcome.skeletonIntact).toBe(true);
    expect(outcome.resolvedModelId).toBe(MODEL);
    expect(outcome.typecheck?.errors).toBe(2);
  });

  it('15 files → ok with fileCountInRange: false (flagged, not discarded)', async () => {
    const { outcome } = await runOnce({ files: sourceFiles(15), stdout: envelope() });
    expect(outcome.status).toBe('ok');
    expect(outcome.fileCount).toBe(15);
    expect(outcome.fileCountInRange).toBe(false);
    expect([19, 20, 100, 101].map(isFileCountInRange)).toEqual([false, true, true, false]);
  });

  it('model mismatch: pinned id not dominant → failed-agent model-mismatch; a smaller helper model alone is auxiliary', async () => {
    const mismatch = await runOnce({ files: sourceFiles(21), stdout: envelope({ pinnedTokens: 10, helperTokens: 900 }) });
    expect(mismatch.outcome.status).toBe('failed-agent');
    expect(mismatch.outcome.failureReason).toBe('model-mismatch');
    expect(mismatch.outcome.resolvedModelId).toBeUndefined();
    expect(mismatch.outcome.typecheck).not.toBeNull();
    h.cleanup();
    h = makeHarness();
    const aux = await runOnce({ files: sourceFiles(21), stdout: envelope({ pinnedTokens: 900, helperTokens: 10 }) });
    expect(aux.outcome.status).toBe('ok');
    expect(aux.outcome.auxiliaryModels).toEqual([{ id: HELPER_MODEL, outputTokens: 10 }]);
  });

  it('skeleton tampered: an edited package.json → failed-agent skeleton-tampered', async () => {
    const { outcome } = await runOnce({
      files: sourceFiles(21),
      stdout: envelope(),
      effect: (cwd) => {
        fs.appendFileSync(path.join(cwd, 'package.json'), ' ');
      },
    });
    expect(outcome.status).toBe('failed-agent');
    expect(outcome.failureReason).toBe('skeleton-tampered');
    expect(outcome.skeletonIntact).toBe(false);
  });

  it('permission denials are counted without changing the status', async () => {
    const { outcome } = await runOnce({ files: sourceFiles(21), stdout: envelope({ denials: 3 }) });
    expect(outcome.status).toBe('ok');
    expect(outcome.permissionDenials).toBe(3);
  });

  it('non-JSON stdout → envelope-unreadable; timeout with files → timeout (final), zero files → infrastructure', async () => {
    const unreadable = await runOnce({ files: sourceFiles(21), stdout: 'not json' });
    expect(unreadable.outcome.failureReason).toBe('envelope-unreadable');
    expect(JSON.parse(fs.readFileSync(path.join(unreadable.dir, ENVELOPE_JSON), 'utf8'))).toMatchObject({ unreadable: true });
    h.cleanup();
    h = makeHarness();
    const timeout = await runOnce({ files: sourceFiles(3), stdout: '', exitCode: -1, timedOut: true });
    expect(timeout.disposition).toBe('final');
    expect(timeout.outcome.failureReason).toBe('timeout');
    const cli: ProcessResult = { exitCode: -1, stdout: '', stderr: '', timedOut: true, durationMs: 1 };
    expect(attemptDisposition(cli, null, 0).kind).toBe('infrastructure');
    expect(attemptDisposition(null, null, 0)).toEqual({ kind: 'infrastructure', label: 'spawn-failed' });
    expect(attemptDisposition({ ...cli, timedOut: false, exitCode: 1 }, null, 0).kind).toBe('infrastructure');
  });

  it('usage or rate limits are read only from erroring calls', () => {
    const limited: ProcessResult = { exitCode: 1, stdout: 'Claude AI usage limit reached|1760000000', stderr: '', timedOut: false, durationMs: 1 };
    const d = attemptDisposition(limited, null, 0);
    expect(d.kind).toBe('usage-limit');
    if (d.kind === 'usage-limit') expect(d.usage.resetAt).toBe(1760000000 * 1000);
    const ok = parseEnvelope(envelope({ result: 'added rate limit middleware' }), []);
    if (!ok.success) throw new Error('parse');
    const fine: ProcessResult = { exitCode: 0, stdout: '', stderr: '', timedOut: false, durationMs: 1 };
    expect(attemptDisposition(fine, ok.data, 20).kind).toBe('final');
    const err = parseEnvelope(envelope({ isError: true, numTurns: 0, result: 'API Error: 429 rate_limit_error' }), []);
    if (!err.success) throw new Error('parse');
    expect(attemptDisposition({ ...fine, exitCode: 1 }, err.data, 0).kind).toBe('usage-limit');
  });
});

describe('makeGenerationOutcome invariants (domain-entities §5)', () => {
  it('refuses ok with a reason, failed-typecheck without errors, and bad hashes', async () => {
    const { outcome } = await runOnce({ files: sourceFiles(21), stdout: envelope() });
    const { fileCountInRange: _drop, ...fields } = outcome;
    expect(makeGenerationOutcome(fields).success).toBe(true);
    expect(makeGenerationOutcome({ ...fields, failureReason: 'typecheck' }).success).toBe(false);
    expect(makeGenerationOutcome({ ...fields, status: 'failed-typecheck', failureReason: 'typecheck' }).success).toBe(false);
    expect(makeGenerationOutcome({ ...fields, status: 'failed-agent', failureReason: 'typecheck' }).success).toBe(false);
    expect(makeGenerationOutcome({ ...fields, promptSha256: 'x' }).success).toBe(false);
    expect(makeGenerationOutcome({ ...fields, resolvedModelId: HELPER_MODEL }).success).toBe(false);
    expect(countSourceFiles(path.join(h.tmp, 'missing'))).toBe(0);
  });
});
