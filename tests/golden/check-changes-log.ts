/**
 * Golden change-log checker (BR-U1-41, BR-U1-42; U1 code-generation plan D-U1-5, D-U1-7, D-U1-15;
 * extended for U3 and U4 labels by BR-U3-91, U3 code-generation plan D-U3-6).
 *
 * Pure module: `checkChangeLog` judges commit data, `collectFromGit` gathers it, `main` is the
 * CLI body. The runnable entry is `check-changes-log-cli.ts` (no exports, no direct-run guard).
 *
 * Rules:
 * - every commit touching `tests/golden/__snapshots__/` has a subject starting with one label:
 *   `U1-K<n>:` (n = 1..16), `U3-R<n>:` (n = 1..14) or `U4-K<n>:` (n >= 1); a snapshot commit
 *   without a label is unattributable;
 * - that commit adds at least one non-observation `CHANGES.md` line with the same label whose
 *   case ids are `all` or cover every changed snapshot case;
 * - every added `CHANGES.md` line carrying a U1 label (`U1-K<digit>`) matches the D-U1-7 format,
 *   its case-id slot holds only members of the closed set (`all`/`self` only alone), and its
 *   attribution is the canonical string of its K;
 * - every added line that is a U3 entry (`<date> U3-R<digit>` at the label position; prose that
 *   only mentions `U3-Rn` is not an entry) matches the D-U3-6 grammar, has a known R (1..14), the
 *   D-U1-7 case-id closed set, and an attribution equal byte for byte to `U3_ATTRIBUTIONS[R]`;
 * - every added U4 entry (`<date> U4-K<digit>`) passes the shape check only (U4 supplies its
 *   canonical strings in its own plan);
 * - Build and Test (v1.2E Build and Test plan Step 5): subject label `BT-<A–G><n>:`; every added line
 *   that has `BT-` at the label position matches `<date> BT-<G><n> [baseline |observation |re-record, cause
 *   <commit/FR> ]<case ids|all> — <FR/NFR/ADR/BR/H/OI id …>: <text>` (BR-U4-CAS-11 for `re-record`);
 *   a snapshot-touching `BT-` commit adds **exactly one** non-observation line of its label per changed
 *   case (`all` covers every case and then must be the only one);
 * - snapshot directories: `tests/golden/__snapshots__/` and the full-mode lane `tests/golden/__snapshots_full__/`;
 * - a change under `results/` fails (BR-U1-42), except `results/pre-tag/**` (FR-18) and
 *   `results/<registered plan id>/**` (BR-U5b-56 re-scope by Build and Test; the RunRecord schema
 *   check of those directories is the guard test `tests/unit/scripts/u5b/guards.test.ts`).
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
  /** Ids of the registered experiment plans (`experiments/<id>/plan.json`); absent means none. */
  readonly registeredPlanIds?: readonly string[];
}

export interface CheckResult {
  readonly ok: boolean;
  readonly problems: string[];
}

export const GOLDEN_BASE = 'f5fed3fbf1ba5ad84196b88dc80d474736534941';

export const SNAPSHOT_DIR = 'tests/golden/__snapshots__/';

/** Full-mode golden lane (Build and Test Step 46, BR-U4-CAS-10/11). */
export const FULL_SNAPSHOT_DIR = 'tests/golden/__snapshots_full__/';

export const SNAPSHOT_DIRS: readonly string[] = [SNAPSHOT_DIR, FULL_SNAPSHOT_DIR];

export const CHANGES_FILE = 'tests/golden/CHANGES.md';

/** D-U1-7 shape check (the plan's regex, verbatim). */
export const CHANGES_LINE_RE =
  /^\d{4}-\d{2}-\d{2} U1-K(1[0-6]|[1-9]) (observation )?(all|self|[a-z-]+(, [a-z-]+)*) — .+ \(.+\)(, [^:]+)?: .+$/;

/** A line carries a U1 label when it names a numbered K (`U1-Kn` placeholders in prose do not). */
const U1_LABEL_RE = /U1-K\d/;

/** Subject label of a snapshot-touching commit: U1-K, U3-R or U4-K (D-U3-6). */
const SUBJECT_LABEL_RE = /^(U1-K(?:1[0-6]|[1-9])|U3-R(?:1[0-4]|[1-9])|U4-K[1-9][0-9]*|BT-[A-G][1-9][0-9]*):/;

/** A line is a Build and Test entry when `BT-` sits at the label position after the date. */
export const BT_ENTRY_TRIGGER_RE = /^\d{4}-\d{2}-\d{2} BT-/;

/**
 * Build and Test line: `<date> BT-<G><n> [marker ]<case ids> — <requirement id …>: <text>`, marker one of
 * `baseline`, `observation`, `re-record, cause <commit/FR>` (BR-U4-CAS-11).
 */
const BT_LINE_RE =
  /^\d{4}-\d{2}-\d{2} BT-([A-G])([1-9][0-9]*) (?:(observation|baseline|re-record, cause [^\s—]+) )?(all|self|[a-z-]+(?:, [a-z-]+)*) — ((?:FR|NFR|ADR|BR|H|OI|D)-[^:]*): .+$/;

export type BtMarker = 'baseline' | 'observation' | 're-record' | undefined;

/** A line is a U3 entry only when a numbered R sits at the label position after the date. */
export const U3_ENTRY_TRIGGER_RE = /^\d{4}-\d{2}-\d{2} U3-R[0-9]/;

/** D-U3-6 line: `<date> U3-Rn [observation ]<case ids> — <attribution>: <text>`. */
const U3_LINE_RE = /^\d{4}-\d{2}-\d{2} U3-R(\d+) (observation )?(all|self|[a-z-]+(?:, [a-z-]+)*) — (.+)$/;

const U3_R_RE = /^(1[0-4]|[1-9])$/;

/** A line is a U4 entry only when a numbered K sits at the label position after the date. */
export const U4_ENTRY_TRIGGER_RE = /^\d{4}-\d{2}-\d{2} U4-K[0-9]/;

/** U4 shape check (no canonical strings yet): `<date> U4-Kn [observation ]<case ids> — <attr>: <text>`. */
const U4_LINE_RE = /^\d{4}-\d{2}-\d{2} U4-K([1-9][0-9]*) (observation )?(all|self|[a-z-]+(?:, [a-z-]+)*) — ([^:]+(?::[^ ][^:]*)*): .+$/;

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

/**
 * Canonical U3 attribution strings per R (U3 code-generation plan, "Canonical attribution
 * strings"; the BLM §9 "Cause" cells, verbatim). Compared by string equality, not regex.
 */
export const U3_ATTRIBUTIONS: Readonly<Record<number, string>> = {
  1: 'Bundled C10 patch (types, optional fields, intent kept until R7)',
  2: 'FR-12 (FD U3 Q2 A; D-U0-12 pick)',
  3: 'FR-35 (FD U3 BR-U3-08/09)',
  4: 'FR-14 / BR-U1-40 (FD U3 BR-U3-10/11/12)',
  5: 'FR-11 (FD U3 E-1; ADR-017 item 5; F14)',
  6: 'FR-21 (FD U3 Q8 A); attributed cross-unit U1 test updates',
  7: 'FR-15 + FR-32 (FD U3 Q3 A); intent removed',
  8: 'FR-09 :File typing + FR-34 (FD U2 Q16 / U1 Q19)',
  9: 'FR-13 / FR-14 (FD U3 Q1, Q4, Q7); ADR-016 c',
  10: 'FR-14 (FD U3 Q4 A): schema freeze, validateReport',
  11: 'NFR-05 (FD U3 BR-U3-58)',
  12: 'D-U0-8 + FR-16 (FD U3 Q9 A)',
  13: 'C13 HTML (FD U3 BR-U3-84)',
  14: 'FR-35 (FD U3 BR-U3-61): byte-stability test; SCC fallback present, off (Q11)',
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
  const idProblem = caseIdProblem(caseIds, line);
  if (idProblem !== null) return idProblem;
  const dash = line.indexOf(' — ');
  const rest = line.slice(dash + 3);
  const attribution = rest.slice(0, rest.indexOf(': '));
  const canonical = CANONICAL_ATTRIBUTION[k];
  if (attribution !== canonical) {
    return `attribution "${attribution}" is not the canonical U1-K${String(k)} string "${canonical ?? '?'}": ${line}`;
  }
  return { k, observation: m[2] !== undefined, caseIds, attribution };
}

/** D-U1-7 closed case-id set; returns the problem text, or null when the ids are valid. */
function caseIdProblem(caseIds: readonly string[], line: string): string | null {
  const allowed = [...SOLE_IDS, ...CASE_IDS];
  for (const id of caseIds) {
    if (!allowed.includes(id)) return `unknown case id "${id}" in CHANGES.md line: ${line}`;
  }
  if (caseIds.length > 1 && caseIds.some((id) => SOLE_IDS.includes(id))) {
    return `"all"/"self" must be the only case id in CHANGES.md line: ${line}`;
  }
  return null;
}

/** A parsed entry of any unit, keyed by its label (`U1-K5`, `U3-R2`, `U4-K1`). */
export interface LabelledEntry {
  readonly label: string;
  readonly observation: boolean;
  readonly caseIds: readonly string[];
  readonly attribution: string;
}

/** Parses one D-U3-6 line; returns the problem text instead when the line is not valid. */
export function parseU3ChangesLine(line: string): LabelledEntry | string {
  const m = U3_LINE_RE.exec(line);
  if (m === null) return `malformed CHANGES.md line (D-U3-6 format): ${line}`;
  const rText = m[1] ?? '';
  if (!U3_R_RE.test(rText)) return `unknown U3 label U3-R${rText} (U3-R1..U3-R14) in CHANGES.md line: ${line}`;
  const r = Number(rText);
  const caseIds = (m[3] ?? '').split(', ');
  const idProblem = caseIdProblem(caseIds, line);
  if (idProblem !== null) return idProblem;
  const canonical = U3_ATTRIBUTIONS[r] ?? '';
  const rest = m[4] ?? '';
  if (!rest.startsWith(`${canonical}: `) || rest.length === canonical.length + 2) {
    return `attribution is not the canonical U3-R${rText} string "${canonical}" followed by ": <text>": ${line}`;
  }
  return { label: `U3-R${rText}`, observation: m[2] !== undefined, caseIds, attribution: canonical };
}

/** Shape check of one U4 line (D-U3-6 hand-off); returns the problem text when malformed. */
export function parseU4ChangesLine(line: string): LabelledEntry | string {
  const m = U4_LINE_RE.exec(line);
  if (m === null) return `malformed CHANGES.md line (U4 shape, D-U3-6): ${line}`;
  const caseIds = (m[3] ?? '').split(', ');
  const idProblem = caseIdProblem(caseIds, line);
  if (idProblem !== null) return idProblem;
  return { label: `U4-K${m[1] ?? ''}`, observation: m[2] !== undefined, caseIds, attribution: m[4] ?? '' };
}

/** Parses one Build and Test line; returns the problem text instead when the line is not valid. */
export function parseBtChangesLine(line: string): (LabelledEntry & { readonly marker: BtMarker }) | string {
  const m = BT_LINE_RE.exec(line);
  if (m === null) {
    return `malformed CHANGES.md line (Build and Test grammar: <date> BT-<A-G><n> [baseline |observation |re-record, cause <ref> ]<case ids> — <FR/ADR id>: <text>): ${line}`;
  }
  const caseIds = (m[4] ?? '').split(', ');
  const idProblem = caseIdProblem(caseIds, line);
  if (idProblem !== null) return idProblem;
  const rawMarker = m[3];
  const marker: BtMarker = rawMarker === undefined ? undefined : rawMarker.startsWith('re-record') ? 're-record' : (rawMarker as 'baseline' | 'observation');
  return { label: `BT-${m[1] ?? ''}${m[2] ?? ''}`, observation: marker === 'observation', caseIds, attribution: m[5] ?? '', marker };
}

/** Routes an added CHANGES.md line to its unit's grammar; null when the line is not an entry. */
function parseEntry(line: string): LabelledEntry | string | null {
  if (BT_ENTRY_TRIGGER_RE.test(line)) return parseBtChangesLine(line);
  if (U3_ENTRY_TRIGGER_RE.test(line)) return parseU3ChangesLine(line);
  if (U4_ENTRY_TRIGGER_RE.test(line)) return parseU4ChangesLine(line);
  if (!U1_LABEL_RE.test(line)) return null;
  const p = parseChangesLine(line);
  if (typeof p === 'string') return p;
  return { label: `U1-K${String(p.k)}`, observation: p.observation, caseIds: p.caseIds, attribution: p.attribution };
}

function snapshotDirOf(file: string): string | undefined {
  return SNAPSHOT_DIRS.find((d) => file.startsWith(d));
}

function snapshotCase(file: string): string {
  return file.slice((snapshotDirOf(file) ?? '').length).replace(/\.json$/, '');
}

/** BR-U1-42 as re-scoped by Build and Test (BR-U5b-56): the only paths allowed under `results/`. */
export function resultsPathAllowed(file: string, registeredPlanIds: readonly string[]): boolean {
  const m = /^results\/([^/]+)\/.+/.exec(file);
  if (m === null) return false;
  const top = m[1] ?? '';
  return top === 'pre-tag' || registeredPlanIds.includes(top);
}

/** Exactly-one rule of a `BT-` snapshot commit: problems per changed case (0 or more than one line). */
function btCoverageProblems(short: string, label: string, attributing: readonly LabelledEntry[], cases: readonly string[]): string[] {
  const problems: string[] = [];
  for (const c of [...new Set(cases)]) {
    const n = attributing.filter((p) => p.caseIds.includes('all') || p.caseIds.includes(c)).length;
    if (n === 0) problems.push(`${short}: ${label} changes snapshot case "${c}" but no ${label} line names it or "all"`);
    else if (n > 1) problems.push(`${short}: ${label} changes snapshot case "${c}" and adds ${String(n)} ${label} lines for it (exactly one required)`);
  }
  return problems;
}

export function checkChangeLog(input: CheckInput): CheckResult {
  const problems: string[] = [];

  for (const commit of input.commits) {
    const short = commit.sha.slice(0, 7);
    const parsed: LabelledEntry[] = [];
    for (const line of commit.addedChangesLines) {
      const p = parseEntry(line);
      if (p === null) continue;
      if (typeof p === 'string') problems.push(`${short}: ${p}`);
      else parsed.push(p);
    }

    const snapshotFiles = commit.changedFiles.filter((f) => snapshotDirOf(f) !== undefined);
    if (snapshotFiles.length === 0) continue;

    const label = SUBJECT_LABEL_RE.exec(commit.subject);
    if (label === null) {
      problems.push(
        `${short}: touches ${SNAPSHOT_DIRS.join(' or ')} without a U1-K<n>:, U3-R<n>:, U4-K<n>: or BT-<A-G><n>: subject label (unattributable): ${commit.subject}`,
      );
      continue;
    }
    const kl = label[1] ?? '';
    const attributing = parsed.filter((p) => p.label === kl && !p.observation);
    if (attributing.length === 0) {
      problems.push(`${short}: ${kl} changes snapshots but adds no non-observation ${kl} line to ${CHANGES_FILE}`);
      continue;
    }
    if (kl.startsWith('BT-')) {
      problems.push(...btCoverageProblems(short, kl, attributing, snapshotFiles.map(snapshotCase)));
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

  const planIds = input.registeredPlanIds ?? [];
  for (const file of input.resultsChanged) {
    if (!resultsPathAllowed(file, planIds)) {
      problems.push(`results/ changed (BR-U1-42; only results/pre-tag/** and results/<registered plan id>/** are allowed, BR-U5b-56): ${file}`);
    }
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
  return { commits, resultsChanged, registeredPlanIds: registeredPlanIds() };
}

/** Plan ids of the tracked `experiments/<id>/plan.json` files whose `id` equals the directory name. */
export function registeredPlanIds(): string[] {
  const out: string[] = [];
  for (const f of lines(git(['ls-files', 'experiments/*/plan.json']))) {
    const dir = f.split('/')[1] ?? '';
    try {
      const id = (JSON.parse(git(['show', `HEAD:${f}`])) as { readonly id?: unknown }).id;
      if (id === dir) out.push(dir);
    } catch {
      // an unreadable plan registers nothing
    }
  }
  return out.sort();
}

/**
 * Built-in known-bad input for `--self-test`: one unlabelled snapshot-touching commit, plus one
 * U3 line with an unknown R and one with a wrong attribution (BR-U3-91), one `BT-B1` snapshot commit
 * with two lines for one case, and one `results/` path outside the re-scoped allow-list.
 */
export const SELF_TEST_INPUT: CheckInput = {
  commits: [
    {
      sha: '0000000000000000000000000000000000000000',
      subject: 'fix(u1): regenerate snapshots without a label',
      changedFiles: [`${SNAPSHOT_DIR}correct-reference.json`],
      addedChangesLines: [],
    },
    {
      sha: '1111111111111111111111111111111111111111',
      subject: 'test(u3): self-test lines',
      changedFiles: [CHANGES_FILE],
      addedChangesLines: [
        '2026-10-08 U3-R15 all — FR-12 (FD U3 Q2 A; D-U0-12 pick): unknown R.',
        '2026-10-08 U3-R2 all — FR-12 (FD U3 Q2 A): wrong attribution.',
      ],
    },
    {
      sha: '2222222222222222222222222222222222222222',
      subject: 'BT-B1: test(bt): re-baseline with two lines for one case',
      changedFiles: [`${SNAPSHOT_DIR}variant-b-pattern.json`, CHANGES_FILE],
      addedChangesLines: [
        '2026-10-08 BT-B1 variant-b-pattern — FR-18: first line.',
        '2026-10-08 BT-B1 all — FR-18: second line covering the same case.',
      ],
    },
  ],
  resultsChanged: ['results/unregistered/x.json'],
  registeredPlanIds: ['fixtures'],
};

/** CLI body: `[--self-test] [<base>]`. Resolves to the process exit code. */
export function main(argv: readonly string[]): Promise<number> {
  return Promise.resolve(run(argv));
}

function run(argv: readonly string[]): number {
  if (argv.includes('--self-test')) {
    const result = checkChangeLog(SELF_TEST_INPUT);
    const reported = (text: string): boolean => result.problems.some((p) => p.includes(text));
    if (!result.ok && reported('unattributable') && reported('unknown U3 label U3-R15') && reported('canonical U3-R2')
      && reported('exactly one required') && reported('results/unregistered/x.json')) {
      console.log('self-test: checker reported the unlabelled snapshot commit, both bad U3 lines, the doubled BT-B1 line and the unregistered results/ path (expected exit 1)');
      return 1;
    }
    console.log('self-test: checker did NOT report every known-bad input');
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
