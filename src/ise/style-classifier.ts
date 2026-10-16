/**
 * ISE Option 2, step 1: classify the architectural style a project attempts.
 *
 * Evidence comes from the source snapshot's paths and its in-memory APG only: layer-like directory tokens, the
 * NestJS suffix vocabulary and decorators, the ports/adapters vocabulary, bounded-context-like top-level folders with
 * their own domain/application/infrastructure, and edge-direction statistics between directory units (dependency
 * inversion across units, chain depth, sibling outer units, a composition root). Each style collects points; the
 * confidence of a style is its share of all points. The point values were fixed before the reference set was run.
 */
import { boundedContexts, detectContexts } from './contexts.js';
import type { IseGraph } from './graph-view.js';
import { isLateral, unitStructure } from './units.js';
import type { UnitStructure } from './units.js';
import { NEST_DECORATORS, NEST_FILE_SUFFIX, STYLE_TOKENS, normaliseToken } from './vocabulary.js';

export { boundedContexts };

export const ISE_STYLES = ['clean-architecture', 'layered', 'hexagonal', 'nestjs', 'ddd'] as const;
export type IseStyle = (typeof ISE_STYLES)[number];

export interface StyleScore {
  readonly style: IseStyle;
  readonly points: number;
  readonly confidence: number;
  readonly evidence: readonly string[];
}

export interface StyleFeatures {
  readonly sourceRoot: string;
  readonly topTokens: readonly string[];
  readonly deepTokens: readonly string[];
  readonly nestDecoratedClasses: number;
  readonly nestModuleClasses: number;
  readonly classes: number;
  readonly nestSuffixFiles: number;
  /** Bounded-context folders: repeated internal layering (`contexts.ts`), united with the vocabulary detection. */
  readonly contexts: readonly string[];
  /** Cross-unit IMPLEMENTS edges, and those whose interface sits in a lower-level (inner) unit. */
  readonly crossImplements: number;
  readonly inwardImplements: number;
  readonly maxLevel: number;
  /** Units that no unit imports and that import at least two others. */
  readonly compositionRoots: readonly string[];
  /** Pairs of non-root units at the same level >= 1 with no edge between them (sibling outer units). */
  readonly siblingOuterPairs: number;
  /**
   * Outer units (level >= 1, imported by no unit but composition roots) by adapter direction: outbound ones implement
   * an interface owned by a lower-level unit (a driven port); inbound ones implement none and call inward.
   */
  readonly inboundAdapters: readonly string[];
  readonly outboundAdapters: readonly string[];
  /** Interfaces owned and implemented inside the core (non-outer units) that an inbound adapter imports (driving ports). */
  readonly drivingPorts: number;
}

const has = (tokens: readonly string[], list: readonly string[]): boolean => tokens.some((t) => list.includes(t));

function dirTokens(files: readonly string[], sourceRoot: string): { top: Set<string>; deep: Set<string> } {
  const top = new Set<string>();
  const deep = new Set<string>();
  for (const f of files) {
    const segs = f.slice(sourceRoot.length).split('/').slice(0, -1);
    segs.forEach((s, i) => (i === 0 ? top : deep).add(normaliseToken(s)));
  }
  return { top, deep };
}

export function styleFeatures(graph: IseGraph, structure: UnitStructure = unitStructure(graph)): StyleFeatures {
  const { sourceRoot, level, unitOf } = structure;
  const { top, deep } = dirTokens(graph.files, sourceRoot);
  const classes = graph.declarations.filter((d) => d.kind === 'class');
  const nestDecorated = classes.filter((c) => c.decorators.some((d) => NEST_DECORATORS.includes(d)));
  let crossImplements = 0;
  let inwardImplements = 0;
  for (const e of graph.typeEdges) {
    if (e.kind !== 'implements') continue;
    const a = unitOf.get(e.from.file);
    const b = unitOf.get(e.to.file);
    if (a === undefined || b === undefined || a === b) continue;
    crossImplements += 1;
    if ((level.get(b) ?? 0) < (level.get(a) ?? 0)) inwardImplements += 1;
  }
  const outCount = new Map<string, number>();
  for (const e of structure.edges) outCount.set(e.from, (outCount.get(e.from) ?? 0) + 1);
  const compositionRoots = structure.roots.filter((r) => (outCount.get(r) ?? 0) >= 2);
  const groupOf = new Map(structure.units.map((u) => [u.id, u.group]));
  const ordered = structure.edges.filter((e) => !isLateral(groupOf, e));
  const linked = new Set(ordered.flatMap((e) => [`${e.from}\n${e.to}`, `${e.to}\n${e.from}`]));
  const inner = structure.units.filter((u) => !compositionRoots.includes(u.id) && (level.get(u.id) ?? 0) >= 1);
  let siblingOuterPairs = 0;
  for (let i = 0; i < inner.length; i += 1) {
    for (let j = i + 1; j < inner.length; j += 1) {
      const a = inner[i];
      const b = inner[j];
      if (a === undefined || b === undefined) continue;
      if (level.get(a.id) === level.get(b.id) && !linked.has(`${a.id}\n${b.id}`)) siblingOuterPairs += 1;
    }
  }
  const outer = structure.units.filter(
    (u) => !structure.roots.includes(u.id) && (level.get(u.id) ?? 0) >= 1 && !ordered.some((e) => e.to === u.id && !structure.roots.includes(e.from)),
  );
  const outerIds = new Set(outer.map((u) => u.id));
  const implementsInner = (unit: string): boolean =>
    graph.typeEdges.some((e) => {
      if (e.kind !== 'implements' || unitOf.get(e.from.file) !== unit) return false;
      const owner = unitOf.get(e.to.file);
      return owner !== undefined && owner !== unit && (level.get(owner) ?? 0) < (level.get(unit) ?? 0);
    });
  const outboundAdapters = outer.filter((u) => implementsInner(u.id)).map((u) => u.id);
  const inboundAdapters = outer.filter((u) => !implementsInner(u.id) && structure.edges.some((e) => e.from === u.id)).map((u) => u.id);
  const coreUnit = (f: string): boolean => {
    const u = unitOf.get(f);
    return u !== undefined && !outerIds.has(u) && !structure.roots.includes(u);
  };
  const drivingPorts = new Set<string>();
  for (const e of graph.typeEdges) {
    if (e.kind !== 'implements' || e.to.kind !== 'interface' || !coreUnit(e.from.file) || !coreUnit(e.to.file)) continue;
    if (graph.edges.some((x) => x.to === e.to.file && inboundAdapters.includes(unitOf.get(x.from) ?? ''))) drivingPorts.add(`${e.to.file}#${e.to.name}`);
  }
  return {
    sourceRoot,
    topTokens: [...top].sort(),
    deepTokens: [...deep].sort(),
    nestDecoratedClasses: nestDecorated.length,
    nestModuleClasses: nestDecorated.filter((c) => c.decorators.includes('Module')).length,
    classes: classes.length,
    nestSuffixFiles: graph.files.filter((f) => NEST_FILE_SUFFIX.test(f)).length,
    contexts: detectContexts(graph).contexts.map((c) => c.root),
    crossImplements,
    inwardImplements,
    maxLevel: Math.max(0, ...[...level.entries()].filter(([u]) => !compositionRoots.includes(u)).map(([, l]) => l)),
    compositionRoots,
    siblingOuterPairs,
    inboundAdapters,
    outboundAdapters,
    drivingPorts: drivingPorts.size,
  };
}

/** Points per style from the features (see the file comment). */
export function scoreStyles(f: StyleFeatures): StyleScore[] {
  const pts: Record<IseStyle, { points: number; evidence: string[] }> = {
    'clean-architecture': { points: 0, evidence: [] },
    layered: { points: 0, evidence: [] },
    hexagonal: { points: 0, evidence: [] },
    nestjs: { points: 0, evidence: [] },
    ddd: { points: 0, evidence: [] },
  };
  const give = (s: IseStyle, p: number, why: string): void => {
    pts[s].points += p;
    pts[s].evidence.push(`+${String(p)} ${why}`);
  };
  const T = f.topTokens;
  const dip = f.crossImplements >= 2 && f.inwardImplements / f.crossImplements >= 0.6;

  // Clean Architecture
  const cCore = has(T, STYLE_TOKENS.cleanCore);
  const cApp = has(T, STYLE_TOKENS.cleanApplication);
  const cInfra = has(T, STYLE_TOKENS.cleanInfrastructure);
  if (cCore && cApp && cInfra) give('clean-architecture', 3, 'top-level domain + application + infrastructure directories');
  if (cCore) give('clean-architecture', 1, 'top-level core/domain directory');
  if (cApp) give('clean-architecture', 1, 'top-level application/use-case directory');
  if (cInfra) give('clean-architecture', 1, 'top-level infrastructure directory');
  if (has([...T, ...f.deepTokens], STYLE_TOKENS.useCases)) give('clean-architecture', 1, 'use-case directory');
  if (dip && f.siblingOuterPairs === 0) {
    give('clean-architecture', 2, `dependency inversion: ${String(f.inwardImplements)}/${String(f.crossImplements)} cross-unit implements point inward, one outer ring`);
  }

  // Layered
  const lP = has(T, STYLE_TOKENS.layeredPresentation);
  const lB = has(T, STYLE_TOKENS.layeredBusiness);
  const lD = has(T, STYLE_TOKENS.layeredPersistence);
  if (lP && lB && lD) give('layered', 3, 'top-level presentation + business + persistence directories');
  if (lP) give('layered', 1, 'top-level presentation directory');
  if (lB) give('layered', 1, 'top-level business directory');
  if (lD) give('layered', 1, 'top-level persistence/data directory');
  if (!dip && f.maxLevel >= 2 && f.nestModuleClasses === 0 && f.contexts.length < 2) {
    give('layered', 2, `a chain of ${String(f.maxLevel + 1)} unit levels without dependency inversion`);
  }

  // Hexagonal
  if (has(T, STYLE_TOKENS.hexAdapters)) give('hexagonal', 3, 'top-level adapters directory');
  if (has(f.deepTokens, STYLE_TOKENS.hexDirections)) give('hexagonal', 2, 'inbound/outbound (driving/driven) adapter directories');
  if (has([...T, ...f.deepTokens], STYLE_TOKENS.hexPorts) && has(f.deepTokens, STYLE_TOKENS.hexPortDirections)) give('hexagonal', 1, 'ports split by direction');
  if (has(T, STYLE_TOKENS.composition)) give('hexagonal', 1, 'top-level composition-root directory');
  if (dip && f.inboundAdapters.length >= 1 && f.outboundAdapters.length >= 1 && f.siblingOuterPairs >= 1 && f.compositionRoots.length >= 1) {
    give('hexagonal', 2, `dependency inversion with separate inbound (${f.inboundAdapters.join(', ')}) and outbound (${f.outboundAdapters.join(', ')}) adapter units and a composition root`);
  }
  if (f.drivingPorts >= 1 && f.outboundAdapters.length >= 1) {
    give('hexagonal', 1, `${String(f.drivingPorts)} driving port(s): core-owned interfaces implemented in the core and called by an inbound adapter`);
  }

  // NestJS
  if (f.nestModuleClasses >= 1) give('nestjs', 3, `${String(f.nestModuleClasses)} @Module classes`);
  if (f.classes > 0 && f.nestDecoratedClasses / f.classes >= 0.3) give('nestjs', 2, `${String(f.nestDecoratedClasses)}/${String(f.classes)} classes carry NestJS decorators`);
  if (f.nestSuffixFiles >= 3) give('nestjs', 1, `${String(f.nestSuffixFiles)} files with NestJS dot suffixes`);

  // DDD
  if (f.contexts.length >= 2) give('ddd', 4, `${String(f.contexts.length)} bounded-context-like folders (${f.contexts.join(', ')}) each with its own domain layer`);
  else if (f.contexts.length === 1) give('ddd', 1, `one bounded-context-like folder (${f.contexts.join(', ')})`);
  if (has(T, STYLE_TOKENS.dddSharedKernel) && f.contexts.length >= 1) give('ddd', 1, 'shared kernel next to the contexts');
  if (has(f.deepTokens, STYLE_TOKENS.dddBoundary) && f.contexts.length >= 1) give('ddd', 1, 'context boundary directories (acl / contracts)');

  const total = Object.values(pts).reduce((s, p) => s + p.points, 0);
  return ISE_STYLES.map((style) => ({
    style,
    points: pts[style].points,
    confidence: total === 0 ? 1 / ISE_STYLES.length : pts[style].points / total,
    evidence: pts[style].evidence,
  })).sort((a, b) => b.points - a.points || ISE_STYLES.indexOf(a.style) - ISE_STYLES.indexOf(b.style));
}

export interface StyleClassification {
  readonly ranked: readonly StyleScore[];
  readonly best: IseStyle;
  readonly features: StyleFeatures;
}

export function classifyStyle(graph: IseGraph): StyleClassification {
  const features = styleFeatures(graph);
  const ranked = scoreStyles(features);
  return { ranked, best: ranked[0]?.style ?? 'clean-architecture', features };
}
