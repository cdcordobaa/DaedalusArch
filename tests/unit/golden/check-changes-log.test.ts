import { checkChangeLog, main, parseChangesLine } from '../../golden/check-changes-log.js';
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
