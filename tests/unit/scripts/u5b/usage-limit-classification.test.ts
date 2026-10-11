// E1 pass 1 (2026-10-10): a usage limit hit at the judge's init probe was recorded as `transport-error`, so the
// registered usage-limit handling (an `incomplete` / `usage-limit` record, resumed from cassettes) never applied.
// The harness and the Claude generator now read the frozen USAGE_LIMIT patterns (ADR-018 item 5) on every step.
import type { ProcessResult } from '../../../../src/shared/interfaces/process-runner.js';
import { CLASSIFIER_PATTERNS } from '../../../../src/llm-critic/frozen.js';
import {
  classifyAttempt, JUDGE_USAGE_LIMIT_PATTERNS, LLM_USAGE_LIMIT_CODE, namesUsageLimit, USAGE_LIMIT_EXIT,
} from '../../../../scripts/run-experiment.js';
import { parseEnvelope } from '../../../../scripts/lib/generators/envelope.js';
import { attemptDisposition } from '../../../../scripts/lib/generators/outcome.js';
import { envelope } from '../generators/fake-generator-runner.js';

const LIMIT_TEXT = "You've hit your limit · resets 5pm (Europe/Berlin)";

function result(extra: Partial<ProcessResult>): ProcessResult {
  return { exitCode: 0, stdout: '', stderr: '', timedOut: false, durationMs: 1, ...extra };
}

describe('run harness: a usage limit from any judge step is incomplete, never transport-error', () => {
  it('restates the frozen C14 USAGE_LIMIT patterns and stop code', () => {
    expect([...JUDGE_USAGE_LIMIT_PATTERNS]).toEqual([...CLASSIFIER_PATTERNS.USAGE_LIMIT]);
    expect(LLM_USAGE_LIMIT_CODE).toBe('LLM_USAGE_LIMIT');
  });

  it('the E1 pass 1 case: exit 2 with the init-probe usage-limit message → incomplete', () => {
    const r = result({ exitCode: 2, stderr: 'Error: Init probe: usage limit reached\n' });
    expect(classifyAttempt({ ok: true, result: r }).kind).toBe('incomplete');
  });

  it('exit 3 (JUDGE_RUN_INCOMPLETE) and the CLI limit text → incomplete', () => {
    expect(classifyAttempt({ ok: true, result: result({ exitCode: USAGE_LIMIT_EXIT, stderr: 'Error: Judge run incomplete (USAGE_LIMIT)' }) }).kind).toBe('incomplete');
    expect(classifyAttempt({ ok: true, result: result({ exitCode: 1, stderr: LIMIT_TEXT }) }).kind).toBe('incomplete');
    expect(classifyAttempt({ ok: true, result: result({ exitCode: 2, stderr: 'LLM_USAGE_LIMIT' }) }).kind).toBe('incomplete');
  });

  it('other exits without a report stay transport errors; a report is still a report', () => {
    expect(classifyAttempt({ ok: true, result: result({ exitCode: 2, stderr: 'Error: Init probe printed no init event' }) }).kind).toBe('transport');
    expect(classifyAttempt({ ok: false, detail: 'ENOENT' }).kind).toBe('transport');
    expect(classifyAttempt({ ok: true, result: result({ exitCode: 1, stdout: '{"verdict":"warning"}' }) }).kind).toBe('report');
    expect(namesUsageLimit('rate limit middleware added')).toBe(false);
  });
});

describe('Claude generator: the CLI limit message is a usage limit (pause, no attempt consumed)', () => {
  it('"You\'ve hit your limit" on an erroring call → usage-limit', () => {
    const err = parseEnvelope(envelope({ isError: true, numTurns: 0, result: LIMIT_TEXT }), []);
    if (!err.success) throw new Error('parse');
    expect(attemptDisposition(result({ exitCode: 1 }), err.data, 0).kind).toBe('usage-limit');
    expect(attemptDisposition(result({ exitCode: 1, stdout: LIMIT_TEXT }), null, 0).kind).toBe('usage-limit');
  });

  it('the same text in a successful call is not a limit', () => {
    const ok = parseEnvelope(envelope({ result: LIMIT_TEXT }), []);
    if (!ok.success) throw new Error('parse');
    expect(attemptDisposition(result({ exitCode: 0 }), ok.data, 20).kind).toBe('final');
  });
});
