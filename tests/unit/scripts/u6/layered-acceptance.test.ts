/**
 * ADR-021 SO1-B: the FR-v1.2E-20 layered acceptance rule and its producer. The hand-computed baseline report of
 * U5b (symbolic-only: declared 27, compiled 26, disabled 1, skipped by mode 2, executed 24, failed 0) is the fixture.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EvaluationReport } from '../../../../src/shared/types/evaluation.js';
import { layeredAcceptance } from '../../../../scripts/lib/layered-acceptance.js';
import type { LayeredAcceptanceMeta } from '../../../../scripts/lib/layered-acceptance.js';
import { main, relativiseReport } from '../../../../scripts/so1-layered-acceptance.js';
import { ROOT } from '../u5b/score-fixture.js';

const BASELINE_FILE = join(ROOT, 'tests/fixtures/u5b/hand-computed/reports/baseline.json');
const BASELINE = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as EvaluationReport;
const META: LayeredAcceptanceMeta = {
  projectId: 'p', originUrl: 'https://example.invalid/p.git', projectCommit: 'c'.repeat(40), style: 'layered',
  specPath: 'corpus/specs/p.yaml', specSha256: 'f'.repeat(64), toolCommit: 'abcdef012345', command: 'evaluate', rejection: null,
};
const withFe = (over: Partial<EvaluationReport['functionExecution']>): EvaluationReport => ({ ...BASELINE, functionExecution: { ...BASELINE.functionExecution, ...over } });

describe('layered acceptance rule (FR-v1.2E-20)', () => {
  it('accepts executed = compiled − skippedByMode with no failure; counts and disabled reasons copied', () => {
    const r = layeredAcceptance(BASELINE, META);
    expect(r.counts).toEqual({ declared: 27, adrDerived: 0, compiled: 26, disabled: 1, dropped: 0, skippedByMode: 2, executed: 24, failed: 0 });
    expect(r.disabledFunctions).toEqual([{ functionId: 'FF-S03', name: 'no-layer-skip', reason: 'not applicable to style clean-architecture' }]);
    expect(r.executedShareOfRunnable).toBe(1);
    expect(r).toMatchObject({ accepted: true, problems: [], identities: { i1i2: true }, reportAccepted: true, evaluationMode: 'symbolic-only' });
  });

  it('one executed short (23 of 24) breaks the rule and identity I2', () => {
    const r = layeredAcceptance(withFe({ executed: 23 }), META);
    expect(r.accepted).toBe(false);
    expect(r.executedShareOfRunnable).toBeCloseTo(23 / 24, 10);
    expect(r.problems).toEqual(['identity I1 or I2 does not hold', 'executed 23 != compiled 26 - skippedByMode 2']);
  });

  it('a failed compiled function is refused even when I2 holds', () => {
    const r = layeredAcceptance(withFe({ executed: 23, failed: [{ functionId: 'FF-S01', name: 'dependency-direction', code: 'EVAL_001', message: 'x' }] } as never), META);
    expect(r.identities.i1i2).toBe(true);
    expect(r.failedFunctions).toEqual([{ functionId: 'FF-S01', code: 'EVAL_001' }]);
    expect(r.problems).toEqual(['1 compiled function(s) failed', 'executed 23 != compiled 26 - skippedByMode 2']);
  });

  it('a non-layered style, another mode or a BR-U5b-45 rejection is refused', () => {
    expect(layeredAcceptance(BASELINE, { ...META, style: 'nestjs' }).problems).toEqual(['style nestjs is not layered']);
    expect(layeredAcceptance({ ...BASELINE, evaluationMode: 'full' }, META).problems).toEqual(['mode full is not symbolic-only']);
    const rej = layeredAcceptance(BASELINE, { ...META, rejection: 'schema-invalid: x' });
    expect(rej).toMatchObject({ accepted: false, reportAccepted: false, reportRejection: 'schema-invalid: x' });
  });

  it('a disabled count that differs from the disabled rows is refused', () => {
    expect(layeredAcceptance({ ...BASELINE, disabledFunctions: [] }, META).problems).toEqual(['disabled 1 != 0 disabled rows']);
  });
});

describe('producer', () => {
  let dir = '';
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'u6-layered-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  const io = (sink: string[]): Parameters<typeof main>[2] => ({
    out: (t) => { sink.push(t); }, err: (t) => { sink.push(t); }, writeFile: (f, t) => { writeFileSync(f, t); }, env: { NEO4J_PASSWORD: 'hunter2-secret' },
  });

  it('writes the summary and the corpus-relative report; a nestjs project is not accepted (exit 1)', () => {
    const reportFile = join(dir, 'in.json');
    writeFileSync(reportFile, JSON.stringify({ ...BASELINE, projectPath: '/abs/path/realworld-test', runId: 'run-hunter2-secret' }));
    const sink: string[] = [];
    expect(main(['--report', reportFile, '--project', 'realworld-test', '--out-dir', dir, '--tool-commit', 'abcdef012345'], ROOT, io(sink))).toBe(1);
    const summary = JSON.parse(readFileSync(join(dir, 'layered-abcdef012345.json'), 'utf8')) as { problems: string[]; specPath: string; reportFile: string; counts: { executed: number } };
    expect(summary).toMatchObject({ specPath: 'corpus/specs/realworld-test.yaml', reportFile: 'layered-abcdef012345.report.json', counts: { executed: 24 } });
    expect(summary.problems).toEqual(['style nestjs is not layered']);
    const reportText = readFileSync(join(dir, 'layered-abcdef012345.report.json'), 'utf8');
    expect(reportText).not.toContain('/abs/path');
    expect(reportText).not.toContain('hunter2-secret');
    expect((JSON.parse(reportText) as { projectPath: string }).projectPath).toBe('../daedalus-corpus/realworld-test');
    expect(sink.join('')).toContain('NOT accepted');
  });

  it('usage errors exit 2; an unknown project exits 2; --self-test exits 1', () => {
    const sink: string[] = [];
    expect(main([], ROOT, io(sink))).toBe(2);
    expect(main(['--report', BASELINE_FILE, '--project', 'no-such'], ROOT, io(sink))).toBe(2);
    expect(main(['--self-test'], ROOT, io(sink))).toBe(1);
    expect(relativiseReport(BASELINE, 'x').projectPath).toBe('../daedalus-corpus/x');
  });
});
