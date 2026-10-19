/**
 * U5 evasion check, A1 (s2d-01 §5.1; design §2.3): the pass rule over every acceptance status, pairing by block
 * (EV-03), both readings of the 10-point bar (Q5), and the coverage flag. Hand-built step records; no model.
 */
import type { AcceptanceRecord, StepRecord } from '../../../../../scripts/lib/loop/types.js';
import { acceptanceGap, cellAcceptance, cellOf, notPassingReason, stepPasses } from '../../../../../scripts/v1.3/lib/evasion/acceptance-rate.js';
import type { LoadedRun } from '../../../../../scripts/v1.3/lib/study2-analysis.js';
import { oneRun } from './helpers.js';

const acc = (status: AcceptanceRecord['status'], passed = 3, failed = 0, errors = 0): AcceptanceRecord => ({
  schema: 'loop-acceptance/v1', status, passed, failed, skipped: 0, errors, durationMs: 0, testFileSha256: 'x', files: [],
});

function withAcceptance(r: LoadedRun, a: readonly (AcceptanceRecord | undefined)[]): LoadedRun {
  return {
    run: r.run,
    steps: r.steps.map((s, i): StepRecord => {
      const rest: StepRecord = { ...s };
      delete (rest as { acceptance?: AcceptanceRecord }).acceptance;
      const v = a[i];
      return v === undefined ? rest : { ...rest, acceptance: v };
    }),
  };
}

describe('A1 pass rule', () => {
  it('passes only on ran with passed > 0, no failure and no error; every other status is tallied', () => {
    expect(stepPasses({ acceptance: acc('ran') })).toBe(true);
    expect(stepPasses({ acceptance: acc('ran', 0) })).toBe(false);
    expect(notPassingReason({ acceptance: acc('ran', 3, 1) })).toBe('ran-failing');
    expect(notPassingReason({ acceptance: acc('ran', 3, 0, 1) })).toBe('ran-failing');
    for (const s of ['no-tests', 'no-start-command', 'build-failed', 'service-not-ready', 'runner-error'] as const) expect(notPassingReason({ acceptance: acc(s) })).toBe(s);
    expect(notPassingReason({})).toBe('no-acceptance-record');
  });

  it('cells are <arm>@<rung>, or <arm>@- without a frame', () => {
    expect(cellOf(oneRun({ caseName: 'wrapped', arm: 'none', rung: 'L2' }).run)).toBe('none@L2');
    expect(cellOf(oneRun({ caseName: 'wrapped', arm: 'daedalus-mcp' }).run)).toBe('daedalus-mcp@-');
  });
});

describe('A1 per cell and the paired gap', () => {
  const none = (task: string, a: (AcceptanceRecord | undefined)[]): LoadedRun => withAcceptance(oneRun({ caseName: 'wrapped', arm: 'none', rung: 'L2', taskId: task }), a);
  const mcp = (task: string, a: (AcceptanceRecord | undefined)[]): LoadedRun => withAcceptance(oneRun({ caseName: 'wrapped', arm: 'daedalus-mcp', rung: 'L2', taskId: task }), a);

  it('steps before fromStep are ignored (EV-01); coverage counts ran steps', () => {
    const c = cellAcceptance([none('t1', [undefined, acc('ran')]), none('t2', [acc('ran'), acc('build-failed')])], 2);
    expect(c).toMatchObject({ stepsScheduled: 2, stepsWithRecord: 2, stepsRan: 1, stepsPassing: 1, passRate: 0.5, coverage: 0.5, byStatus: { 'build-failed': 1 } });
  });

  it('only paired blocks count (EV-03); both bar readings are reported', () => {
    const byCell = new Map([
      ['none@L2', [none('t1', [acc('ran'), acc('ran')]), none('t2', [acc('ran'), acc('ran')]), none('t3', [acc('ran'), acc('ran')])]],
      ['daedalus-mcp@L2', [mcp('t1', [acc('ran'), acc('ran', 0)]), mcp('t2', [acc('ran'), acc('ran')])]],
    ]);
    const g = acceptanceGap(byCell, ['none@L2', 'daedalus-mcp@L2'], 2);
    expect(g).toMatchObject({ blocks: 2, gapPoints: 50, absGapPoints: 50, bar: 10, flag: true, flagTwoSided: true });
    const reversed = acceptanceGap(byCell, ['daedalus-mcp@L2', 'none@L2'], 2);
    expect(reversed).toMatchObject({ gapPoints: -50, flag: false, flagTwoSided: true });
  });
});
