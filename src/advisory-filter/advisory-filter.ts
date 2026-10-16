/**
 * Advisory post-filters (v1.3 advisory-noise proposal; Docs/DiagnosticRuns/v1.3-advisory-noise-2026-10-16.md).
 *
 * Every option is OFF by default and touches advisory-tier rows of its own rules only. A blocking row is never
 * removed, whatever the option says (`tierOf` is checked first), and no Cypher template, tier or blocking rule is
 * changed: the filter runs on finished findings. A removed row is not dropped silently; the caller keeps it, with the
 * option and the reason, in the report's `advisoryFilter.suppressed` list.
 *
 * The filter reads only the finding row, the file's own source and the spec's layer model, so the same function runs
 * inside the pipeline (`AssembleReportCommand`) and offline over stored findings (`scripts/v1.3/advisory-noise.ts`).
 */
import * as path from 'node:path';
import { APG2_COMPOSITION_ROOT_NAME_PATTERNS, APG2_TEST_COMPOSITION_ROOT_PATTERNS, COMPOSITION_ROOT_ROLE } from '../shared/apg2-scope.js';
import { FRAMEWORK_DEPENDENCY_TYPES, sourceFacts } from './source-facts.js';
import type { SourceFacts } from './source-facts.js';

/** The options. Each is independent; any subset may be combined. */
export const ADVISORY_FILTER_OPTIONS = [
  'cv05-no-logic',
  'cv05-no-branching',
  'composition-roots',
  'c03-core-only',
  'c02-abstract-imports',
  'c02-size-scaled',
  'c04-entry-points',
  'so-framework-members',
  'cv05-rollup',
] as const;

export type AdvisoryFilterOption = (typeof ADVISORY_FILTER_OPTIONS)[number];

/** What each option does, one line (CLI help and the report). */
export const ADVISORY_FILTER_DESCRIPTIONS: Readonly<Record<AdvisoryFilterOption, string>> = {
  'cv05-no-logic': 'FF-CV05: skip files with no runtime logic (types, barrels, DTO / error / data classes, enums, constant data, config, migrations)',
  'cv05-no-branching': 'FF-CV05: also skip files with no control flow, no callbacks and function bodies of at most two statements (thin delegation)',
  'composition-roots': 'FF-C02, FF-C03, FF-C04, FF-CV05: skip composition roots (name patterns, the composition-root layer role, or a class-free file without control flow that instantiates classes from two or more layers)',
  'c03-core-only': 'FF-C03: report instability only for files in a layer of kind domain (outer and orchestrating modules are meant to be unstable)',
  'c02-abstract-imports': 'FF-C02: do not count type-only imports and imports of type-only modules (ports, DTO types) towards fan-out',
  'c02-size-scaled': 'FF-C02: scale the fan-out threshold by project size, threshold x max(1, sqrt(files / 40))',
  'c04-entry-points': 'FF-C04: skip entry points (main, server, index, cli, app, bootstrap at the source root, package.json main / bin) and composition roots',
  'so-framework-members': 'FF-SO01, FF-SO02: do not count accessors, lifecycle hooks and serialisation members, nor Logger / ConfigService / ModuleRef / Reflector injections; skip generated files',
  'cv05-rollup': 'FF-CV05: when the rule fires on at least 80% of the project\'s source files (and on 5 or more), keep one row for the project and list the others as rolled up',
};

/** Rules each option may touch. */
export const OPTION_RULES: Readonly<Record<AdvisoryFilterOption, readonly string[]>> = {
  'cv05-no-logic': ['FF-CV05'],
  'cv05-no-branching': ['FF-CV05'],
  'composition-roots': ['FF-C02', 'FF-C03', 'FF-C04', 'FF-CV05'],
  'c03-core-only': ['FF-C03'],
  'c02-abstract-imports': ['FF-C02'],
  'c02-size-scaled': ['FF-C02'],
  'c04-entry-points': ['FF-C04'],
  'so-framework-members': ['FF-SO01', 'FF-SO02'],
  'cv05-rollup': ['FF-CV05'],
};

/** `cv05-rollup`: the share of source files and the minimum row count at which FF-CV05 is read as a project-level fact. */
export const CV05_ROLLUP_SHARE = 0.8;
export const CV05_ROLLUP_MIN_ROWS = 5;

/** Parse `a,b,c` or `all` (or `none`); throws on an unknown id. */
export function parseAdvisoryFilterOptions(value: string): AdvisoryFilterOption[] {
  const v = value.trim();
  if (v === '' || v === 'none') return [];
  if (v === 'all') return [...ADVISORY_FILTER_OPTIONS];
  const out: AdvisoryFilterOption[] = [];
  for (const raw of v.split(',')) {
    const id = raw.trim();
    if (!(ADVISORY_FILTER_OPTIONS as readonly string[]).includes(id)) {
      throw new Error(`unknown advisory filter option '${id}' (known: ${ADVISORY_FILTER_OPTIONS.join(', ')}, all, none)`);
    }
    if (!out.includes(id as AdvisoryFilterOption)) out.push(id as AdvisoryFilterOption);
  }
  return out;
}

/** The minimal finding shape the filter reads (`Violation` and stored evidence rows both fit). */
export interface FilterableFinding {
  readonly functionId: string;
  readonly filePath: string;
  readonly evidence?: readonly string[];
  readonly discriminator?: readonly string[];
}

export interface LayerInfo {
  readonly name: string;
  readonly kind?: string;
  readonly role?: string;
}

/** What the filter may know about the project. Every member is optional knowledge: unknown means "keep the row". */
export interface ProjectView {
  /** Project-relative path to source text; undefined when the file cannot be read. */
  readSource(file: string): string | undefined;
  /** Whether a project file exists when its text may be unknown (offline views); defaults to `readSource`. */
  exists?(file: string): boolean;
  layerOf(file: string): LayerInfo | undefined;
  /** Number of source files of the project (for `c02-size-scaled`); undefined = unknown. */
  readonly fileCount?: number;
  /** A rule parameter as compiled (`threshold`, `maxPublicMethods`, …); undefined = the template default. */
  param(functionId: string, name: string): number | undefined;
  /** Project-relative files named by package.json `main` / `bin` (for `c04-entry-points`). */
  readonly entryPoints?: readonly string[];
}

export interface SuppressedFinding<F> {
  readonly finding: F;
  readonly option: AdvisoryFilterOption;
  readonly reason: string;
}

export interface AdvisoryFilterResult<F> {
  readonly kept: F[];
  readonly suppressed: SuppressedFinding<F>[];
}

/** Template defaults (`src/spec-parser/template-registry.ts`, `specs/clean-arch.yaml`) when the spec sets none. */
const DEFAULTS: Readonly<Record<string, number>> = {
  'FF-C02.threshold': 10,
  'FF-SO01.maxPublicMethods': 10,
  'FF-SO01.maxDependencies': 5,
  'FF-SO02.maxInterfaceMethods': 5,
};

const TS_EXT = /\.(?:ts|tsx|mts|cts)$/;
const CONFIG_RX = [/(?:^|\/)config\//, /(?:^|\/)[^/]*\.config\.(?:ts|tsx|mts|cts)$/, /(?:^|\/)(?:config|configuration|env|environment)\.(?:ts|tsx|mts|cts)$/];
const MIGRATION_RX = [/(?:^|\/)migrations?\//, /(?:^|\/)[^/]*\.migration\.(?:ts|tsx|mts|cts)$/, /(?:^|\/)\d{10,}[-_][^/]*\.(?:ts|tsx|mts|cts)$/];
const ENTRY_RX = /^(?:src\/)?(?:main|server|index|cli|app|bootstrap|start)\.(?:ts|tsx|mts|cts)$/;
const GENERATED_PATH_RX = /(?:^|\/)(?:generated|__generated__)\/|\.generated\.(?:ts|tsx)$|\.g\.ts$/;
const CR_NAME_RX = [...APG2_COMPOSITION_ROOT_NAME_PATTERNS, ...APG2_TEST_COMPOSITION_ROOT_PATTERNS].map((p) => new RegExp(p));

function evidenceNumber(f: FilterableFinding, key: string): number | undefined {
  for (const e of f.evidence ?? []) {
    const m = new RegExp(`^${key}=(-?[0-9.]+)$`).exec(e);
    if (m?.[1] !== undefined) return Number(m[1]);
  }
  return undefined;
}

/** Resolve a relative import of `from` to a readable project file, or undefined (packages, aliases, missing files). */
export function resolveImport(view: ProjectView, from: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier)).replace(/\.(?:js|mjs|cjs|jsx)$/, '');
  const candidates = TS_EXT.test(base) ? [base] : [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((c) => (view.exists !== undefined ? view.exists(c) : view.readSource(c) !== undefined));
}

/** Per-run cache of parsed facts. */
class FactsCache {
  private readonly cache = new Map<string, SourceFacts | null>();
  constructor(private readonly view: ProjectView) {}
  get(file: string): SourceFacts | undefined {
    if (!this.cache.has(file)) {
      const text = this.view.readSource(file);
      this.cache.set(file, text === undefined ? null : sourceFacts(text, file));
    }
    return this.cache.get(file) ?? undefined;
  }
}

/** Why `file` is a composition root, or undefined. */
function compositionRootReason(view: ProjectView, facts: FactsCache, file: string): string | undefined {
  if (CR_NAME_RX.some((r) => r.test(file))) return 'composition-root file name';
  if (view.layerOf(file)?.role === COMPOSITION_ROOT_ROLE) return 'composition-root layer role';
  const f = facts.get(file);
  if (f === undefined || f.declaresClass || f.controlFlow) return undefined;
  const own = view.layerOf(file)?.name;
  const layers = new Set<string>(own !== undefined ? [own] : []);
  let built = 0;
  for (const name of f.instantiated) {
    const spec = f.importedNames[name];
    if (spec === undefined) continue;
    const target = resolveImport(view, file, spec);
    const layer = target !== undefined ? view.layerOf(target)?.name : undefined;
    if (layer === undefined) continue;
    built += 1;
    layers.add(layer);
  }
  return built >= 2 && layers.size >= 2 ? `class-free file without control flow that instantiates classes from ${String(layers.size)} layers (${[...layers].sort().join(', ')})` : undefined;
}

function cv05NoLogicReason(file: string, f: SourceFacts | undefined): string | undefined {
  if (CONFIG_RX.some((r) => r.test(file))) return 'configuration file';
  if (MIGRATION_RX.some((r) => r.test(file))) return 'migration file';
  if (f === undefined) return undefined;
  if (f.barrel) return 'barrel (re-exports only)';
  if (f.typesOnly) return 'type declarations only';
  if (f.noLogic) return 'no runtime logic (data classes, enums, constant data)';
  return undefined;
}

type Decider = (f: FilterableFinding, view: ProjectView, facts: FactsCache) => string | undefined;

const DECIDERS: Readonly<Record<Exclude<AdvisoryFilterOption, 'cv05-rollup'>, Decider>> = {
  'cv05-no-logic': (f, _v, facts) => cv05NoLogicReason(f.filePath, facts.get(f.filePath)),
  'cv05-no-branching': (f, _v, facts) => {
    const sf = facts.get(f.filePath);
    const strict = cv05NoLogicReason(f.filePath, sf);
    if (strict !== undefined) return strict;
    return sf?.noBranching === true ? 'no control flow, no callbacks, function bodies of at most two statements' : undefined;
  },
  'composition-roots': (f, view, facts) => compositionRootReason(view, facts, f.filePath),
  'c03-core-only': (f, view) => {
    const layer = view.layerOf(f.filePath);
    if (layer?.kind === undefined) return undefined;
    return layer.kind === 'domain' ? undefined : `layer '${layer.name}' is of kind ${layer.kind}, not domain`;
  },
  'c02-abstract-imports': (f, view, facts) => {
    const fanOut = evidenceNumber(f, 'fanOut');
    const sf = facts.get(f.filePath);
    if (fanOut === undefined || sf === undefined) return undefined;
    const threshold = view.param(f.functionId, 'threshold') ?? DEFAULTS['FF-C02.threshold'] ?? 10;
    const abstract = new Set<string>();
    const concrete = new Set<string>();
    for (const imp of sf.imports) {
      if (imp.reExport) continue;
      const target = resolveImport(view, f.filePath, imp.specifier);
      if (target === undefined) continue;
      const tf = facts.get(target);
      if (imp.typeOnly || tf?.typesOnly === true) abstract.add(target); else concrete.add(target);
    }
    for (const c of concrete) abstract.delete(c);
    const counted = fanOut - abstract.size;
    return counted <= threshold ? `fan-out ${String(fanOut)} counts ${String(abstract.size)} type-only targets; ${String(counted)} concrete <= ${String(threshold)}` : undefined;
  },
  'c02-size-scaled': (f, view) => {
    const fanOut = evidenceNumber(f, 'fanOut');
    if (fanOut === undefined || view.fileCount === undefined) return undefined;
    const threshold = view.param(f.functionId, 'threshold') ?? DEFAULTS['FF-C02.threshold'] ?? 10;
    const scaled = Math.ceil(threshold * Math.max(1, Math.sqrt(view.fileCount / 40)));
    return fanOut <= scaled ? `fan-out ${String(fanOut)} <= size-scaled threshold ${String(scaled)} (${String(view.fileCount)} files)` : undefined;
  },
  'c04-entry-points': (f, view, facts) => {
    if (ENTRY_RX.test(f.filePath)) return 'entry point at the source root';
    if (view.entryPoints?.includes(f.filePath) === true) return 'package.json entry point';
    const cr = compositionRootReason(view, facts, f.filePath);
    return cr !== undefined ? `entry point: ${cr}` : undefined;
  },
  'so-framework-members': (f, view, facts) => {
    if (GENERATED_PATH_RX.test(f.filePath)) return 'generated file (path)';
    const sf = facts.get(f.filePath);
    if (sf === undefined) return undefined;
    if (sf.generatedMarker) return 'generated file (header marker)';
    const name = f.discriminator?.[0];
    const member = sf.members.find((m) => m.name === name);
    if (member === undefined) return undefined;
    const methodCount = evidenceNumber(f, 'methodCount');
    if (methodCount === undefined) return undefined;
    const methods = methodCount - member.excludedMethods.length;
    if (f.functionId === 'FF-SO02') {
      const max = view.param(f.functionId, 'maxInterfaceMethods') ?? DEFAULTS['FF-SO02.maxInterfaceMethods'] ?? 5;
      return methods <= max ? `${String(methods)} interface methods without ${member.excludedMethods.join(', ')} <= ${String(max)}` : undefined;
    }
    const depCount = evidenceNumber(f, 'depCount');
    if (depCount === undefined) return undefined;
    const framework = member.constructorParamTypes.filter((t) => FRAMEWORK_DEPENDENCY_TYPES.includes(t.replace(/<.*$/, '').trim()));
    const deps = depCount - framework.length;
    const maxM = view.param(f.functionId, 'maxPublicMethods') ?? DEFAULTS['FF-SO01.maxPublicMethods'] ?? 10;
    const maxD = view.param(f.functionId, 'maxDependencies') ?? DEFAULTS['FF-SO01.maxDependencies'] ?? 5;
    if (member.excludedMethods.length === 0 && framework.length === 0) return undefined;
    return methods <= maxM && deps <= maxD
      ? `${String(methods)} methods and ${String(deps)} dependencies without framework members (${[...member.excludedMethods, ...framework].join(', ')})`
      : undefined;
  },
};

/**
 * Apply `options` to `findings`. `tierOf` must return the row's v1.3 tier; only `advisory` rows of an option's own rules
 * are considered. Order is kept. With no option, every row is kept and nothing is read.
 */
export function applyAdvisoryFilter<F extends FilterableFinding>(
  findings: readonly F[],
  options: readonly AdvisoryFilterOption[],
  tierOf: (finding: F) => 'blocking' | 'advisory',
  view: ProjectView,
): AdvisoryFilterResult<F> {
  if (options.length === 0) return { kept: [...findings], suppressed: [] };
  const facts = new FactsCache(view);
  const kept: F[] = [];
  const suppressed: SuppressedFinding<F>[] = [];
  for (const f of findings) {
    let hit: SuppressedFinding<F> | undefined;
    if (tierOf(f) === 'advisory') {
      for (const option of options) {
        if (option === 'cv05-rollup' || !OPTION_RULES[option].includes(f.functionId)) continue;
        const reason = DECIDERS[option](f, view, facts);
        if (reason !== undefined) { hit = { finding: f, option, reason }; break; }
      }
    }
    if (hit !== undefined) suppressed.push(hit); else kept.push(f);
  }
  if (!options.includes('cv05-rollup')) return { kept, suppressed };
  // Project-level pass: the share is read on the input rows, so the per-row options above do not change whether the
  // project counts as untested; the first remaining FF-CV05 row stands for the project.
  const isCv05 = (f: F): boolean => f.functionId === 'FF-CV05' && tierOf(f) === 'advisory';
  const fired = findings.filter(isCv05).length;
  const files = view.fileCount;
  if (files === undefined || fired < CV05_ROLLUP_MIN_ROWS || fired < CV05_ROLLUP_SHARE * files) return { kept, suppressed };
  const representative = kept.find(isCv05);
  if (representative === undefined) return { kept, suppressed };
  const reason = `project-level: FF-CV05 fires on ${String(fired)} of ${String(files)} source files; one row (${representative.filePath}) stands for the project`;
  return {
    kept: kept.filter((f) => f === representative || !isCv05(f)),
    suppressed: [...suppressed, ...kept.filter((f) => f !== representative && isCv05(f)).map((f) => ({ finding: f, option: 'cv05-rollup' as const, reason }))],
  };
}
