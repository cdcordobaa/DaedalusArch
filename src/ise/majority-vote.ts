/**
 * ISE Option 1: majority vote. No style, no preset: over the directory units of the inferred-from graph, every
 * pattern that at least `threshold` (default 60%) of its instances follow is encoded as a rule; the rules are then
 * applied to any later graph and every instance that breaks one is a deviation.
 *
 * Rule kinds (instances in brackets):
 * - direction        [cross-unit import edges of a unit pair]   the majority direction holds; the minority is forbidden
 * - closed-world     [a unit's files]                           a unit imports only the units it imported when mined
 *                                                               (support 1 by construction: the frozen allowlist)
 * - framework-free   [a unit's files]                           no file of the unit imports a framework package
 * - decorator-free   [a unit's classes]                         no class of the unit carries a decorator
 * - acyclic          [files]                                    no file lies on an import cycle
 * - inject-interfaces[cross-unit constructor injections]        an injected cross-unit dependency is an interface
 * - implements-port  [classes named *Repository outside sinks]  such a class implements an interface of another unit
 */
import type { IseGraph } from './graph-view.js';
import { stronglyConnected } from './units.js';
import type { Unit, UnitStructure } from './units.js';
import { FRAMEWORK_PACKAGES } from './vocabulary.js';

export type RuleKind = 'direction' | 'closed-world' | 'framework-free' | 'decorator-free' | 'acyclic' | 'inject-interfaces' | 'implements-port';

export interface RuleCandidate {
  readonly id: string;
  readonly kind: RuleKind;
  readonly statement: string;
  /** Share of instances that follow the pattern. */
  readonly support: number;
  readonly instances: number;
  /** support >= threshold and at least one instance. */
  readonly applies: boolean;
  /** Firewall rules (any style) the candidate corresponds to. */
  readonly mapsTo: readonly string[];
  readonly unit?: string;
  readonly from?: string;
  readonly to?: string;
  /** closed-world: the units the unit may import. */
  readonly allowed?: readonly string[];
  /** implements-port: the core (sink) units, where the rule does not apply. */
  readonly exempt?: readonly string[];
}

export interface Deviation {
  readonly rule: string;
  readonly kind: RuleKind;
  readonly file: string;
  readonly target?: string;
}

export const MAJORITY_THRESHOLD = 0.6;

const isFramework = (pkg: string): boolean => FRAMEWORK_PACKAGES.some((r) => r.test(pkg));

/** The unit of `file` among `units` (directory prefix, direct-only directory, or the file itself). */
export function unitOfPath(file: string, units: readonly Unit[]): string | undefined {
  let best: Unit | undefined;
  for (const u of units) {
    const hit = u.kind === 'file'
      ? file === u.id
      : u.directOnly
        ? file.startsWith(u.id) && !file.slice(u.id.length).includes('/')
        : file.startsWith(u.id);
    if (hit && (best === undefined || u.id.length > best.id.length)) best = u;
  }
  return best?.id;
}

function fileCycles(graph: IseGraph): string[][] {
  return stronglyConnected(graph.files, graph.edges).filter((c) => c.length > 1).map((c) => [...c].sort());
}

/** Mines the rule candidates of `graph` over the units of `structure`. */
export function mineRules(graph: IseGraph, structure: UnitStructure, threshold = MAJORITY_THRESHOLD): RuleCandidate[] {
  const out: RuleCandidate[] = [];
  const unitOf = (f: string): string | undefined => structure.unitOf.get(f);
  const add = (c: Omit<RuleCandidate, 'id' | 'applies'>): void => {
    out.push({ ...c, id: `MV-${String(out.length + 1).padStart(2, '0')}`, applies: c.instances > 0 && c.support >= threshold });
  };
  const cnt = new Map(structure.edges.map((e) => [`${e.from}\n${e.to}`, e.count]));
  const seen = new Set<string>();
  for (const e of structure.edges) {
    const key = [e.from, e.to].sort().join('\n');
    if (seen.has(key)) continue;
    seen.add(key);
    const back = cnt.get(`${e.to}\n${e.from}`) ?? 0;
    const [major, minor, m] = e.count >= back ? [e, { from: e.to, to: e.from }, e.count] : [{ from: e.to, to: e.from }, e, back];
    const n = e.count + back;
    add({ kind: 'direction', statement: `${major.from} -> ${major.to} (${String(m)}/${String(n)} edges); ${minor.from} must not import ${minor.to}`, support: m / n, instances: n, mapsTo: ['FF-S01', 'FF-S04'], from: minor.from, to: minor.to });
  }
  for (const u of structure.units) {
    const targets = [...new Set(structure.edges.filter((e) => e.from === u.id).map((e) => e.to))].sort();
    add({ kind: 'closed-world', statement: `${u.id} imports only ${targets.length === 0 ? 'no other unit' : targets.join(', ')}`, support: 1, instances: u.files.length, mapsTo: ['FF-S01', 'FF-S03'], unit: u.id, allowed: targets });
    const free = u.files.filter((f) => !graph.packageImports.some((p) => p.file === f && isFramework(p.pkg))).length;
    add({ kind: 'framework-free', statement: `${String(free)}/${String(u.files.length)} files of ${u.id} import no framework package`, support: free / u.files.length, instances: u.files.length, mapsTo: ['FF-P01', 'FF-DT04'], unit: u.id });
    const classes = graph.declarations.filter((d) => d.kind === 'class' && unitOf(d.file) === u.id);
    const plain = classes.filter((c) => c.decorators.length === 0).length;
    if (classes.length > 0) add({ kind: 'decorator-free', statement: `${String(plain)}/${String(classes.length)} classes of ${u.id} carry no decorator`, support: plain / classes.length, instances: classes.length, mapsTo: ['FF-P01'], unit: u.id });
  }
  const onCycle = new Set(fileCycles(graph).flat());
  add({ kind: 'acyclic', statement: `${String(graph.files.length - onCycle.size)}/${String(graph.files.length)} files lie on no import cycle`, support: graph.files.length === 0 ? 1 : (graph.files.length - onCycle.size) / graph.files.length, instances: graph.files.length, mapsTo: ['FF-S02'] });
  const injects = graph.typeEdges.filter((e) => e.kind === 'injects' && unitOf(e.from.file) !== unitOf(e.to.file));
  const toIface = injects.filter((e) => e.to.kind === 'interface').length;
  if (injects.length > 0) add({ kind: 'inject-interfaces', statement: `${String(toIface)}/${String(injects.length)} cross-unit constructor injections target an interface`, support: toIface / injects.length, instances: injects.length, mapsTo: ['FF-P02'] });
  const sinks = new Set(structure.units.filter((u) => (structure.level.get(u.id) ?? 0) === 0).map((u) => u.id));
  const repos = graph.declarations.filter((d) => d.kind === 'class' && d.name.endsWith("Repository") && !sinks.has(unitOf(d.file) ?? ''));
  const implemented = repos.filter((r) => implementsForeign(graph, r.name, r.file, unitOf)).length;
  if (repos.length > 0) add({ kind: 'implements-port', statement: `${String(implemented)}/${String(repos.length)} *Repository classes outside the core implement an interface of another unit`, support: implemented / repos.length, instances: repos.length, mapsTo: ['FF-P03'], exempt: [...sinks].sort() });
  return out;
}

function implementsForeign(graph: IseGraph, name: string, file: string, unitOf: (f: string) => string | undefined): boolean {
  return graph.typeEdges.some((e) => e.kind === 'implements' && e.from.name === name && e.from.file === file && unitOf(e.to.file) !== unitOf(file));
}

/** Deviations of `graph` from the applying `rules`; units are resolved against `units` (the mined structure's). */
export function applyRules(rules: readonly RuleCandidate[], graph: IseGraph, units: readonly Unit[]): Deviation[] {
  const unitOf = (f: string): string | undefined => unitOfPath(f, units);
  const out: Deviation[] = [];
  for (const r of rules.filter((x) => x.applies)) {
    switch (r.kind) {
      case 'direction':
        for (const e of graph.edges) if (unitOf(e.from) === r.from && unitOf(e.to) === r.to) out.push({ rule: r.id, kind: r.kind, file: e.from, target: e.to });
        break;
      case 'closed-world':
        for (const e of graph.edges) {
          const a = unitOf(e.from);
          const b = unitOf(e.to);
          if (a === r.unit && b !== undefined && b !== a && !(r.allowed ?? []).includes(b)) out.push({ rule: r.id, kind: r.kind, file: e.from, target: e.to });
        }
        break;
      case 'framework-free':
        for (const p of graph.packageImports) if (unitOf(p.file) === r.unit && isFramework(p.pkg)) out.push({ rule: r.id, kind: r.kind, file: p.file, target: p.pkg });
        break;
      case 'decorator-free':
        for (const d of graph.declarations) if (d.kind === 'class' && unitOf(d.file) === r.unit && d.decorators.length > 0) out.push({ rule: r.id, kind: r.kind, file: d.file, target: d.name });
        break;
      case 'acyclic':
        for (const c of fileCycles(graph)) out.push({ rule: r.id, kind: r.kind, file: c.join(',') });
        break;
      case 'inject-interfaces':
        for (const e of graph.typeEdges) {
          if (e.kind === 'injects' && e.to.kind === 'class' && unitOf(e.from.file) !== unitOf(e.to.file)) out.push({ rule: r.id, kind: r.kind, file: e.from.file, target: e.to.file });
        }
        break;
      case 'implements-port': {
        const sinkUnits = new Set(r.exempt ?? []);
        for (const d of graph.declarations) {
          if (d.kind !== 'class' || !d.name.endsWith("Repository") || sinkUnits.has(unitOf(d.file) ?? '')) continue;
          if (!implementsForeign(graph, d.name, d.file, unitOf)) out.push({ rule: r.id, kind: r.kind, file: d.file, target: d.name });
        }
        break;
      }
    }
  }
  return out;
}

/** Deviations of `now` that `before` (the mined project's own deviations) does not have. */
export function newDeviations(now: readonly Deviation[], before: readonly Deviation[]): Deviation[] {
  const k = (d: Deviation): string => `${d.rule}|${d.file}|${d.target ?? ''}`;
  const old = new Set(before.map(k));
  return now.filter((d) => !old.has(k(d)));
}
