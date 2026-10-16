/**
 * `check_file`, `check_diff` and `check_import` under `--fast-rules-engine cypher-interp` (Docs/v1.3/mcp-interp-parity.md
 * §3.3): the project state before and after the proposed change is evaluated by `InterpEvaluator`, and the answer is
 * the rows the change adds. The fast path still supplies what the graph has no row for (layers, hints, skipped files).
 */
import * as path from 'node:path';
import type { ParsedSpec } from '../shared/types/spec.js';
import { applyHunks, checkDiff, parseUnifiedDiffWithHunks, rebuild } from './diff-check.js';
import type { DiffFileWithHunks } from './diff-check.js';
import { checkSource } from './file-check.js';
import { diffResultFromFiles, fileResultFromRows, importResultFromRows, rowDelta, rowFiles } from './interp-check.js';
import type { GraphRow, InterpEvaluator } from './interp-check.js';
import { normalisePath } from './layer-resolver.js';
import { ProjectView } from './project-files.js';
import type { CheckImportResult, DiffCheckResult, FileCheckResult } from './types.js';

export interface InterpInput {
  readonly spec: ParsedSpec;
  readonly specPath: string;
  readonly root: string;
  readonly evaluator: InterpEvaluator;
}

/** Old and new contents of one diff file (null: the side does not have the file); undefined when not rebuildable. */
function sides(view: ProjectView, f: DiffFileWithHunks): { oldText: string | null; newText: string | null } | undefined {
  if (f.oldPath === null && f.newPath !== null) return { oldText: null, newText: view.read(f.newPath) ?? `${f.added.map((a) => a.text).join('\n')}\n` };
  if (f.newPath === null && f.oldPath !== null) {
    const oldText = view.read(f.oldPath) ?? applyHunks('', f.hunks, 'reverse');
    return oldText === undefined ? undefined : { oldText, newText: null };
  }
  const whole = rebuild(view, f);
  return whole === undefined ? undefined : { oldText: whole.oldText, newText: whole.newText };
}

export async function interpCheckDiff(input: InterpInput, diff: string): Promise<DiffCheckResult> {
  const { spec, specPath, root, evaluator } = input;
  const fast = checkDiff(spec, diff, { projectRoot: root });
  const view = new ProjectView({ root });
  const before = new Map<string, string | null>();
  const after = new Map<string, string | null>();
  for (const f of parseUnifiedDiffWithHunks(diff)) {
    const s = sides(view, f);
    if (s === undefined) {
      return { ...fast, files: fast.files.map((x) => ({ ...x, notes: [...x.notes, `fast-rules-engine cypher-interp could not rebuild ${f.newPath ?? f.oldPath ?? '?'} from the diff and the project; answered on the fast path`] })) };
    }
    if (f.oldPath !== null) before.set(f.oldPath, s.oldText);
    if (f.newPath !== null && f.newPath !== f.oldPath) before.set(f.newPath, null);
    if (f.oldPath !== null && f.oldPath !== f.newPath) after.set(f.oldPath, null);
    if (f.newPath !== null) after.set(f.newPath, s.newText);
  }
  const [b, a] = [await evaluator.evaluate(spec, specPath, root, before), await evaluator.evaluate(spec, specPath, root, after)];
  const delta = rowDelta(a.rows, b.rows);
  const listed = fast.files.map((f) => f.path);
  const placed = new Set<GraphRow>();
  const rowsFor = (file: string): GraphRow[] => delta.filter((r) => {
    if (placed.has(r) || !rowFiles(r).includes(file)) return false;
    placed.add(r);
    return true;
  });
  const files: DiffCheckResult['files'][number][] = fast.files.map((f) => ({
    ...fileResultFromRows(spec, f, f.path, rowsFor(f.path), f.notes.filter((n) => !n.startsWith('rebuilt from the diff'))),
    change: f.change,
    basis: f.basis === 'whole-file' ? 'whole-file' : 'delta',
  }));
  const elsewhere = new Map<string, GraphRow[]>();
  for (const r of delta) {
    if (placed.has(r)) continue;
    const file = rowFiles(r).find((x) => listed.includes(x)) ?? rowFiles(r)[0] ?? r.file;
    elsewhere.set(file, [...(elsewhere.get(file) ?? []), r]);
  }
  const afterView = new ProjectView({ root, overrides: new Map([...after].filter((e): e is [string, string] => e[1] !== null)) });
  for (const [file, rows] of [...elsewhere].sort(([x], [y]) => x.localeCompare(y))) {
    const base = checkSource(spec, { path: file, content: afterView.read(file) ?? '', view: afterView });
    files.push({
      ...fileResultFromRows(spec, { ...base, hints: [] }, file, rows, ['not in the diff: the change made these rules fire here']),
      change: 'affected',
      basis: 'delta',
    });
  }
  return diffResultFromFiles(files, fast.skipped);
}

export async function interpCheckFile(input: InterpInput, rel: string, content: string): Promise<FileCheckResult> {
  const { spec, specPath, root, evaluator } = input;
  const file = normalisePath(rel);
  const fast = checkSource(spec, { path: file, content, view: new ProjectView({ root, overrides: new Map([[file, content]]) }) });
  const [b, a] = [await evaluator.evaluate(spec, specPath, root, new Map()), await evaluator.evaluate(spec, specPath, root, new Map([[file, content]]))];
  const inFile = a.rows.filter((r) => rowFiles(r).includes(file));
  const elsewhere = rowDelta(a.rows, b.rows).filter((r) => !rowFiles(r).includes(file));
  return fileResultFromRows(spec, fast, file, [...inFile, ...elsewhere], elsewhere.length > 0 ? ['some findings are in other files: the file as proposed makes those rules fire there'] : []);
}

/** The specifier as written from `from`, or a relative specifier to `resolvedPath` (extension dropped). */
function probeSpecifier(from: string, module: string, resolvedPath: string | undefined): string {
  if (resolvedPath === undefined) return module;
  const rel = path.posix.relative(path.posix.dirname(from), normalisePath(resolvedPath).replace(/\.(?:[cm]?[jt]sx?)$/, ''));
  return rel.startsWith('.') ? rel : `./${rel}`;
}

export const PROBE_BINDING = '__daedalusProbe';

export async function interpCheckImport(
  input: InterpInput,
  fast: CheckImportResult,
  args: { readonly from: string; readonly module: string; readonly resolvedPath?: string | undefined },
): Promise<CheckImportResult> {
  const { spec, specPath, root, evaluator } = input;
  const from = normalisePath(args.from);
  const current = new ProjectView({ root }).read(from) ?? '';
  const sep = current === '' || current.endsWith('\n') ? '' : '\n';
  const probe = `${current}${sep}import * as ${PROBE_BINDING} from '${probeSpecifier(from, args.module, args.resolvedPath)}';\n`;
  const [b, a] = [await evaluator.evaluate(spec, specPath, root, new Map([[from, current]])), await evaluator.evaluate(spec, specPath, root, new Map([[from, probe]]))];
  const rows = rowDelta(a.rows, b.rows).filter((r) => rowFiles(r).includes(from));
  return importResultFromRows(spec, fast, rows, fast.verdict !== 'unknown');
}
