/**
 * Team-declared rules vs DaedalusArch v1.3, one case (a repository at one commit). No Neo4j, no LLM.
 * `Docs/DiagnosticRuns/v1.3-declared-rules-2026-10-16.md`.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/declared-rules-run.ts case <case.json>
 *   npx tsx scripts/v1.3/declared-rules-run.ts summary <results dir>
 *
 * case.json: { id, repo, sha, family: depcruise|boundaries|nx, root, tsconfig, configPath, toolVersion,
 *              theirs: <dependency-cruiser JSON or ESLint JSON output>, decl?: <declaration JSON (boundaries, nx)>,
 *              ruleIds?: <ESLint rule ids>, out: <dir>, note? }
 *
 * Steps. (1) Extract the APG with the v1.3 defaults and keep the LITERAL edge view (IMPORTS without `viaReExport`, plus
 * RE_EXPORTS), File→File. (2) Translate the team's declaration (`declared-to-aac.ts`), write the spec, parse it with
 * DaedalusArch's parser and assign layers with its own annotator (must equal the atom map). (3) Evaluate the two enabled
 * graph rules in memory (`evaluateGraphRules`, the FF-S01/FF-S03 Cypher's predicate). (4) Read the team tool's
 * violations, keep those of rules the translation covers, map each to a (source file, target) edge. (5) Compare on the
 * files the team's tool analysed and classify every disagreement from the evidence (TypeScript compiler occurrences,
 * the APG's literal and resolved views, the tool's own dependency list where it has one).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { join, relative, resolve } from 'node:path';
import { extractAPG, V13_DEFAULT_OPTIONS } from '../../src/apg-extractor/index.js';
import { parseSpec } from '../../src/spec-parser/index.js';
import { globToRegex } from '../../src/fitness-compiler/glob-to-regex.js';
import { assignLayers } from './lib/layer-assignment.js';
import { cmp, collectSpecifiers, edgeKey, occurrencesByEdge, projectApg, splitKey, toCsv, tscReference, TYPE_ONLY_KINDS } from './lib/graph-fidelity.js';
import type { ApgLike, EdgeKey, RefOccurrence } from './lib/graph-fidelity.js';
import { evaluateGraphRules, toSpecYaml, translate } from './declared-to-aac.js';
import type { BoundariesDecl, Declaration, DepcruiseDecl, Family, NxDecl, RuleCoverage, Translation } from './declared-to-aac.js';

export interface CaseInput {
  readonly id: string;
  readonly repo: string;
  readonly sha: string;
  readonly family: Family;
  readonly root: string;
  readonly tsconfig: string;
  readonly configPath: string;
  readonly toolVersion: string;
  readonly theirs: string;
  readonly decl?: string;
  readonly ruleIds?: readonly string[];
  readonly out: string;
  readonly note?: string;
  /** History cases: the commit whose declaration is applied, and why the case was mined. */
  readonly history?: { readonly ruleCommit: string; readonly treeCommit: string; readonly reason: string };
}

export const DISAGREEMENT_CLASSES = [
  'alias resolution', 'type-only', 're-export/barrel', 'dynamic import', 'rule translation gap', 'extractor gap', "their tool's gap",
] as const;
export type DisagreementClass = (typeof DISAGREEMENT_CLASSES)[number];

/** One violation of the team's tool, normalised. */
export interface TheirViolation {
  readonly source: string;
  /** In-repo target file, or a package / unresolved specifier (`ext:` / `unresolved:` prefixed). */
  readonly target: string;
  readonly rule: string;
  readonly line?: number;
  readonly specifier?: string;
  /** The tool left the specifier unresolved; `target` is the TypeScript compiler's in-repo resolution of it. */
  readonly viaUnresolved?: boolean;
}

export interface EdgeRow {
  readonly source: string;
  readonly target: string;
  readonly side: 'both' | 'ours-only' | 'theirs-only';
  readonly ourFunction: string;
  readonly theirRules: string;
  readonly declaredRules: string;
  readonly cls: DisagreementClass | '';
  readonly reason: string;
  readonly tscKinds: string;
}

// ── Team tool outputs ────────────────────────────────────────────────────────

interface DcOutput {
  readonly modules: readonly { readonly source: string; readonly dependencies: readonly { readonly resolved: string; readonly module: string; readonly couldNotResolve?: boolean; readonly dependencyTypes?: readonly string[]; readonly dynamic?: boolean }[] }[];
  readonly summary: {
    readonly violations: readonly { readonly type?: string; readonly from: string; readonly to: string; readonly rule: { readonly name: string; readonly severity: string } }[];
    readonly ruleSetUsed?: { readonly forbidden?: DepcruiseDecl['forbidden']; readonly allowed?: DepcruiseDecl['allowed']; readonly allowedSeverity?: string };
    readonly optionsUsed?: { readonly tsPreCompilationDeps?: boolean | string };
  };
}

interface EslintFileResult {
  readonly filePath: string;
  readonly messages: readonly { readonly ruleId: string | null; readonly line: number; readonly column: number; readonly message: string; readonly severity: number }[];
}

/**
 * Which check of the Nx rule produced a message: a declared tag constraint (`depConstraints`, compared) or one of the
 * rule's built-in checks (relative cross-project import, imports of apps, cycles, deep imports, buildable libraries,
 * lazy-loaded libraries, banned external imports: reported, not compared). boundaries messages are all declared.
 */
export function eslintCheckOf(family: Family, message: string): string {
  if (family !== 'nx') return 'declared';
  if (/can only depend on libs tagged with|cannot depend on any libs with tags|without tags matching at least one constraint/.test(message)) return 'declared';
  const builtins: readonly [RegExp, string][] = [
    [/cannot be imported by a relative or absolute path/, 'relative-or-absolute-import'],
    [/Imports of apps are forbidden/, 'imports-of-apps'],
    [/Circular dependency/, 'circular'],
    [/Deep imports/, 'deep-import'],
    [/[Bb]uildable libraries cannot|non-buildable/, 'buildable-lib'],
    [/lazy-loaded/, 'lazy-loaded'],
    [/should use relative imports/, 'same-project-relative'],
    [/is not allowed to import|banned/, 'external-import'],
  ];
  for (const [re, name] of builtins) if (re.test(message)) return `builtin:${name}`;
  return 'builtin:other';
}

const isFileTarget = (t: string): boolean => !t.startsWith('ext:') && !t.startsWith('unresolved:');

/** dependency-cruiser: the declaration it used, the files it cruised, its violations and its dependency edges. */
export function readDepcruise(raw: DcOutput): { decl: DepcruiseDecl; scope: Set<string>; violations: TheirViolation[]; edges: Map<EdgeKey, { dependencyTypes: readonly string[]; dynamic: boolean }> } {
  const rs = raw.summary.ruleSetUsed ?? {};
  const decl: DepcruiseDecl = {
    family: 'depcruise',
    ...(rs.forbidden !== undefined ? { forbidden: rs.forbidden } : {}),
    ...(rs.allowed !== undefined ? { allowed: rs.allowed } : {}),
    ...(rs.allowedSeverity !== undefined ? { allowedSeverity: rs.allowedSeverity } : {}),
    ...(raw.summary.optionsUsed?.tsPreCompilationDeps !== undefined ? { tsPreCompilationDeps: raw.summary.optionsUsed.tsPreCompilationDeps } : {}),
  };
  const scope = new Set<string>();
  const edges = new Map<EdgeKey, { dependencyTypes: readonly string[]; dynamic: boolean }>();
  const local = new Set(raw.modules.map((m) => m.source));
  for (const m of raw.modules) {
    if (!m.source.includes('node_modules') && /\.[cm]?[jt]sx?$/.test(m.source)) scope.add(m.source);
    for (const d of m.dependencies) edges.set(edgeKey(m.source, d.resolved), { dependencyTypes: d.dependencyTypes ?? [], dynamic: d.dynamic === true });
  }
  const violations: TheirViolation[] = [];
  for (const v of raw.summary.violations) {
    if (v.type !== undefined && v.type !== 'dependency') continue;
    const dep = raw.modules.find((m) => m.source === v.from)?.dependencies.find((d) => d.resolved === v.to);
    const ext = v.to.includes('node_modules') || (dep !== undefined && (dep.dependencyTypes ?? []).some((t) => t.startsWith('npm') || t === 'core'));
    const target = dep?.couldNotResolve === true ? `unresolved:${v.to}` : ext || !local.has(v.to) && !/\.[cm]?[jt]sx?$/.test(v.to) ? `ext:${v.to}` : v.to;
    violations.push({ source: v.from, target, rule: v.rule.name, ...(dep?.couldNotResolve === true ? { specifier: v.to } : {}) });
  }
  return { decl, scope, violations, edges };
}

/**
 * ESLint (boundaries / Nx): map each message of the kept rules to an edge. The message line is the import statement
 * (Nx reports the declaration) or the specifier literal (boundaries); the occurrence on that line, or whose specifier
 * is quoted on that line, gives the resolved target.
 */
export function readEslint(raw: readonly EslintFileResult[], root: string, ruleIds: readonly string[], occBySource: ReadonlyMap<string, readonly RefOccurrence[]>, family: Family = 'boundaries'): { scope: Set<string>; violations: TheirViolation[]; unmapped: string[] } {
  const scope = new Set<string>();
  const violations: TheirViolation[] = [];
  const unmapped: string[] = [];
  for (const f of raw) {
    const source = relative(root, f.filePath).split('\\').join('/');
    scope.add(source);
    const msgs = f.messages.filter((m) => m.ruleId !== null && ruleIds.includes(m.ruleId));
    if (msgs.length === 0) continue;
    const lines = readFileSync(f.filePath, 'utf8').split('\n');
    const occ = occBySource.get(source) ?? [];
    for (const m of msgs) {
      const text = lines[m.line - 1] ?? '';
      const quoted = [...text.matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1] ?? '');
      let hits = occ.filter((o) => o.line === m.line);
      if (hits.length !== 1) {
        const byQuote = occ.filter((o) => quoted.includes(o.specifier) && o.line <= m.line);
        if (byQuote.length > 0) hits = [byQuote.reduce((a, b) => (b.line > a.line ? b : a))];
      }
      const check = eslintCheckOf(family, m.message);
      const rule = check === 'declared' ? String(m.ruleId) : `${String(m.ruleId)}:${check}`;
      if (hits.length === 0) {
        const spec = quoted[0] ?? '?';
        unmapped.push(`${source}:${String(m.line)} ${spec}`);
        violations.push({ source, target: `unresolved:${spec}`, rule, line: m.line, specifier: spec });
        continue;
      }
      for (const h of hits.slice(0, 1)) violations.push({ source, target: h.target, rule, line: m.line, specifier: h.specifier });
    }
  }
  return { scope, violations, unmapped };
}

// ── Classification ───────────────────────────────────────────────────────────

export interface Evidence {
  readonly tsc: readonly RefOccurrence[];
  readonly apgLiteral: boolean;
  readonly apgResolvedOnly: boolean;
  readonly apgFiles: ReadonlySet<string>;
  readonly theirEdge?: { dependencyTypes: readonly string[]; dynamic: boolean } | undefined;
  readonly theirGraph: boolean;
  readonly family: Family;
  readonly tsPreCompilationDeps?: boolean | string | undefined;
  readonly forbiddenByDecl: readonly string[];
  readonly ourLayers: readonly [string | null, string | null];
  /** The team suppresses the rule inline for this import (`eslint-disable` comment). */
  readonly suppressedInline?: boolean;
  /** Every occurrence of the edge disappears when the source is compiled to JavaScript (type-only use, elided). */
  readonly elidedOnCompile?: boolean;
}

/**
 * Whether an `eslint-disable` comment covers `ruleId` on any of `lines` (1-based) of `text`: `-line` on the line,
 * `-next-line` on the line before, or a block `eslint-disable` above it not re-enabled in between. A comment without a
 * rule list covers every rule.
 */
export function suppressedInline(text: string, ruleId: string, lines: readonly number[]): boolean {
  const ls = text.split('\n');
  const covers = (c: string): boolean => { const rest = c.replace(/^.*?eslint-(?:disable|enable)(?:-next-line|-line)?/, '').replace(/\*\/.*$/, '').split('--')[0]?.trim() ?? ''; return rest === '' || rest.split(/[\s,]+/).includes(ruleId); };
  return lines.some((n) => {
    const same = ls[n - 1] ?? '';
    if (same.includes('eslint-disable-line') && covers(same.slice(same.indexOf('eslint-disable-line')))) return true;
    const prev = ls[n - 2] ?? '';
    if (prev.includes('eslint-disable-next-line') && covers(prev.slice(prev.indexOf('eslint-disable-next-line')))) return true;
    let off = false;
    for (let i = 0; i < n - 1; i++) {
      const l = ls[i] ?? '';
      const d = /eslint-disable(?!-)/.exec(l);
      const e = /eslint-enable/.exec(l);
      if (d !== null && covers(l.slice(d.index))) off = true;
      if (e !== null && covers(l.slice(e.index))) off = false;
    }
    return off;
  });
}

/**
 * Whether compiling `abs` to JavaScript (single-file transpile, as dependency-cruiser does when
 * `tsPreCompilationDeps` is false) drops every one of `specifiers`: imports used only in type positions are elided.
 */
export function elidedOnCompile(abs: string, specifiers: readonly string[]): boolean {
  if (specifiers.length === 0) return false;
  const out = ts.transpileModule(readFileSync(abs, 'utf8'), {
    fileName: abs, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve },
  }).outputText;
  const kept = new Set(collectSpecifiers(abs.replace(/\.tsx?$/, '.js'), out).map((x) => x.specifier));
  return specifiers.every((sp) => !kept.has(sp));
}

const DYNAMIC_KINDS = new Set(['dynamic-import', 'require']);

/** The class of one disagreement, with a one-line reason. */
export function classify(side: 'ours-only' | 'theirs-only', source: string, target: string, ev: Evidence): { cls: DisagreementClass; reason: string } {
  const kinds = new Set(ev.tsc.map((o) => o.kind));
  const allTypeOnly = ev.tsc.length > 0 && ev.tsc.every((o) => TYPE_ONLY_KINDS.has(o.kind));
  const allDynamic = ev.tsc.length > 0 && ev.tsc.every((o) => DYNAMIC_KINDS.has(o.kind));
  const allReExport = ev.tsc.length > 0 && ev.tsc.every((o) => o.kind === 're-export' || o.kind === 'type-re-export');
  const alias = ev.tsc.some((o) => o.alias);
  if (side === 'ours-only') {
    if (ev.suppressedInline === true) return { cls: 'rule translation gap', reason: 'the team suppresses the rule inline (eslint-disable comment); a spec has no per-import suppression' };
    if (ev.theirGraph && ev.theirEdge !== undefined) {
      if (ev.theirEdge.dependencyTypes.includes('type-only')) return { cls: 'type-only', reason: 'their tool has the edge as type-only and the rule exempts it' };
      return { cls: 'rule translation gap', reason: 'their tool has the edge but its rule did not fire' };
    }
    if (ev.family === 'depcruise' && ev.tsPreCompilationDeps !== true && (allTypeOnly || ev.elidedOnCompile === true)) {
      return { cls: 'type-only', reason: `${allTypeOnly ? 'type-only import' : 'import used only in type positions (elided on compile)'}; tsPreCompilationDeps is not true, so dependency-cruiser never sees it` };
    }
    if (allDynamic && ev.family === 'boundaries') return { cls: 'dynamic import', reason: 'dynamic import()/require; eslint-plugin-boundaries checks static import declarations only (default dependency-nodes)' };
    if (allDynamic) return { cls: 'dynamic import', reason: `dynamic import()/require (${[...kinds].join(',')}) not seen by their tool` };
    if (allReExport && ev.family === 'boundaries') return { cls: 're-export/barrel', reason: '`export ... from`; eslint-plugin-boundaries default dependency-nodes check import declarations only' };
    if (kinds.has('import-type') && ev.tsc.every((o) => o.kind === 'import-type')) return { cls: 'type-only', reason: '`import("m").T` type reference; not an import statement for their tool' };
    if (ev.tsc.length === 0) return { cls: 'extractor gap', reason: 'the TypeScript compiler has no occurrence for this edge; the APG edge comes from DaedalusArch resolution' };
    if (alias) return { cls: 'alias resolution', reason: 'aliased specifier (paths/baseUrl) that their resolver did not resolve to this file' };
    return { cls: "their tool's gap", reason: `plain ${[...kinds].join(',')} the TypeScript compiler resolves to this file; their tool reported nothing` };
  }
  // theirs-only
  if (target.startsWith('ext:')) return { cls: 'rule translation gap', reason: 'package / core-module target: DaedalusArch layers hold files only' };
  if (target.startsWith('unresolved:')) return { cls: 'alias resolution', reason: 'their tool could not resolve the specifier (or its report could not be mapped to a file)' };
  if (!ev.apgFiles.has(source)) return { cls: 'extractor gap', reason: 'source file outside the DaedalusArch extraction (default excludes: tests, .d.ts, dist; or not in the tsconfig)' };
  if (!ev.apgFiles.has(target)) return { cls: 'extractor gap', reason: 'target file outside the DaedalusArch extraction (default excludes, .d.ts, or not in the tsconfig)' };
  if (ev.apgLiteral) {
    const [a, b] = ev.ourLayers;
    if (a === null || b === null) return { cls: 'rule translation gap', reason: 'the edge is in the APG but a file has no layer (element or project assignment differs)' };
    if (a === b) return { cls: 'rule translation gap', reason: `same-atom prohibition (${ev.forbiddenByDecl.join(', ') || 'rule'}): DaedalusArch never flags imports inside one layer` };
    return { cls: 'rule translation gap', reason: 'the edge is in the APG between allowed layers' };
  }
  if (ev.apgResolvedOnly) return { cls: 're-export/barrel', reason: 'their tool resolves through the barrel; the literal view keeps the edge to the barrel only' };
  if (allDynamic) return { cls: 'dynamic import', reason: 'dynamic import()/require not in the APG edge' };
  if (allTypeOnly) return { cls: 'type-only', reason: 'type-only reference the APG does not record as an edge' };
  if (ev.tsc.length === 0) return { cls: 'alias resolution', reason: 'their tool resolves the import to this file; the TypeScript compiler (and the APG) do not' };
  return { cls: 'extractor gap', reason: `the TypeScript compiler resolves ${[...kinds].join(',')} to this file; the APG has no edge` };
}

// ── One case ─────────────────────────────────────────────────────────────────

function apgLiteralAndResolved(apg: ApgLike): { files: string[]; literal: Set<EdgeKey>; resolved: Set<EdgeKey>; info: ReturnType<typeof projectApg>['edges'] } {
  const flag = (e: ApgLike['edges'][number], k: string): boolean => e.type === 'IMPORTS' && (e.properties as Record<string, unknown>)[k] === true;
  const lit = projectApg({ nodes: apg.nodes, edges: apg.edges.filter((e) => !flag(e, 'viaReExport')) });
  const res = projectApg({ nodes: apg.nodes, edges: apg.edges.filter((e) => !flag(e, 'reExportHop')) });
  return { files: [...lit.files], literal: new Set(lit.edges.keys()), resolved: new Set(res.edges.keys()), info: lit.edges };
}

export interface CaseResult {
  readonly id: string;
  readonly repo: string;
  readonly sha: string;
  readonly family: Family;
  readonly toolVersion: string;
  readonly history?: CaseInput['history'];
  readonly note?: string;
  readonly files: { readonly apg: number; readonly theirScope: number; readonly compared: number; readonly mapped: number };
  readonly atoms: number;
  readonly allowedEdges: number;
  readonly forbiddenPairs: number;
  readonly specLayerMismatches: number;
  readonly coverage: readonly RuleCoverage[];
  readonly theirsAll: number;
  readonly theirsByRule: Readonly<Record<string, number>>;
  readonly theirsComparable: number;
  readonly ours: number;
  readonly oursOutsideTheirScope: number;
  readonly both: number;
  readonly oursOnly: number;
  readonly theirsOnly: number;
  readonly byClass: Readonly<Record<string, { oursOnly: number; theirsOnly: number }>>;
  readonly unmappedEslint: readonly string[];
}

export async function runCase(c: CaseInput): Promise<CaseResult> {
  mkdirSync(c.out, { recursive: true });
  const ext = await extractAPG(c.root, { ...V13_DEFAULT_OPTIONS }, c.tsconfig);
  if (!ext.success) throw new Error(`extraction failed: ${ext.errors.map((e) => e.message).join('; ')}`);
  const apg = apgLiteralAndResolved(ext.data);
  const apgFiles = new Set(apg.files);
  const tsc = tscReference(c.root, c.tsconfig);
  const occByEdge = occurrencesByEdge(tsc.occurrences);
  const occBySource = new Map<string, RefOccurrence[]>();
  for (const o of tsc.occurrences) { const l = occBySource.get(o.source); if (l === undefined) occBySource.set(o.source, [o]); else l.push(o); }

  // Team tool output and declaration.
  const raw = JSON.parse(readFileSync(c.theirs, 'utf8')) as unknown;
  let decl: Declaration;
  let theirScope: Set<string>;
  let theirViolations: TheirViolation[];
  let theirEdges: Map<EdgeKey, { dependencyTypes: readonly string[]; dynamic: boolean }> | undefined;
  let unmapped: string[] = [];
  if (c.family === 'depcruise') {
    const r = readDepcruise(raw as DcOutput);
    decl = r.decl; theirScope = r.scope; theirViolations = r.violations; theirEdges = r.edges;
  } else {
    decl = JSON.parse(readFileSync(c.decl ?? '', 'utf8')) as BoundariesDecl | NxDecl;
    const r = readEslint(raw as EslintFileResult[], c.root, c.ruleIds ?? [], occBySource, c.family);
    theirScope = r.scope; theirViolations = r.violations; unmapped = r.unmapped;
  }
  writeFileSync(join(c.out, 'declaration.json'), JSON.stringify(decl, null, 1) + '\n');

  // Translation over every file either side can see (so theirs-only sources outside the APG still get a verdict).
  const t: Translation = translate(decl, [...new Set([...apg.files, ...theirScope])]);
  const specPath = join(c.out, 'spec.yaml');
  writeFileSync(specPath, toSpecYaml({ ...t, layerOf: new Map([...t.layerOf].filter(([f]) => apgFiles.has(f))), excludedSources: t.excludedSources.filter((f) => apgFiles.has(f)) }, { repo: c.repo, sha: c.sha, configPath: c.configPath, toolVersion: c.toolVersion }));
  const parsed = await parseSpec({ specFilePath: specPath });
  if (!parsed.success) throw new Error(`translated spec does not parse: ${parsed.errors.map((e) => e.message).join('; ')}`);
  const assigned = assignLayers(apg.files, parsed.data.layerModel);
  const specLayer = new Map(assigned.assignments.map((a) => [a.file, a.layer]));
  const mismatches = apg.files.filter((f) => (specLayer.get(f) ?? null) !== (t.layerOf.get(f) ?? null));
  const allowed = new Set((parsed.data.layerModel.allowedDependencies ?? []).map((e) => `${e.from}>${e.to}`));

  // DaedalusArch, in memory, on the literal view, with the spec's own layer assignment.
  const literalEdges = [...apg.literal].map((k) => { const [source, target] = splitKey(k); return { source, target }; });
  const ff = parsed.data.fitnessFunctions.find((f) => String(f.id) === 'FF-S01');
  const excludePatterns = (ff?.excludePaths ?? []).map((g) => globToRegex(g));
  const ours = evaluateGraphRules(literalEdges, (f) => specLayer.get(f) ?? null, allowed, excludePatterns);

  // Comparison scope: sources the team's tool analysed.
  const translatedRules = new Set(t.coverage.filter((x) => x.status === 'translated' || x.status === 'partial').map((x) => x.rule));
  const comparableRule = (rule: string): boolean => {
    if (c.family !== 'depcruise') return !rule.includes(':builtin:');
    return translatedRules.has(`forbidden:${rule}`) || (rule === 'not-in-allowed' && [...translatedRules].some((r) => r.startsWith('allowed:')));
  };
  // An unresolved specifier the TypeScript compiler resolves to an in-repo file is that file (the tool's resolution
  // failed: an alias). One it cannot resolve in the repository is a package (not installed here) unless relative.
  theirViolations = theirViolations.map((v) => {
    if (!v.target.startsWith('unresolved:')) return v;
    const spec = v.specifier ?? v.target.slice('unresolved:'.length);
    const hit = (occBySource.get(v.source) ?? []).find((o) => o.specifier === spec);
    if (hit !== undefined) return { ...v, target: hit.target, viaUnresolved: true };
    return spec.startsWith('.') || spec.startsWith('/') ? v : { ...v, target: `ext:${spec}` };
  });
  const theirsByRule: Record<string, number> = {};
  for (const v of theirViolations) theirsByRule[v.rule] = (theirsByRule[v.rule] ?? 0) + 1;
  const theirsMap = new Map<EdgeKey, TheirViolation[]>();
  for (const v of theirViolations.filter((x) => comparableRule(x.rule))) {
    const k = edgeKey(v.source, v.target);
    theirsMap.set(k, [...(theirsMap.get(k) ?? []), v]);
  }
  const oursMap = new Map<EdgeKey, (typeof ours)[number]>();
  let outside = 0;
  for (const o of ours) {
    if (!theirScope.has(o.source)) { outside++; continue; }
    oursMap.set(edgeKey(o.source, o.target), o);
  }
  const forbidPairs = new Map(t.forbidden.map((f) => [`${f.from}>${f.to}`, f.rules]));
  const intra = new Map(t.intraAtomForbidden.map((x) => [x.atom, x.rules]));
  const rows: EdgeRow[] = [];
  const byClass: Record<string, { oursOnly: number; theirsOnly: number }> = Object.fromEntries(DISAGREEMENT_CLASSES.map((k) => [k, { oursOnly: 0, theirsOnly: 0 }]));
  let both = 0;
  for (const k of [...new Set([...oursMap.keys(), ...theirsMap.keys()])].sort(cmp)) {
    const [s, tg] = splitKey(k);
    const o = oursMap.get(k);
    const th = theirsMap.get(k);
    const la = t.layerOf.get(s) ?? null;
    const lb = isFileTarget(tg) ? t.layerOf.get(tg) ?? null : null;
    const declared = la !== null && lb !== null ? (la === lb ? intra.get(la) ?? [] : forbidPairs.get(`${la}>${lb}`) ?? []) : [];
    const tscOcc = occByEdge.get(k) ?? [];
    const base = { source: s, target: tg, ourFunction: o?.functionId ?? '', theirRules: [...new Set((th ?? []).map((x) => x.rule))].join(';'), declaredRules: declared.join(';'), tscKinds: [...new Set(tscOcc.map((x) => x.kind))].join(',') };
    if (o !== undefined && th !== undefined) {
      both++;
      rows.push({ ...base, side: 'both', cls: '', reason: th.every((x) => x.viaUnresolved === true) ? 'agreement on the import; their tool did not resolve the alias' : '' });
      continue;
    }
    const side = o !== undefined ? 'ours-only' : 'theirs-only';
    if (th?.every((x) => x.viaUnresolved === true) === true) {
      const b = byClass['alias resolution'] ?? { oursOnly: 0, theirsOnly: 0 };
      b.theirsOnly++;
      byClass['alias resolution'] = b;
      rows.push({ ...base, side: 'theirs-only', cls: 'alias resolution', reason: 'their tool left the aliased specifier unresolved and its rule fired on the raw specifier; the TypeScript compiler resolves it to this file' });
      continue;
    }
    const ev: Evidence = {
      tsc: tscOcc, apgLiteral: apg.literal.has(k), apgResolvedOnly: !apg.literal.has(k) && apg.resolved.has(k), apgFiles,
      theirEdge: theirEdges?.get(k), theirGraph: theirEdges !== undefined, family: c.family,
      tsPreCompilationDeps: (decl as DepcruiseDecl).tsPreCompilationDeps, forbiddenByDecl: declared, ourLayers: [la, lb],
      elidedOnCompile: side === 'ours-only' && c.family === 'depcruise' && elidedOnCompile(join(c.root, s), tscOcc.map((x) => x.specifier)),
      suppressedInline: side === 'ours-only' && c.family !== 'depcruise'
        && (c.ruleIds ?? []).some((r) => suppressedInline(readFileSync(join(c.root, s), 'utf8'), r, tscOcc.map((x) => x.line))),
    };
    const { cls, reason } = classify(side, s, tg, ev);
    const bucket = byClass[cls] ?? { oursOnly: 0, theirsOnly: 0 };
    if (side === 'ours-only') bucket.oursOnly++; else bucket.theirsOnly++;
    byClass[cls] = bucket;
    rows.push({ ...base, side, cls, reason });
  }
  const header = ['source', 'target', 'side', 'ourFunction', 'theirRules', 'declaredRules', 'cls', 'reason', 'tscKinds'] as const;
  writeFileSync(join(c.out, 'edges.csv'), toCsv(header, rows.map((r) => header.map((h) => r[h]))));
  writeFileSync(join(c.out, 'atoms.json'), JSON.stringify({
    atoms: t.atoms.map((a) => ({ id: a.id, label: a.label, files: a.files.length })),
    allowed: t.allowed, forbidden: t.forbidden, intraAtomForbidden: t.intraAtomForbidden,
  }, null, 1) + '\n');
  const result: CaseResult = {
    id: c.id, repo: c.repo, sha: c.sha, family: c.family, toolVersion: c.toolVersion,
    ...(c.history !== undefined ? { history: c.history } : {}), ...(c.note !== undefined ? { note: c.note } : {}),
    files: { apg: apg.files.length, theirScope: theirScope.size, compared: [...theirScope].filter((f) => apgFiles.has(f)).length, mapped: [...apgFiles].filter((f) => t.layerOf.get(f) != null).length },
    atoms: t.atoms.length, allowedEdges: t.allowed.length, forbiddenPairs: t.forbidden.length, specLayerMismatches: mismatches.length,
    coverage: t.coverage, theirsAll: theirViolations.length, theirsByRule, theirsComparable: theirsMap.size,
    ours: ours.length, oursOutsideTheirScope: outside, both,
    oursOnly: rows.filter((r) => r.side === 'ours-only').length, theirsOnly: rows.filter((r) => r.side === 'theirs-only').length,
    byClass, unmappedEslint: unmapped,
  };
  writeFileSync(join(c.out, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  return result;
}

// ── Summary over every case ──────────────────────────────────────────────────

export function summarise(dir: string): { cases: CaseResult[]; totals: Record<string, number>; byClass: Record<string, { oursOnly: number; theirsOnly: number }> } {
  const cases: CaseResult[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name));
      else if (e.name === 'result.json') cases.push(JSON.parse(readFileSync(join(d, e.name), 'utf8')) as CaseResult);
    }
  };
  walk(dir);
  cases.sort((a, b) => cmp(a.id, b.id));
  const totals: Record<string, number> = { cases: cases.length, both: 0, oursOnly: 0, theirsOnly: 0, ours: 0, theirsComparable: 0 };
  const byClass: Record<string, { oursOnly: number; theirsOnly: number }> = Object.fromEntries(DISAGREEMENT_CLASSES.map((k) => [k, { oursOnly: 0, theirsOnly: 0 }]));
  for (const c of cases) {
    for (const k of ['both', 'oursOnly', 'theirsOnly', 'ours', 'theirsComparable'] as const) totals[k] = (totals[k] ?? 0) + c[k];
    for (const [k, v] of Object.entries(c.byClass)) { const b = byClass[k] ?? { oursOnly: 0, theirsOnly: 0 }; b.oursOnly += v.oursOnly; b.theirsOnly += v.theirsOnly; byClass[k] = b; }
  }
  return { cases, totals, byClass };
}

async function main(): Promise<void> {
  const [mode, arg] = process.argv.slice(2);
  if (mode === 'case' && arg !== undefined) {
    const c = JSON.parse(readFileSync(arg, 'utf8')) as CaseInput;
    const r = await runCase({ ...c, out: resolve(c.out) });
    process.stdout.write(`${r.id}: atoms ${String(r.atoms)}, theirs ${String(r.theirsComparable)}/${String(r.theirsAll)}, ours ${String(r.ours)} (outside ${String(r.oursOutsideTheirScope)}), both ${String(r.both)}, ours-only ${String(r.oursOnly)}, theirs-only ${String(r.theirsOnly)}, spec mismatches ${String(r.specLayerMismatches)}\n`);
  } else if (mode === 'summary' && arg !== undefined && existsSync(arg)) {
    const s = summarise(arg);
    writeFileSync(join(arg, 'summary.json'), JSON.stringify(s, null, 1) + '\n');
    process.stdout.write(JSON.stringify({ totals: s.totals, byClass: s.byClass }, null, 1) + '\n');
  } else {
    throw new Error('usage: declared-rules-run.ts case <case.json> | summary <dir>');
  }
}

if (process.argv[1]?.endsWith('declared-rules-run.ts') === true) main().catch((e: unknown) => { process.stderr.write(`${String((e as Error).stack ?? e)}\n`); process.exit(1); });
