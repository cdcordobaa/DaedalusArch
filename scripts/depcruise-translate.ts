/**
 * Mechanical translation of a DaedalusArch spec into a dependency-cruiser rule set (ADR-030, registered artefact).
 *
 * The spec is read with DaedalusArch's own parser (`parseSpec`), so layers, layer kinds, the style, `enabled`,
 * `exclude_paths` and `forbidden_imports` are interpreted exactly as the evaluator interprets them. Only the rules
 * dependency-cruiser can express are translated (TRANSLATED_FUNCTIONS): forbidden layer directions (FF-S01, FF-S03,
 * FF-S04), forbidden package imports from the domain layer (FF-P01), import cycles (FF-S02) and orphan files (FF-C04).
 * Every other symbolic function, and every neuronal function, is listed with the reason it is not translated.
 *
 * Translation rules (ADR-030 item 2):
 * - T1 Layer membership. DaedalusArch assigns a file to the first layer (spec order) whose `directories` glob matches
 *   (picomatch, `dot: true`), else to the first layer whose `file_patterns` glob matches (layer-annotator.ts). Each
 *   layer therefore becomes up to two path selectors: (its directories, not any earlier layer's directories) and
 *   (its file patterns, not any layer's directories, not any earlier layer's file patterns). Globs become regexes
 *   with `picomatch.makeRe(glob, { dot: true })`, the matcher the evaluator uses.
 * - T2 FF-S01 dependency-direction: a file of layer i importing a file of layer j with i < j in spec order is
 *   forbidden (the `layerOrder` parameter, srcIdx < tgtIdx).
 * - T3 FF-S03 no-layer-skip (style `layered` only, as the template): every pair (a, b), a != b, other than
 *   "layer[i+1] imports layer[i]" is forbidden.
 * - T4 FF-S04 no-domain-outward-dep (styles clean-architecture and nestjs, a bound domain layer): domain to any
 *   other mapped layer.
 * - T5 FF-P01 domain-purity: a domain-layer file importing a package of `forbidden_imports` (exact name, or the
 *   `prefix/*` form), whether resolved under node_modules (also its `@types/` package) or left unresolved.
 * - T6 FF-S02 no-cyclic-deps: dependency-cruiser's `circular` rule over every module.
 * - T7 FF-C04 no-orphan-files: dependency-cruiser's `orphan` rule over mapped (layered) files.
 * - T8 Excludes. A function's `exclude_paths` become `pathNot` on the source (`from`) side with DaedalusArch's own
 *   `globToRegex` (the `$excludePatterns` the Cypher templates use); instrument v2 role exemptions are empty for
 *   every translated template. The extractor excludes (DEFAULT_EXCLUDE_PATTERNS plus `default_exclude_paths`) remove
 *   files from the cruise (`options.exclude`), except node_modules, which is `doNotFollow` so packages stay visible.
 * - T9 Type-only imports and re-exports count, as in the evaluator (`tsPreCompilationDeps: true`).
 * - T10 A function that is disabled, or whose template is not applicable to the spec's style or layer kinds, is
 *   not translated for that spec (it produces no rule).
 */
import { readFileSync } from 'node:fs';
import { DEFAULT_EXCLUDE_PATTERNS } from '../src/apg-extractor/types.js';
import { CYPHER_TEMPLATES } from '../src/fitness-compiler/cypher-templates.js';
import { globToRegex } from '../src/fitness-compiler/glob-to-regex.js';
import { bindLayerParams } from '../src/fitness-compiler/layer-binding.js';
import { roleExemptionPatterns } from '../src/fitness-compiler/role-exemptions.js';
import { isTemplateApplicable } from '../src/fitness-compiler/template-applicability.js';
import { parseSpec, specExcludePathsFromYaml } from '../src/spec-parser/index.js';
import type { FitnessFunction, LayerDefinition, ParsedSpec } from '../src/shared/types/spec.js';

/** The registered translation version (ADR-030). A change to any T-rule bumps it and the pre-registration. */
export const TRANSLATION_VERSION = '1.0.0';

/** Functions dependency-cruiser can express, with the T-rule that translates each. */
export const TRANSLATED_FUNCTIONS: Readonly<Record<string, string>> = Object.freeze({
  'FF-S01': 'T2 forbidden layer direction (srcIdx < tgtIdx)',
  'FF-S02': 'T6 circular',
  'FF-S03': 'T3 forbidden non-adjacent / upward layer import (layered only)',
  'FF-S04': 'T4 domain to any other mapped layer (clean-architecture, nestjs)',
  'FF-P01': 'T5 domain to forbidden package',
  'FF-C04': 'T7 orphan (mapped files)',
});

/** Why each other function is not translated (ADR-030 item 3). Keyed by template name. */
export const UNTRANSLATABLE: Readonly<Record<string, string>> = Object.freeze({
  'dependency-inversion': 'ratio of abstract to concrete cross-layer imports against a threshold; needs symbol kinds (interface vs class) of import targets',
  'repository-pattern': 'needs class roles and the classes a repository implements; dependency-cruiser sees modules, not classes',
  'use-case-isolation': 'use case to use case calls at class level; module paths cannot tell a use case class from other symbols in a file',
  'controller-no-entity': 'needs the class role (controller) and the imported symbol kind (entity class)',
  'domain-state-purity': 'domain class holding an infrastructure type through constructor injection or a field (FLOWS_TO, CONSTRUCTOR_INJECTS); type-level data flow, not an import edge',
  'domain-stability': 'Martin instability metric per layer against a threshold',
  'module-fan-out': 'fan-out threshold per file (dependency-cruiser reports metrics but has no fan-out rule)',
  'component-instability': 'Martin instability per file against a threshold',
  'max-fan-in': 'fan-in threshold; expressible in part (numberOfDependentsMoreThan) but not translated: outside the registered comparison scope',
  'abstraction-ratio': 'Martin abstractness (abstract classes and interfaces over all classes) of the domain',
  'single-responsibility-proxy': 'public method and constructor dependency counts per class',
  'interface-segregation-proxy': 'method count per interface',
  'inheritance-depth': 'class inheritance depth',
  'naming-conventions': 'class naming per layer (symbol names, not file paths)',
  'naming-services': 'class naming (symbol names, not file paths)',
  'naming-repos': 'class naming (symbol names, not file paths)',
  'naming-controllers': 'class naming (symbol names, not file paths)',
  'test-file-pairing': 'presence of a sibling test file; no dependency edge exists between a file and its missing test',
  'no-index-logic': 'statement kinds inside index.ts files',
  'architectural-integrity': 'LLM judge (neuronal); no symbolic counterpart',
  'intent-alignment': 'LLM judge (neuronal); no symbolic counterpart',
});

export interface PathSelector {
  readonly path: readonly string[];
  readonly pathNot: readonly string[];
}

export interface DepcruiseRule {
  readonly name: string;
  readonly severity: 'error';
  readonly comment: string;
  readonly from: Record<string, unknown>;
  readonly to: Record<string, unknown>;
}

export interface TranslatedFunction {
  readonly functionId: string;
  readonly template: string;
  readonly rule: string;
  readonly ruleCount: number;
}

export interface SkippedFunction {
  readonly functionId: string;
  readonly template: string;
  readonly reason: string;
  /** `untranslatable` (dependency-cruiser cannot express it) or `inactive` (disabled or not applicable here). */
  readonly kind: 'untranslatable' | 'inactive';
}

export interface Translation {
  readonly translationVersion: string;
  readonly style: string | null;
  readonly layerOrder: readonly string[];
  readonly config: { readonly forbidden: readonly DepcruiseRule[]; readonly options: Record<string, unknown> };
  readonly translated: readonly TranslatedFunction[];
  readonly skipped: readonly SkippedFunction[];
}

/**
 * The regex of one glob, equivalent to `picomatch(glob, { dot: true })` for the glob forms the corpus specs use
 * (globstar segments, `*` inside a segment, literal segments; braces, classes and extglobs are refused).
 * picomatch's own `makeRe` source is refused by dependency-cruiser's safe-regex check (nested repetition), so the
 * same language is written without nested repetition: a leading globstar segment is `(^|/)`, an inner one is
 * an optional any-characters-then-slash group, a trailing one is `(/|$)`, and `*` is `[^/]*`. The unit test checks the equivalence against
 * picomatch over every corpus path (ADR-030 T1).
 */
export function globRegex(glob: string): string {
  if (/[{}[\]!?()+@]/.test(glob)) throw new Error(`glob ${glob}: only globstar, * and literal segments are translated`);
  const esc = (t: string): string => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const parts = glob.split('/');
  if (parts.every((p) => p === '**')) return '.*';
  let out = parts[0] === '**' ? '(?:^|\\/)' : '^';
  let needSlash = false;
  parts.forEach((seg, i) => {
    if (seg === '**') {
      if (i === 0) { needSlash = false; return; }
      if (i === parts.length - 1) { out += '(?:\\/|$)'; return; }
      out += '\\/(?:|.*\\/)';
      needSlash = false;
      return;
    }
    out += (needSlash ? '\\/' : '') + seg.split('*').map(esc).join('[^/]*');
    needSlash = true;
  });
  return parts[parts.length - 1] === '**' ? out : `${out}$`;
}

/** T1: the path selectors of each layer, in spec order. */
export function layerSelectors(layers: readonly LayerDefinition[]): PathSelector[][] {
  const dirs = layers.map((l) => l.directories.map(globRegex));
  const files = layers.map((l) => (l.filePatterns ?? []).map(globRegex));
  const allDirs = dirs.flat();
  return layers.map((_, i) => {
    const out: PathSelector[] = [];
    if ((dirs[i] ?? []).length > 0) out.push({ path: dirs[i] ?? [], pathNot: dirs.slice(0, i).flat() });
    if ((files[i] ?? []).length > 0) out.push({ path: files[i] ?? [], pathNot: [...allDirs, ...files.slice(0, i).flat()] });
    return out;
  });
}

/** T5: the regex of a forbidden package entry: exact name or `prefix/*`, resolved or unresolved. */
export function packageRegex(entry: string): string {
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const name = entry.endsWith('/*') ? `${esc(entry.slice(0, -2))}/[^/]+` : esc(entry);
  // `@types/<name>` for an unscoped name (the declaration package a type-only import resolves to).
  const types = entry.startsWith('@') ? '' : `|(^|/)node_modules/@types/${name}(/|$)`;
  return `(^|/)node_modules/${name}(/|$)|^${name}(/|$)${types}`;
}

/** Repository-relative extractor excludes as dependency-cruiser regexes, without node_modules (T8). */
export function extractionExcludes(defaultExcludePaths: readonly string[]): string[] {
  const globs = [...DEFAULT_EXCLUDE_PATTERNS, ...defaultExcludePaths].filter((g) => !g.includes('node_modules'));
  return [...new Set(globs)].map(globRegex);
}

const NODE_MODULES = '(^|/)node_modules/';

function sel(s: PathSelector, extraNot: readonly string[] = []): Record<string, unknown> {
  const pathNot = [...s.pathNot, ...extraNot];
  return { path: [...s.path], ...(pathNot.length > 0 ? { pathNot } : {}) };
}

/** Translate a parsed spec plus its `default_exclude_paths` (ADR-030 T1..T10). */
export function translateParsed(spec: ParsedSpec, defaultExcludePaths: readonly string[]): Translation {
  const layers = spec.layerModel.layers;
  const layerOrder = layers.map((l) => l.name);
  const selectors = layerSelectors(layers);
  const binding = bindLayerParams(layers);
  const forbidden: DepcruiseRule[] = [];
  const translated: TranslatedFunction[] = [];
  const skipped: SkippedFunction[] = [];

  for (const ff of spec.fitnessFunctions) {
    const id = String(ff.id);
    const template = ff.name;
    if (TRANSLATED_FUNCTIONS[id] === undefined || ff.route === 'neuronal') {
      skipped.push({ functionId: id, template, kind: 'untranslatable', reason: UNTRANSLATABLE[template] ?? 'not in the translated set' });
      continue;
    }
    const tpl = CYPHER_TEMPLATES.get(template);
    if (!ff.enabled) { skipped.push({ functionId: id, template, kind: 'inactive', reason: `disabled: ${ff.disabledReason ?? ''}` }); continue; }
    if (tpl === undefined) { skipped.push({ functionId: id, template, kind: 'inactive', reason: 'no template' }); continue; }
    const app = isTemplateApplicable(tpl, spec.style, binding, spec.layerModel);
    if (!app.applicable) { skipped.push({ functionId: id, template, kind: 'inactive', reason: app.reason }); continue; }
    const rules = rulesFor(ff, layerOrder, selectors, binding.domainLayer);
    forbidden.push(...rules);
    translated.push({ functionId: id, template, rule: TRANSLATED_FUNCTIONS[id] ?? '', ruleCount: rules.length });
  }

  const options: Record<string, unknown> = {
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    exclude: { path: extractionExcludes(defaultExcludePaths) },
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.json'] },
  };
  return { translationVersion: TRANSLATION_VERSION, style: spec.style ?? null, layerOrder, config: { forbidden, options }, translated, skipped };
}

function fromExcludes(ff: FitnessFunction): string[] {
  // T8: the evaluator's own `$excludePatterns` (instrument v2 role exemptions are empty for these templates).
  return [...ff.excludePaths.map((g) => globToRegex(g)), ...roleExemptionPatterns(ff.name, 2)];
}

function rulesFor(
  ff: FitnessFunction, layerOrder: readonly string[], selectors: readonly PathSelector[][], domainLayer: string | undefined,
): DepcruiseRule[] {
  const id = String(ff.id);
  const ex = fromExcludes(ff);
  const rules: DepcruiseRule[] = [];
  const edge = (a: number, b: number, why: string): void => {
    (selectors[a] ?? []).forEach((fs, x) => (selectors[b] ?? []).forEach((ts, y) => {
      rules.push({
        name: `${id}--${String(layerOrder[a])}--${String(layerOrder[b])}--${String(x)}${String(y)}`,
        severity: 'error', comment: why,
        from: sel(fs, ex), to: sel(ts, [NODE_MODULES]),
      });
    }));
  };
  const n = layerOrder.length;
  switch (id) {
    case 'FF-S01':
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edge(i, j, 'T2 dependency-direction');
      break;
    case 'FF-S03': {
      const allowed = new Set<string>();
      for (let i = 0; i < n - 1; i++) allowed.add(`${i + 1}>${i}`);
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b && !allowed.has(`${a}>${b}`)) edge(a, b, 'T3 no-layer-skip');
      break;
    }
    case 'FF-S04': {
      const d = layerOrder.indexOf(domainLayer ?? '');
      if (d >= 0) for (let b = 0; b < n; b++) if (b !== d) edge(d, b, 'T4 no-domain-outward-dep');
      break;
    }
    case 'FF-P01': {
      const d = layerOrder.indexOf(domainLayer ?? '');
      const pkgs = ff.forbiddenImports ?? [];
      if (d >= 0 && pkgs.length > 0) {
        (selectors[d] ?? []).forEach((fs, x) => rules.push({
          name: `${id}--${String(layerOrder[d])}--packages--${String(x)}`, severity: 'error', comment: 'T5 domain-purity',
          from: sel(fs, ex), to: { path: pkgs.map(packageRegex) },
        }));
      }
      break;
    }
    case 'FF-S02':
      rules.push({ name: `${id}--cycle`, severity: 'error', comment: 'T6 no-cyclic-deps', from: ex.length > 0 ? { pathNot: ex } : {}, to: { circular: true } });
      break;
    case 'FF-C04':
      selectors.forEach((ss, l) => ss.forEach((fs, x) => rules.push({
        name: `${id}--${String(layerOrder[l])}--${String(x)}`, severity: 'error', comment: 'T7 no-orphan-files',
        from: { orphan: true, ...sel(fs, ex) }, to: {},
      })));
      break;
  }
  return rules;
}

/** Translate the spec file at `specPath` (absolute or relative to the working directory). */
export async function translateSpec(specPath: string): Promise<Translation> {
  const parsed = await parseSpec({ specFilePath: specPath });
  if (!parsed.success) throw new Error(`spec ${specPath}: ${parsed.errors.map((e) => e.message).join('; ')}`);
  return translateParsed(parsed.data, specExcludePathsFromYaml(readFileSync(specPath, 'utf8')));
}

/** Map a dependency-cruiser rule name back to its function id (`FF-S01--domain--infrastructure--00` → `FF-S01`). */
export function functionIdOfRule(ruleName: string): string {
  return ruleName.split('--')[0] ?? ruleName;
}

/**
 * The comparison target of a dependency-cruiser `to` path (ADR-030 item 4): a package name for a node_modules or
 * unresolved bare specifier (`node_modules/@types/express/index.d.ts` → `express`), else the path itself.
 */
export function normaliseTarget(to: string): string {
  const m = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(to);
  if (m !== null) {
    const pkg = m[1] ?? to;
    if (pkg.startsWith('@types/')) {
      const bare = pkg.slice('@types/'.length);
      return bare.includes('__') ? `@${bare.replace('__', '/')}` : bare;
    }
    return pkg;
  }
  return to;
}
