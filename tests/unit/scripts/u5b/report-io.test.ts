/**
 * U5b Step 5: report acceptance and loading (FR-36, FR-25; BR-U5b-25, 45; domain-entities §1, §6).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acceptReport, checkRunRecord, loadRun } from '../../../../scripts/lib/report-io.js';
import type { Acceptance, RunRecord } from '../../../../scripts/lib/report-io.js';
import { storedReport } from './report-fixture.js';
import type { StoredReport } from './report-fixture.js';

const PINNED = { provider: 'claude-cli', model: 'claude-opus-5-5', aliases: ['claude-opus-5-5-20260901'] };

function reasons(a: Acceptance): string[] {
  return a.accepted ? [] : a.rejections.map((r) => r.code);
}

function failure(id: string, code: string): StoredReport['functionExecution']['failed'][number] {
  return { functionId: id, name: `fn-${id}`, code, message: `${code} message` };
}

function judged(report: StoredReport, judge: Record<string, unknown>): StoredReport {
  report.judge = { runsPerUnit: 3, cassetteMode: 'replay', ...judge };
  return report;
}

describe('acceptReport (BR-U5b-45)', () => {
  it('accepts a clean symbolic-only report', async () => {
    const a = acceptReport(await storedReport());
    expect(a.accepted).toBe(true);
  });

  it('schema-invalid: a report that fails the frozen schema', async () => {
    const r = await storedReport() as Record<string, unknown>;
    delete r.functionExecution;
    const a = acceptReport(r);
    expect(a.accepted).toBe(false);
    if (!a.accepted) {
      expect(a.reasonCode).toBe('schema-invalid');
      expect(a.reasonDetail).toMatch(/functionExecution/);
    }
    expect(reasons(acceptReport('not a report'))).toEqual(['schema-invalid']);
  });

  it('function-failed: a report with only EVAL_001 in failed[]', async () => {
    const r = await storedReport();
    r.functionExecution.failed = [failure('FF-S09', 'EVAL_001')];
    expect(reasons(acceptReport(r))).toEqual(['function-failed']);
  });

  it('function-timeout: a report with EVAL_002 in failed[]', async () => {
    const r = await storedReport();
    r.functionExecution.failed = [failure('FF-S09', 'EVAL_002')];
    const a = acceptReport(r);
    expect(reasons(a)).toEqual(['function-timeout']);
    if (!a.accepted) expect(a.reasonDetail).toContain('FF-S09');
  });

  it('timeout and other failure together report both, timeout first', async () => {
    const r = await storedReport();
    r.functionExecution.failed = [failure('FF-S08', 'EVAL_001'), failure('FF-S09', 'EVAL_002')];
    const a = acceptReport(r);
    expect(reasons(a)).toEqual(['function-timeout', 'function-failed']);
    if (!a.accepted) expect(a.reasonCode).toBe('function-timeout');
  });

  it('function-truncated: a truncated functionResults row', async () => {
    const r = await storedReport();
    const row = r.functionResults[0];
    if (row === undefined) throw new Error('fixture has no functionResults row');
    row.truncated = true;
    expect(reasons(acceptReport(r))).toEqual(['function-truncated']);
  });

  it('function-truncated: an EVAL_003 warning alone', async () => {
    const r = await storedReport();
    r.warnings.push({ code: 'EVAL_003', message: 'row cap reached', stage: 'evaluation-engine', context: { functionId: 'FF-S04' } });
    expect(reasons(acceptReport(r))).toEqual(['function-truncated']);
  });

  it('metric-failed: a METRIC_001 warning', async () => {
    const r = await storedReport();
    r.warnings.push({ code: 'METRIC_001', message: 'metric query failed', stage: 'compute-scores', context: { metric: 'cycleCount', code: 'X' } });
    const a = acceptReport(r);
    expect(reasons(a)).toEqual(['metric-failed']);
    if (!a.accepted) expect(a.reasonDetail).toContain('cycleCount');
  });

  it('METRIC_002 only is accepted (empty metric result is not a failure)', async () => {
    const r = await storedReport();
    r.warnings.push({ code: 'METRIC_002', message: 'ratio undefined', stage: 'compute-scores', context: { metric: 'abstractness', reason: 'no-rows' } });
    expect(acceptReport(r).accepted).toBe(true);
  });

  it('disabled and cannot-fire functions are accepted', async () => {
    const r = await storedReport();
    r.disabledFunctions = [
      { functionId: 'FF-S03', name: 'style-disabled', reason: 'disabled by spec' },
      { functionId: 'FF-C07', name: 'cannot-fire', reason: 'cannot fire: no matching layer' },
    ];
    expect(acceptReport(r).accepted).toBe(true);
  });

  it('judge-model-mismatch under the actual-model rule (BR-U4-VRD-07)', async () => {
    expect(acceptReport(judged(await storedReport('full'), { provider: 'claude-cli', model: 'claude-opus-5-5', resolvedModel: 'claude-opus-5-5' }), { pinnedJudge: PINNED }).accepted).toBe(true);
    expect(acceptReport(judged(await storedReport('full'), { provider: 'claude-cli', model: 'claude-opus-5-5', resolvedModel: 'claude-opus-5-5-20260901' }), { pinnedJudge: PINNED }).accepted).toBe(true);
    expect(reasons(acceptReport(judged(await storedReport('full'), { provider: 'claude-cli', model: 'claude-opus-5-5', resolvedModel: 'claude-sonnet-5' }), { pinnedJudge: PINNED }))).toEqual(['judge-model-mismatch']);
    expect(reasons(acceptReport(judged(await storedReport('full'), { provider: 'gemini', model: 'claude-opus-5-5' }), { pinnedJudge: PINNED }))).toEqual(['judge-model-mismatch']);
    expect(reasons(acceptReport(judged(await storedReport('full'), { provider: 'claude-cli', model: 'claude-haiku-5' }), { pinnedJudge: PINNED }))).toEqual(['judge-model-mismatch']);
  });

  it('a symbolic-only plan (no pinned judge) skips the judge check', async () => {
    const r = await storedReport();
    expect(r.judge.provider).toBe('none');
    expect(acceptReport(r).accepted).toBe(true);
    expect(reasons(acceptReport(r, { pinnedJudge: PINNED }))).toEqual(['judge-model-mismatch']);
  });
});

describe('loadRun and checkRunRecord (BR-U5b-25, 53)', () => {
  const record: RunRecord = {
    runId: 'r-1', planId: 'fixtures', projectId: 'p', status: 'accepted', attempt: 1, reportPath: 'report.json',
    specSha: 'a'.repeat(64), cliCommit: 'b'.repeat(40), preregVersion: 1, frozenHashes: { 'Docs/matching-rule.md': 'c'.repeat(64) },
    envRecordId: 'env-1', startedAt: '2026-10-08T00:00:00Z', wallMs: 1200,
  };
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'u5b-report-io-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('loads a report with its record', async () => {
    writeFileSync(join(dir, 'report.json'), JSON.stringify(await storedReport()));
    writeFileSync(join(dir, 'record.json'), JSON.stringify(record));
    const l = loadRun(join(dir, 'report.json'), join(dir, 'record.json'));
    expect(l.ok).toBe(true);
    if (l.ok) {
      expect(l.record.specSha).toBe(record.specSha);
      expect(acceptReport(l.report).accepted).toBe(true);
    }
  });

  it('refuses a report passed without its record, or with an unreadable or malformed one', async () => {
    writeFileSync(join(dir, 'report.json'), JSON.stringify(await storedReport()));
    expect(loadRun(join(dir, 'report.json'), undefined)).toMatchObject({ ok: false, reason: 'record-missing' });
    expect(loadRun(join(dir, 'report.json'), join(dir, 'absent.json'))).toMatchObject({ ok: false, reason: 'record-missing' });
    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ ...record, attempt: 3, specSha: '' }));
    const l = loadRun(join(dir, 'report.json'), join(dir, 'bad.json'));
    expect(l).toMatchObject({ ok: false, reason: 'record-invalid' });
    if (!l.ok) expect(l.detail).toMatch(/specSha.*attempt|attempt.*specSha|specSha/);
  });

  it('reports an unreadable report', () => {
    writeFileSync(join(dir, 'report.json'), '{ not json');
    expect(loadRun(join(dir, 'report.json'), undefined)).toMatchObject({ ok: false, reason: 'report-unreadable' });
  });

  it('checkRunRecord lists every problem', () => {
    expect(checkRunRecord(record)).toEqual([]);
    expect(checkRunRecord(null)).toEqual(['run record is not an object']);
    expect(checkRunRecord({ ...record, status: 'done', wallMs: -1, frozenHashes: [] })).toEqual([
      'status done unknown', 'wallMs must be a non-negative number', 'frozenHashes must be an object',
    ]);
  });
});
