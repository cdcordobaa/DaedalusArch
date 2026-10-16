/**
 * `check_diff`: `check_file`'s rules over a unified diff (`git diff` or `diff -u` output). A new file is checked
 * whole; a modified or renamed file is checked on its added lines only, with the new-file line numbers, so existing
 * code is not re-reported. Deleted and non-source files are skipped with a reason. Pure.
 */
import type { ParsedSpec } from '../shared/types/spec.js';
import { blockingSummaryOf, checkSource } from './file-check.js';
import { normalisePath, resolveLayer } from './layer-resolver.js';
import { ProjectView } from './project-files.js';
import type { BlockingVerdict, DiffCheckResult, FileCheckResult, FileVerdict, FileViolation } from './types.js';

/** One hunk: its header positions and its body lines with their marker (' ', '-', '+'). */
export interface DiffHunk {
  readonly oldStart: number;
  readonly newStart: number;
  readonly lines: readonly string[];
}

export interface DiffFile {
  readonly oldPath: string | null;
  readonly newPath: string | null;
  /** Added lines with their 1-based line number in the new file. */
  readonly added: readonly { readonly line: number; readonly text: string }[];
}

/** MCP v2: a diff file with its hunks, to rebuild the old and new contents against the project. */
export interface DiffFileWithHunks extends DiffFile {
  readonly hunks: readonly DiffHunk[];
}

const SOURCE_FILE_RE = /\.(?:[cm]?[jt]sx?)$/;
const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

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
  return parseUnifiedDiffWithHunks(diff).map(({ oldPath, newPath, added }) => ({ oldPath, newPath, added }));
}

/** `parseUnifiedDiff` with each file's hunks (MCP v2). */
export function parseUnifiedDiffWithHunks(diff: string): readonly DiffFileWithHunks[] {
  const files: {
    oldPath: string | null;
    newPath: string | null;
    added: { line: number; text: string }[];
    hunks: { oldStart: number; newStart: number; lines: string[] }[];
  }[] = [];
  let current: (typeof files)[number] | undefined;
  let newLine = 0;
  let oldLeft = 0;
  let newLeft = 0;
  for (const line of diff.split(/\r?\n/)) {
    if (current !== undefined && (oldLeft > 0 || newLeft > 0)) {
      const body = current.hunks[current.hunks.length - 1]?.lines;
      if (line.startsWith('+')) {
        current.added.push({ line: newLine, text: line.slice(1) });
        body?.push(line);
        newLine++;
        newLeft--;
      } else if (line.startsWith('-')) {
        body?.push(line);
        oldLeft--;
      } else if (line.startsWith(' ') || line === '') {
        body?.push(line === '' ? ' ' : line);
        newLine++;
        newLeft--;
        oldLeft--;
      }
      // '\ No newline at end of file' changes no counter.
      continue;
    }
    if (line.startsWith('--- ')) {
      current = { oldPath: stripPrefix(line.slice(4)), newPath: null, added: [], hunks: [] };
      files.push(current);
      continue;
    }
    if (line.startsWith('+++ ') && current !== undefined) {
      current.newPath = stripPrefix(line.slice(4));
      continue;
    }
    const hunk = HUNK_RE.exec(line);
    if (hunk !== null && current !== undefined) {
      oldLeft = hunk[2] === undefined ? 1 : Number(hunk[2]);
      newLine = Number(hunk[3]);
      newLeft = hunk[4] === undefined ? 1 : Number(hunk[4]);
      current.hunks.push({ oldStart: Number(hunk[1]), newStart: newLine, lines: [] });
    }
  }
  return files;
}

function worst(verdicts: readonly FileVerdict[]): FileVerdict {
  if (verdicts.includes('violations')) return 'violations';
  return verdicts.includes('unknown') ? 'unknown' : 'clean';
}

function worstBlocking(verdicts: readonly BlockingVerdict[]): BlockingVerdict {
  if (verdicts.includes('block')) return 'block';
  return verdicts.includes('unknown') ? 'unknown' : 'pass';
}

function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * Applies the hunks to `from` (forward: old to new; reverse: new to old). Strict: every context and removed line must
 * sit where the header says. Returns undefined when they do not fit.
 */
export function applyHunks(from: string, hunks: readonly DiffHunk[], direction: 'forward' | 'reverse'): string | undefined {
  const src = splitLines(from);
  const out: string[] = [];
  let pos = 0;
  for (const h of hunks) {
    const start = (direction === 'forward' ? h.oldStart : h.newStart) - 1;
    const take = direction === 'forward' ? '-' : '+';
    const give = direction === 'forward' ? '+' : '-';
    const anchor = Math.max(0, start + (h.lines.every((l) => l.startsWith(give)) ? 1 : 0));
    if (anchor < pos || anchor > src.length) return undefined;
    out.push(...src.slice(pos, anchor));
    pos = anchor;
    for (const l of h.lines) {
      const text = l.slice(1);
      if (l.startsWith(' ') || l.startsWith(take)) {
        if (src[pos] !== text) return undefined;
        pos++;
        if (l.startsWith(' ')) out.push(text);
      } else if (l.startsWith(give)) {
        out.push(text);
      }
    }
  }
  out.push(...src.slice(pos));
  return `${out.join('\n')}\n`;
}

/** Old and new contents of a modified file: the project holds either side (agent edited already, or not yet). */
function rebuild(view: ProjectView, f: DiffFileWithHunks): { oldText: string; newText: string } | undefined {
  if (!view.hasRoot || f.newPath === null || f.oldPath === null) return undefined;
  const onDiskNew = view.read(f.newPath);
  if (onDiskNew !== undefined) {
    const oldText = applyHunks(onDiskNew, f.hunks, 'reverse');
    if (oldText !== undefined) return { oldText, newText: onDiskNew };
  }
  const onDiskOld = view.read(f.oldPath);
  if (onDiskOld !== undefined) {
    const newText = applyHunks(onDiskOld, f.hunks, 'forward');
    if (newText !== undefined) return { oldText: onDiskOld, newText };
  }
  return undefined;
}

/** Identity of a finding without its line, so a moved line is not a new finding. */
const findingKey = (v: FileViolation): string => `${v.rule}|${v.subject}|${v.target ?? ''}`;

function minus(next: readonly FileViolation[], prev: readonly FileViolation[]): FileViolation[] {
  const before = new Map<string, number>();
  for (const v of prev) before.set(findingKey(v), (before.get(findingKey(v)) ?? 0) + 1);
  const out: FileViolation[] = [];
  for (const v of next) {
    const k = findingKey(v);
    const n = before.get(k) ?? 0;
    if (n > 0) before.set(k, n - 1);
    else out.push(v);
  }
  return out;
}

interface Planned {
  readonly f: DiffFileWithHunks;
  readonly newPath: string;
  readonly change: 'added' | 'modified' | 'renamed';
  readonly whole?: { readonly oldText: string | null; readonly newText: string };
}

export interface CheckDiffOptions {
  /** Project root: modified files are rebuilt whole and reported as a delta; barrels, entry files and cycles are read. */
  readonly projectRoot?: string | undefined;
}

export function checkDiff(spec: ParsedSpec, diff: string, options: CheckDiffOptions = {}): DiffCheckResult {
  const files: DiffCheckResult['files'][number][] = [];
  const skipped: { path: string; reason: string }[] = [];
  const disk = new ProjectView({ root: options.projectRoot });

  const planned: Planned[] = [];
  for (const f of parseUnifiedDiffWithHunks(diff)) {
    if (f.newPath === null) {
      if (f.oldPath !== null) skipped.push({ path: f.oldPath, reason: 'deleted' });
      continue;
    }
    if (!SOURCE_FILE_RE.test(f.newPath)) {
      skipped.push({ path: f.newPath, reason: 'not a TypeScript/JavaScript source file' });
      continue;
    }
    const change = f.oldPath === null ? 'added' : f.oldPath === f.newPath ? 'modified' : 'renamed';
    const whole = change === 'added'
      ? { oldText: null, newText: `${f.added.map((a) => a.text).join('\n')}\n` }
      : rebuild(disk, f);
    planned.push({ f, newPath: f.newPath, change, ...(whole !== undefined ? { whole } : {}) });
  }

  // The project after the change (and before it, for the delta) as the fast checks see it.
  const after = new Map<string, string>();
  const before = new Map<string, string>();
  for (const p of planned) {
    if (p.whole === undefined) continue;
    after.set(p.newPath, p.whole.newText);
    if (p.whole.oldText !== null && p.f.oldPath !== null) before.set(p.f.oldPath, p.whole.oldText);
  }
  const viewAfter = new ProjectView({ root: options.projectRoot, overrides: after });
  const viewBefore = new ProjectView({ root: options.projectRoot, overrides: before });
  let graphAfter: ReadonlyMap<string, ReadonlySet<string>> | undefined;
  let graphBefore: ReadonlyMap<string, ReadonlySet<string>> | undefined;
  const lazyAfter = (): ReadonlyMap<string, ReadonlySet<string>> | undefined => (viewAfter.hasRoot ? (graphAfter ??= viewAfter.importGraph()) : undefined);
  const lazyBefore = (): ReadonlyMap<string, ReadonlySet<string>> | undefined => (viewBefore.hasRoot ? (graphBefore ??= viewBefore.importGraph()) : undefined);

  for (const { f, newPath, change, whole } of planned) {
    let result: FileCheckResult;
    let basis: 'whole-file' | 'delta' | 'added-lines';
    if (whole !== undefined) {
      const g = lazyAfter();
      const next = checkSource(spec, { path: newPath, content: whole.newText, view: viewAfter, ...(g !== undefined ? { graph: g } : {}) });
      if (whole.oldText === null) {
        result = next;
        basis = 'whole-file';
      } else {
        const gb = lazyBefore();
        const prev = checkSource(spec, { path: f.oldPath ?? newPath, content: whole.oldText, view: viewBefore, ...(gb !== undefined ? { graph: gb } : {}) });
        const addedLines = new Set(f.added.map((a) => a.line));
        const violations = minus(next.violations, prev.violations);
        const findings = minus(next.findings, prev.findings);
        const blockingCount = findings.filter((v) => v.tier === 'blocking').length;
        const hints = minus(next.hints, prev.hints);
        const unresolved = next.unresolved.filter((u) => addedLines.has(u.line));
        const verdict: FileVerdict = violations.length > 0 ? 'violations' : unresolved.length > 0 ? 'unknown' : 'clean';
        const blockingVerdict: BlockingVerdict = blockingCount > 0 ? 'block' : unresolved.length > 0 ? 'unknown' : 'pass';
        result = {
          ...next,
          verdict,
          summary: verdict === 'violations'
            ? `${next.path} (${next.layer ?? 'no layer'}): ${String(violations.length)} violation(s) of ${[...new Set(violations.map((v) => v.rule))].join(', ')}; apply each fix.`
            : verdict === 'unknown'
              ? `${next.path} (${next.layer ?? 'no layer'}): no violation found, ${String(unresolved.length)} alias import(s) unresolved; check them with check_import and resolvedPath.`
              : `${next.path} (${next.layer ?? 'no layer'}): clean.`,
          violations,
          advisories: minus(next.advisories, prev.advisories),
          unresolved,
          findings,
          hints,
          blockingVerdict,
          blockingCount,
          advisoryCount: findings.length - blockingCount,
          blockingSummary: blockingSummaryOf(blockingVerdict, findings, hints.length),
        };
        basis = 'delta';
      }
    } else {
      const lines = f.added.map((a) => a.line);
      result = checkSource(spec, {
        path: newPath,
        content: f.added.map((a) => a.text).join('\n'),
        lineOf: (l) => lines[l - 1] ?? l,
      });
      basis = 'added-lines';
    }
    const notes = [...result.notes];
    if (change === 'renamed' && f.oldPath !== null) {
      const from = resolveLayer(spec, f.oldPath)?.layer ?? null;
      if (from !== result.layer && basis === 'added-lines') {
        notes.push(
          `moved from ${from ?? 'no layer'} to ${result.layer ?? 'no layer'}: unchanged imports are not in the diff, so run check_file on the whole file`,
        );
      }
    }
    if (basis === 'added-lines' && change !== 'added') notes.push('only added lines were checked');
    if (basis === 'delta') notes.push('rebuilt from the diff and the project: findings are those the new content has and the old did not');
    files.push({ ...result, notes, change, basis });
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
  const blockingVerdict = worstBlocking(files.map((f) => f.blockingVerdict));
  const all = files.flatMap((f) => f.findings);
  const blockingCount = all.filter((v) => v.tier === 'blocking').length;
  return {
    verdict,
    summary,
    files,
    skipped,
    blockingVerdict,
    blockingCount,
    advisoryCount: all.length - blockingCount,
    blockingSummary: blockingSummaryOf(blockingVerdict, all, files.reduce((n, f) => n + f.hints.length, 0)),
  };
}

/**
 * The project before and after a diff, as in-memory overrides of the files on disk (project-relative; `null` =
 * absent), for the template check (`template-check.ts`). The disk may hold either side of a modified file (the agent
 * edited already, or not yet); `rebuild` decides. A modified file neither side of which can be rebuilt is listed in
 * `unreadable` and left as on disk.
 */
export function diffOverrides(diff: string, projectRoot: string | undefined): {
  readonly before: ReadonlyMap<string, string | null>;
  readonly after: ReadonlyMap<string, string | null>;
  readonly unreadable: readonly string[];
} {
  const disk = new ProjectView({ root: projectRoot });
  const before = new Map<string, string | null>();
  const after = new Map<string, string | null>();
  const unreadable: string[] = [];
  for (const f of parseUnifiedDiffWithHunks(diff)) {
    if (f.newPath === null) {
      // Deleted: before = the old content (on disk, or rebuilt from the hunks when the agent deleted it already).
      if (f.oldPath === null || !SOURCE_FILE_RE.test(f.oldPath)) continue;
      const onDisk = disk.read(f.oldPath);
      const oldText = onDisk ?? applyHunks('', f.hunks, 'reverse');
      if (oldText !== undefined) before.set(f.oldPath, oldText);
      after.set(f.oldPath, null);
      continue;
    }
    if (!SOURCE_FILE_RE.test(f.newPath)) continue;
    if (f.oldPath === null) {
      before.set(f.newPath, null);
      after.set(f.newPath, `${f.added.map((a) => a.text).join('\n')}\n`);
      continue;
    }
    const whole = rebuild(disk, f);
    if (whole === undefined) {
      unreadable.push(f.newPath);
      continue;
    }
    before.set(f.oldPath, whole.oldText);
    after.set(f.newPath, whole.newText);
    if (f.oldPath !== f.newPath) {
      before.set(f.newPath, null);
      after.set(f.oldPath, null);
    }
  }
  return { before, after, unreadable };
}
