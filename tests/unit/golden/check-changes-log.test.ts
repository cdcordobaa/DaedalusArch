import {
  checkChangeLog,
  main,
  parseChangesLine,
  parseBtChangesLine,
  parseU3ChangesLine,
  resultsPathAllowed,
  SELF_TEST_INPUT,
  U3_ATTRIBUTIONS,
} from '../../golden/check-changes-log.js';
import type { CommitInfo } from '../../golden/check-changes-log.js';

const SNAP = 'tests/golden/__snapshots__/';
const K5 = 'ADR-015 item 1 (U1 BR-U1-45)';

function commit(overrides: Partial<CommitInfo>): CommitInfo {
  return {
    sha: 'abcdef0123456789abcdef0123456789abcdef01',
    subject: 'U1-K5: fix(u1): repository-pattern reports only violations (ADR-015 item 1, BR-U1-45)',
    changedFiles: [],
    addedChangesLines: [],
    ...overrides,
  };
}

function run(commits: CommitInfo[], resultsChanged: string[] = []) {
  return checkChangeLog({ commits, resultsChanged });
}

describe('checkChangeLog (BR-U1-41, BR-U1-42)', () => {
  it('passes a compliant K commit', () => {
    const r = run([
      commit({
        changedFiles: [`${SNAP}correct-reference.json`, `${SNAP}variant-a-structural.json`, 'tests/golden/CHANGES.md'],
        addedChangesLines: [
          `2026-10-09 U1-K5 correct-reference, variant-a-structural — ${K5}: FF-P03 no longer reports passing repositories.`,
        ],
      }),
    ]);
    expect(r).toEqual({ ok: true, problems: [] });
  });

  it('fails a snapshot commit whose subject has no label', () => {
    const r = run([
      commit({
        subject: 'fix(u1): repository-pattern reports only violations',
        changedFiles: [`${SNAP}correct-reference.json`],
        addedChangesLines: [`2026-10-09 U1-K5 correct-reference — ${K5}: text.`],
      }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/unattributable/);
  });

  it('fails when no CHANGES.md line names one changed case', () => {
    const r = run([
      commit({
        changedFiles: [`${SNAP}correct-reference.json`, `${SNAP}variant-d-subtle.json`],
        addedChangesLines: [`2026-10-09 U1-K5 correct-reference — ${K5}: text.`],
      }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatch(/variant-d-subtle/);
  });

  it('fails when the line carries a different K than the subject', () => {
    const r = run([
      commit({
        changedFiles: [`${SNAP}correct-reference.json`],
        addedChangesLines: [`2026-10-09 U1-K4 correct-reference — ADR-015 item 10 (U1 Q22 B): text.`],
      }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/adds no non-observation U1-K5 line/);
  });

  it('accepts "all" as covering every changed case', () => {
    const r = run([
      commit({
        changedFiles: [
          `${SNAP}correct-reference.json`, `${SNAP}variant-a-structural.json`, `${SNAP}variant-b-pattern.json`,
          `${SNAP}variant-c-everything.json`, `${SNAP}variant-d-subtle.json`,
        ],
        addedChangesLines: [`2026-10-09 U1-K5 all — ${K5}: text.`],
      }),
    ]);
    expect(r.ok).toBe(true);
  });

  it('rejects a line with the wrong dash', () => {
    const r = run([commit({ addedChangesLines: [`2026-10-09 U1-K5 all - ${K5}: text.`] })]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/malformed/);
  });

  it('rejects a line whose attribution has no parentheses', () => {
    const r = run([commit({ addedChangesLines: ['2026-10-09 U1-K5 all — ADR-015 item 1: text.'] })]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/malformed/);
  });

  it('rejects an observation line with no case ids', () => {
    const line = '2026-10-09 U1-K2 observation — FR-07 + FR-08 (Q1 grammar, Q2, Q5): default_exclude_paths ignored.';
    const r = run([commit({ addedChangesLines: [line] })]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/unknown case id "observation"/);
  });

  it('rejects an unknown case id', () => {
    const r = run([commit({ addedChangesLines: [`2026-10-09 U1-K5 variant-e — ${K5}: text.`] })]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/unknown case id "variant-e"/);
  });

  it('rejects "all" combined with a case id', () => {
    const r = run([commit({ addedChangesLines: [`2026-10-09 U1-K5 all, correct-reference — ${K5}: text.`] })]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/only case id/);
  });

  it('rejects a non-canonical attribution string', () => {
    const r = run([commit({ addedChangesLines: ['2026-10-09 U1-K5 all — ADR-015 item 1 (BR-U1-45): text.'] })]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/not the canonical U1-K5 string/);
  });

  it('does not let an observation line alone attribute a change', () => {
    const r = run([
      commit({
        changedFiles: [`${SNAP}correct-reference.json`],
        addedChangesLines: [`2026-10-09 U1-K5 observation correct-reference — ${K5}: text.`],
      }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/adds no non-observation/);
  });

  it('ignores prose that names the label placeholder U1-Kn', () => {
    const r = run([
      commit({
        subject: 'test(u1): checker',
        addedChangesLines: ["U1 lines use the label `U1-Kn` in place of the commit hash (recover it with `git log --grep 'U1-Kn'`)."],
      }),
    ]);
    expect(r.ok).toBe(true);
  });

  it('fails any results/ change (BR-U1-42)', () => {
    const r = run([], ['results/correct-reference.json']);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/BR-U1-42/);
  });

  it('parses the K1 self-spec line and the K12 attribution with its trailing ADR', () => {
    expect(parseChangesLine(
      '2026-10-08 U1-K1 self — FR-19 (U1 Q3 B): core-modules kind: infrastructure; FF-P03 now binds infraLayer.',
    )).toEqual({ k: 1, observation: false, caseIds: ['self'], attribution: 'FR-19 (U1 Q3 B)' });
    expect(parseChangesLine(
      '2026-10-10 U1-K12 variant-b-pattern — FR-34 (FD U2 Q6 / U1 Q25), ADR-015 item 8: RE_EXPORTS traversed.',
    )).toMatchObject({ k: 12, caseIds: ['variant-b-pattern'] });
    expect(parseChangesLine(
      '2026-10-10 U1-K13 variant-d-subtle — FR-09 :File typing + FR-34 (FD U2 Q16 / U1 Q19): FF-C04 passes.',
    )).toMatchObject({ k: 13, attribution: 'FR-09 :File typing + FR-34 (FD U2 Q16 / U1 Q19)' });
  });

  it('main --self-test resolves to 1', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await expect(main(['--self-test'])).resolves.toBe(1);
    log.mockRestore();
  });
});

describe('checkChangeLog U3-R and U4-K labels (BR-U3-91, D-U3-6)', () => {
  const R2 = U3_ATTRIBUTIONS[2] ?? '';
  const R8 = U3_ATTRIBUTIONS[8] ?? '';
  const u3Subject = 'U3-R2: fix(u3): FR-12 mapping and hashed ids (FR-v1.2E-12, BR-U3-04)';

  it('holds the fourteen canonical attribution strings', () => {
    expect(Object.keys(U3_ATTRIBUTIONS)).toHaveLength(14);
    expect(U3_ATTRIBUTIONS[10]).toBe('FR-14 (FD U3 Q4 A): schema freeze, validateReport');
  });

  it('passes a compliant U3 snapshot commit', () => {
    const r = run([
      commit({
        subject: u3Subject,
        changedFiles: [`${SNAP}variant-a-structural.json`, `${SNAP}variant-c-everything.json`, 'tests/golden/CHANGES.md'],
        addedChangesLines: [
          `2026-10-09 U3-R2 variant-a-structural, variant-c-everything — ${R2}: violation ids hashed, order-independent.`,
        ],
      }),
    ]);
    expect(r).toEqual({ ok: true, problems: [] });
  });

  it('parses a U3 attribution that itself contains a colon (string equality, not regex)', () => {
    expect(parseU3ChangesLine(`2026-10-09 U3-R8 observation all — ${R8}: text.`)).toEqual({
      label: 'U3-R8', observation: true, caseIds: ['all'], attribution: R8,
    });
  });

  it('rejects an unknown R (U3-R15)', () => {
    const r = run([commit({ subject: 'test(u3): x', addedChangesLines: [`2026-10-09 U3-R15 all — ${R2}: text.`] })]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/unknown U3 label U3-R15/);
  });

  it('rejects a U3 line with a wrong attribution', () => {
    const r = run([
      commit({ subject: 'test(u3): x', addedChangesLines: ['2026-10-09 U3-R2 all — FR-12 (FD U3 Q2 A): text.'] }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/not the canonical U3-R2 string/);
  });

  it('rejects a U3 line with an unknown case id', () => {
    const r = run([commit({ subject: 'test(u3): x', addedChangesLines: [`2026-10-09 U3-R2 variant-e — ${R2}: text.`] })]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/unknown case id "variant-e"/);
  });

  it('rejects a U3 snapshot commit that adds no U3 line', () => {
    const r = run([commit({ subject: u3Subject, changedFiles: [`${SNAP}variant-a-structural.json`] })]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/U3-R2 changes snapshots but adds no non-observation U3-R2 line/);
  });

  it('rejects a U3 snapshot commit whose line carries another R', () => {
    const r = run([
      commit({
        subject: u3Subject,
        changedFiles: [`${SNAP}variant-a-structural.json`],
        addedChangesLines: [`2026-10-09 U3-R8 variant-a-structural — ${R8}: text.`],
      }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/adds no non-observation U3-R2 line/);
  });

  it('rejects a snapshot commit labelled with an R outside 1..14', () => {
    const r = run([
      commit({
        subject: 'U3-R15: fix(u3): x',
        changedFiles: [`${SNAP}variant-a-structural.json`],
        addedChangesLines: [`2026-10-09 U3-R2 variant-a-structural — ${R2}: text.`],
      }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/unattributable/);
  });

  it('passes a U4-K1 line on the shape check and lets it attribute a U4-K1 commit', () => {
    const r = run([
      commit({
        subject: 'U4-K1: feat(u4): neural results (FR-33)',
        changedFiles: [`${SNAP}correct-reference.json`],
        addedChangesLines: ['2026-10-09 U4-K1 correct-reference — FR-33 (FD U4 Q1 A): neural rows recorded.'],
      }),
    ]);
    expect(r).toEqual({ ok: true, problems: [] });
  });

  it('rejects a malformed U4 line', () => {
    const r = run([commit({ subject: 'test(u4): x', addedChangesLines: ['2026-10-09 U4-K1 all - FR-33: text.'] })]);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/malformed CHANGES.md line \(U4 shape/);
  });

  it('does not parse the Step 5 header paragraph as an entry', () => {
    const r = run([
      commit({
        subject: 'test(u3): change-log checker accepts U3-R and U4-K labels (BR-U3-91)',
        changedFiles: ['tests/golden/CHANGES.md'],
        addedChangesLines: [
          "U3 lines use the label `U3-Rn` (recover the hash with `git log --grep '^U3-Rn'`) in the grammar of the U3 code-generation plan D-U3-6.",
        ],
      }),
    ]);
    expect(r).toEqual({ ok: true, problems: [] });
  });

  it('self-test input reports the unlabelled commit and both bad U3 lines', () => {
    const problems = checkChangeLog(SELF_TEST_INPUT).problems.join('\n');
    expect(problems).toMatch(/unattributable/);
    expect(problems).toMatch(/unknown U3 label U3-R15/);
    expect(problems).toMatch(/not the canonical U3-R2 string/);
  });
});

describe('checkChangeLog Build and Test labels and results/ re-scope (BT Step 5; BR-U4-CAS-11; BR-U5b-56)', () => {
  const FULL = 'tests/golden/__snapshots_full__/';

  it('parses the three markers and a plain line', () => {
    expect(parseBtChangesLine('2026-10-09 BT-B1 all — FR-18: re-baseline @abc1234 (symbolic-only); snapshots unchanged.')).toMatchObject({ label: 'BT-B1', observation: false, caseIds: ['all'], attribution: 'FR-18', marker: undefined });
    expect(parseBtChangesLine('2026-10-09 BT-F46 baseline all — FR-36 (L0 lane): full-mode baseline.')).toMatchObject({ label: 'BT-F46', marker: 'baseline', observation: false });
    expect(parseBtChangesLine('2026-10-09 BT-F47 re-record, cause 1a2b3c4 correct-reference — BR-U4-CAS-11: 3 missing keys.')).toMatchObject({ marker: 're-record', caseIds: ['correct-reference'] });
    expect(parseBtChangesLine('2026-10-09 BT-D24 observation variant-b-pattern — ADR-016 e: no change.')).toMatchObject({ observation: true, marker: 'observation' });
  });

  it('rejects malformed BT lines: unknown group, no requirement id, unknown case id', () => {
    const r = run([commit({
      subject: 'test(bt): x',
      addedChangesLines: [
        '2026-10-09 BT-H1 all — FR-18: group H does not exist.',
        '2026-10-09 BT-B1 all — re-baseline: no requirement id.',
        '2026-10-09 BT-B1 variant-e — FR-18: unknown case.',
      ],
    })]);
    expect(r.ok).toBe(false);
    expect(r.problems.filter((p) => p.includes('Build and Test grammar'))).toHaveLength(2);
    expect(r.problems.join('\n')).toMatch(/unknown case id "variant-e"/);
  });

  it('passes a BT snapshot commit with exactly one line per changed case', () => {
    const r = run([commit({
      subject: 'BT-E31: fix(bt): FF-CV01 probe fixed (ADR-016 b)',
      changedFiles: [`${SNAP}variant-b-pattern.json`, `${SNAP}variant-c-everything.json`],
      addedChangesLines: [
        '2026-10-09 BT-E31 variant-b-pattern — ADR-016 b: FF-CV01 now fires.',
        '2026-10-09 BT-E31 variant-c-everything — ADR-016 b: FF-CV01 now fires.',
      ],
    })]);
    expect(r).toEqual({ ok: true, problems: [] });
  });

  it('fails a BT snapshot commit with two lines for one case, or none for a case', () => {
    const doubled = run([commit({
      subject: 'BT-B1: test(bt): x',
      changedFiles: [`${SNAP}correct-reference.json`],
      addedChangesLines: ['2026-10-09 BT-B1 correct-reference — FR-18: a.', '2026-10-09 BT-B1 all — FR-18: b.'],
    })]);
    expect(doubled.problems.join('\n')).toMatch(/adds 2 BT-B1 lines for it \(exactly one required\)/);
    const missing = run([commit({
      subject: 'BT-B1: test(bt): x',
      changedFiles: [`${SNAP}correct-reference.json`, `${SNAP}variant-a-structural.json`],
      addedChangesLines: ['2026-10-09 BT-B1 correct-reference — FR-18: a.'],
    })]);
    expect(missing.problems.join('\n')).toMatch(/"variant-a-structural" but no BT-B1 line/);
  });

  it('an observation or a line of another label does not attribute a BT snapshot commit', () => {
    const r = run([commit({
      subject: 'BT-B1: test(bt): x',
      changedFiles: [`${SNAP}correct-reference.json`],
      addedChangesLines: ['2026-10-09 BT-B1 observation all — FR-18: o.', '2026-10-09 BT-B2 all — FR-18: other step.'],
    })]);
    expect(r.problems.join('\n')).toMatch(/adds no non-observation BT-B1 line/);
  });

  it('treats the full-mode lane directory as a snapshot directory', () => {
    const unlabelled = run([commit({ subject: 'test(bt): lane', changedFiles: [`${FULL}correct-reference.json`] })]);
    expect(unlabelled.problems.join('\n')).toMatch(/unattributable/);
    const baseline = run([commit({
      subject: 'BT-F46: test(bt): full-mode golden lane L0 baseline',
      changedFiles: [`${FULL}correct-reference.json`],
      addedChangesLines: ['2026-10-09 BT-F46 baseline correct-reference — FR-36 (BR-U4-CAS-10): L0 baseline.'],
    })]);
    expect(baseline).toEqual({ ok: true, problems: [] });
  });

  it('allows results/pre-tag/** and results/<registered plan id>/** only', () => {
    expect(resultsPathAllowed('results/pre-tag/fixtures-abc1234.json', [])).toBe(true);
    expect(resultsPathAllowed('results/latency-gate/runs/r1.run.json', ['latency-gate'])).toBe(true);
    expect(resultsPathAllowed('results/latency-gate/runs/r1.run.json', [])).toBe(false);
    expect(resultsPathAllowed('results/other/x.json', ['latency-gate'])).toBe(false);
    expect(resultsPathAllowed('results/x.json', ['x.json'])).toBe(false);
    const r = checkChangeLog({ commits: [], resultsChanged: ['results/pre-tag/README.md', 'results/sensitivity/runs/a.run.json', 'results/scratch.json'], registeredPlanIds: ['sensitivity'] });
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatch(/BR-U1-42.*results\/scratch.json/);
  });

  it('self-test input also reports the doubled BT line and the unregistered results/ path', () => {
    const problems = checkChangeLog(SELF_TEST_INPUT).problems.join('\n');
    expect(problems).toMatch(/exactly one required/);
    expect(problems).toMatch(/results\/unregistered\/x.json/);
  });
});
