/**
 * Prepared corpus bases (FR-36; BR-U5b-76; U5b domain-entities §8, R-14).
 *
 * Emits one U5a `PreparedBase` (imported type, `scripts/lib/mutation/types.ts`, never restated) per fetched corpus
 * entry: `baseKind = 'corpus'`, `dir` (clone + `subPath`), `baseCommit` = `commitSha`, `tsconfigPath`, `tscPath`
 * resolved from `CorpusEntry.tsc` (`project` → the clone root, `repo-pinned` → this repository's root) and
 * `tscVersion` measured as `node <tscPath> --version` (must equal the registered value, `PREP_TSC_MISMATCH`),
 * `installLockSha256`, `overlays` `{path, sha256}` with `path` relative to `dir` and `sha256` = the overlaid file's
 * content in the fetched clone (U5a `copyBase` checks exactly that; OI-U5a-17 hand-off, DV-U5b-20), `specPath`.
 * The value is built through U5a's validating constructor `makePreparedBase` (`PREP_INVALID`).
 *
 * `capped` / `judgeSelection` are copied from U4's baseline selection stored for the base, never computed:
 * one row per neural function with `candidateUnitIds`, `selectedUnitIds` and the unit → file mapping
 * (`unitFiles`, the report's `unitResults[].filePaths`; OI-11). No stored selection → `PREP_SELECTION_MISSING`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { ProcessRunner } from '../src/shared/interfaces/process-runner.js';
import { buildChildEnv, NodeProcessRunner } from '../src/shared/process/node-process-runner.js';
import { CORPUS_FILE, loadCorpus, sha256Hex } from './lib/corpus.js';
import { makePreparedBase } from './lib/mutation/prepare.js';
import type { CorpusEntry } from './lib/corpus.js';
import type { JudgeSelection, PreparedBase } from './lib/mutation/types.js';

export const PREP_SELECTION_MISSING = 'PREP_SELECTION_MISSING';
export const PREP_SELECTION_UNMAPPED = 'PREP_SELECTION_UNMAPPED';
export const PREP_TSC_MISMATCH = 'PREP_TSC_MISMATCH';
export const PREP_DIR_MISSING = 'PREP_DIR_MISSING';
export const PREP_INVALID = 'PREP_INVALID';

export type PrepCode = typeof PREP_SELECTION_MISSING | typeof PREP_SELECTION_UNMAPPED | typeof PREP_TSC_MISMATCH | typeof PREP_DIR_MISSING | typeof PREP_INVALID;

/** U4's baseline selection for one base, as stored from its baseline full-mode report (U4 `NeuralResultRow`). */
export interface StoredBaselineSelection {
  readonly projectId: string;
  readonly functions: readonly {
    readonly template: JudgeSelection['template'];
    readonly functionId: string;
    readonly candidateUnitIds: readonly string[];
    readonly selectedUnitIds: readonly string[];
    /** unitId → file paths (`unitResults[].filePaths`). */
    readonly unitFiles: Readonly<Record<string, readonly string[]>>;
  }[];
}

export type PrepOutcome = { readonly ok: true; readonly base: PreparedBase } | { readonly ok: false; readonly projectId: string; readonly code: PrepCode; readonly detail: string };

export interface PrepOptions {
  readonly repoRoot: string;
  readonly runner: ProcessRunner;
  readonly env: Readonly<Record<string, string>>;
}

/** `Version 5.9.3` → `5.9.3`. */
export function parseTscVersion(stdout: string): string | undefined {
  return /Version\s+(\S+)/.exec(stdout)?.[1];
}

export function judgeSelectionOf(stored: StoredBaselineSelection): { ok: true; value: JudgeSelection[] } | { ok: false; detail: string } {
  const out: JudgeSelection[] = [];
  for (const f of stored.functions) {
    const files = new Set<string>();
    for (const u of f.selectedUnitIds) {
      const paths = f.unitFiles[u];
      if (paths === undefined) return { ok: false, detail: `${f.functionId}: selected unit ${u} has no file mapping` };
      for (const p of paths) files.add(p);
    }
    out.push({
      template: f.template, functionId: f.functionId,
      capped: f.selectedUnitIds.length < f.candidateUnitIds.length,
      selectedFiles: [...files].sort(),
    });
  }
  return { ok: true, value: out.sort((a, b) => (a.functionId < b.functionId ? -1 : a.functionId > b.functionId ? 1 : 0)) };
}

export async function prepareBase(entry: CorpusEntry, cloneDir: string, stored: StoredBaselineSelection | undefined, o: PrepOptions): Promise<PrepOutcome> {
  const id = entry.name;
  const bad = (code: PrepCode, detail: string): PrepOutcome => ({ ok: false, projectId: id, code, detail });
  if (stored?.projectId !== id) return bad(PREP_SELECTION_MISSING, `no stored baseline selection for ${id}`);
  const sel = judgeSelectionOf(stored);
  if (!sel.ok) return bad(PREP_SELECTION_UNMAPPED, sel.detail);
  const dir = entry.subPath !== undefined ? join(cloneDir, entry.subPath) : cloneDir;
  if (!existsSync(dir)) return bad(PREP_DIR_MISSING, dir);
  const tscPath = resolve(entry.tsc.kind === 'project' ? cloneDir : o.repoRoot, entry.tsc.tscPath);
  const r = await o.runner.run('node', [tscPath, '--version'], { env: o.env, timeoutMs: 60_000 });
  const measured = r.success && r.data.exitCode === 0 ? parseTscVersion(r.data.stdout) : undefined;
  if (measured === undefined) return bad(PREP_TSC_MISMATCH, `node ${tscPath} --version failed`);
  if (measured !== entry.tsc.tscVersion) return bad(PREP_TSC_MISMATCH, `measured ${measured} ≠ registered ${entry.tsc.tscVersion}`);
  const overlays: { path: string; sha256: string }[] = [];
  for (const ov of entry.overlays) {
    const file = join(cloneDir, ...ov.path.split('/'));
    const rel = relative(dir, file).split(sep).join('/');
    if (rel.startsWith('..') || isAbsolute(rel)) return bad(PREP_INVALID, `overlay ${ov.path} lies outside the project directory`);
    if (!existsSync(file)) return bad(PREP_INVALID, `overlay ${ov.path} not applied (file missing)`);
    overlays.push({ path: rel, sha256: sha256Hex(readFileSync(file)) });
  }
  const made = makePreparedBase({
    projectId: id,
    baseKind: 'corpus',
    dir,
    baseCommit: entry.commitSha,
    tsconfigPath: entry.tsconfigPath ?? 'tsconfig.json',
    tscPath,
    tscVersion: measured,
    ...(entry.install.policy === 'npm-ci-ignore-scripts' ? { installLockSha256: entry.install.lockSha256 } : {}),
    overlays,
    specPath: entry.specPath,
    judgeSelection: sel.value,
  });
  if (!made.success) return bad(PREP_INVALID, made.errors.map((e) => e.message).join('; '));
  return { ok: true, base: made.data };
}

// --- CLI ----------------------------------------------------------------------------------------------------------

export interface PrepIo { readonly out: (t: string) => void; readonly err: (t: string) => void }

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** `--clones <dir> --selections <dir of <name>.json> [--corpus …] [--only a,b] [--out <file>]`. */
export async function main(argv: readonly string[], repoRoot: string, io: PrepIo, runner: ProcessRunner = new NodeProcessRunner()): Promise<number> {
  if (argv.includes('--self-test')) {
    // BR-U5b-73: built-in known-bad input, a stored selection whose selected unit has no file mapping (OI-11),
    // must be refused with PREP_SELECTION_UNMAPPED before any directory or subprocess is touched.
    const r = judgeSelectionOf({
      projectId: 'self-test',
      functions: [{ template: 'intent-alignment', functionId: 'FF-N01', candidateUnitIds: ['u1'], selectedUnitIds: ['u1'], unitFiles: {} }],
    });
    io.err(r.ok ? 'self-test: an unmapped selection was accepted\n' : `self-test: ${PREP_SELECTION_UNMAPPED}: ${r.detail}\n`);
    return 1;
  }
  const clones = arg(argv, '--clones');
  const selections = arg(argv, '--selections');
  if (clones === undefined || selections === undefined) {
    io.err('usage: prepare-bases-cli.ts --clones <dir> --selections <dir> [--corpus <file>] [--only a,b] [--out <file>]\n');
    return 2;
  }
  const loaded = loadCorpus(resolve(repoRoot, arg(argv, '--corpus') ?? CORPUS_FILE), repoRoot);
  if (!loaded.ok) {
    io.err(`${loaded.errors.join('\n')}\n`);
    return 1;
  }
  const only = arg(argv, '--only')?.split(',');
  const o: PrepOptions = { repoRoot, runner, env: buildChildEnv(process.env, ['PATH', 'HOME']) };
  const bases: PreparedBase[] = [];
  let bad = 0;
  for (const e of loaded.corpus.entries.filter((x) => only === undefined || only.includes(x.name))) {
    const sp = join(selections, `${e.name}.json`);
    const stored = existsSync(sp) ? (JSON.parse(readFileSync(sp, 'utf8')) as StoredBaselineSelection) : undefined;
    const r = await prepareBase(e, resolve(clones, e.name), stored, o);
    if (r.ok) bases.push(r.base);
    else {
      bad++;
      io.err(`${r.projectId}: ${r.code}: ${r.detail}\n`);
    }
  }
  const text = `${JSON.stringify(bases, null, 2)}\n`;
  const out = arg(argv, '--out');
  if (out !== undefined) writeFileSync(out, text);
  else io.out(text);
  return bad === 0 ? 0 : 1;
}
