/**
 * `check_diff`: `check_file`'s rules over a unified diff (`git diff` or `diff -u` output). A new file is checked
 * whole; a modified or renamed file is checked on its added lines only, with the new-file line numbers, so existing
 * code is not re-reported. Deleted and non-source files are skipped with a reason. Pure.
 */
import type { ParsedSpec } from '../shared/types/spec.js';
import { checkSource } from './file-check.js';
import { normalisePath, resolveLayer } from './layer-resolver.js';
import type { DiffCheckResult, FileVerdict } from './types.js';

export interface DiffFile {
  readonly oldPath: string | null;
  readonly newPath: string | null;
  /** Added lines with their 1-based line number in the new file. */
  readonly added: readonly { readonly line: number; readonly text: string }[];
}

const SOURCE_FILE_RE = /\.(?:[cm]?[jt]sx?)$/;
const HUNK_RE = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function stripPrefix(raw: string): string | null {
  const p = raw.split('\t')[0]?.trim() ?? '';
  if (p === '/dev/null') return null;
  return normalisePath(p.replace(/^[ab]\//, ''));
}

/**
 * Files of a unified diff, in order. Hunk bodies are consumed by their header counts, so a removed line that reads
 * `--- x` is not taken for a file header. Tolerates missing `diff --git` headers (plain `diff -u`).
 */
export function parseUnifiedDiff(diff: string): readonly DiffFile[] {
  const files: {
    oldPath: string | null;
    newPath: string | null;
    added: { line: number; text: string }[];
  }[] = [];
  let current: (typeof files)[number] | undefined;
  let newLine = 0;
  let oldLeft = 0;
  let newLeft = 0;
  for (const line of diff.split(/\r?\n/)) {
    if (current !== undefined && (oldLeft > 0 || newLeft > 0)) {
      if (line.startsWith('+')) {
        current.added.push({ line: newLine, text: line.slice(1) });
        newLine++;
        newLeft--;
      } else if (line.startsWith('-')) {
        oldLeft--;
      } else if (line.startsWith(' ') || line === '') {
        newLine++;
        newLeft--;
        oldLeft--;
      }
      // '\ No newline at end of file' changes no counter.
      continue;
    }
    if (line.startsWith('--- ')) {
      current = { oldPath: stripPrefix(line.slice(4)), newPath: null, added: [] };
      files.push(current);
      continue;
    }
    if (line.startsWith('+++ ') && current !== undefined) {
      current.newPath = stripPrefix(line.slice(4));
      continue;
    }
    const hunk = HUNK_RE.exec(line);
    if (hunk !== null && current !== undefined) {
      oldLeft = hunk[1] === undefined ? 1 : Number(hunk[1]);
      newLine = Number(hunk[2]);
      newLeft = hunk[3] === undefined ? 1 : Number(hunk[3]);
    }
  }
  return files;
}

function worst(verdicts: readonly FileVerdict[]): FileVerdict {
  if (verdicts.includes('violations')) return 'violations';
  return verdicts.includes('unknown') ? 'unknown' : 'clean';
}

export function checkDiff(spec: ParsedSpec, diff: string, options: { readonly hints?: boolean } = {}): DiffCheckResult {
  const files: DiffCheckResult['files'][number][] = [];
  const skipped: { path: string; reason: string }[] = [];

  for (const f of parseUnifiedDiff(diff)) {
    if (f.newPath === null) {
      if (f.oldPath !== null) skipped.push({ path: f.oldPath, reason: 'deleted' });
      continue;
    }
    if (!SOURCE_FILE_RE.test(f.newPath)) {
      skipped.push({ path: f.newPath, reason: 'not a TypeScript/JavaScript source file' });
      continue;
    }
    const change = f.oldPath === null ? 'added' : f.oldPath === f.newPath ? 'modified' : 'renamed';
    const lines = f.added.map((a) => a.line);
    const result = checkSource(spec, {
      path: f.newPath,
      content: f.added.map((a) => a.text).join('\n'),
      lineOf: (l) => lines[l - 1] ?? l,
      ...(options.hints === true ? { hints: true } : {}),
    });
    const notes = [...result.notes];
    if (change === 'renamed' && f.oldPath !== null) {
      const from = resolveLayer(spec, f.oldPath)?.layer ?? null;
      if (from !== result.layer) {
        notes.push(
          `moved from ${from ?? 'no layer'} to ${result.layer ?? 'no layer'}: unchanged imports are not in the diff, so run check_file on the whole file`,
        );
      }
    }
    if (change !== 'added') notes.push('only added lines were checked');
    files.push({ ...result, notes, change });
  }

  const verdict = worst(files.map((f) => f.verdict));
  const count = files.reduce((n, f) => n + f.violations.length, 0);
  const dirty = files.filter((f) => f.verdict === 'violations').map((f) => f.path);
  const summary =
    verdict === 'violations'
      ? `${String(count)} violation(s) in ${dirty.join(', ')}; apply each fix.`
      : verdict === 'unknown'
        ? `No violation found in ${String(files.length)} file(s); some alias imports are unresolved.`
        : `${String(files.length)} source file(s) checked: clean.`;
  return { verdict, summary, files, skipped };
}
