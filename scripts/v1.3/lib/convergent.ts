/**
 * Convergent validity (Docs/DiagnosticRuns/v1.3-validity-convergent-2026-10-16.md): pure helpers that translate the
 * v1.3 rules of a spec into the configurations of three independent tools (dependency-cruiser, eslint-plugin-boundaries,
 * ArchUnitTS), normalise every tool's findings to the shared key (rule, file, target), and compute agreement.
 *
 * The translation reads the rules as the v1.3 compiler binds them (`compileFunctions` with `V13_COMPILE_OPTIONS`):
 * the IR below is built from each compiled query's template name and bound parameters, so the layer order, the
 * allowed-dependency graph, the forbidden packages, the DDD contexts and aggregates are exactly what our Cypher reads.
 * Nothing here executes or edits a Cypher template.
 *
 * Policy (stated in the report): a rule counts as expressible by a tool only through the tool's declarative rule
 * vocabulary. Escape hatches that run arbitrary code over a file (ArchUnitTS `adhereTo`/custom metrics, a hand-written
 * ESLint rule, dependency-cruiser's programmatic API) are not counted: with them every rule is "expressible" by
 * re-implementing it, which is not convergent evidence.
 */
import picomatch from 'picomatch';
import { globRegex, packageRegex } from '../../depcruise-translate.js';
import type { PathSelector } from '../../depcruise-translate.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';

export const TOOLS = ['depcruise', 'boundaries', 'archunit'] as const;
export type Tool = (typeof TOOLS)[number];
export type Engine = 'ours' | Tool;

export type RuleKind = 'layer-edge' | 'package' | 'cycle' | 'orphan' | 'fan-in' | 'context' | 'aggregate' | 'repo-aggregate' | 'unknown-file';

/** Key granularity of a rule kind: an edge (file, target) or a file (target empty). */
export const KIND_UNIT: Readonly<Record<RuleKind, 'edge' | 'package-edge' | 'file'>> = {
  'layer-edge': 'edge', package: 'package-edge', cycle: 'edge', orphan: 'file', 'fan-in': 'file',
  context: 'edge', aggregate: 'edge', 'repo-aggregate': 'edge', 'unknown-file': 'file',
};

/** Templates the IR covers, with their kind and edge view (Docs/v1.3/edge-views.md). */
export const TEMPLATE_KIND: Readonly<Record<string, { kind: RuleKind; view: 'literal' | 'resolved' | 'none' }>> = {
  'dependency-direction': { kind: 'layer-edge', view: 'literal' },
  'no-layer-skip': { kind: 'layer-edge', view: 'literal' },
  'no-domain-outward-dep': { kind: 'layer-edge', view: 'literal' },
  'dependency-direction-graph': { kind: 'layer-edge', view: 'literal' },
  'layer-skip-graph': { kind: 'layer-edge', view: 'literal' },
  'core-isolation': { kind: 'layer-edge', view: 'literal' },
  'domain-purity': { kind: 'package', view: 'resolved' },
  'no-cyclic-deps': { kind: 'cycle', view: 'literal' },
  'no-orphan-files': { kind: 'orphan', view: 'literal' },
  'max-fan-in': { kind: 'fan-in', view: 'literal' },
  'context-isolation': { kind: 'context', view: 'literal' },
  'aggregate-boundary': { kind: 'aggregate', view: 'resolved' },
  'repository-aggregate-root': { kind: 'repo-aggregate', view: 'resolved' },
  'bounded-context-modules': { kind: 'unknown-file', view: 'none' },
};

/** What each tool can express per rule kind: `null` = translated, else the reason it cannot. */
export const CAPABILITY: Readonly<Record<Tool, Readonly<Record<RuleKind, string | null>>>> = {
  depcruise: {
    'layer-edge': null, package: null, cycle: null, orphan: null, 'fan-in': null, context: null, aggregate: null, 'repo-aggregate': null,
    'unknown-file': 'rules constrain dependencies or modules with dependencies; a file that lies in no declared context is not a dependency fact (no rule on file placement alone)',
  },
  boundaries: {
    'layer-edge': null, package: null,
    cycle: 'no cycle rule (cycles are eslint-plugin-import `no-cycle`, a different tool)',
    orphan: 'per-import lint rule: sees one file\'s imports, never the whole graph, so "no file imports this one" is not expressible',
    'fan-in': 'per-import lint rule: no dependent counts',
    context: null, aggregate: null, 'repo-aggregate': null, 'unknown-file': null,
  },
  archunit: {
    'layer-edge': null,
    package: 'the dependency graph holds project files only; imports of packages are dropped (resolved or not), so no rule can name a package',
    cycle: null,
    orphan: 'no orphan rule (file rules are dependency, cycle, naming and placement predicates)',
    'fan-in': 'count metrics are per class (methods, fields, lines, statements); no per-file dependent count',
    context: null, aggregate: null, 'repo-aggregate': null, 'unknown-file': null,
  },
};

/** Rules no tool can express, by template name: our added value. */
export const UNEXPRESSIBLE: Readonly<Record<string, string>> = {
  'dependency-inversion': 'ratio of interface to concrete constructor-injected dependencies per class against a threshold (CONSTRUCTOR_INJECTS, symbol kinds)',
  'port-dependency-inversion': 'same ratio as dependency-inversion, over the application layers',
  'repository-pattern': 'a repository class in infrastructure must IMPLEMENT a domain interface (class roles, IMPLEMENTS)',
  'port-adapter-pattern': 'an outbound adapter class must IMPLEMENT a port interface of the core (class roles, IMPLEMENTS)',
  'use-case-isolation': 'use-case classes must not constructor-inject other use cases (class roles, CONSTRUCTOR_INJECTS)',
  'controller-no-entity': 'a controller class must not use an entity class (class roles; constructor injection and signature types)',
  'domain-state-purity': 'a domain class must not hold infrastructure state (constructor injection of an infrastructure type; field data flow)',
  'domain-stability': 'Martin instability of the domain layer against a threshold (layer-level metric)',
  'module-fan-out': 'distinct file fan-out over IMPORTS against a threshold (no tool has a fan-out condition)',
  'component-instability': 'Martin instability per file against a threshold (ArchUnitTS instability is per folder/project, not per file, and not filterable to mapped files)',
  'abstraction-ratio': 'abstract classes and interfaces over all classes of the domain against a threshold',
  'single-responsibility-proxy': 'public methods and constructor dependencies per class (ArchUnitTS methodCount counts all methods; no dependency count)',
  'interface-segregation-proxy': 'methods per interface (ArchUnitTS count metrics read classes only)',
  'inheritance-depth': 'class inheritance depth (EXTENDS chains)',
  'naming-services': 'class names of application-layer classes (tools match file names, not declared class names)',
  'naming-repos': 'class names of repository classes (tools match file names, not declared class names)',
  'test-file-pairing': 'existence of a sibling test file (no tool rule on file existence)',
  'no-index-logic': 'statement kinds declared inside index.ts barrels',
  'value-object-immutability': 'mutable members (setters, non-readonly fields) of value-object classes',
  'domain-event-placement': 'classes that implement or extend DomainEvent, outside the domain layer (type hierarchy)',
  'application-service-thin': 'methods per application-service class (ArchUnitTS methodCount is close but counts every class member method of every class in a file, and our CONTAINS counts declared methods; not translated)',
};

export interface LayerSel { readonly name: string; readonly dirs: readonly string[]; readonly files: readonly string[] }

export interface ContextSel {
  readonly name: string; readonly root: string;
  readonly publicApiGlobs: readonly string[]; readonly aclGlobs: readonly string[];
}
export interface AggregateSel { readonly name: string; readonly moduleGlob: string; readonly innerGlobs: readonly string[] }

export interface IrRule {
  readonly id: string;
  readonly template: string;
  readonly kind: RuleKind;
  readonly view: 'literal' | 'resolved' | 'none';
  /** Bound `excludePatterns` (Neo4j full-match regexes) on the source side. */
  readonly excludeRx: readonly string[];
  readonly pairs?: readonly (readonly [string, string])[];
  readonly srcLayer?: string;
  readonly packages?: readonly string[];
  readonly threshold?: number;
  readonly contexts?: readonly ContextSel[];
  readonly aggregates?: readonly AggregateSel[];
  readonly repositoryGlobs?: readonly string[];
  readonly sourceRoot?: string;
  readonly outsideGlobs?: readonly string[];
}

export interface Ir {
  readonly style: string;
  readonly layers: readonly LayerSel[];
  readonly rules: readonly IrRule[];
  /** Compiled rules outside the IR, with the reason (UNEXPRESSIBLE). */
  readonly untranslated: readonly { readonly id: string; readonly template: string; readonly reason: string }[];
  /** Extractor excludes (globs) that remove files from every graph. */
  readonly extractorExcludes: readonly string[];
}

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Forbidden (source layer, target layer) pairs of one layer-edge template, from its bound parameters. */
export function forbiddenPairs(template: string, params: Readonly<Record<string, unknown>>, layers: readonly string[]): [string, string][] {
  const out: [string, string][] = [];
  const all = (pred: (a: string, b: string) => boolean): void => {
    for (const a of layers) for (const b of layers) if (a !== b && pred(a, b)) out.push([a, b]);
  };
  switch (template) {
    case 'dependency-direction': {
      const order = strs(params.layerOrder);
      all((a, b) => order.indexOf(a) >= 0 && order.indexOf(b) >= 0 && order.indexOf(a) < order.indexOf(b));
      break;
    }
    case 'no-layer-skip': {
      const allowed = new Set(strs(params.allowedTransitions));
      all((a, b) => !allowed.has(`${a}>${b}`));
      break;
    }
    case 'no-domain-outward-dep':
    case 'core-isolation': {
      const d = String(params.domainLayer);
      all((a) => a === d);
      break;
    }
    case 'dependency-direction-graph': {
      const allowed = new Set(strs(params.allowedDependencies));
      all((a, b) => !allowed.has(`${a}>${b}`) && allowed.has(`${b}>${a}`));
      break;
    }
    case 'layer-skip-graph': {
      const allowed = new Set(strs(params.allowedDependencies));
      all((a, b) => !allowed.has(`${a}>${b}`) && !allowed.has(`${b}>${a}`));
      break;
    }
    default: throw new Error(`not a layer-edge template: ${template}`);
  }
  return out;
}

/** Build the IR from a parsed spec and its v1.3 compiled symbolic queries. */
export function buildIr(spec: ParsedSpec, queries: readonly CypherQuery[], extractorExcludes: readonly string[]): Ir {
  const layers: LayerSel[] = spec.layerModel.layers.map((l) => ({ name: l.name, dirs: [...l.directories], files: [...(l.filePatterns ?? [])] }));
  const layerNames = layers.map((l) => l.name);
  const ddd = spec.layerModel.ddd;
  const rules: IrRule[] = [];
  const untranslated: { id: string; template: string; reason: string }[] = [];
  for (const q of queries) {
    const id = String(q.functionId);
    const tk = TEMPLATE_KIND[q.name];
    if (tk === undefined) {
      untranslated.push({ id, template: q.name, reason: UNEXPRESSIBLE[q.name] ?? 'no counterpart in any tool' });
      continue;
    }
    const base = { id, template: q.name, kind: tk.kind, view: tk.view, excludeRx: strs(q.params.excludePatterns) };
    switch (tk.kind) {
      case 'layer-edge': rules.push({ ...base, pairs: forbiddenPairs(q.name, q.params, layerNames) }); break;
      case 'package': rules.push({ ...base, srcLayer: String(q.params.domainLayer), packages: strs(q.params.forbiddenImports) }); break;
      case 'cycle': case 'orphan': rules.push(base); break;
      case 'fan-in': rules.push({ ...base, threshold: Number(q.params.threshold) }); break;
      case 'context': case 'unknown-file': {
        if (ddd === undefined) throw new Error('DDD rule without architecture.ddd');
        rules.push({
          ...base,
          contexts: ddd.contexts.map((c) => ({ name: c.name, root: c.root, publicApiGlobs: [...c.publicApi], aclGlobs: [...c.acl] })),
          sourceRoot: ddd.sourceRoot, outsideGlobs: [...ddd.outsideContexts],
        });
        break;
      }
      case 'aggregate': case 'repo-aggregate': {
        if (ddd === undefined) throw new Error('DDD rule without architecture.ddd');
        rules.push({
          ...base,
          aggregates: ddd.aggregates.map((a) => ({ name: a.name, moduleGlob: a.module, innerGlobs: [...a.innerEntities] })),
          repositoryGlobs: [...ddd.repositories],
        });
        break;
      }
    }
  }
  return { style: spec.style ?? '', layers, rules, untranslated, extractorExcludes: [...extractorExcludes] };
}

// ── Our layer annotator, for classification only (never fed to a tool) ────────

/** The layer of a file as `layer-annotator.ts` assigns it: first layer by directories, else first by file patterns. */
export function layerOf(file: string, layers: readonly LayerSel[]): string | undefined {
  const m = (g: string): boolean => picomatch(g, { dot: true })(file);
  return layers.find((l) => l.dirs.some(m))?.name ?? layers.find((l) => l.files.some(m))?.name;
}

// ── dependency-cruiser ────────────────────────────────────────────────────────

const NODE_MODULES = '(^|/)node_modules/';
const full = (rx: string): string => `^(?:${rx})$`;

export interface DcRule { name: string; severity: 'error'; from: Record<string, unknown>; to?: Record<string, unknown>; module?: Record<string, unknown> }

function dcSel(s: PathSelector, extraNot: readonly string[] = []): Record<string, unknown> {
  const pathNot = [...s.pathNot, ...extraNot];
  return { path: [...s.path], ...(pathNot.length > 0 ? { pathNot } : {}) };
}

/** dependency-cruiser `forbidden` rules for an IR (rule names `<id>--<n>`). */
/**
 * A glob as a dependency-cruiser regex: the registered T1 form (`globRegex`, no nested repetition) where it applies,
 * else picomatch's own regex for globs with braces or extglobs (e.g. `!(*.module).ts`), which dependency-cruiser may
 * refuse as unsafe (then the run reports the configuration error).
 */
export function dcGlob(glob: string): string {
  try { return globRegex(glob); } catch { /* not the T1 form */ }
  // The negated-extglob segment the external specs use, `<dir>/**/!(a|b)<suffix>`: T1 for the rest of the glob, and a
  // negative lookahead (star height 1, which dependency-cruiser's safe-regex check accepts) for the last segment.
  const m = /^(.*\/)?!\(([^()]+)\)([^/()]*)$/.exec(glob);
  if (m !== null) {
    const esc = (t: string): string => t.replace(/[.+?^${}()|[\]\\/]/g, '\\$&').split('*').join('[^/]*');
    const head = m[1] ?? '';
    const alts = (m[2] ?? '').split('|').map(esc).join('|');
    const suffix = esc(m[3] ?? '');
    const last = `(?!(?:${alts})${suffix}$)[^/]*${suffix}$`;
    if (head === '') return `(?:^|\\/)${last}`;
    const base = globRegex(`${head}x`).replace(/x\$$/, '');
    return `${base}${last}`;
  }
  return picomatch.makeRe(glob, { dot: true }).source;
}

/** T1 layer selectors (as `layerSelectors` in depcruise-translate.ts) with `dcGlob`. */
export function dcLayerSelectors(layers: readonly LayerSel[]): PathSelector[][] {
  const dirs = layers.map((l) => l.dirs.map(dcGlob));
  const files = layers.map((l) => l.files.map(dcGlob));
  const allDirs = dirs.flat();
  return layers.map((_, i) => {
    const out: PathSelector[] = [];
    if ((dirs[i] ?? []).length > 0) out.push({ path: dirs[i] ?? [], pathNot: dirs.slice(0, i).flat() });
    if ((files[i] ?? []).length > 0) out.push({ path: files[i] ?? [], pathNot: [...allDirs, ...files.slice(0, i).flat()] });
    return out;
  });
}

export function depcruiseRules(ir: Ir): DcRule[] {
  const sels = dcLayerSelectors(ir.layers);
  const idx = new Map(ir.layers.map((l, i) => [l.name, i]));
  const out: DcRule[] = [];
  for (const r of ir.rules) {
    const ex = r.excludeRx.map(full);
    const push = (from: Record<string, unknown>, to: Record<string, unknown> | undefined, extra: Partial<DcRule> = {}): void => {
      out.push({ name: `${r.id}--${String(out.length)}`, severity: 'error', from, ...(to !== undefined ? { to } : {}), ...extra });
    };
    switch (r.kind) {
      case 'layer-edge':
        for (const [a, b] of r.pairs ?? []) {
          for (const fs of sels[idx.get(a) ?? -1] ?? []) for (const ts of sels[idx.get(b) ?? -1] ?? []) push(dcSel(fs, ex), dcSel(ts, [NODE_MODULES]));
        }
        break;
      case 'package':
        for (const fs of sels[idx.get(r.srcLayer ?? '') ?? -1] ?? []) push(dcSel(fs, ex), { path: (r.packages ?? []).map(packageRegex) });
        break;
      case 'cycle': push(ex.length > 0 ? { pathNot: ex } : {}, { circular: true }); break;
      case 'orphan':
        for (const ss of sels) for (const fs of ss) push({ orphan: true, ...dcSel(fs, ex) }, {});
        break;
      case 'fan-in':
        push({ pathNot: [NODE_MODULES] }, undefined, { module: { numberOfDependentsMoreThan: r.threshold, pathNot: [NODE_MODULES, ...ex] } });
        break;
      case 'context': {
        const api = (r.contexts ?? []).flatMap((c) => c.publicApiGlobs.map(dcGlob));
        for (const a of r.contexts ?? []) for (const b of r.contexts ?? []) {
          if (a.name === b.name) continue;
          push({ path: [dcGlob(`${a.root}**`)], pathNot: [...a.aclGlobs.map(dcGlob), ...ex] }, { path: [dcGlob(`${b.root}**`)], ...(api.length > 0 ? { pathNot: api } : {}) });
        }
        break;
      }
      case 'aggregate':
        for (const g of r.aggregates ?? []) {
          if (g.innerGlobs.length === 0) continue;
          push({ pathNot: [dcGlob(g.moduleGlob), ...ex] }, { path: g.innerGlobs.map(dcGlob) });
        }
        break;
      case 'repo-aggregate': {
        const inner = (r.aggregates ?? []).flatMap((g) => g.innerGlobs.map(dcGlob));
        if (inner.length > 0 && (r.repositoryGlobs ?? []).length > 0) push({ path: (r.repositoryGlobs ?? []).map(dcGlob), ...(ex.length > 0 ? { pathNot: ex } : {}) }, { path: inner });
        break;
      }
      case 'unknown-file': break;
    }
  }
  return out;
}

// ── eslint-plugin-boundaries ──────────────────────────────────────────────────

export interface BoundariesGroup {
  /** Rule ids checked by this ESLint run (one element classification per run). */
  readonly ruleIds: readonly string[];
  readonly elements: readonly Record<string, unknown>[];
  readonly policies: readonly Record<string, unknown>[];
  readonly noUnknownFiles?: string;
  /** Files to lint (`undefined` = every program file). */
  readonly filesUnder?: string;
}

// `mode: 'full'` (deprecated in v7, still supported): the pattern is matched against the whole file path, as our globs
// are. `partialMatch: false` matches folder-like element paths and never matches a single file such as `src/main.ts`.
const el = (type: string, pattern: string | readonly string[]): Record<string, unknown> => ({ type, pattern, mode: 'full' });
const msg = (id: string): string => `${id}|{{to.file.path}}|{{to.module.source}}`;

/**
 * eslint-plugin-boundaries runs for an IR. Element descriptors are matched in order, first match wins, so the layer
 * descriptors are emitted as our annotator reads layers: every layer's directories in spec order, then every layer's
 * file patterns. Each DDD rule family gets its own classification (one ESLint run each).
 */
export function boundariesGroups(ir: Ir): BoundariesGroup[] {
  const groups: BoundariesGroup[] = [];
  // One ESLint run per rule: an import gets one report, from the last policy that matches it, so two rules that
  // forbid the same import (FF-S01 and FF-S04 on a domain-to-application import) cannot share a run.
  const elements = [
    ...ir.layers.filter((l) => l.dirs.length > 0).map((l) => el(`L:${l.name}`, l.dirs)),
    ...ir.layers.filter((l) => l.files.length > 0).map((l) => el(`L:${l.name}`, l.files)),
  ];
  for (const r of ir.rules) {
    if (r.kind === 'layer-edge') {
      const policies = (r.pairs ?? []).map(([a, b]) => ({ from: { element: { type: `L:${a}` } }, disallow: { to: { element: { type: `L:${b}` } } }, message: msg(r.id) }));
      if (policies.length > 0) groups.push({ ruleIds: [r.id], elements, policies });
    } else if (r.kind === 'package') {
      groups.push({ ruleIds: [r.id], elements, policies: [{ from: { element: { type: `L:${r.srcLayer ?? ''}` } }, disallow: { to: { module: { origin: 'external', source: [...(r.packages ?? [])] } } }, message: msg(r.id) }] });
    }
  }
  for (const r of ir.rules) {
    const ctxEls = (rr: IrRule): Record<string, unknown>[] => (rr.contexts ?? []).flatMap((c) => [
      ...(c.aclGlobs.length > 0 ? [el(`ACL:${c.name}`, c.aclGlobs)] : []),
      ...(c.publicApiGlobs.length > 0 ? [el(`API:${c.name}`, c.publicApiGlobs)] : []),
      el(`CTX:${c.name}`, `${c.root}**`),
    ]);
    if (r.kind === 'context') {
      const policies: Record<string, unknown>[] = [];
      for (const a of r.contexts ?? []) for (const b of r.contexts ?? []) {
        if (a.name === b.name) continue;
        policies.push({
          from: [{ element: { type: `CTX:${a.name}` } }, { element: { type: `API:${a.name}` } }],
          disallow: { to: [{ element: { type: `CTX:${b.name}` } }, { element: { type: `ACL:${b.name}` } }] },
          message: msg(r.id),
        });
      }
      groups.push({ ruleIds: [r.id], elements: ctxEls(r), policies });
    } else if (r.kind === 'unknown-file') {
      groups.push({
        ruleIds: [r.id], elements: [...ctxEls(r), ...((r.outsideGlobs ?? []).length > 0 ? [el('OUTSIDE', r.outsideGlobs ?? [])] : [])],
        policies: [], noUnknownFiles: r.id, ...(r.sourceRoot !== undefined ? { filesUnder: r.sourceRoot } : {}),
      });
    } else if (r.kind === 'aggregate') {
      const aggs = (r.aggregates ?? []).filter((g) => g.innerGlobs.length > 0);
      const elements = [...aggs.flatMap((g) => [el(`INNER:${g.name}`, g.innerGlobs), el(`AGG:${g.name}`, g.moduleGlob)]), el('OTHER', '**')];
      const types = elements.map((e) => String(e.type));
      const policies = aggs.map((g) => ({
        from: types.filter((t) => t !== `INNER:${g.name}` && t !== `AGG:${g.name}`).map((t) => ({ element: { type: t } })),
        disallow: { to: { element: { type: `INNER:${g.name}` } } }, message: msg(r.id),
      }));
      if (aggs.length > 0) groups.push({ ruleIds: [r.id], elements, policies });
    } else if (r.kind === 'repo-aggregate') {
      const inner = (r.aggregates ?? []).flatMap((g) => g.innerGlobs);
      if (inner.length > 0 && (r.repositoryGlobs ?? []).length > 0) {
        groups.push({
          ruleIds: [r.id], elements: [el('REPO', r.repositoryGlobs ?? []), el('INNER', inner), el('OTHER', '**')],
          policies: [{ from: { element: { type: 'REPO' } }, disallow: { to: { element: { type: 'INNER' } } }, message: msg(r.id) }],
        });
      }
    }
  }
  return groups;
}

// ── ArchUnitTS ────────────────────────────────────────────────────────────────

/** One ArchUnitTS check: regex sources (JS) for the file selections. */
export type ArchCheck =
  | { readonly id: string; readonly op: 'not-depend'; readonly from: string; readonly to: string }
  | { readonly id: string; readonly op: 'no-cycles'; readonly from: string }
  | { readonly id: string; readonly op: 'be-in'; readonly from: string; readonly allowed: string };

const re = (g: string): string => picomatch.makeRe(g, { dot: true }).source;
const anyOf = (srcs: readonly string[]): string => (srcs.length === 0 ? '(?!)' : srcs.map((s) => `(?:${s})`).join('|'));
/** `^` (not any of `not`) (any of `yes`): one JS regex (every part is anchored). */
const sel = (yes: readonly string[], not: readonly string[]): string => `^${not.length > 0 ? `(?!${anyOf(not)})` : ''}(?:${anyOf(yes)})`;

/** The ArchUnitTS checks of an IR. Every selection also excludes the extractor excludes. */
export function archunitChecks(ir: Ir): ArchCheck[] {
  const ex = ir.extractorExcludes.map(re);
  const dirsRx = ir.layers.map((l) => l.dirs.map(re));
  const filesRx = ir.layers.map((l) => l.files.map(re));
  const layerSel = (name: string): string[] => {
    const i = ir.layers.findIndex((l) => l.name === name);
    if (i < 0) return [];
    const out: string[] = [];
    if ((dirsRx[i] ?? []).length > 0) out.push(sel(dirsRx[i] ?? [], [...dirsRx.slice(0, i).flat(), ...ex]));
    if ((filesRx[i] ?? []).length > 0) out.push(sel(filesRx[i] ?? [], [...dirsRx.flat(), ...filesRx.slice(0, i).flat(), ...ex]));
    return out;
  };
  const out: ArchCheck[] = [];
  for (const r of ir.rules) {
    const rex = [...ex, ...r.excludeRx.map((x) => `^(?:${x})$`)];
    switch (r.kind) {
      case 'layer-edge':
        for (const [a, b] of r.pairs ?? []) for (const f of layerSel(a)) for (const t of layerSel(b)) out.push({ id: r.id, op: 'not-depend', from: r.excludeRx.length > 0 ? `(?=${sel(['.*'], rex)})${f}` : f, to: t });
        break;
      case 'cycle': out.push({ id: r.id, op: 'no-cycles', from: sel(['^.*$'], rex) }); break;
      case 'context': {
        const api = (r.contexts ?? []).flatMap((c) => c.publicApiGlobs.map(re));
        for (const a of r.contexts ?? []) for (const b of r.contexts ?? []) {
          if (a.name !== b.name) out.push({ id: r.id, op: 'not-depend', from: sel([re(`${a.root}**`)], [...a.aclGlobs.map(re), ...rex]), to: sel([re(`${b.root}**`)], [...api, ...ex]) });
        }
        break;
      }
      case 'aggregate':
        for (const g of r.aggregates ?? []) {
          if (g.innerGlobs.length > 0) out.push({ id: r.id, op: 'not-depend', from: sel(['^.*$'], [re(g.moduleGlob), ...rex]), to: sel(g.innerGlobs.map(re), ex) });
        }
        break;
      case 'repo-aggregate': {
        const inner = (r.aggregates ?? []).flatMap((g) => g.innerGlobs.map(re));
        if (inner.length > 0 && (r.repositoryGlobs ?? []).length > 0) out.push({ id: r.id, op: 'not-depend', from: sel((r.repositoryGlobs ?? []).map(re), rex), to: sel(inner, ex) });
        break;
      }
      case 'unknown-file': {
        const allowed = [...(r.contexts ?? []).map((c) => re(`${c.root}**`)), ...(r.outsideGlobs ?? []).map(re)];
        out.push({ id: r.id, op: 'be-in', from: sel([re(`${r.sourceRoot ?? ''}**`)], rex), allowed: sel(allowed, []) });
        break;
      }
      case 'package': case 'orphan': case 'fan-in': break;
    }
  }
  return out;
}

// ── Keys ──────────────────────────────────────────────────────────────────────

/** A finding key: `rule|file|target` (target '' for a file-level rule). */
export const key = (rule: string, file: string, target = ''): string => `${rule}|${file}|${target}`;
export const splitKey = (k: string): { rule: string; file: string; target: string } => {
  const [rule = '', file = '', ...rest] = k.split('|');
  return { rule, file, target: rest.join('|') };
};

/** Base package name of a specifier or node_modules path (`@nestjs/common/x` → `@nestjs/common`; `@types/x` → `x`). */
export function packageName(spec: string): string {
  const nm = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(spec);
  let s = nm !== null ? (nm[1] ?? spec) : spec;
  if (nm === null) {
    const parts = s.split('/');
    s = s.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? s);
  }
  if (s.startsWith('@types/')) {
    const bare = s.slice('@types/'.length);
    return bare.includes('__') ? `@${bare.replace('__', '/')}` : bare;
  }
  return s;
}

/** The edges of a cycle given as a closed path [a, b, ..., a] or an open one [a, b, ...] (closed implicitly). */
export function cycleEdges(cycle: readonly string[]): [string, string][] {
  const nodes = cycle.length > 1 && cycle[0] === cycle[cycle.length - 1] ? cycle.slice(0, -1) : [...cycle];
  return nodes.map((n, i) => [n, nodes[(i + 1) % nodes.length] ?? n]);
}

// ── Agreement ─────────────────────────────────────────────────────────────────

export interface Table { readonly both: number; readonly aOnly: number; readonly bOnly: number; readonly neither: number }

export function table(a: ReadonlySet<string>, b: ReadonlySet<string>, universe: number): Table {
  let both = 0;
  for (const k of a) if (b.has(k)) both++;
  const aOnly = a.size - both;
  const bOnly = b.size - both;
  return { both, aOnly, bOnly, neither: Math.max(0, universe - both - aOnly - bOnly) };
}

export const addTables = (ts: readonly Table[]): Table => ts.reduce(
  (s, t) => ({ both: s.both + t.both, aOnly: s.aOnly + t.aOnly, bOnly: s.bOnly + t.bOnly, neither: s.neither + t.neither }),
  { both: 0, aOnly: 0, bOnly: 0, neither: 0 },
);

/** Observed agreement, Cohen's kappa, and positive agreement (2·both / (2·both + aOnly + bOnly)). */
export function agreement(t: Table): { n: number; po: number; kappa: number | null; positiveAgreement: number | null } {
  const n = t.both + t.aOnly + t.bOnly + t.neither;
  if (n === 0) return { n, po: 1, kappa: null, positiveAgreement: null };
  const po = (t.both + t.neither) / n;
  const pa = (t.both + t.aOnly) / n;
  const pb = (t.both + t.bOnly) / n;
  const pe = pa * pb + (1 - pa) * (1 - pb);
  const kappa = pe === 1 ? null : (po - pe) / (1 - pe);
  const pos = 2 * t.both + t.aOnly + t.bOnly;
  return { n, po, kappa, positiveAgreement: pos === 0 ? null : (2 * t.both) / pos };
}

/** Wilson 95% interval of k/n (as `scripts/v1.3/ue-score.ts`). */
export function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.959964;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
