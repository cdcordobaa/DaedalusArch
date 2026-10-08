/**
 * Pre-registration bump tool (BR-U5b-50, 51; v1.2E Build and Test plan Step 5; D-U5a-13 entry form in
 * `register-prereg-cli.ts`).
 *
 * `bumpPreRegistration` reads the committed `corpus/prereg.json`, rebuilds the registration over every committed
 * registered artefact with `buildPreRegistration` and returns version + 1 with the required `reason` and
 * `previous[] += {version, commit}` (the commit that wrote the current version). It refuses when:
 * - the reason is empty (`reason-empty`);
 * - the working tree has uncommitted registered artefacts, modified, staged, deleted or untracked
 *   (`artefacts-uncommitted`), because the hashes would not describe a commit;
 * - `corpus/prereg.json` is missing, invalid, or differs from its committed blob (`prereg-unreadable`,
 *   `prereg-uncommitted`).
 * The caller commits the written file; the `--check-prereg` gate (BR-U5b-50) then applies unchanged.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildPreRegistration, isRegisteredPath, loadPreRegistration, PREREG_FILE, validatePreRegistration,
} from './lib/prereg.js';
import type { PreRegistration } from './lib/prereg.js';

export const PREREG_BUMP_REFUSED = 'PREREG_BUMP_REFUSED';

export type BumpRefusal = 'reason-empty' | 'artefacts-uncommitted' | 'prereg-unreadable' | 'prereg-uncommitted' | 'prereg-invalid';

export type BumpResult =
  | { readonly ok: true; readonly value: PreRegistration; readonly text: string }
  | { readonly ok: false; readonly code: typeof PREREG_BUMP_REFUSED; readonly refusal: BumpRefusal; readonly detail: string };

export interface BumpOptions {
  readonly reason: string;
  readonly now: Date;
  /** Where the prereg schema is read from (default `repoRoot`). */
  readonly schemaRoot?: string;
}

function git(repoRoot: string, args: readonly string[]): string {
  return execFileSync('git', [...args], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function refuse(refusal: BumpRefusal, detail: string): BumpResult {
  return { ok: false, code: PREREG_BUMP_REFUSED, refusal, detail };
}

/** Registered paths with any uncommitted change (`git status --porcelain -z`, untracked files included). */
export function uncommittedRegisteredPaths(repoRoot: string): string[] {
  const entries = git(repoRoot, ['status', '--porcelain', '-z', '--untracked-files=all']).split('\0').filter((e) => e !== '');
  const paths: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] ?? '';
    const status = entry.slice(0, 2);
    paths.push(entry.slice(3));
    if (status.startsWith('R') || status.startsWith('C')) i++; // the next entry is the source path of a rename or copy
  }
  return [...new Set(paths.filter(isRegisteredPath))].sort();
}

/** `registeredAt` in the v1 form (seconds, `Z`). */
export function registeredAtOf(now: Date): string {
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function bumpPreRegistration(repoRoot: string, options: BumpOptions): BumpResult {
  const reason = options.reason.trim();
  if (reason === '') return refuse('reason-empty', 'a bump needs a non-empty --reason (BR-U5b-50)');
  const schemaRoot = options.schemaRoot ?? repoRoot;

  const dirty = uncommittedRegisteredPaths(repoRoot);
  if (dirty.length > 0) return refuse('artefacts-uncommitted', `uncommitted registered artefacts: ${dirty.join(', ')}`);

  const loaded = loadPreRegistration(repoRoot, schemaRoot);
  if (!loaded.ok) return refuse('prereg-unreadable', loaded.detail);
  const current = loaded.value;
  let commit: string;
  try {
    const head = git(repoRoot, ['rev-parse', `HEAD:${PREREG_FILE}`]).trim();
    const work = git(repoRoot, ['hash-object', '--', PREREG_FILE]).trim();
    if (head !== work) return refuse('prereg-uncommitted', `${PREREG_FILE} differs from its committed blob`);
    commit = git(repoRoot, ['log', '-1', '--format=%H', '--', PREREG_FILE]).trim();
  } catch {
    return refuse('prereg-uncommitted', `${PREREG_FILE} is not committed at HEAD`);
  }
  if (commit === '') return refuse('prereg-uncommitted', `no commit wrote ${PREREG_FILE}`);

  const value = buildPreRegistration(repoRoot, {
    version: current.version + 1,
    registeredAt: registeredAtOf(options.now),
    reason,
    matchingRuleVersion: current.matchingRuleVersion,
    labellingBudgetCalls: current.labellingBudgetCalls,
    previous: [...(current.previous ?? []), { version: current.version, commit }],
  });
  const problems = validatePreRegistration(value, schemaRoot);
  if (problems.length > 0) return refuse('prereg-invalid', problems.join('; '));
  return { ok: true, value, text: `${JSON.stringify(value, null, 2)}\n` };
}

export interface BumpMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly now: () => Date;
  /** Where the prereg schema is read from (default `repoRoot`). */
  readonly schemaRoot?: string;
}

const USAGE = `usage: npx tsx scripts/register-prereg-cli.ts --reason <text> [--dry-run]
       npx tsx scripts/register-prereg-cli.ts --self-test | --help

Writes corpus/prereg.json version + 1 over every committed registered artefact, with the reason and
previous[] += {version, commit}. Commit the file afterwards (BR-U5b-50).
Exit: 0 written (or printed with --dry-run); 1 refused (PREREG_BUMP_REFUSED); 2 usage error.
`;

/** CLI body. Resolves to the exit code. */
export function main(argv: readonly string[], repoRoot: string, io: BumpMainIo): Promise<number> {
  return Promise.resolve(run(argv, repoRoot, io));
}

function run(argv: readonly string[], repoRoot: string, io: BumpMainIo): number {
  if (argv.includes('--help')) { io.out(USAGE); return 0; }
  if (argv.includes('--self-test')) {
    // Known-bad input: an empty reason is refused before any file is read.
    const r = bumpPreRegistration(repoRoot, { reason: '   ', now: io.now() });
    if (!r.ok && r.refusal === 'reason-empty') {
      io.out('self-test: empty reason refused with PREREG_BUMP_REFUSED reason-empty (expected exit 1)\n');
      return 1;
    }
    io.err('self-test: the empty reason was NOT refused\n');
    return 0;
  }
  let reason: string | undefined;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--reason') { reason = argv[++i]; continue; }
    if (a === '--dry-run') { dryRun = true; continue; }
    io.err(`unknown argument ${String(a)}\n${USAGE}`);
    return 2;
  }
  if (reason === undefined) { io.err(`--reason is required\n${USAGE}`); return 2; }
  const r = bumpPreRegistration(repoRoot, { reason, now: io.now(), ...(io.schemaRoot !== undefined && { schemaRoot: io.schemaRoot }) });
  if (!r.ok) { io.err(`${r.code} ${r.refusal}: ${r.detail}\n`); return 1; }
  if (dryRun) { io.out(r.text); return 0; }
  writeFileSync(join(repoRoot, PREREG_FILE), r.text);
  io.out(`${PREREG_FILE} v${String(r.value.version)} written (${String(r.value.artefacts.length)} artefacts); commit it before any run it covers\n`);
  return 0;
}
