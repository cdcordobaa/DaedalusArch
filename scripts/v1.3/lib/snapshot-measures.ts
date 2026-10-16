/**
 * v1.3 snapshot measures (gate D13, D16; `Docs/v1.3/snapshot-measures.md`): the pure parts of the post-hoc scorer.
 *
 * - `scanImports`: the import kinds and the barrel test of one source file, from the TypeScript parser.
 * - `treeMeasures`: files, LOC, import-kind totals and barrels of a tree's source files.
 * - `toolFindings` / `agreement`: the tool's blocking rows and dependency-cruiser's findings on one key
 *   (`findingKey` of `scripts/tool-comparison.ts`), with a reason class for every one-sided key (§3 of the doc).
 *
 * Nothing here runs a process or reads a store; `scripts/v1.3/snapshot-measures.ts` does.
 */
import * as path from 'node:path';
import ts from 'typescript';
import { canonicalCycle, findingKey } from '../../tool-comparison.js';
import type { Finding } from '../../tool-comparison.js';

/** Blocking functions the ADR-030 translation can express, compared tool against dependency-cruiser (doc §3). */
export const AGREEMENT_FUNCTIONS: readonly string[] = Object.freeze(['FF-P01', 'FF-S01', 'FF-S02', 'FF-S03', 'FF-S04']);

export const HELD_OUT_REASON =
  'not computed: which rules are withheld from the gate arm is the author\'s decision (night backlog job G1, gate line D16)';

export type ImportKind = 'static' | 'typeOnly' | 'dynamic' | 'require' | 'reexport';

export const IMPORT_KINDS: readonly ImportKind[] = Object.freeze(['static', 'typeOnly', 'dynamic', 'require', 'reexport']);

export type ImportKindCounts = Record<ImportKind, number>;

export interface FileImports {
  readonly kinds: ImportKindCounts;
  /** Every module specifier with its kind, in source order. */
  readonly imports: readonly { readonly specifier: string; readonly kind: ImportKind }[];
  /** At least one statement, and every top-level statement is an `export ... from`. */
  readonly barrel: boolean;
}

export function emptyKinds(): ImportKindCounts {
  return { static: 0, typeOnly: 0, dynamic: 0, require: 0, reexport: 0 };
}

/** Import kinds and the barrel test of one file (doc §2). Comments and strings never count. */
export function scanImports(fileName: string, text: string): FileImports {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const kinds = emptyKinds();
  const imports: { specifier: string; kind: ImportKind }[] = [];
  const add = (kind: ImportKind, spec: ts.Node | undefined): void => {
    kinds[kind]++;
    imports.push({ specifier: spec !== undefined && ts.isStringLiteralLike(spec) ? spec.text : '', kind });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      add(node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword ? 'typeOnly' : 'static', node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
      add('reexport', node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add('require', node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add('dynamic', node.arguments[0]);
      else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') add('require', node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const stmts = sf.statements;
  const barrel = stmts.length > 0 && stmts.every((s) => ts.isExportDeclaration(s) && s.moduleSpecifier !== undefined);
  return { kinds, imports, barrel };
}

export function nonBlankLines(text: string): number {
  return text.split('\n').filter((l) => l.trim() !== '').length;
}

export interface TreeMeasures {
  /** Tree-relative (`src/...`), sorted. */
  readonly sourceFiles: readonly string[];
  readonly files: number;
  readonly loc: number;
  readonly importKinds: ImportKindCounts;
  readonly barrels: readonly string[];
  readonly perFile: ReadonlyMap<string, FileImports>;
}

/** Measures of the source files (`src/**\/*.ts`, `.d.ts` excluded): `texts` maps tree-relative path to content. */
export function treeMeasures(texts: ReadonlyMap<string, string>): TreeMeasures {
  const sourceFiles = [...texts.keys()].filter(isSourceFile).sort();
  const importKinds = emptyKinds();
  const barrels: string[] = [];
  const perFile = new Map<string, FileImports>();
  let loc = 0;
  for (const f of sourceFiles) {
    const text = texts.get(f) ?? '';
    loc += nonBlankLines(text);
    const s = scanImports(f, text);
    perFile.set(f, s);
    for (const k of IMPORT_KINDS) importKinds[k] += s.kinds[k];
    if (s.barrel) barrels.push(f);
  }
  return { sourceFiles, files: sourceFiles.length, loc, importKinds, barrels, perFile };
}

export function isSourceFile(rel: string): boolean {
  return rel.startsWith('src/') && rel.endsWith('.ts') && !rel.endsWith('.d.ts');
}

/** The tree file a relative specifier of `fromRel` names (`x.ts`, `x.d.ts`, `x/index.ts`), or undefined. */
export function resolveRelative(fromRel: string, specifier: string, files: ReadonlySet<string>): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), specifier)).replace(/\.js$/, '');
  for (const c of [base, `${base}.ts`, `${base}.d.ts`, `${base}/index.ts`]) if (files.has(c)) return c;
  return undefined;
}

/** A tool blocking row as either store writes it (loop: ruleId/filePath; probe: rule/file). */
export interface ToolRow {
  readonly ruleId?: string;
  readonly rule?: string;
  readonly filePath?: string;
  readonly file?: string;
  readonly target?: string;
}

/** The tool's blocking rows of `functions` in the shared finding shape (FF-S02 on its canonical cycle). */
export function toolFindings(rows: readonly ToolRow[], functions: readonly string[]): Finding[] {
  const out: Finding[] = [];
  for (const r of rows) {
    const functionId = r.ruleId ?? r.rule ?? '';
    if (!functions.includes(functionId)) continue;
    const file = r.filePath ?? r.file ?? '';
    if (functionId === 'FF-S02') {
      const c = canonicalCycle(file.split(','));
      out.push({ functionId, filePath: c[0] ?? '', target: c.join(' > '), cycle: c });
    } else {
      out.push({ functionId, filePath: file, target: r.target ?? '' });
    }
  }
  return out;
}

export type DisagreementClass =
  | 'type-only' | 're-export/barrel' | 'dynamic-import' | 'require' | '.d.ts' | 'excluded-file' | 'rule-semantics' | 'unexplained';

export interface ClassifyContext {
  readonly files: ReadonlySet<string>;
  readonly perFile: ReadonlyMap<string, FileImports>;
  readonly barrels: ReadonlySet<string>;
  /** Regexes of the function's `exclude_paths` plus the extractor excludes (tree-relative paths). */
  readonly excluded: (functionId: string, file: string) => boolean;
}

/** The kinds by which `from` reaches `to` directly (relative specifiers resolved; a package by name). */
function edgeKinds(from: string, to: string, ctx: ClassifyContext): ImportKind[] {
  const imp = ctx.perFile.get(from);
  if (imp === undefined) return [];
  return imp.imports
    .filter((i) => {
      const r = resolveRelative(from, i.specifier, ctx.files);
      if (r !== undefined) return r === to;
      return i.specifier === to || i.specifier.startsWith(`${to}/`);
    })
    .map((i) => i.kind);
}

/** One reason class for a key one side reports and the other does not (doc §3). */
export function classifyDisagreement(f: Finding, ctx: ClassifyContext): DisagreementClass {
  if (ctx.excluded(f.functionId, f.filePath)) return 'excluded-file';
  if (f.functionId === 'FF-S02') {
    const ring = f.cycle ?? [];
    const edges = ring.map((a, i) => edgeKinds(a, ring[(i + 1) % ring.length] ?? '', ctx));
    return classifyKinds(edges.flat(), ring.some((n) => ctx.barrels.has(n)), ring.some((n) => n.endsWith('.d.ts')));
  }
  if (f.target.endsWith('.d.ts')) return '.d.ts';
  return classifyKinds(edgeKinds(f.filePath, f.target, ctx), ctx.barrels.has(f.target), false);
}

function classifyKinds(kinds: readonly ImportKind[], viaBarrel: boolean, dts: boolean): DisagreementClass {
  if (dts) return '.d.ts';
  if (kinds.length === 0) return viaBarrel ? 're-export/barrel' : 'unexplained';
  if (kinds.includes('static')) return viaBarrel ? 're-export/barrel' : 'rule-semantics';
  if (kinds.every((k) => k === 'typeOnly')) return 'type-only';
  if (kinds.every((k) => k === 'reexport')) return 're-export/barrel';
  if (kinds.every((k) => k === 'dynamic')) return 'dynamic-import';
  if (kinds.every((k) => k === 'require')) return 'require';
  return 'unexplained';
}

export interface FunctionAgreement {
  readonly functionId: string;
  readonly tool: number;
  readonly depcruise: number;
  readonly both: number;
  readonly toolOnly: readonly { readonly key: string; readonly reason: DisagreementClass }[];
  readonly depcruiseOnly: readonly { readonly key: string; readonly reason: DisagreementClass }[];
}

export interface Agreement {
  /** Functions of AGREEMENT_FUNCTIONS the translation produced rules for on this spec. */
  readonly compared: readonly FunctionAgreement[];
  /** Functions of AGREEMENT_FUNCTIONS with no translated rule here (inactive, not applicable or no layer). */
  readonly notTranslatedHere: readonly string[];
}

/** Tool against dependency-cruiser over `translated` ∩ AGREEMENT_FUNCTIONS, on distinct keys. */
export function agreement(tool: readonly Finding[], dc: readonly Finding[], translated: readonly string[], ctx: ClassifyContext): Agreement {
  const compared: FunctionAgreement[] = [];
  const notTranslatedHere: string[] = [];
  for (const fn of AGREEMENT_FUNCTIONS) {
    if (!translated.includes(fn)) { notTranslatedHere.push(fn); continue; }
    const t = new Map(tool.filter((f) => f.functionId === fn).map((f) => [findingKey(f), f]));
    const d = new Map(dc.filter((f) => f.functionId === fn).map((f) => [findingKey(f), f]));
    const side = (a: Map<string, Finding>, b: Map<string, Finding>): { key: string; reason: DisagreementClass }[] =>
      [...a].filter(([k]) => !b.has(k)).map(([key, f]) => ({ key, reason: classifyDisagreement(f, ctx) })).sort((x, y) => cmp(x.key, y.key));
    compared.push({
      functionId: fn, tool: t.size, depcruise: d.size, both: [...t.keys()].filter((k) => d.has(k)).length,
      toolOnly: side(t, d), depcruiseOnly: side(d, t),
    });
  }
  return { compared, notTranslatedHere };
}

export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
