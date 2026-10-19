/**
 * L1 per-snapshot coverage check for generated code (TRUST-01 link L1; V8 restated, REV-05 §5 item 2; drift record §7
 * V8 "per-snapshot coverage of generated code is kept"). Pure measures over one materialised tree plus the bar.
 *
 * Per snapshot:
 * - `sourceFiles`: `src/**\/*.ts` without `.d.ts` (the files the extractor reads; `snapshot-measures.ts` `isSourceFile`);
 * - `unmappedShare`: the share of source files matching no layer glob, no declared context root and no
 *   `outside_contexts` glob of the snapshot's spec (`pilot-metrics.ts` `unmatchedShare`, the pilot §4 guard);
 * - `unparsed`: source files with TypeScript parse diagnostics (a syntax error: the extractor then reads a partial
 *   tree, `src/mcp-server/source-ast.ts` `partial`);
 * - `notExtracted`: code files under `src/` the extractor does not read (`.js`, `.jsx`, `.tsx`, `.mjs`, `.cjs`, `.mts`,
 *   `.cts`), listed apart: their imports are invisible to the graph;
 * - `barrels`, `require`, `dynamicImport` (`import()`), and the non-literal ones of the last two (a specifier that is
 *   not a string literal cannot be resolved to an edge), counted by `snapshot-measures.ts` `scanImports`.
 *
 * Bar (TRUST-01 L1): unmapped ≤ 10 % and no unparsed file. `notExtracted`, barrels, `require` and `import()` are
 * counted and reported, not barred (the bar says "counted"). A snapshot with no spec or no source file is `no-data`.
 */
import ts from 'typescript';
import { scanImports, isSourceFile } from '../../v1.3/lib/snapshot-measures.js';

export const UNMAPPED_BAR = 0.1;

export const NOT_EXTRACTED_EXT = Object.freeze(['.js', '.jsx', '.tsx', '.mjs', '.cjs', '.mts', '.cts']);

export interface UnparsedFile {
  readonly file: string;
  readonly diagnostics: number;
  /** The first diagnostic's message. */
  readonly first: string;
}

export interface TreeCoverage {
  readonly sourceFiles: readonly string[];
  readonly unparsed: readonly UnparsedFile[];
  readonly notExtracted: readonly string[];
  readonly barrels: readonly string[];
  readonly require: number;
  readonly requireNonLiteral: number;
  readonly dynamicImport: number;
  readonly dynamicImportNonLiteral: number;
}

/** The parse diagnostics of one file (syntax only; no type check). */
export function parseDiagnostics(fileName: string, text: string): readonly ts.DiagnosticWithLocation[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  return (sf as unknown as { parseDiagnostics?: readonly ts.DiagnosticWithLocation[] }).parseDiagnostics ?? [];
}

export function isNotExtracted(rel: string): boolean {
  return rel.startsWith('src/') && NOT_EXTRACTED_EXT.some((e) => rel.endsWith(e));
}

/** The tree measures; `texts` holds every `.ts` file of the tree (POSIX-relative), `files` every file. */
export function treeCoverage(texts: ReadonlyMap<string, string>, files: readonly string[]): TreeCoverage {
  const sourceFiles = [...texts.keys()].filter(isSourceFile).sort();
  const unparsed: UnparsedFile[] = [];
  const barrels: string[] = [];
  let req = 0;
  let reqNl = 0;
  let dyn = 0;
  let dynNl = 0;
  for (const f of sourceFiles) {
    const text = texts.get(f) ?? '';
    const d = parseDiagnostics(f, text);
    if (d.length > 0) unparsed.push({ file: f, diagnostics: d.length, first: ts.flattenDiagnosticMessageText(d[0]?.messageText ?? '', ' ') });
    const s = scanImports(f, text);
    if (s.barrel) barrels.push(f);
    for (const i of s.imports) {
      if (i.kind === 'require') {
        req++;
        if (i.specifier === '') reqNl++;
      } else if (i.kind === 'dynamic') {
        dyn++;
        if (i.specifier === '') dynNl++;
      }
    }
  }
  return {
    sourceFiles,
    unparsed,
    notExtracted: files.filter(isNotExtracted).sort(),
    barrels,
    require: req,
    requireNonLiteral: reqNl,
    dynamicImport: dyn,
    dynamicImportNonLiteral: dynNl,
  };
}

export type CoverageVerdict = 'pass' | 'fail' | 'no-data';

export interface CoverageVerdictResult {
  readonly verdict: CoverageVerdict;
  readonly reasons: readonly string[];
}

/** The L1 bar on one snapshot (module header). */
export function coverageVerdict(unmappedShare: number | null, tree: Pick<TreeCoverage, 'unparsed' | 'sourceFiles'>): CoverageVerdictResult {
  if (tree.sourceFiles.length === 0) return { verdict: 'no-data', reasons: ['no source file'] };
  const reasons: string[] = [];
  if (tree.unparsed.length > 0) reasons.push(`${String(tree.unparsed.length)} unparsed file(s)`);
  if (unmappedShare === null) return { verdict: tree.unparsed.length > 0 ? 'fail' : 'no-data', reasons: [...reasons, 'no spec recorded'] };
  if (unmappedShare > UNMAPPED_BAR) reasons.push(`unmapped ${(unmappedShare * 100).toFixed(1)} % > ${String(UNMAPPED_BAR * 100)} %`);
  return { verdict: reasons.length > 0 ? 'fail' : 'pass', reasons };
}

export interface SnapshotCoverage {
  readonly id: string;
  readonly store: string;
  readonly generator: string;
  readonly task: string;
  readonly arm: string;
  readonly run: string;
  readonly step: number;
  readonly snapshot: string;
  readonly spec: string | null;
  readonly files: number;
  readonly unmappedShare: number | null;
  readonly unparsed: readonly UnparsedFile[];
  readonly notExtracted: readonly string[];
  readonly barrels: number;
  readonly require: number;
  readonly requireNonLiteral: number;
  readonly dynamicImport: number;
  readonly dynamicImportNonLiteral: number;
  readonly verdict: CoverageVerdict;
  readonly reasons: readonly string[];
  readonly error?: string;
}

export interface CoverageAggregate {
  readonly generator: string;
  readonly arm: string;
  readonly snapshots: number;
  readonly pass: number;
  readonly fail: number;
  readonly noData: number;
  readonly meanUnmapped: number | null;
  readonly maxUnmapped: number | null;
  readonly unparsedFiles: number;
  readonly notExtractedFiles: number;
  readonly barrels: number;
  readonly require: number;
  readonly dynamicImport: number;
  readonly nonLiteral: number;
}

/** Per generator × arm (rows sorted by generator, then arm). */
export function aggregateCoverage(rows: readonly SnapshotCoverage[]): CoverageAggregate[] {
  const groups = new Map<string, SnapshotCoverage[]>();
  for (const r of rows) {
    const k = `${r.generator}\u0001${r.arm}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out: CoverageAggregate[] = [];
  for (const [k, g] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    const [generator = '', arm = ''] = k.split('\u0001');
    const um = g.map((r) => r.unmappedShare).filter((x): x is number => x !== null);
    const sum = (f: (r: SnapshotCoverage) => number): number => g.reduce((a, r) => a + f(r), 0);
    out.push({
      generator,
      arm,
      snapshots: g.length,
      pass: g.filter((r) => r.verdict === 'pass').length,
      fail: g.filter((r) => r.verdict === 'fail').length,
      noData: g.filter((r) => r.verdict === 'no-data').length,
      meanUnmapped: um.length === 0 ? null : um.reduce((a, b) => a + b, 0) / um.length,
      maxUnmapped: um.length === 0 ? null : Math.max(...um),
      unparsedFiles: sum((r) => r.unparsed.length),
      notExtractedFiles: sum((r) => r.notExtracted.length),
      barrels: sum((r) => r.barrels),
      require: sum((r) => r.require),
      dynamicImport: sum((r) => r.dynamicImport),
      nonLiteral: sum((r) => r.requireNonLiteral + r.dynamicImportNonLiteral),
    });
  }
  return out;
}

const pct = (x: number | null): string => (x === null ? 'n/a' : `${(x * 100).toFixed(1)} %`);

export function renderCoverage(stores: readonly { readonly store: string; readonly rows: readonly SnapshotCoverage[] }[]): string {
  const md: string[] = [
    '# L1 per-snapshot coverage of generated code',
    '',
    `Bar (TRUST-01 L1): unmapped ≤ ${String(UNMAPPED_BAR * 100)} % and no unparsed file. Barrels, \`require\`, \`import()\` and files the extractor does not read are counted, not barred.`,
    '',
  ];
  for (const s of stores) {
    md.push(`## ${s.store}`, '', '| Generator | Arm | Snapshots | Pass | Fail | No data | Mean unmapped | Max unmapped | Unparsed | Not extracted | Barrels | require | import() | Non-literal |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const a of aggregateCoverage(s.rows)) {
      md.push(`| ${a.generator} | ${a.arm} | ${String(a.snapshots)} | ${String(a.pass)} | ${String(a.fail)} | ${String(a.noData)} | ${pct(a.meanUnmapped)} | ${pct(a.maxUnmapped)} | ${String(a.unparsedFiles)} | ${String(a.notExtractedFiles)} | ${String(a.barrels)} | ${String(a.require)} | ${String(a.dynamicImport)} | ${String(a.nonLiteral)} |`);
    }
    const failing = s.rows.filter((r) => r.verdict !== 'pass');
    if (failing.length > 0) {
      md.push('', 'Snapshots not passing:', '');
      for (const r of failing) md.push(`- \`${r.id}\`: ${r.verdict} (${r.reasons.join('; ')}${r.error !== undefined ? `; error: ${r.error}` : ''})`);
    }
    md.push('');
  }
  return md.join('\n');
}
