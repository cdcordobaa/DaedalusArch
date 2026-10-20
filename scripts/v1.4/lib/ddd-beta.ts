/**
 * DDD beta capability study (v1.4 DDD-BETA; `Docs/DiagnosticRuns/v1.4-ddd-beta-capability-2026-10-19.md`). Pure
 * helpers of `scripts/v1.4/ddd-beta-capability.ts`. DEVELOPMENT DATA ONLY: no pre-registration, zero model calls.
 *
 * - `conceptMap`: per DDD concept the spec declares (`architecture.ddd`), which project files the declaration matches
 *   and which classes those files declare, so a declaration that names no code is visible.
 * - `grainCensus`: how the project's own DDD building blocks are laid out (one class per file or several), and where
 *   the non-root entity classes of each declared aggregate sit (own file declared as inner entity, own file
 *   undeclared, or inside another class's file). The DDD rules read files; this is what they cannot see.
 * - `shadowClassGrainDt01`: a measurement, not a rule: imports from outside an aggregate's module that name a non-root
 *   entity class or type of that module (error classes left out). It is what a class-grain FF-DT01 would have to look at; nothing in the tool uses it.
 * - `rulePreconditions`: whether each DDD blocking rule has the files its template needs (a precondition, as in
 *   `scripts/v1.4/ddd-b2-rule-reach.ts`, extended to the post-seal FF-S02 and FF-P07).
 * - `summariseByRule`: seeded recall per rule at expected-key grain, twin false fires per rule, Wilson 95 % intervals.
 */
import { globToRegex } from '../../../src/fitness-compiler/glob-to-regex.js';
import { wilson } from '../../lib/stats.js';

/** The DDD blocking rules the study covers, in report order (sealed set, then the post-seal overlay). */
export const DDD_BLOCKING_RULES: readonly string[] = Object.freeze(['FF-DS01', 'FF-DS02', 'FF-DT01', 'FF-DT02', 'FF-DT03', 'FF-DT04', 'FF-S01', 'FF-S02', 'FF-P07']);

/** One class as the census sees it: its name, its direct base class and interfaces (identifiers, generics stripped). */
export interface ClassFact {
  readonly name: string;
  readonly extends: string | null;
  readonly implements: readonly string[];
}

/** One import declaration resolved to a project file, with the names it binds (named, and `default` for a default import). */
export interface ImportFact {
  readonly target: string;
  readonly names: readonly string[];
}

export interface FileFact {
  readonly file: string;
  readonly classes: readonly ClassFact[];
  readonly imports: readonly ImportFact[];
  /** Interfaces and type aliases the file declares (not graph nodes for type aliases; agent code models entities so). */
  readonly types?: readonly string[];
}

export interface LayerDecl {
  readonly name: string;
  readonly kind: string | null;
  readonly directories: readonly string[];
  readonly roles: readonly string[];
}

export interface AggregateDecl {
  readonly name: string;
  readonly context: string;
  readonly module: string;
  readonly root: string;
  readonly inner_entities: readonly string[];
}

export interface DddDecl {
  readonly source_root: string;
  readonly contexts: readonly { readonly name: string; readonly root: string; readonly public_api?: readonly string[]; readonly acl?: readonly string[] }[];
  readonly outside_contexts?: readonly string[];
  readonly aggregates?: readonly AggregateDecl[];
  readonly value_objects?: readonly string[];
  readonly repositories?: readonly string[];
  readonly domain_event_types?: readonly string[];
  readonly application_services?: readonly string[];
}

export interface SpecDecl {
  readonly layers: readonly LayerDecl[];
  readonly allowed: ReadonlyMap<string, readonly string[]>;
  readonly ddd: DddDecl;
}

const rxCache = new Map<string, RegExp>();
/** The glob semantics of the DDD binding (`ddd-templates.ts` `rx`: `segmentGlobstar`). */
export function globMatches(glob: string, file: string): boolean {
  let re = rxCache.get(glob);
  if (re === undefined) {
    re = new RegExp(globToRegex(glob, { segmentGlobstar: true }));
    rxCache.set(glob, re);
  }
  return re.test(file);
}

const anyGlob = (globs: readonly string[], file: string): boolean => globs.some((g) => globMatches(g, file));

/** The first layer whose directories match (declaration order, as the extractor's first-match rule). */
export function layerOf(spec: SpecDecl, file: string): LayerDecl | undefined {
  return spec.layers.find((l) => anyGlob(l.directories, file));
}

function isComposition(l: LayerDecl): boolean {
  return l.roles.includes('composition-root') || l.name === 'composition';
}

// ── A. Concept map ──────────────────────────────────────────────────────────

export interface ConceptRow {
  /** Concept name (bounded context, aggregate root, inner entity, ...). */
  readonly concept: string;
  /** The declaration (context or aggregate name, or `*` for a project-wide glob list). */
  readonly item: string;
  readonly globs: readonly string[];
  readonly files: number;
  readonly classes: number;
  /** Declared, and matches at least one file that declares a class (or, for contexts and globs of folders, a file). */
  readonly mapsToCode: boolean;
  readonly note?: string;
}

/** Names of every class reachable from `name` through `extends`/`implements` inside the project (by simple name). */
function ancestors(name: string, byName: ReadonlyMap<string, readonly ClassFact[]>): Set<string> {
  const out = new Set<string>();
  const stack = [name];
  for (let n = stack.pop(); n !== undefined; n = stack.pop()) {
    for (const c of byName.get(n) ?? []) {
      for (const p of [c.extends, ...c.implements]) {
        if (p !== null && !out.has(p)) {
          out.add(p);
          stack.push(p);
        }
      }
    }
  }
  return out;
}

export function classIndex(facts: readonly FileFact[]): Map<string, ClassFact[]> {
  const byName = new Map<string, ClassFact[]>();
  for (const f of facts) for (const c of f.classes) byName.set(c.name, [...(byName.get(c.name) ?? []), c]);
  return byName;
}

export function conceptMap(spec: SpecDecl, facts: readonly FileFact[]): ConceptRow[] {
  const files = facts.map((f) => f.file);
  const classesIn = (fs: readonly string[]): number => facts.filter((f) => fs.includes(f.file)).reduce((a, f) => a + f.classes.length, 0);
  const rows: ConceptRow[] = [];
  const add = (concept: string, item: string, globs: readonly string[], needClass: boolean, note?: string): void => {
    const m = files.filter((f) => anyGlob(globs, f));
    const classes = classesIn(m);
    rows.push({ concept, item, globs, files: m.length, classes, mapsToCode: m.length > 0 && (!needClass || classes > 0), ...(note !== undefined ? { note } : {}) });
  };
  const { ddd } = spec;
  for (const c of ddd.contexts) {
    const m = files.filter((f) => f.startsWith(c.root));
    rows.push({ concept: 'bounded context', item: c.name, globs: [c.root], files: m.length, classes: classesIn(m), mapsToCode: m.length > 0 });
    add('published interface (public_api)', c.name, c.public_api ?? [], false, (c.public_api ?? []).length === 0 ? 'none declared' : undefined);
    add('anti-corruption layer (acl)', c.name, c.acl ?? [], false, (c.acl ?? []).length === 0 ? 'none declared' : undefined);
  }
  add('outside contexts (shared kernel, composition, other)', '*', ddd.outside_contexts ?? [], false, (ddd.outside_contexts ?? []).length === 0 ? 'none declared' : undefined);
  for (const a of ddd.aggregates ?? []) {
    add('aggregate module', a.name, [a.module], true);
    const rootFiles = files.filter((f) => globMatches(a.root, f));
    const rootClasses = facts.filter((f) => rootFiles.includes(f.file)).flatMap((f) => f.classes.map((c) => c.name));
    rows.push({
      concept: 'aggregate root', item: a.name, globs: [a.root], files: rootFiles.length, classes: rootClasses.length,
      mapsToCode: rootClasses.length > 0,
      note: rootClasses.length === 0 ? 'root glob names no class' : rootClasses.includes(a.name) ? `class ${a.name} found` : `classes ${rootClasses.join(', ')}`,
    });
    if (a.inner_entities.length > 0) add('inner entity', a.name, a.inner_entities, true);
    else rows.push({ concept: 'inner entity', item: a.name, globs: [], files: 0, classes: 0, mapsToCode: false, note: 'none declared' });
  }
  add('value object', '*', ddd.value_objects ?? [], true);
  add('repository', '*', ddd.repositories ?? [], false);
  add('application service', '*', ddd.application_services ?? [], false);
  const byName = classIndex(facts);
  const eventTypes = ddd.domain_event_types ?? [];
  let events = 0;
  const eventFiles = new Set<string>();
  for (const f of facts) {
    for (const c of f.classes) {
      if (eventTypes.includes(c.name)) continue;
      const anc = ancestors(c.name, byName);
      if (eventTypes.some((t) => anc.has(t))) {
        events++;
        eventFiles.add(f.file);
      }
    }
  }
  rows.push({ concept: 'domain event (by type)', item: eventTypes.join(', ') || '(none)', globs: [], files: eventFiles.size, classes: events, mapsToCode: events > 0, note: 'class grain: classes extending or implementing a declared event type' });
  return rows;
}

// ── A. Grain census ─────────────────────────────────────────────────────────

export interface GrainCensus {
  /** Files in a domain-kind layer, the classes they declare, and the files that declare two or more classes. */
  readonly domainFiles: number;
  readonly domainClasses: number;
  readonly domainMultiClassFiles: number;
  /** Share of domain classes that sit in a file with another class. */
  readonly domainClassesSharingFile: number;
  /** Classes whose ancestry names an entity or aggregate base (`*Entity*`, `*AggregateRoot*`, `*Aggregate*`). */
  readonly entityClasses: number;
  readonly entityClassesSharingFile: number;
  readonly perAggregate: readonly AggregateGrain[];
}

export interface AggregateGrain {
  readonly aggregate: string;
  readonly rootClasses: readonly string[];
  /** Classes declared in the root file besides the root class. */
  readonly classesInRootFile: readonly string[];
  /** Interfaces and type aliases declared in the root file besides the root, ports and services left out. */
  readonly typesInRootFile: readonly string[];
  /** Non-root, non-value-object classes of the module, by where they sit. */
  readonly innerInDeclaredFile: readonly string[];
  readonly innerInOwnUndeclaredFile: readonly string[];
  readonly innerInSharedFile: readonly string[];
}

const ENTITY_BASE = /(AggregateRoot|Aggregate|Entity)/;
const PORT_LIKE = /(Repository|Repo|Port|Directory|Verifier|Registry|Service|Gateway|Props|Dto|DTO)$/;

export function grainCensus(spec: SpecDecl, facts: readonly FileFact[]): GrainCensus {
  const domain = facts.filter((f) => layerOf(spec, f.file)?.kind === 'domain');
  const domainClasses = domain.reduce((a, f) => a + f.classes.length, 0);
  const multi = domain.filter((f) => f.classes.length >= 2);
  const byName = classIndex(facts);
  let entities = 0;
  let entitiesShared = 0;
  for (const f of facts) {
    for (const c of f.classes) {
      const anc = [...ancestors(c.name, byName)];
      if (anc.some((n) => ENTITY_BASE.test(n))) {
        entities++;
        if (f.classes.length >= 2) entitiesShared++;
      }
    }
  }
  const vo = spec.ddd.value_objects ?? [];
  const perAggregate: AggregateGrain[] = (spec.ddd.aggregates ?? []).map((a) => {
    const moduleFiles = facts.filter((f) => globMatches(a.module, f.file) && !anyGlob(vo, f.file));
    const rootFacts = moduleFiles.filter((f) => globMatches(a.root, f.file));
    const rootClasses = rootFacts.flatMap((f) => f.classes.map((c) => c.name));
    const rootTypes = rootFacts.flatMap((f) => [...(f.types ?? [])]);
    const rootName = rootClasses.includes(a.name) || rootTypes.includes(a.name) ? a.name : rootClasses[0];
    const classesInRootFile = rootClasses.filter((n) => n !== rootName);
    const typesInRootFile = rootTypes.filter((n) => n !== rootName && !PORT_LIKE.test(n));
    const innerDeclared: string[] = [];
    const innerOwn: string[] = [];
    const innerShared: string[] = [];
    for (const f of moduleFiles) {
      if (globMatches(a.root, f.file)) {
        innerShared.push(...f.classes.map((c) => c.name).filter((n) => n !== rootName));
        continue;
      }
      // Only entity-like classes count (an entity/aggregate base, or no base at all and not an error/event/service).
      const entityLike = f.classes.filter((c) => {
        const anc = [...ancestors(c.name, byName)];
        if (anc.some((n) => ENTITY_BASE.test(n))) return true;
        return c.extends === null && !/(Error|Exception|Event|Service|Repository|Factory|Policy|Spec|Specification|Mapper|Dto|DTO)$/.test(c.name);
      });
      for (const c of entityLike) {
        if (anyGlob(a.inner_entities, f.file)) innerDeclared.push(c.name);
        else if (f.classes.length === 1) innerOwn.push(c.name);
        else innerShared.push(c.name);
      }
    }
    return { aggregate: a.name, rootClasses, classesInRootFile, typesInRootFile, innerInDeclaredFile: innerDeclared, innerInOwnUndeclaredFile: innerOwn, innerInSharedFile: innerShared };
  });
  return {
    domainFiles: domain.length, domainClasses, domainMultiClassFiles: multi.length,
    domainClassesSharingFile: multi.reduce((a, f) => a + f.classes.length, 0),
    entityClasses: entities, entityClassesSharingFile: entitiesShared, perAggregate,
  };
}

/**
 * Shadow class-grain FF-DT01 (a measurement for §C, not a rule): an import from a file outside an aggregate's module
 * into a module file, that binds the name of a non-root class the census places inside the aggregate (declared inner
 * entity file, undeclared own file, or the root's file). One row per (source, target, name).
 */
export function shadowClassGrainDt01(spec: SpecDecl, facts: readonly FileFact[], grain: GrainCensus): { aggregate: string; source: string; target: string; name: string }[] {
  const out: { aggregate: string; source: string; target: string; name: string }[] = [];
  for (const a of spec.ddd.aggregates ?? []) {
    const g = grain.perAggregate.find((x) => x.aggregate === a.name);
    if (g === undefined) continue;
    const inner = new Set([...g.innerInDeclaredFile, ...g.innerInOwnUndeclaredFile, ...g.innerInSharedFile, ...g.typesInRootFile]);
    if (inner.size === 0) continue;
    for (const f of facts) {
      if (globMatches(a.module, f.file)) continue;
      for (const i of f.imports) {
        if (!globMatches(a.module, i.target)) continue;
        for (const n of i.names) if (inner.has(n) && !/(Error|Exception)$/.test(n)) out.push({ aggregate: a.name, source: f.file, target: i.target, name: n });
      }
    }
  }
  return out;
}

// ── B. Rule preconditions ───────────────────────────────────────────────────

export interface Preconditions {
  readonly rule: string;
  readonly holds: boolean;
  readonly why: string;
}

const TEST_FILE = /(^|\/)(__tests__|tests?)\/|\.(spec|test)\.ts$/;

export function rulePreconditions(spec: SpecDecl, facts: readonly FileFact[]): Preconditions[] {
  const files = facts.map((f) => f.file);
  const { ddd } = spec;
  const inSource = files.filter((f) => f.startsWith(ddd.source_root));
  const ctxWithFiles = ddd.contexts.filter((c) => files.some((f) => f.startsWith(c.root))).length;
  const innerFiles = files.filter((f) => (ddd.aggregates ?? []).some((a) => anyGlob(a.inner_entities, f)));
  const repoFiles = files.filter((f) => anyGlob(ddd.repositories ?? [], f));
  const voClasses = facts.filter((f) => anyGlob(ddd.value_objects ?? [], f.file)).reduce((a, f) => a + f.classes.length, 0);
  const layered = new Map<string, number>();
  for (const f of files) {
    const l = layerOf(spec, f);
    if (l !== undefined) layered.set(l.name, (layered.get(l.name) ?? 0) + 1);
  }
  const domainFiles = files.filter((f) => layerOf(spec, f)?.kind === 'domain').length;
  const appFiles = files.filter((f) => {
    const l = layerOf(spec, f);
    return l?.kind === 'application' && !isComposition(l) && !TEST_FILE.test(f);
  }).length;
  const nonEmpty = spec.layers.filter((l) => (layered.get(l.name) ?? 0) > 0);
  let forbiddenPairs = 0;
  for (const a of nonEmpty) for (const b of nonEmpty) if (a.name !== b.name && !(spec.allowed.get(a.name) ?? []).includes(b.name)) forbiddenPairs++;
  return [
    { rule: 'FF-DS01', holds: inSource.length > 0, why: `${String(inSource.length)} files under source_root` },
    { rule: 'FF-DS02', holds: ctxWithFiles >= 2, why: `${String(ctxWithFiles)} contexts with files` },
    { rule: 'FF-DT01', holds: innerFiles.length > 0, why: `${String(innerFiles.length)} files match an inner-entity glob` },
    { rule: 'FF-DT02', holds: innerFiles.length > 0 && repoFiles.length > 0, why: `${String(innerFiles.length)} inner-entity files, ${String(repoFiles.length)} repository files` },
    { rule: 'FF-DT03', holds: voClasses > 0, why: `${String(voClasses)} classes in value-object files` },
    { rule: 'FF-DT04', holds: domainFiles > 0, why: `${String(domainFiles)} domain-layer files` },
    { rule: 'FF-S01', holds: forbiddenPairs > 0, why: `${String(nonEmpty.length)} non-empty layers, ${String(forbiddenPairs)} forbidden ordered layer pairs` },
    { rule: 'FF-S02', holds: files.length >= 2, why: `${String(files.length)} files (a cycle needs two)` },
    { rule: 'FF-P07', holds: appFiles > 0, why: `${String(appFiles)} application-layer files outside composition roots and tests` },
  ];
}

// ── B. Seeded recall by rule ────────────────────────────────────────────────

export interface KeyRow {
  readonly baseId: string;
  readonly baseKind: string;
  readonly operatorId: string;
  readonly positiveId: string;
  readonly role: 'positive' | 'twin';
  readonly status: string;
  readonly expected: readonly { readonly functionId: string }[];
  readonly hits: readonly boolean[];
  readonly newBlocking: readonly { readonly functionId: string }[];
}

export interface RuleRecall {
  readonly rule: string;
  readonly baseKind: string;
  readonly bases: number;
  readonly basesDetected: number;
  readonly keys: number;
  readonly hits: number;
  readonly rate: number | null;
  readonly low: number | null;
  readonly high: number | null;
  readonly operators: readonly string[];
}

/**
 * Per rule (expected-key grain): over evaluated positive rows that carry a key for the rule, how many keys were
 * matched; per base kind and pooled (`*`). Rows that did not reach evaluation (type-check, apply error) carry no
 * evaluated key and are left out, as in the U10 run.
 */
export function summariseByRule(rows: readonly KeyRow[], rules: readonly string[] = DDD_BLOCKING_RULES): RuleRecall[] {
  const out: RuleRecall[] = [];
  const kinds = ['*', ...new Set(rows.map((r) => r.baseKind))].sort();
  for (const rule of rules) {
    for (const kind of kinds) {
      let keys = 0;
      let hits = 0;
      const bases = new Set<string>();
      const detected = new Set<string>();
      const ops = new Set<string>();
      for (const r of rows) {
        if (r.role !== 'positive' || (kind !== '*' && r.baseKind !== kind)) continue;
        if (r.status !== 'detected' && r.status !== 'missed') continue;
        r.expected.forEach((k, i) => {
          if (k.functionId !== rule) return;
          keys++;
          bases.add(r.baseId);
          ops.add(r.positiveId);
          if (r.hits[i] === true) {
            hits++;
            detected.add(r.baseId);
          }
        });
      }
      const w = keys > 0 ? wilson(hits, keys) : null;
      out.push({ rule, baseKind: kind, bases: bases.size, basesDetected: detected.size, keys, hits, rate: keys > 0 ? hits / keys : null, low: w?.low ?? null, high: w?.high ?? null, operators: [...ops].sort() });
    }
  }
  return out;
}

export interface TwinTally {
  readonly positiveId: string;
  readonly evaluated: number;
  readonly falseFires: number;
  readonly rules: readonly string[];
}

/** Twin rows per positive: evaluated (silent or false fire), false fires and the blocking rules they added. */
export function twinTally(rows: readonly KeyRow[]): TwinTally[] {
  const by = new Map<string, { evaluated: number; falseFires: number; rules: Set<string> }>();
  for (const r of rows) {
    if (r.role !== 'twin' || (r.status !== 'silent' && r.status !== 'false-fire')) continue;
    const t = by.get(r.positiveId) ?? { evaluated: 0, falseFires: 0, rules: new Set<string>() };
    t.evaluated++;
    if (r.status === 'false-fire') {
      t.falseFires++;
      for (const v of r.newBlocking) t.rules.add(v.functionId);
    }
    by.set(r.positiveId, t);
  }
  return [...by.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([positiveId, t]) => ({ positiveId, evaluated: t.evaluated, falseFires: t.falseFires, rules: [...t.rules].sort() }));
}

/** The proposed beta bar (author decision 2026-10-19): reach on ≥ 3 real repositories, seeded recall ≥ 0.90, 0 twin false fires. */
export function betaReady(realReach: number, recall: number | null, twinFalseFires: number): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (realReach < 3) reasons.push(`reach on ${String(realReach)} real repositories (< 3)`);
  if (recall === null) reasons.push('no seeded recall estimate');
  else if (recall < 0.9) reasons.push(`seeded recall ${recall.toFixed(2)} (< 0.90)`);
  if (twinFalseFires > 0) reasons.push(`${String(twinFalseFires)} twin false fires`);
  return { ready: reasons.length === 0, reasons };
}
