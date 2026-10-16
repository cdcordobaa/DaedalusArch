/**
 * Rule mining, the miner: deterministic, no LLM, no spec. It reads a project through `MiningInput` (the APG's file
 * edges, package imports, declarations and type edges, an inferred layer map, and the APG v2 components) and proposes
 * the dependency rules the code follows almost everywhere, each with its evidence counts, a confidence and its
 * exceptions (the candidate violations).
 *
 * Every threshold is a constant below. They were fixed before the evaluation on the reference set ran
 * (Docs/v1.3/rule-mining.md, "Commit order") and were not tuned on it.
 *
 * Confidence is smoothed (a Laplace-style `+1` in each denominator), so one observation cannot give confidence 1:
 * - layer-direction / component-direction: reverse / (edges + reverse + 1) * (files - importing) / (files + 1);
 * - layer-rare-edge: 0.5 * (files - 1) / (files + 1)   (no direction evidence: never above 0.5);
 * - layer-unobserved: 0.5 * a / (a + 1) * b / (b + 1)  (absence of evidence only: never above 0.5);
 * - acyclic-files, public-api, port-implementation, inject-abstractions: compliant / (instances + 1);
 * - core-package-free: (core files not importing) / (core files + 1), the minimum over the listed packages.
 */
import { stronglyConnected } from '../ise/units.js';
import { APG2_COMPOSITION_ROOT_NAME_PATTERNS, APG2_TEST_PATTERNS } from '../shared/apg2-scope.js';
import type {
  CompileTarget,
  ConfidenceLevel,
  LayerPairStat,
  MinedRule,
  MinedRuleKind,
  MiningComponent,
  MiningInput,
  MiningResult,
  MiningStyle,
  RuleException,
} from './types.js';

/** A pair rule needs at least this share of the pair's edges to run the other way (direction evidence). */
export const DIRECTION_MIN = 0.75;
/** ... and at most `1 - ABSENCE_MIN` of the source's files may import the target. */
export const ABSENCE_MIN = 0.75;
/** A rare edge: exactly one importing file, out of at least this many files of the source, and nothing back. */
export const RARE_MIN_FILES = 3;
/** The acyclic rule is proposed when at most this share of files lies on a cycle. */
export const ACYCLIC_MAX_SHARE = 0.1;
/** Pattern rules (public API, port implementation, injection) need this share of compliant instances ... */
export const PATTERN_MIN_SHARE = 0.75;
/** ... out of at least this many instances. */
export const PATTERN_MIN_INSTANCES = 2;
/** A package is listed for the core when at most this share of core files imports it. */
export const CORE_PACKAGE_MAX_SHARE = 0.1;
export const LEVEL_HIGH = 0.75;
export const LEVEL_MEDIUM = 0.5;

/** Layer names the presets use for the composition root (the miner exempts them from no rule but the public API). */
const COMPOSITION_LAYER_NAMES: readonly string[] = ['config', 'composition'];
/** The adapter roles the existing `port-adapter-pattern` template binds (hexagonal-templates.ts), and repository-pattern's. */
const PORT_ADAPTER_ROLES: readonly string[] = ['Repository', 'Repo', 'Adapter', 'Gateway'];
const REPOSITORY_ROLES: readonly string[] = ['Repository', 'Repo'];

export const levelOf = (c: number): ConfidenceLevel => (c >= LEVEL_HIGH ? 'high' : c >= LEVEL_MEDIUM ? 'medium' : 'low');
const round = (x: number): number => Math.round(x * 1000) / 1000;
const isGraphStyle = (s: MiningStyle): boolean => s === 'hexagonal' || s === 'ddd';

const testRe = APG2_TEST_PATTERNS.map((p) => new RegExp(p));
const rootRe = APG2_COMPOSITION_ROOT_NAME_PATTERNS.map((p) => new RegExp(p));
const isTest = (f: string): boolean => testRe.some((r) => r.test(f));

interface Draft {
  readonly kind: MinedRuleKind;
  readonly statement: string;
  readonly subject: string;
  readonly object?: string;
  readonly confidence: number;
  readonly evidence: Record<string, number>;
  readonly exceptions: RuleException[];
  readonly params?: Record<string, readonly string[]>;
  readonly compilesTo: CompileTarget | null;
  readonly notRepresentable?: string;
}

/** The last PascalCase word of a class name, `Impl` stripped (`InMemoryRoomRepositoryImpl` -> `Repository`). */
export function roleSuffix(name: string): string | null {
  const base = name.endsWith('Impl') && name.length > 4 ? name.slice(0, -4) : name;
  const m = /([A-Z][a-z0-9]+)$/.exec(base);
  return m?.[1] ?? null;
}

/** Statistics of every ordered pair of distinct layers that have files. */
export function layerPairStats(input: MiningInput): LayerPairStat[] {
  const filesOf = new Map<string, number>();
  for (const f of input.files) {
    const l = input.layerOf.get(f);
    if (l != null) filesOf.set(l, (filesOf.get(l) ?? 0) + 1);
  }
  const edges = new Map<string, number>();
  const importers = new Map<string, Set<string>>();
  for (const e of input.fileEdges) {
    const a = input.layerOf.get(e.from);
    const b = input.layerOf.get(e.to);
    if (a == null || b == null || a === b) continue;
    const k = `${a}>${b}`;
    edges.set(k, (edges.get(k) ?? 0) + 1);
    const s = importers.get(k) ?? new Set<string>();
    s.add(e.from);
    importers.set(k, s);
  }
  const present = input.layers.filter((l) => (filesOf.get(l) ?? 0) > 0);
  const out: LayerPairStat[] = [];
  for (const a of present) {
    for (const b of present) {
      if (a === b) continue;
      const n = filesOf.get(a) ?? 0;
      const e = edges.get(`${a}>${b}`) ?? 0;
      const r = edges.get(`${b}>${a}`) ?? 0;
      const f = importers.get(`${a}>${b}`)?.size ?? 0;
      out.push({
        from: a, to: b, fromFiles: n, edges: e, reverseEdges: r, importingFiles: f,
        support: round(f / n), absence: round(1 - f / n), direction: e + r === 0 ? null : round(r / (e + r)),
      });
    }
  }
  return out;
}

/** The existing template that carries "A must not depend on B" under `style`, or why none does. */
function layerPairTarget(
  style: MiningStyle, kind: 'layer-direction' | 'layer-rare-edge' | 'layer-unobserved',
): { compilesTo: CompileTarget | null; notRepresentable?: string } {
  if (isGraphStyle(style)) {
    const directional = kind === 'layer-direction';
    return {
      compilesTo: {
        catalogue: 'hexagonal',
        template: directional ? 'dependency-direction-graph' : 'layer-skip-graph',
        via: directional
          ? 'architecture.allowed_dependencies (the reverse edge is listed, this one is not)'
          : 'architecture.allowed_dependencies (no edge listed in either direction)',
      },
    };
  }
  if (kind === 'layer-direction') {
    return { compilesTo: { catalogue: 'frozen', template: 'dependency-direction', via: 'the order of architecture.layers' } };
  }
  if (style === 'layered') {
    return { compilesTo: { catalogue: 'frozen', template: 'no-layer-skip', via: 'the order of architecture.layers (adjacent layers only)' } };
  }
  return {
    compilesTo: null,
    notRepresentable: `style ${style} orders its layers totally: dependency-direction allows every inward import, and no-layer-skip applies to the layered style only`,
  };
}

function mineLayerRules(input: MiningInput, style: MiningStyle, pairs: readonly LayerPairStat[], drafts: Draft[]): void {
  const filesOf = (l: string): number => pairs.find((p) => p.from === l)?.fromFiles ?? 0;
  const byKey = new Map(pairs.map((p) => [`${p.from}>${p.to}`, p]));
  const exceptionsOf = (a: string, b: string): RuleException[] =>
    input.fileEdges
      .filter((e) => input.layerOf.get(e.from) === a && input.layerOf.get(e.to) === b)
      .map((e) => ({ file: e.from, target: e.to }));
  for (const p of pairs) {
    const back = byKey.get(`${p.to}>${p.from}`);
    if (back === undefined) continue;
    const evidence = { fromFiles: p.fromFiles, importingFiles: p.importingFiles, edges: p.edges, reverseEdges: p.reverseEdges };
    if (p.reverseEdges > 0 && (p.direction ?? 0) >= DIRECTION_MIN && p.absence >= ABSENCE_MIN) {
      const confidence = (p.reverseEdges / (p.edges + p.reverseEdges + 1)) * ((p.fromFiles - p.importingFiles) / (p.fromFiles + 1));
      drafts.push({
        kind: 'layer-direction', subject: p.from, object: p.to, confidence, evidence,
        statement: `${p.from} must not depend on ${p.to} (${String(p.reverseEdges)} edges ${p.to} -> ${p.from}; ${String(p.importingFiles)}/${String(p.fromFiles)} ${p.from} files import ${p.to})`,
        exceptions: exceptionsOf(p.from, p.to),
        ...layerPairTarget(style, 'layer-direction'),
      });
    } else if (p.reverseEdges === 0 && p.importingFiles === 1 && p.fromFiles >= RARE_MIN_FILES) {
      drafts.push({
        kind: 'layer-rare-edge', subject: p.from, object: p.to, confidence: (0.5 * (p.fromFiles - 1)) / (p.fromFiles + 1), evidence,
        statement: `${p.from} should not depend on ${p.to} (1/${String(p.fromFiles)} ${p.from} files imports it; nothing goes back)`,
        exceptions: exceptionsOf(p.from, p.to),
        ...layerPairTarget(style, 'layer-rare-edge'),
      });
    } else if (p.edges === 0 && p.reverseEdges === 0) {
      const a = p.fromFiles;
      const b = filesOf(p.to);
      drafts.push({
        kind: 'layer-unobserved', subject: p.from, object: p.to, confidence: 0.5 * (a / (a + 1)) * (b / (b + 1)), evidence,
        statement: `${p.from} must not depend on ${p.to} (no import between them either way)`,
        exceptions: [],
        ...layerPairTarget(style, 'layer-unobserved'),
      });
    }
  }
}

function mineAcyclic(input: MiningInput, style: MiningStyle, drafts: Draft[]): void {
  const files = input.files.filter((f) => !isTest(f));
  if (files.length === 0) return;
  const inScope = new Set(files);
  const edges = input.fileEdges.filter((e) => inScope.has(e.from) && inScope.has(e.to));
  const sccs = stronglyConnected(files, edges).filter((c) => c.length > 1);
  const sccOf = new Map<string, number>();
  sccs.forEach((c, i) => { for (const f of c) sccOf.set(f, i); });
  const onCycle = sccOf.size;
  if (onCycle / files.length > ACYCLIC_MAX_SHARE) return;
  drafts.push({
    kind: 'acyclic-files', subject: '*', confidence: (files.length - onCycle) / (files.length + 1),
    evidence: { files: files.length, filesOnCycles: onCycle, cycles: sccs.length },
    statement: `no file lies on an import cycle (${String(files.length - onCycle)}/${String(files.length)} files do not)`,
    exceptions: edges
      .filter((e) => sccOf.has(e.from) && sccOf.get(e.from) === sccOf.get(e.to))
      .map((e) => ({ file: e.from, target: e.to, detail: 'edge on an import cycle' })),
    ...(style === 'ddd'
      ? { compilesTo: null, notRepresentable: 'the ddd style compiles only its own library and the hexagonal graph templates; no-cyclic-deps is not among them' }
      : { compilesTo: { catalogue: 'frozen' as const, template: 'no-cyclic-deps', via: 'fitness function FF-S02' } }),
  });
}

function mineComponentRules(input: MiningInput, style: MiningStyle, drafts: Draft[]): void {
  const comps = input.components ?? [];
  const edges = input.literalEdges ?? [];
  for (const kind of ['module', 'folder'] as const) {
    const ofKind = comps.filter((c) => c.kind === kind && c.files.length > 0);
    if (ofKind.length < 2) continue;
    const compOf = new Map<string, MiningComponent>();
    for (const c of ofKind) for (const f of c.files) compOf.set(f, c);
    const count = new Map<string, number>();
    const importers = new Map<string, Set<string>>();
    for (const e of edges) {
      const a = compOf.get(e.from);
      const b = compOf.get(e.to);
      if (a === undefined || b === undefined || a === b) continue;
      const k = `${a.name}>${b.name}`;
      count.set(k, (count.get(k) ?? 0) + 1);
      importers.set(k, (importers.get(k) ?? new Set()).add(e.from));
    }
    for (const a of ofKind) {
      for (const b of ofKind) {
        if (a === b) continue;
        const e = count.get(`${a.name}>${b.name}`) ?? 0;
        const r = count.get(`${b.name}>${a.name}`) ?? 0;
        const f = importers.get(`${a.name}>${b.name}`)?.size ?? 0;
        const n = a.files.length;
        if (r === 0 || r / (e + r) < DIRECTION_MIN || 1 - f / n < ABSENCE_MIN) continue;
        drafts.push({
          kind: 'component-direction', subject: `${kind}:${a.name}`, object: `${kind}:${b.name}`,
          confidence: (r / (e + r + 1)) * ((n - f) / (n + 1)),
          evidence: { fromFiles: n, importingFiles: f, edges: e, reverseEdges: r },
          statement: `${kind} component ${a.name} must not depend on ${b.name} (${String(r)} imports ${b.name} -> ${a.name}; ${String(f)}/${String(n)} files import back)`,
          exceptions: edges.filter((x) => compOf.get(x.from) === a && compOf.get(x.to) === b).map((x) => ({ file: x.from, target: x.to })),
          compilesTo: { catalogue: 'apg2', template: 'component-adp-cycle', via: `APG v2 ${kind} components (an import against the rule closes a component cycle)` },
        });
      }
    }
  }
  // Public API: for each component with entry files, the share of imports from outside that go through an entry.
  for (const c of comps) {
    if (c.entries.length === 0) continue;
    const own = new Set(c.files);
    const entries = new Set(c.entries);
    const incoming = edges.filter((e) => own.has(e.to) && !own.has(e.from) && !isTest(e.from)
      && !rootRe.some((r) => r.test(e.from)) && !COMPOSITION_LAYER_NAMES.includes(input.layerOf.get(e.from) ?? ''));
    if (incoming.length < PATTERN_MIN_INSTANCES) continue;
    const deep = incoming.filter((e) => !entries.has(e.to));
    const share = (incoming.length - deep.length) / incoming.length;
    if (share < PATTERN_MIN_SHARE) continue;
    const ddd = style === 'ddd' && c.kind === 'module' && c.publicApiDeclared;
    drafts.push({
      kind: 'public-api', subject: `${c.kind}:${c.name}`, confidence: (incoming.length - deep.length) / (incoming.length + 1),
      evidence: { incomingImports: incoming.length, viaEntryFiles: incoming.length - deep.length, entryFiles: c.entries.length },
      statement: `imports into ${c.kind} component ${c.name} go through its entry files (${[...entries].sort().join(', ')}): ${String(incoming.length - deep.length)}/${String(incoming.length)}`,
      exceptions: deep.map((e) => ({ file: e.from, target: e.to, detail: 'deep import' })),
      compilesTo: ddd
        ? { catalogue: 'ddd', template: 'context-isolation', via: 'architecture.ddd.contexts[].public_api' }
        : { catalogue: 'apg2', template: c.publicApiDeclared ? 'deep-import-declared-api' : 'deep-import-inferred-api', via: `APG v2 ${c.kind} component entry files` },
    });
  }
}

/** The layer whose kind is `kind` (first in order), as the fitness compiler binds it. */
const layerOfKind = (input: MiningInput, kind: string): string | undefined => input.layers.find((l) => input.layerKinds.get(l) === kind);

function minePatternRules(input: MiningInput, style: MiningStyle, drafts: Draft[]): void {
  const layerOf = (f: string): string | null => input.layerOf.get(f) ?? null;
  const infra = layerOfKind(input, 'infrastructure');
  const application = layerOfKind(input, 'application');
  // Port implementation: classes grouped by (layer, role suffix).
  const groups = new Map<string, { layer: string; suffix: string; classes: { name: string; file: string }[] }>();
  for (const d of input.declarations) {
    if (d.kind !== 'class' || isTest(d.file)) continue;
    const l = layerOf(d.file);
    const s = roleSuffix(d.name);
    if (l === null || s === null) continue;
    const k = `${l}|${s}`;
    const g = groups.get(k) ?? { layer: l, suffix: s, classes: [] };
    g.classes.push({ name: d.name, file: d.file });
    groups.set(k, g);
  }
  for (const g of [...groups.values()].sort((a, b) => (a.layer + a.suffix < b.layer + b.suffix ? -1 : 1))) {
    if (g.classes.length < PATTERN_MIN_INSTANCES) continue;
    const verdict = g.classes.map((c) => {
      const impl = input.typeEdges.filter((e) => e.kind === 'implements' && e.from.name === c.name && e.from.file === c.file);
      const foreign = impl.filter((e) => { const tl = layerOf(e.to.file); return tl !== null && tl !== g.layer; });
      return { c, ok: foreign.length > 0, detail: impl.length === 0 ? 'implements no interface' : 'implements only interfaces of its own layer or of no layer' };
    });
    const ok = verdict.filter((v) => v.ok).length;
    if (ok / g.classes.length < PATTERN_MIN_SHARE) continue;
    let compilesTo: CompileTarget | null = null;
    let notRepresentable: string | undefined;
    const roles = isGraphStyle(style) ? PORT_ADAPTER_ROLES : REPOSITORY_ROLES;
    if (style === 'ddd') notRepresentable = 'the ddd library has no port template (repository-aggregate-root checks aggregate roots, not ports)';
    else if (g.layer !== infra) notRepresentable = `the existing templates check the infrastructure-kind layer only (${infra ?? 'none'}), not ${g.layer}`;
    else if (!roles.includes(g.suffix)) notRepresentable = `the existing template binds the roles ${roles.join(', ')}; ${g.suffix} is not one`;
    else compilesTo = isGraphStyle(style)
      ? { catalogue: 'hexagonal', template: 'port-adapter-pattern', via: 'fitness function FF-P03 (port-adapter-pattern)' }
      : { catalogue: 'frozen', template: 'repository-pattern', via: 'fitness function FF-P03 (repository-pattern)' };
    drafts.push({
      kind: 'port-implementation', subject: `${g.layer}/${g.suffix}`, confidence: ok / (g.classes.length + 1),
      evidence: { classes: g.classes.length, implementingAPort: ok },
      statement: `every *${g.suffix} class in ${g.layer} implements an interface declared in another layer (${String(ok)}/${String(g.classes.length)})`,
      exceptions: verdict.filter((v) => !v.ok).map((v) => ({ file: v.c.file, target: v.c.name, detail: v.detail })),
      compilesTo, ...(notRepresentable !== undefined ? { notRepresentable } : {}),
    });
  }
  // Injection of abstractions: cross-layer constructor injections, per injecting layer.
  const byLayer = new Map<string, { to: { name: string; kind: string; file: string }; file: string; cls: string }[]>();
  for (const e of input.typeEdges) {
    if (e.kind !== 'injects' || isTest(e.from.file)) continue;
    const a = layerOf(e.from.file);
    const b = layerOf(e.to.file);
    if (a === null || b === null || a === b || COMPOSITION_LAYER_NAMES.includes(a)) continue;
    byLayer.set(a, [...(byLayer.get(a) ?? []), { to: e.to, file: e.from.file, cls: e.from.name }]);
  }
  for (const [layer, injs] of [...byLayer].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (injs.length < PATTERN_MIN_INSTANCES) continue;
    const ok = injs.filter((i) => i.to.kind === 'interface').length;
    if (ok / injs.length < PATTERN_MIN_SHARE) continue;
    const compilesTo: CompileTarget | null = layer !== application || style === 'ddd'
      ? null
      : isGraphStyle(style)
        ? { catalogue: 'hexagonal', template: 'port-dependency-inversion', via: 'fitness function FF-P02 (port-dependency-inversion)' }
        : { catalogue: 'frozen', template: 'dependency-inversion', via: 'fitness function FF-P02 (dependency-inversion)' };
    drafts.push({
      kind: 'inject-abstractions', subject: layer, confidence: ok / (injs.length + 1),
      evidence: { crossLayerInjections: injs.length, ofInterfaces: ok },
      statement: `classes of ${layer} inject interfaces across layers, not concrete classes (${String(ok)}/${String(injs.length)})`,
      exceptions: injs.filter((i) => i.to.kind !== 'interface').map((i) => ({ file: i.file, target: i.to.file, detail: `${i.cls} injects class ${i.to.name}` })),
      compilesTo,
      ...(compilesTo === null
        ? { notRepresentable: style === 'ddd' ? 'the ddd library has no injection template' : `the existing templates check the application-kind layer only (${application ?? 'none'}), not ${layer}` }
        : {}),
    });
  }
}

/**
 * Core package freedom: the core is every layer the mined allowed graph lets import no other layer (a sink). A package
 * that another layer imports and at most `CORE_PACKAGE_MAX_SHARE` of the core's files import is proposed as forbidden.
 */
function mineCorePackages(input: MiningInput, allowed: readonly string[], drafts: Draft[]): void {
  const present = new Set(input.files.map((f) => input.layerOf.get(f)).filter((l): l is string => l != null));
  const sinks = input.layers.filter((l) => present.has(l) && !allowed.some((a) => a.startsWith(`${l}>`)));
  const domain = layerOfKind(input, 'domain');
  for (const core of sinks) {
    const coreFiles = input.files.filter((f) => input.layerOf.get(f) === core && !isTest(f));
    if (coreFiles.length === 0) continue;
    const coreSet = new Set(coreFiles);
    const usedElsewhere = new Set(input.packageImports.filter((p) => !coreSet.has(p.file) && !isTest(p.file) && input.layerOf.get(p.file) != null).map((p) => p.pkg));
    const listed: string[] = [];
    const exceptions: RuleException[] = [];
    let minConf = 1;
    for (const pkg of [...usedElsewhere].sort()) {
      const importing = new Set(input.packageImports.filter((p) => p.pkg === pkg && coreSet.has(p.file)).map((p) => p.file));
      if (importing.size / coreFiles.length > CORE_PACKAGE_MAX_SHARE) continue;
      listed.push(pkg);
      minConf = Math.min(minConf, (coreFiles.length - importing.size) / (coreFiles.length + 1));
      for (const f of [...importing].sort()) exceptions.push({ file: f, target: pkg });
    }
    if (listed.length === 0) continue;
    drafts.push({
      kind: 'core-package-free', subject: core, confidence: minConf,
      evidence: { coreFiles: coreFiles.length, packages: listed.length },
      statement: `${core} (a core layer: it may depend on no other layer) imports none of ${listed.join(', ')}`,
      exceptions,
      params: { forbidden_imports: listed },
      ...(core === domain
        ? { compilesTo: { catalogue: 'frozen' as const, template: 'domain-purity', via: 'fitness function FF-P01 (domain-purity) forbidden_imports' } }
        : { compilesTo: null, notRepresentable: `domain-purity checks the domain-kind layer only (${domain ?? 'none'}), not ${core}` }),
    });
  }
}

export interface MineOptions {
  /** Rule kinds whose forbidden pairs are removed from the allowed graph (default: all three layer kinds). */
  readonly forbidKinds?: readonly ('layer-direction' | 'layer-rare-edge' | 'layer-unobserved')[];
}

/** The allowed layer graph: observed pairs minus the pairs a selected layer rule forbids. */
export function allowedGraph(pairs: readonly LayerPairStat[], rules: readonly MinedRule[], kinds: readonly MinedRuleKind[]): string[] {
  const forbidden = new Set(rules.filter((r) => kinds.includes(r.kind)).map((r) => `${r.subject}>${String(r.object)}`));
  return pairs.filter((p) => p.edges > 0 && !forbidden.has(`${p.from}>${p.to}`)).map((p) => `${p.from}>${p.to}`).sort();
}

/** Mines every rule kind from `input`, under the inferred `style` (which decides the compile target). */
export function mineRules(input: MiningInput, style: MiningStyle, opts: MineOptions = {}): MiningResult {
  const pairs = layerPairStats(input);
  const drafts: Draft[] = [];
  mineLayerRules(input, style, pairs, drafts);
  const kinds = opts.forbidKinds ?? ['layer-direction', 'layer-rare-edge', 'layer-unobserved'];
  const asRules = (ds: readonly Draft[], offset: number): MinedRule[] => ds.map((d, i) => ({
    id: `MR-${String(offset + i + 1).padStart(3, '0')}`,
    kind: d.kind, statement: d.statement, subject: d.subject, ...(d.object !== undefined ? { object: d.object } : {}),
    confidence: round(d.confidence), level: levelOf(d.confidence), evidence: d.evidence,
    exceptions: [...d.exceptions].sort((a, b) => (a.file + (a.target ?? '') < b.file + (b.target ?? '') ? -1 : 1)),
    ...(d.params !== undefined ? { params: d.params } : {}),
    compilesTo: d.compilesTo, ...(d.notRepresentable !== undefined ? { notRepresentable: d.notRepresentable } : {}),
  }));
  const layerRules = asRules(drafts, 0);
  const allowed = allowedGraph(pairs, layerRules, kinds);
  const rest: Draft[] = [];
  mineAcyclic(input, style, rest);
  mineComponentRules(input, style, rest);
  minePatternRules(input, style, rest);
  mineCorePackages(input, allowed, rest);
  const layerFiles: Record<string, number> = {};
  for (const f of input.files) {
    const l = input.layerOf.get(f);
    if (l != null) layerFiles[l] = (layerFiles[l] ?? 0) + 1;
  }
  return { style, layers: [...input.layers], layerFiles, pairs, rules: [...layerRules, ...asRules(rest, layerRules.length)], allowed };
}
