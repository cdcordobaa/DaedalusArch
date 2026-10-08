/**
 * Golden change-log checker (BR-U1-41, BR-U1-42; U1 code-generation plan D-U1-5, D-U1-7, D-U1-15).
 *
 * Pure module: `checkChangeLog` judges commit data, `collectFromGit` gathers it, `main` is the
 * CLI body. The runnable entry is `check-changes-log-cli.ts` (no exports, no direct-run guard).
 *
 * Rules:
 * - every commit touching `tests/golden/__snapshots__/` has a subject starting `U1-K<n>:`
 *   (n = 1..16); a snapshot commit without the label is unattributable;
 * - that commit adds at least one non-observation `CHANGES.md` line with the same label whose
 *   case ids are `all` or cover every changed snapshot case;
 * - every added `CHANGES.md` line carrying a U1 label (`U1-K<digit>`) matches the D-U1-7 format,
 *   its case-id slot holds only members of the closed set (`all`/`self` only alone), and its
 *   attribution is the canonical string of its K;
 * - any change under `results/` fails (BR-U1-42).
 */
import { execFileSync } from 'node:child_process';

export interface CommitInfo {
  readonly sha: string;
  readonly subject: string;
  readonly changedFiles: readonly string[];
  readonly addedChangesLines: readonly string[];
}

export interface CheckInput {
  readonly commits: readonly CommitInfo[];
  readonly resultsChanged: readonly string[];
}

export interface CheckResult {
  readonly ok: boolean;
  readonly problems: string[];
}

export const GOLDEN_BASE = 'f5fed3fbf1ba5ad84196b88dc80d474736534941';

export const SNAPSHOT_DIR = 'tests/golden/__snapshots__/';

export const CHANGES_FILE = 'tests/golden/CHANGES.md';

/** D-U1-7 shape check (the plan's regex, verbatim). */
export const CHANGES_LINE_RE =
  /^\d{4}-\d{2}-\d{2} U1-K(1[0-6]|[1-9]) (observation )?(all|self|[a-z-]+(, [a-z-]+)*) — .+ \(.+\)(, [^:]+)?: .+$/;

/** A line carries a U1 label when it names a numbered K (`U1-Kn` placeholders in prose do not). */
const U1_LABEL_RE = /U1-K\d/;

const SUBJECT_LABEL_RE = /^U1-K(1[0-6]|[1-9]):/;

export const CASE_IDS: readonly string[] = [
  'correct-reference',
  'variant-a-structural',
  'variant-b-pattern',
  'variant-c-everything',
  'variant-d-subtle',
];

const SOLE_IDS: readonly string[] = ['all', 'self'];

/** Canonical attribution strings per K (plan table "Canonical attribution strings"). */
export const CANONICAL_ATTRIBUTION: Readonly<Record<number, string>> = {
  1: 'FR-19 (U1 Q3 B)',
  2: 'FR-07 + FR-08 (Q1 grammar, Q2, Q5)',
  3: 'ADR-015 item 10 (U1 Q21 B)',
  4: 'ADR-015 item 10 (U1 Q22 B)',
  5: 'ADR-015 item 1 (U1 BR-U1-45)',
  6: 'FR-35 + NFR-07 (U1 Q15 A)',
  7: 'FR-35 (U1 Q16 A)',
  8: 'FR-35 (U1 Q17 A)',
  9: 'FR-19 + NFR-02 (U1 Q13 A)',
  10: 'FR-12 (U1 Q18 A)',
  11: 'FR-29 (U1 Q14 E)',
  12: 'FR-34 (FD U2 Q6 / U1 Q25), ADR-015 item 8',
  13: 'FR-09 :File typing + FR-34 (FD U2 Q16 / U1 Q19)',
  14: 'FR-22 (U1 Q9 A, Q12 A)',
  15: 'FR-20 (U1 Q6 A, Q7 A)',
  16: 'ADR-015 item 1 (ADR-016 a, U1 BR-U1-46)',
};

export interface ParsedChangesLine {
  readonly k: number;
  readonly observation: boolean;
  readonly caseIds: readonly string[];
  readonly attribution: string;
}

/** Parses one D-U1-7 line; returns the problem text instead when the line is malformed. */
export function parseChangesLine(line: string): ParsedChangesLine | string {
  const m = CHANGES_LINE_RE.exec(line);
  if (m === null) return `malformed CHANGES.md line (D-U1-7 format): ${line}`;
  const k = Number(m[1]);
  const caseIds = (m[3] ?? '').split(', ');
  const allowed = [...SOLE_IDS, ...CASE_IDS];
  for (const id of caseIds) {
    if (!allowed.includes(id)) return `unknown case id "${id}" in CHANGES.md line: ${line}`;
  }
  if (caseIds.length > 1 && caseIds.some((id) => SOLE_IDS.includes(id))) {
    return `"all"/"self" must be the only case id in CHANGES.md line: ${line}`;
  }
  const dash = line.indexOf(' — ');
  const rest = line.slice(dash + 3);
  const attribution = rest.slice(0, rest.indexOf(': '));
  const canonical = CANONICAL_ATTRIBUTION[k];
  if (attribution !== canonical) {
    return `attribution "${attribution}" is not the canonical U1-K${String(k)} string "${canonical ?? '?'}": ${line}`;
  }
  return { k, observation: m[2] !== undefined, caseIds, attribution };
}

function snapshotCase(file: string): string {
  return file.slice(SNAPSHOT_DIR.length).replace(/\.json$/, '');
}

export function checkChangeLog(input: CheckInput): CheckResult {
  const problems: string[] = [];

  for (const commit of input.commits) {
    const short = commit.sha.slice(0, 7);
    const parsed: ParsedChangesLine[] = [];
    for (const line of commit.addedChangesLines) {
      if (!U1_LABEL_RE.test(line)) continue;
      const p = parseChangesLine(line);
      if (typeof p === 'string') problems.push(`${short}: ${p}`);
      else parsed.push(p);
    }

    const snapshotFiles = commit.changedFiles.filter((f) => f.startsWith(SNAPSHOT_DIR));
    if (snapshotFiles.length === 0) continue;

    const label = SUBJECT_LABEL_RE.exec(commit.subject);
    if (label === null) {
      problems.push(`${short}: touches ${SNAPSHOT_DIR} without a U1-K<n>: subject label (unattributable): ${commit.subject}`);
      continue;
    }
    const k = Number(label[1]);
    const kl = `U1-K${String(k)}`;
    const attributing = parsed.filter((p) => p.k === k && !p.observation);
    if (attributing.length === 0) {
      problems.push(`${short}: ${kl} changes snapshots but adds no non-observation ${kl} line to ${CHANGES_FILE}`);
      continue;
    }
    const covered = new Set(attributing.flatMap((p) => p.caseIds));
    if (covered.has('all')) continue;
    for (const file of snapshotFiles) {
      const caseId = snapshotCase(file);
      if (!covered.has(caseId)) {
        problems.push(`${short}: ${kl} changes ${file} but no ${kl} line names "${caseId}" or "all"`);
      }
    }
  }

  for (const file of input.resultsChanged) {
    problems.push(`results/ changed (BR-U1-42): ${file}`);
  }

  return { ok: problems.length === 0, problems };
}

function git(args: readonly string[]): string {
  return execFileSync('git', args, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
}

function lines(text: string): string[] {
  return text.split('\n').filter((l) => l.length > 0);
}

/** Collects the checker input for `<base>..HEAD` (merge commits excluded). */
export function collectFromGit(base: string): CheckInput {
  const commits: CommitInfo[] = lines(git(['log', '--no-merges', '--format=%H%x09%s', `${base}..HEAD`])).map((row) => {
    const tab = row.indexOf('\t');
    const sha = row.slice(0, tab);
    const subject = row.slice(tab + 1);
    const changedFiles = lines(git(['show', '--name-only', '--format=', sha]));
    const addedChangesLines = lines(git(['show', '--format=', sha, '--', CHANGES_FILE]))
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1));
    return { sha, subject, changedFiles, addedChangesLines };
  });
  const resultsChanged = lines(git(['diff', '--name-only', `${base}..HEAD`, '--', 'results/']));
  return { commits, resultsChanged };
}

/** Built-in known-bad input for `--self-test`: one unlabelled snapshot-touching commit. */
export const SELF_TEST_INPUT: CheckInput = {
  commits: [
    {
      sha: '0000000000000000000000000000000000000000',
      subject: 'fix(u1): regenerate snapshots without a label',
      changedFiles: [`${SNAPSHOT_DIR}correct-reference.json`],
      addedChangesLines: [],
    },
  ],
  resultsChanged: [],
};

/** CLI body: `[--self-test] [<base>]`. Resolves to the process exit code. */
export function main(argv: readonly string[]): Promise<number> {
  return Promise.resolve(run(argv));
}

function run(argv: readonly string[]): number {
  if (argv.includes('--self-test')) {
    const result = checkChangeLog(SELF_TEST_INPUT);
    if (!result.ok && result.problems.some((p) => p.includes('unattributable'))) {
      console.log('self-test: checker reported the unlabelled snapshot commit (expected exit 1)');
      return 1;
    }
    console.log('self-test: checker did NOT report the unlabelled snapshot commit');
    return 0;
  }
  const base = argv.find((a) => !a.startsWith('--')) ?? GOLDEN_BASE;
  const input = collectFromGit(base);
  const result = checkChangeLog(input);
  if (result.ok) {
    console.log(`golden change log ok: ${String(input.commits.length)} commits checked since ${base.slice(0, 7)}`);
    return 0;
  }
  for (const p of result.problems) console.error(p);
  return 1;
}
