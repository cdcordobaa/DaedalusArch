/**
 * Team-declared architecture rules → DaedalusArch spec (v1.3 brownfield ground truth,
 * `Docs/DiagnosticRuns/v1.3-declared-rules-2026-10-16.md`). The reverse direction of `scripts/depcruise-translate.ts`:
 * there a DaedalusArch spec became a dependency-cruiser rule set; here a team's own declaration becomes a spec.
 *
 * Inputs (one per tool family, read from the team's configuration as their tool resolves it):
 * - dependency-cruiser: the `forbidden` (and `allowed`) rules of `.dependency-cruiser.{js,cjs,json}`;
 * - eslint-plugin-boundaries: the `boundaries/elements` settings and the `boundaries/element-types` rule options;
 * - Nx: the project list (root, tags) and the `depConstraints` of `@nx/enforce-module-boundaries`.
 *
 * Target. DaedalusArch has one construct that can hold an arbitrary module dependency relation: the v1.3 hexagonal
 * style's `architecture.allowed_dependencies` graph, read by two templates (`dependency-direction-graph`, FF-S01,
 * and `layer-skip-graph`, FF-S03). Together they flag every import between two different layers that does not follow
 * an allowed edge. Same-layer imports are never flagged. So the translation is:
 *
 * D1 Atoms. Every in-scope file gets a signature: the value of every predicate the declared rules evaluate on it
 *    (dependency-cruiser: each rule's `from` match with its capture groups and each `to` match, after `$n`
 *    substitution, for every capture value seen; boundaries: the element type and captured values, plus the element
 *    instance when two instances of one type may not import each other; Nx: the project). Files with equal
 *    signatures are indistinguishable to the rules, so each signature class becomes one layer. A file no rule can
 *    see (boundaries: unknown or ignored; Nx: outside every project) gets no layer.
 * D2 Allowed edges. For two different atoms A, B the declared rules are evaluated on one file of each; the result is
 *    exact because it depends on the signatures only. `A > B` is allowed unless a rule forbids it.
 * D3 Same-atom prohibitions. When the rules forbid an import between two different files of one atom (a sibling
 *    rule without capture groups, a same-folder rule, ...) DaedalusArch cannot say it: recorded, not translated.
 * D4 Layers in YAML. A directory whose in-scope files all belong to one atom becomes `<dir>/**` of that atom
 *    (largest such directories); every other file is listed in `file_patterns`. Directory globs are disjoint and
 *    are matched before file patterns, so the spec's layer assignment equals the atom map on the snapshot (checked
 *    by the run with DaedalusArch's own layer annotator).
 * D6 Per-file rule configuration. Files the team's configuration does not run the rule on (an ESLint override that
 *    turns it off for a project or directory) are source-side excludes: `exclude_paths` of FF-S01 and FF-S03, which the
 *    compiled Cypher applies to the importing file (`/*EXCLUDE:src*\/`).
 * D5 Placeholders. The hexagonal binding needs a domain, application, presentation and infrastructure layer; four
 *    empty placeholder layers carry those kinds and one placeholder edge, so the spec binds. Only FF-S01 and FF-S03 are
 *    enabled; neither reads a layer kind.
 *
 * What is not expressible is recorded per rule (`RuleCoverage`): package and dependency-type targets, cycles,
 * orphans, reachability, import-kind conditions, transitive Nx bans, external/app/deep-import Nx checks, same-atom
 * prohibitions, and rules whose matchers this translator does not implement.
 */
import picomatch from 'picomatch';
import { stringify } from 'yaml';
import { resolveTemplate } from '../../src/spec-parser/template-registry.js';

// ── Declarations ─────────────────────────────────────────────────────────────

export type Family = 'depcruise' | 'boundaries' | 'nx';

type OneOrMany<T> = T | readonly T[];

export interface DcSide {
  readonly path?: OneOrMany<string>;
  readonly pathNot?: OneOrMany<string>;
  readonly [key: string]: unknown;
}

export interface DcRule {
  readonly name?: string;
  readonly severity?: string;
  readonly comment?: string;
  readonly from?: DcSide;
  readonly to?: DcSide;
  readonly module?: unknown;
}

export interface DepcruiseDecl {
  readonly family: 'depcruise';
  readonly forbidden?: readonly DcRule[];
  readonly allowed?: readonly DcRule[];
  readonly allowedSeverity?: string;
  /** `options.tsPreCompilationDeps` (type-only imports are invisible to the tool when false). */
  readonly tsPreCompilationDeps?: boolean | string;
}

export interface BoundariesElement {
  readonly type: string;
  readonly pattern: OneOrMany<string>;
  readonly mode?: 'folder' | 'file' | 'full';
  readonly capture?: readonly string[];
  readonly basePattern?: string;
  readonly baseCapture?: readonly string[];
}

export type BoundariesMatcher = string | readonly [string, Readonly<Record<string, string>>];

export interface BoundariesRule {
  readonly from?: OneOrMany<BoundariesMatcher>;
  readonly target?: OneOrMany<BoundariesMatcher>;
  readonly allow?: OneOrMany<BoundariesMatcher>;
  readonly disallow?: OneOrMany<BoundariesMatcher>;
  readonly importKind?: OneOrMany<string>;
  readonly message?: string;
}

export interface BoundariesDecl {
  readonly family: 'boundaries';
  readonly elements: readonly BoundariesElement[];
  readonly options: { readonly default?: 'allow' | 'disallow'; readonly rules?: readonly BoundariesRule[]; readonly message?: string };
  readonly include?: OneOrMany<string>;
  readonly ignore?: OneOrMany<string>;
  readonly dependencyNodes?: readonly string[];
  /** Linted files the team's configuration does not run the rule on (overrides); source-side excludes (D6). */
  readonly disabledFiles?: readonly string[];
}

export interface NxProject {
  readonly name: string;
  /** Workspace-relative root, '' or '.' for a root project. */
  readonly root: string;
  readonly tags: readonly string[];
  readonly type?: string;
}

export interface NxConstraint {
  readonly sourceTag?: string;
  readonly allSourceTags?: readonly string[];
  readonly onlyDependOnLibsWithTags?: readonly string[];
  readonly notDependOnLibsWithTags?: readonly string[];
  readonly onlyTagsAllowed?: readonly string[];
  readonly bannedExternalImports?: readonly string[];
  readonly allowedExternalImports?: readonly string[];
}

export interface NxDecl {
  readonly family: 'nx';
  readonly projects: readonly NxProject[];
  readonly depConstraints: readonly NxConstraint[];
  readonly allow?: readonly string[];
  readonly options?: Readonly<Record<string, unknown>>;
  /** Linted files the team's configuration does not run the rule on (per-project overrides); source-side excludes (D6). */
  readonly disabledFiles?: readonly string[];
}

export type Declaration = DepcruiseDecl | BoundariesDecl | NxDecl;

// ── Translation result ───────────────────────────────────────────────────────

export type CoverageStatus = 'translated' | 'partial' | 'not-expressible' | 'inactive';

export interface RuleCoverage {
  readonly rule: string;
  readonly status: CoverageStatus;
  /** What was kept, and what is lost when partial or not expressible. */
  readonly detail: string;
}

export interface Atom {
  readonly id: string;
  readonly label: string;
  readonly files: readonly string[];
}

export interface Translation {
  readonly family: Family;
  readonly atoms: readonly Atom[];
  /** In-scope file → atom id, null when no rule can see the file. */
  readonly layerOf: ReadonlyMap<string, string | null>;
  /** `from>to` pairs between different atoms an import may follow. */
  readonly allowed: readonly string[];
  /** Pairs between different atoms the declared rules forbid, with the rules that forbid them. */
  readonly forbidden: readonly { readonly from: string; readonly to: string; readonly rules: readonly string[] }[];
  /** D3: atoms inside which the rules forbid an import between two different files (not expressible). */
  readonly intraAtomForbidden: readonly { readonly atom: string; readonly rules: readonly string[] }[];
  /** D6: in-scope files the team's tool does not check as importers (rule off for them); `exclude_paths` in the spec. */
  readonly excludedSources: readonly string[];
  readonly coverage: readonly RuleCoverage[];
}

/** The predicate the translation is evaluated on: may a file of atom-signature `a` import one of signature `b`? */
interface Semantics {
  readonly signature: (file: string) => string | null;
  /** Names of the rules forbidding `src → tgt` (both in scope, both with a signature); empty when allowed. */
  readonly forbids: (src: string, tgt: string) => readonly string[];
  /** Whether two different files with one signature are exempt from every rule (same element instance, project). */
  readonly sameUnitExempt?: (a: string, b: string) => boolean;
  readonly label: (file: string) => string;
  readonly coverage: readonly RuleCoverage[];
}

const arr = <T>(v: OneOrMany<T> | undefined): readonly T[] => (v === undefined ? [] : Array.isArray(v) ? (v as readonly T[]) : [v as T]);
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// ── dependency-cruiser ───────────────────────────────────────────────────────

/** `from`/`to` keys that only restrict paths; every other key is a condition the spec cannot hold. */
const DC_PATH_KEYS = new Set(['path', 'pathNot']);
/** Keys whose presence makes a rule a non-path rule (cycles, orphans, packages, metrics ...). */
const DC_NON_PATH: Readonly<Record<string, string>> = Object.freeze({
  circular: 'cycle detection (FF-S02 no-cyclic-deps exists but is not part of this translation)',
  orphan: 'orphan detection (FF-C04 exists but is not part of this translation)',
  reachable: 'reachability from entry points',
  couldNotResolve: 'unresolvable imports (not an edge between files)',
  dependencyTypes: 'dependency-type condition (npm, core, dev/peer/optional dependencies)',
  moreThanOneDependencyType: 'package.json duplication',
  license: 'package licence', licenseNot: 'package licence',
  via: 'cycle path condition', viaOnly: 'cycle path condition', viaNot: 'cycle path condition', viaSomeNot: 'cycle path condition',
  exoticallyRequired: 'exotic require', exoticRequire: 'exotic require', exoticRequireNot: 'exotic require',
  preCompilationOnly: 'pre-compilation-only (type) condition',
  numberOfDependentsLessThan: 'fan-in metric', numberOfDependentsMoreThan: 'fan-in metric',
  moreUnstable: 'instability metric', isDeprecated: 'deprecation', mostlyMatching: 'path group condition',
  dependencyTypesNot: 'dependency-type exemption',
  isAbsolute: 'absolute-path condition', isDynamic: 'dynamic-import condition', isTypeOnly: 'type-only condition',
});

/** Dependency-type exemptions that only remove edges the spec cannot see either way (packages, core modules). */
const DC_HARMLESS_TYPES_NOT = new Set(['npm', 'npm-dev', 'npm-peer', 'npm-optional', 'npm-bundled', 'npm-no-pkg', 'npm-unknown', 'core', 'deprecated']);

function dcRe(source: string): RegExp {
  return new RegExp(source);
}

interface DcCompiled {
  readonly name: string;
  readonly fromPath: readonly RegExp[];
  readonly fromPathNot: readonly RegExp[];
  readonly toPath: readonly string[];
  readonly toPathNot: readonly string[];
}

/** A dependency-cruiser side matches when one `path` regex matches (or none is given) and no `pathNot` regex does. */
function dcSideMatch(path: readonly RegExp[], pathNot: readonly RegExp[], file: string): boolean {
  return (path.length === 0 || path.some((r) => r.test(file))) && !pathNot.some((r) => r.test(file));
}

/** The capture groups of the first matching `from.path` regex (dependency-cruiser's `$1` source), or []. */
function dcGroups(rule: DcCompiled, file: string): readonly string[] {
  for (const r of rule.fromPath) {
    const m = r.exec(file);
    if (m !== null) return m.slice(1).map((g: string | undefined) => g ?? '');
  }
  return [];
}

/** `$n` group substitution in a `to` regex (dependency-cruiser's group matching), escaping the captured text. */
export function substituteGroups(source: string, groups: readonly string[]): string {
  return source.replace(/\$(\d)/g, (_, d: string) => (groups[Number(d) - 1] ?? '').replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
}

function dcToMatch(rule: DcCompiled, groups: readonly string[], file: string): boolean {
  const path = rule.toPath.map((s) => dcRe(substituteGroups(s, groups)));
  const pathNot = rule.toPathNot.map((s) => dcRe(substituteGroups(s, groups)));
  return dcSideMatch(path, pathNot, file);
}

/** Classify one dependency-cruiser rule: compiled when its path part can be translated, with its coverage line. */
export function classifyDcRule(rule: DcRule, kind: 'forbidden' | 'allowed', allowedSeverity?: string): { compiled?: DcCompiled; coverage: RuleCoverage } {
  const name = `${kind}:${rule.name ?? '(unnamed)'}`;
  const severity = kind === 'allowed' ? allowedSeverity ?? 'warn' : rule.severity ?? 'warn';
  if (severity === 'ignore' || severity === 'off') return { coverage: { rule: name, status: 'inactive', detail: `severity ${severity}` } };
  if (rule.module !== undefined) return { coverage: { rule: name, status: 'not-expressible', detail: 'module-level rule (no dependency edge)' } };
  const from = rule.from ?? {};
  const to = rule.to ?? {};
  const lost: string[] = [];
  for (const [side, obj] of [['from', from], ['to', to]] as const) {
    for (const key of Object.keys(obj)) {
      if (DC_PATH_KEYS.has(key)) continue;
      if (side === 'to' && key === 'dependencyTypesNot' && arr(obj[key] as OneOrMany<string>).every((t) => DC_HARMLESS_TYPES_NOT.has(t))) continue;
      if (side === 'to' && key === 'dependencyTypes' && arr(obj[key] as OneOrMany<string>).every((t) => t === 'local' || t.startsWith('aliased'))) {
        lost.push('`dependencyTypes: local/aliased` kept as "in-repo files only"');
        continue;
      }
      const why = DC_NON_PATH[key] ?? `\`${side}.${key}\` condition`;
      // A condition on the `to` side that selects packages or a graph property: the rule is not about file edges.
      return { coverage: { rule: name, status: 'not-expressible', detail: `${side}.${key}: ${why}` } };
    }
  }
  if (to.path === undefined && to.pathNot === undefined && kind === 'forbidden') {
    return { coverage: { rule: name, status: 'not-expressible', detail: 'no `to` condition (every dependency, including packages)' } };
  }
  let compiled: DcCompiled;
  try {
    compiled = {
      name: rule.name ?? '(unnamed)',
      fromPath: arr(from.path).map(dcRe), fromPathNot: arr(from.pathNot).map(dcRe),
      toPath: [...arr(to.path)], toPathNot: [...arr(to.pathNot)],
    };
    for (const s of [...compiled.toPath, ...compiled.toPathNot]) dcRe(substituteGroups(s, []));
  } catch (e) {
    return { coverage: { rule: name, status: 'not-expressible', detail: `regex not supported by JavaScript: ${(e as Error).message}` } };
  }
  if (to.path === undefined && kind === 'forbidden') lost.push('targets outside the repository (packages, core modules) that the `to.pathNot` also catches are not expressible: DaedalusArch layers hold files only');
  if (kind === 'allowed') lost.push('package and core-module targets outside every `allowed` rule are not expressible');
  const groups = [...compiled.toPath, ...compiled.toPathNot].some((s) => /\$\d/.test(s));
  const detail = [`file-to-file path rule${groups ? ' with group matching ($n), expanded per captured value' : ''}`, ...lost].join('; ');
  return { compiled, coverage: { rule: name, status: lost.some((l) => l.startsWith('targets') || l.startsWith('package')) ? 'partial' : 'translated', detail } };
}

export function depcruiseSemantics(decl: DepcruiseDecl, files: readonly string[]): Semantics {
  const coverage: RuleCoverage[] = [];
  const forb: DcCompiled[] = [];
  const allow: DcCompiled[] = [];
  for (const r of decl.forbidden ?? []) {
    const c = classifyDcRule(r, 'forbidden');
    coverage.push(c.coverage);
    if (c.compiled) forb.push(c.compiled);
  }
  const allowedActive = (decl.allowed ?? []).length > 0 && decl.allowedSeverity !== 'ignore';
  let allowedUsable = allowedActive;
  for (const r of decl.allowed ?? []) {
    const c = classifyDcRule(r, 'allowed', decl.allowedSeverity);
    coverage.push(c.coverage);
    if (c.compiled) allow.push(c.compiled);
    // An `allowed` rule that cannot be translated would make the whitelist stricter than declared: drop the whitelist.
    else if (c.coverage.status === 'not-expressible') allowedUsable = false;
  }
  if (allowedActive && !allowedUsable) {
    coverage.push({ rule: 'allowed (not-in-allowed)', status: 'not-expressible', detail: 'an `allowed` rule has a non-path condition; the whitelist is not translated' });
  }
  const rules = [...forb, ...(allowedUsable ? allow : [])];
  // Every capture value seen on a `from` side, per rule, for the `to` signature bits.
  const capturesByRule = rules.map((r) => {
    const seen = new Set<string>();
    for (const f of files) if (dcSideMatch(r.fromPath, r.fromPathNot, f)) seen.add(JSON.stringify(dcGroups(r, f)));
    return [...seen].sort(cmp).map((s) => JSON.parse(s) as string[]);
  });
  const usesGroups = rules.map((r) => [...r.toPath, ...r.toPathNot].some((s) => /\$\d/.test(s)));
  const signature = (f: string): string => rules.map((r, i) => {
    const fm = dcSideMatch(r.fromPath, r.fromPathNot, f);
    const g = fm && usesGroups[i] ? JSON.stringify(dcGroups(r, f)) : '';
    const caps = usesGroups[i] ? capturesByRule[i] ?? [] : [[]];
    const tm = caps.map((c) => (dcToMatch(r, c, f) ? '1' : '0')).join('');
    return `${fm ? 'F' : 'f'}${g}${tm}`;
  }).join('|');
  const forbids = (s: string, t: string): string[] => {
    const out: string[] = [];
    for (const r of forb) if (dcSideMatch(r.fromPath, r.fromPathNot, s) && dcToMatch(r, dcGroups(r, s), t)) out.push(r.name);
    if (allowedUsable && allow.length > 0) {
      const ok = allow.some((r) => dcSideMatch(r.fromPath, r.fromPathNot, s) && dcToMatch(r, dcGroups(r, s), t));
      if (!ok) out.push('not-in-allowed');
    }
    return out;
  };
  return { signature, forbids, label: (f) => commonDir([f]), coverage };
}

// ── eslint-plugin-boundaries ─────────────────────────────────────────────────

export interface ElementInfo {
  readonly type: string;
  readonly elementPath: string;
  readonly capturedValues: Readonly<Record<string, string>>;
}

/** micromatch.capture: the capture groups of a glob, or null. */
function capture(pattern: string, input: string): string[] | null {
  const m = picomatch.makeRe(pattern, { capture: true }).exec(input);
  return m === null ? null : m.slice(1).map((v: string | undefined) => v ?? '');
}

function isMatch(input: string, patterns: OneOrMany<string>): boolean {
  const list = arr(patterns);
  return list.length > 0 && picomatch([...list])(input);
}

function captureValues(groups: readonly string[], names: readonly string[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (names === undefined) return out;
  groups.forEach((g, i) => { const n = names[i]; if (n !== undefined && n !== '') out[n] = g; });
  return out;
}

/**
 * The element of a project-relative path, as eslint-plugin-boundaries 4.x/5.x `elementTypeAndParents` assigns it:
 * walk the path from its last segment up, and at each accumulated suffix try every element in settings order; the
 * first match wins. `folder` mode (default) matches `<pattern>/**\/*` against the suffix, `file` mode the pattern,
 * `full` mode the whole path. Parent elements are not computed (no rule here reads them).
 */
export function boundariesElement(path: string, decl: BoundariesDecl): ElementInfo | null {
  if (boundariesIgnored(path, decl)) return null;
  const segments = path.split('/');
  const acc: string[] = [];
  for (let i = segments.length - 1; i >= 0; i--) {
    acc.unshift(segments[i] ?? '');
    for (const el of decl.elements) {
      const mode = el.mode ?? 'folder';
      for (const pat of arr(el.pattern)) {
        const pattern = mode === 'folder' ? `${pat}/**/*` : pat;
        const subject = mode === 'full' ? path : acc.join('/');
        const cap = capture(pattern, subject);
        if (cap === null) continue;
        let values = captureValues(cap, el.capture);
        if (el.basePattern !== undefined) {
          const base = capture([el.basePattern, '**', pattern].join('/'), segments.slice(0, i).concat(acc).join('/'));
          if (base === null) continue;
          values = { ...captureValues(base, el.baseCapture), ...values };
        }
        // The element path: the shortest prefix of the suffix that the bare pattern matches (getElementPath).
        let elementPath = path;
        if (mode !== 'full') {
          const re = picomatch.makeRe(pat);
          const tested: string[] = [];
          let hit: string | undefined;
          for (const seg of acc) {
            tested.push(seg);
            if (re.test(tested.join('/'))) { hit = tested.join('/'); break; }
          }
          if (hit !== undefined) elementPath = segments.slice(0, i).concat([hit]).join('/');
        }
        return { type: el.type, elementPath, capturedValues: values };
      }
    }
  }
  return null;
}

export function boundariesIgnored(path: string, decl: BoundariesDecl): boolean {
  const include = arr(decl.include);
  if (include.length > 0 && !isMatch(path, include)) return true;
  return isMatch(path, arr(decl.ignore));
}

/** `${name}`, `${from.name}` and `${target.name}` templates (replaceObjectValuesInTemplates). */
function replaceTemplates(pattern: string, from: Readonly<Record<string, string>>, target: Readonly<Record<string, string>>): string {
  let out = pattern;
  for (const [k, v] of Object.entries(from)) out = out.split(`\${${k}}`).join(v).split(`\${from.${k}}`).join(v);
  for (const [k, v] of Object.entries(target)) out = out.split(`\${target.${k}}`).join(v);
  return out;
}

function matcherMatches(m: BoundariesMatcher, el: ElementInfo, from: ElementInfo, target: ElementInfo): boolean {
  const [value, captures] = typeof m === 'string' ? [m, {}] : [m[0], m[1]];
  if (!picomatch(replaceTemplates(value, from.capturedValues, target.capturedValues))(el.type)) return false;
  return Object.entries(captures).every(([k, pat]) => {
    const v = el.capturedValues[k];
    return v !== undefined && picomatch(replaceTemplates(pat, from.capturedValues, target.capturedValues))(v);
  });
}

function anyMatcher(ms: OneOrMany<BoundariesMatcher> | undefined, el: ElementInfo, from: ElementInfo, target: ElementInfo): boolean {
  if (ms === undefined) return false;
  // A tuple [type, captures] is one matcher; an array of strings/tuples is several.
  const list: readonly BoundariesMatcher[] = typeof ms === 'string' ? [ms]
    : ms.length === 2 && typeof ms[0] === 'string' && typeof ms[1] === 'object' && !Array.isArray(ms[1]) ? [ms as BoundariesMatcher]
      : (ms as readonly BoundariesMatcher[]);
  return list.some((m) => matcherMatches(m, el, from, target));
}

/** `element-types`: start from the default, every rule whose `from` matches overrides it in order (last match wins). */
export function boundariesAllows(decl: BoundariesDecl, from: ElementInfo, target: ElementInfo): { allowed: boolean; rule: string } {
  let allowed = (decl.options.default ?? 'allow') === 'allow';
  let rule = `default:${decl.options.default ?? 'allow'}`;
  (decl.options.rules ?? []).forEach((r, i) => {
    if (!anyMatcher(r.from, from, from, from)) return;
    if (r.disallow !== undefined && anyMatcher(r.disallow, target, from, target)) { allowed = false; rule = `rule#${String(i + 1)}:disallow`; return; }
    if (r.allow !== undefined && anyMatcher(r.allow, target, from, target)) { allowed = true; rule = `rule#${String(i + 1)}:allow`; }
  });
  return { allowed, rule };
}

export function boundariesSemantics(decl: BoundariesDecl, files: readonly string[]): Semantics {
  const coverage: RuleCoverage[] = [];
  const nodes = decl.dependencyNodes ?? ['import'];
  coverage.push({
    rule: 'boundaries/element-types (default)', status: 'translated',
    detail: `default ${decl.options.default ?? 'allow'}; element types by first-matching element (settings order, nearest folder first)${nodes.join(',') === 'import' ? '' : `; dependency nodes ${nodes.join(', ')}`}`,
  });
  (decl.options.rules ?? []).forEach((r, i) => {
    const name = `boundaries/element-types rule#${String(i + 1)}`;
    if (r.target !== undefined) { coverage.push({ rule: name, status: 'not-expressible', detail: '`target`-keyed rule (not implemented by this translator)' }); return; }
    if (r.importKind !== undefined && arr(r.importKind).some((k) => k !== 'value' && k !== '*')) {
      coverage.push({ rule: name, status: 'partial', detail: `importKind ${arr(r.importKind).join(',')}: DaedalusArch layers cannot condition on the import kind; applied to every import` });
      return;
    }
    coverage.push({ rule: name, status: 'translated', detail: `${r.allow !== undefined ? 'allow' : ''}${r.disallow !== undefined ? ' disallow' : ''} between element types${JSON.stringify(r).includes('${') ? ', capture templates expanded per captured value' : ''}` });
  });
  const info = new Map<string, ElementInfo | null>(files.map((f) => [f, boundariesElement(f, decl)]));
  const key = (e: ElementInfo): string => `${e.type}${JSON.stringify(e.capturedValues)}`;
  // D1: instances of one type+captures stay one atom unless two such instances may not import each other.
  const selfForbidden = new Map<string, boolean>();
  for (const e of info.values()) {
    if (e === null || selfForbidden.has(key(e))) continue;
    selfForbidden.set(key(e), !boundariesAllows(decl, e, e).allowed);
  }
  const signature = (f: string): string | null => {
    const e = info.get(f) ?? boundariesElement(f, decl);
    if (e === null) return null;
    return selfForbidden.get(key(e)) === true ? `${key(e)}@${e.elementPath}` : key(e);
  };
  const forbids = (s: string, t: string): string[] => {
    const a = info.get(s) ?? boundariesElement(s, decl);
    const b = info.get(t) ?? boundariesElement(t, decl);
    if (a === null || b === null || a.elementPath === b.elementPath) return [];
    const r = boundariesAllows(decl, a, b);
    return r.allowed ? [] : [r.rule];
  };
  const sameUnitExempt = (x: string, y: string): boolean => info.get(x)?.elementPath === info.get(y)?.elementPath;
  return { signature, forbids, sameUnitExempt, label: (f) => { const e = info.get(f); return e ? `${e.type}${Object.values(e.capturedValues).map((v) => `-${v}`).join('')}` : 'unknown'; }, coverage };
}

// ── Nx enforce-module-boundaries ─────────────────────────────────────────────

/** Nx tag pattern: `*`, a `/regex/`, a glob with `*`, or an exact tag. */
export function nxTagMatches(pattern: string, tag: string): boolean {
  if (pattern === '*') return true;
  if (pattern.length > 2 && pattern.startsWith('/') && pattern.endsWith('/')) return new RegExp(pattern.slice(1, -1)).test(tag);
  if (pattern.includes('*')) return new RegExp(`^${pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('.*')}$`).test(tag);
  return pattern === tag;
}

const hasAnyTag = (patterns: readonly string[], tags: readonly string[]): boolean => patterns.some((p) => p === '*' || tags.some((t) => nxTagMatches(p, t)));

export function nxConstraintsFor(constraints: readonly NxConstraint[], project: NxProject): NxConstraint[] {
  return constraints.filter((c) => (c.allSourceTags !== undefined
    ? c.allSourceTags.every((t) => project.tags.some((pt) => nxTagMatches(t, pt)))
    : c.sourceTag === '*' || project.tags.some((t) => nxTagMatches(c.sourceTag ?? '', t))));
}

/** Why `source → target` breaks the declared constraints (direct checks only), or [] when it does not. */
export function nxViolations(decl: NxDecl, source: NxProject, target: NxProject): string[] {
  if (source.name === target.name || decl.depConstraints.length === 0) return [];
  const cs = nxConstraintsFor(decl.depConstraints, source);
  if (cs.length === 0) return ['no-constraint-for-source (a project without matching tags may depend on no project)'];
  const out: string[] = [];
  for (const c of cs) {
    const id = c.sourceTag ?? (c.allSourceTags ?? []).join('+');
    if (c.onlyDependOnLibsWithTags !== undefined && c.onlyDependOnLibsWithTags.length > 0 && !hasAnyTag(c.onlyDependOnLibsWithTags, target.tags)) out.push(`${id}:onlyDependOnLibsWithTags`);
    if (c.notDependOnLibsWithTags !== undefined && hasAnyTag(c.notDependOnLibsWithTags, target.tags)) out.push(`${id}:notDependOnLibsWithTags`);
  }
  return out;
}

export function nxProjectOf(file: string, projects: readonly NxProject[]): NxProject | null {
  let best: NxProject | null = null;
  let bestLen = -1;
  for (const p of projects) {
    const root = p.root === '.' ? '' : p.root.replace(/\/$/, '');
    if (root === '' || file === root || file.startsWith(`${root}/`)) {
      if (root.length > bestLen) { best = p; bestLen = root.length; }
    }
  }
  return best;
}

export function nxSemantics(decl: NxDecl, _files: readonly string[]): Semantics {
  const coverage: RuleCoverage[] = [];
  decl.depConstraints.forEach((c) => {
    const id = `depConstraint ${c.sourceTag ?? `[${(c.allSourceTags ?? []).join(', ')}]`}`;
    const lost: string[] = [];
    if (c.notDependOnLibsWithTags !== undefined) lost.push('notDependOnLibsWithTags is also checked on transitive dependencies by Nx; only the direct edge is expressible');
    if (c.bannedExternalImports !== undefined || c.allowedExternalImports !== undefined) lost.push('external (package) import bans are not expressible as layer edges');
    if (c.onlyTagsAllowed !== undefined) lost.push('onlyTagsAllowed constrains project tags, not edges');
    const edgePart = c.onlyDependOnLibsWithTags !== undefined || c.notDependOnLibsWithTags !== undefined;
    coverage.push({ rule: id, status: !edgePart ? 'not-expressible' : lost.length > 0 ? 'partial' : 'translated', detail: [edgePart ? 'project-to-project tag constraint' : 'no edge constraint', ...lost].join('; ') });
  });
  coverage.push({ rule: 'nx: project without matching constraint', status: 'translated', detail: 'a project no constraint applies to may depend on no other project (Nx `projectWithoutTagsCannotHaveDependencies`)' });
  if ((decl.allow ?? []).length > 0) coverage.push({ rule: 'nx: allow', status: 'partial', detail: `\`allow\` import exemptions (${(decl.allow ?? []).join(', ')}) are import-specifier based; not expressible` });
  for (const [k, v] of Object.entries(decl.options ?? {})) {
    if (k === 'depConstraints' || k === 'allow') continue;
    if (v === true || (Array.isArray(v) && v.length > 0)) coverage.push({ rule: `nx: ${k}`, status: 'not-expressible', detail: 'check outside the tag constraints (not compared)' });
  }
  for (const c of ['noImportsOfApps', 'noDeepImportsIntoLibs', 'noRelativeOrAbsoluteImportsAcrossLibraries', 'noCircularProjectDependencies', 'noLazyLoadedImports']) {
    coverage.push({ rule: `nx: built-in ${c}`, status: 'not-expressible', detail: 'built-in check of the Nx rule, not a declared constraint (not compared)' });
  }
  const proj = (f: string): NxProject | null => nxProjectOf(f, decl.projects);
  return {
    signature: (f) => proj(f)?.name ?? null,
    forbids: (s, t) => { const a = proj(s); const b = proj(t); return a === null || b === null ? [] : nxViolations(decl, a, b); },
    label: (f) => proj(f)?.name ?? 'none',
    coverage,
  };
}

// ── Generic atomisation (D1–D3) ──────────────────────────────────────────────

export function semanticsOf(decl: Declaration, files: readonly string[]): Semantics {
  switch (decl.family) {
    case 'depcruise': return depcruiseSemantics(decl, files);
    case 'boundaries': return boundariesSemantics(decl, files);
    case 'nx': return nxSemantics(decl, files);
  }
}

/** The longest common directory of some paths ('' for the root). */
export function commonDir(paths: readonly string[]): string {
  if (paths.length === 0) return '';
  const split = paths.map((p) => p.split('/').slice(0, -1));
  const first = split[0] ?? [];
  let n = first.length;
  for (const s of split) { let i = 0; while (i < n && s[i] === first[i]) i++; n = i; }
  return first.slice(0, n).join('/');
}

function slug(s: string): string {
  return s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'root';
}

export function translate(decl: Declaration, files: readonly string[]): Translation {
  const sorted = [...new Set(files)].sort(cmp);
  const sem = semanticsOf(decl, sorted);
  const groups = new Map<string, string[]>();
  for (const f of sorted) {
    const s = sem.signature(f);
    if (s === null) continue;
    const g = groups.get(s);
    if (g === undefined) groups.set(s, [f]); else g.push(f);
  }
  // Atom ids: deterministic, by first file.
  const ordered = [...groups.entries()].sort((a, b) => cmp(a[1][0] ?? '', b[1][0] ?? ''));
  const atoms: Atom[] = [];
  const idOfSig = new Map<string, string>();
  ordered.forEach(([sig, fs], i) => {
    const label = decl.family === 'depcruise' ? commonDir(fs) || '.' : sem.label(fs[0] ?? '');
    const id = `L${String(i + 1).padStart(3, '0')}-${slug(label)}`;
    idOfSig.set(sig, id);
    atoms.push({ id, label, files: fs });
  });
  const layerOf = new Map<string, string | null>();
  for (const f of sorted) { const s = sem.signature(f); layerOf.set(f, s === null ? null : idOfSig.get(s) ?? null); }
  const allowed: string[] = [];
  const forbidden: { from: string; to: string; rules: string[] }[] = [];
  const intra: { atom: string; rules: string[] }[] = [];
  for (const a of atoms) {
    const ra = a.files[0] ?? '';
    for (const b of atoms) {
      if (a.id === b.id) {
        // D3: two different files of one atom, not exempt as one unit.
        const other = a.files.find((f) => f !== ra && !(sem.sameUnitExempt?.(ra, f) ?? false));
        if (other !== undefined) { const r = sem.forbids(ra, other); if (r.length > 0) intra.push({ atom: a.id, rules: [...r] }); }
        continue;
      }
      const r = sem.forbids(ra, b.files[0] ?? '');
      if (r.length === 0) allowed.push(`${a.id}>${b.id}`); else forbidden.push({ from: a.id, to: b.id, rules: [...r] });
    }
  }
  const coverage = [...sem.coverage];
  const disabled = new Set(decl.family === 'depcruise' ? [] : decl.disabledFiles ?? []);
  const excludedSources = sorted.filter((f) => disabled.has(f));
  if (disabled.size > 0) {
    coverage.push({ rule: 'per-file rule off (D6)', status: 'translated', detail: `${String(disabled.size)} linted file(s) the team's overrides exclude from the rule become exclude_paths of FF-S01/FF-S03` });
  }
  if (intra.length > 0) {
    coverage.push({ rule: 'same-atom prohibitions (D3)', status: 'not-expressible', detail: `${String(intra.length)} atom(s) inside which the rules forbid imports between different files: ${[...new Set(intra.flatMap((x) => x.rules))].sort(cmp).join(', ')}` });
  }
  return { family: decl.family, atoms, layerOf, allowed, forbidden, intraAtomForbidden: intra, excludedSources, coverage };
}

// ── Spec emission (D4, D5) ───────────────────────────────────────────────────

/** Escape picomatch's special characters so a literal path is a glob that matches only itself. */
export function escapeGlob(path: string): string {
  return path.replace(/[\\*?[\]{}()!+@]/g, '\\$&');
}

/** D4: per atom, the directory globs owned by it alone and the remaining literal file patterns. */
export function compactLayers(layerOf: ReadonlyMap<string, string | null>): Map<string, { directories: string[]; filePatterns: string[] }> {
  const out = new Map<string, { directories: string[]; filePatterns: string[] }>();
  const get = (id: string): { directories: string[]; filePatterns: string[] } => {
    let v = out.get(id);
    if (v === undefined) { v = { directories: [], filePatterns: [] }; out.set(id, v); }
    return v;
  };
  const owners = new Map<string, Set<string | null>>();
  for (const [f, l] of layerOf) {
    const parts = f.split('/');
    for (let i = 0; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/');
      let s = owners.get(dir);
      if (s === undefined) { s = new Set(); owners.set(dir, s); }
      s.add(l);
    }
  }
  const visit = (dir: string): void => {
    const s = owners.get(dir);
    if (s === undefined) return;
    const only = s.size === 1 ? [...s][0] : undefined;
    if (only !== undefined && only !== null) { get(only).directories.push(dir === '' ? '**' : `${escapeGlob(dir)}/**`); return; }
    if (only === null) return;
    const prefix = dir === '' ? '' : `${dir}/`;
    const children = new Set<string>();
    for (const f of layerOf.keys()) {
      if (!f.startsWith(prefix)) continue;
      const rest = f.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash < 0) { const l = layerOf.get(f); if (l !== null && l !== undefined) get(l).filePatterns.push(escapeGlob(f)); } else children.add(prefix + rest.slice(0, slash));
    }
    for (const c of [...children].sort(cmp)) visit(c);
  };
  visit('');
  return out;
}

/** D6: exclude globs covering exactly `excluded` among `all` (whole directories where possible, else literal paths). */
export function compactExcludes(excluded: readonly string[], all: readonly string[]): string[] {
  const ex = new Set(excluded);
  const m = new Map<string, string | null>();
  for (const f of new Set([...all, ...excluded])) m.set(f, ex.has(f) ? 'x' : 'k');
  const c = compactLayers(m).get('x');
  return c === undefined ? [] : [...c.directories, ...c.filePatterns];
}

export const PLACEHOLDER_KINDS = ['domain', 'application', 'presentation', 'infrastructure'] as const;
export const PLACEHOLDER_PREFIX = 'zz-placeholder-';

export interface SpecMeta {
  readonly repo: string;
  readonly sha: string;
  readonly configPath: string;
  readonly toolVersion?: string;
}

export const ENABLED_FUNCTIONS: readonly string[] = ['FF-S01', 'FF-S03'];

/** The hexagonal library with FF-S01 and FF-S03 enabled and every other function disabled (with the reason). */
function specFunctions(excludePaths: readonly string[] = []): Record<string, unknown>[] {
  const lib = resolveTemplate('hexagonal');
  if (lib === undefined) throw new Error('hexagonal library not registered');
  return lib.functions.map((f) => ({
    id: String(f.id), name: f.name, dimension: f.dimension, severity: f.severity, route: f.route, validated: false,
    ...(ENABLED_FUNCTIONS.includes(String(f.id)) ? (excludePaths.length > 0 ? { exclude_paths: [...excludePaths] } : {}) : { enabled: false, reason: 'declared-rules translation: only the allowed-dependency graph (FF-S01, FF-S03) carries the team\'s rules' }),
  }));
}

/** The DaedalusArch spec (YAML text) of a translation. */
export function toSpecYaml(t: Translation, meta: SpecMeta): string {
  const compact = compactLayers(t.layerOf);
  const layers: Record<string, unknown>[] = t.atoms.map((a) => {
    const c = compact.get(a.id) ?? { directories: [], filePatterns: [] };
    return {
      name: a.id, kind: 'application',
      directories: c.directories.length > 0 ? c.directories : [`${PLACEHOLDER_PREFIX}none/${a.id}/**`],
      ...(c.filePatterns.length > 0 ? { file_patterns: c.filePatterns } : {}),
      roles: ['declared-atom'],
    };
  });
  for (const k of PLACEHOLDER_KINDS) layers.push({ name: `${PLACEHOLDER_PREFIX}${k}`, kind: k, directories: [`${PLACEHOLDER_PREFIX}${k}/**`], roles: ['placeholder'] });
  const byFrom = new Map<string, string[]>();
  for (const e of t.allowed) { const [f, to] = e.split('>') as [string, string]; byFrom.set(f, [...(byFrom.get(f) ?? []), to]); }
  const allowedDeps = [...byFrom.entries()].map(([from, to]) => ({ from, to }));
  allowedDeps.push({ from: `${PLACEHOLDER_PREFIX}application`, to: [`${PLACEHOLDER_PREFIX}domain`] });
  const doc = {
    spec_version: '1.0.0',
    architecture: { style: 'hexagonal', layers, allowed_dependencies: allowedDeps },
    fitness_functions: specFunctions(compactExcludes(t.excludedSources, [...t.layerOf.keys()])),
    // The hexagonal preset's scoring block, verbatim; scoring is not part of this comparison.
    scoring: {
      weights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05 },
      thresholds: { pass: 0.8, warning: 0.65, soft_block: 0.5 },
    },
    confidence_thresholds: { high: 0.85, medium: 0.6, icc_minimum: 0.7 },
  };
  const header = [
    `# Translated by scripts/v1.3/declared-to-aac.ts from the team's own declaration (${t.family}).`,
    `# Source: ${meta.repo}@${meta.sha} ${meta.configPath}${meta.toolVersion ? ` (${meta.toolVersion})` : ''}.`,
    '# Layers are the atoms of the declared rules (D1), allowed_dependencies the atom pairs no rule forbids (D2).',
    `# The ${PLACEHOLDER_PREFIX}* layers are empty and exist only so the hexagonal binding resolves (D5).`,
    '',
  ].join('\n');
  return header + stringify(doc, { lineWidth: 0 });
}

// ── In-memory evaluation (the FF-S01 / FF-S03 Cypher, over the literal edge view) ──

export interface FileEdge {
  readonly source: string;
  readonly target: string;
}

export interface SpecViolation extends FileEdge {
  readonly functionId: 'FF-S01' | 'FF-S03';
  readonly srcLayer: string;
  readonly tgtLayer: string;
}

/**
 * The rows `dependency-direction-graph` (FF-S01) and `layer-skip-graph` (FF-S03) return on a graph whose File nodes
 * carry `layer`: an edge between two different non-null layers not in `allowed`; FF-S01 when the reverse edge is
 * allowed, FF-S03 otherwise. `excludePatterns` are the compiled `$excludePatterns` (globToRegex of exclude_paths),
 * applied to the importing file as `/*EXCLUDE:src*\/` does.
 */
export function evaluateGraphRules(
  edges: readonly FileEdge[], layerOf: (file: string) => string | null, allowed: ReadonlySet<string>, excludePatterns: readonly string[] = [],
): SpecViolation[] {
  const out: SpecViolation[] = [];
  // Cypher `=~` matches the whole string.
  const excludes = excludePatterns.map((p) => new RegExp(`^(?:${p})$`));
  for (const e of edges) {
    if (excludes.some((r) => r.test(e.source))) continue;
    const s = layerOf(e.source);
    const t = layerOf(e.target);
    if (s === null || t === null || s === t || allowed.has(`${s}>${t}`)) continue;
    out.push({ ...e, functionId: allowed.has(`${t}>${s}`) ? 'FF-S01' : 'FF-S03', srcLayer: s, tgtLayer: t });
  }
  return out.sort((a, b) => cmp(a.source, b.source) || cmp(a.target, b.target));
}
