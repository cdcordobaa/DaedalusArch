/**
 * COMPREHEND-01 (v1.5-exp) comprehension tools over the graph index (`index.ts`): `context_map`, `who_writes`,
 * `trace` and `impact`. Pure functions of the index (impact also runs the DETECT-02 rules once per index), symbolic,
 * zero model calls. Every fact says whether it was declared in the spec or inferred from the code. Lists are capped at
 * `MAX_ROWS` rows, with the total stated, so an agent knows when it sees a part.
 */
import * as fs from 'node:fs';
import YAML from 'yaml';
import { loadRules, runTree } from '../../lib/graph.js';
import type { Finding } from '../../lib/graph.js';
import type { FootprintWrite } from '../../lib/facts.js';
import { globMatch } from '../../lib/spec.js';
import { entityNameForms, isWriteMember, WRITE_VERB } from './entities.js';
import type { EntityInfo } from './entities.js';
import type { ComprehendIndex, MemberCall, MemberSig, TypeInfo, UnitInfo } from './index.js';

export const MAX_ROWS = 25;
export const MAX_TRACE_DEPTH = 8;
export const MAX_TRACE_NODES = 60;

export interface Capped<T> { readonly total: number; readonly shown: readonly T[]; readonly truncated: boolean }
export const cap = <T>(xs: readonly T[], n = MAX_ROWS): Capped<T> => ({ total: xs.length, shown: xs.slice(0, n), truncated: xs.length > n });

export class ToolInputError extends Error {}

// ── context_map ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ContextRow {
  readonly name: string; readonly root: string; readonly source: 'declared' | 'inferred';
  readonly published: readonly string[]; readonly aggregates: readonly string[]; readonly commands: number; readonly files: number;
}
export interface AggregateRow {
  readonly name: string; readonly context: string | null; readonly file: string; readonly line: number; readonly module: string;
  readonly source: 'declared' | 'inferred'; readonly ownerSource: 'declared' | 'inferred' | 'none';
}
export interface ContextMap {
  readonly contexts: readonly ContextRow[];
  readonly aggregates: readonly AggregateRow[];
  readonly unownedAggregates: readonly string[];
  readonly aggregatesFrom: 'spec' | 'inferred' | 'none';
  readonly notes: readonly string[];
}

export function contextMap(ix: ComprehendIndex): ContextMap {
  const { spec, facts } = ix;
  const declared = spec.contexts.length > 0;
  const names = declared ? spec.contexts.map((c) => c.name) : [...new Set(ix.files.map((f) => spec.contextOf(f)).filter((c): c is string => c !== null))].sort();
  const contexts: ContextRow[] = names.map((name) => {
    const d = spec.contexts.find((c) => c.name === name);
    const files = ix.files.filter((f) => spec.contextOf(f) === name);
    return {
      name, root: d?.root ?? `src/${name}/`, source: d ? 'declared' : 'inferred',
      published: files.filter((f) => spec.isPublished(f)),
      aggregates: facts.roots.filter((r) => r.context === name).map((r) => r.name),
      commands: facts.commands.filter((c) => c.context === name).length,
      files: files.length,
    };
  });
  const aggregates: AggregateRow[] = facts.roots.map((r) => ({
    name: r.name, context: r.context, file: r.file, line: r.line, module: r.module,
    source: r.declared ? 'declared' : 'inferred',
    ownerSource: r.context === null ? 'none' : r.declared ? 'declared' : declared ? 'declared' : 'inferred',
  }));
  const notes: string[] = [];
  if (!declared) notes.push(names.length > 0 ? 'No contexts are declared in the spec: contexts are inferred from src/<context>/{domain,application,infrastructure,...} folders.' : 'No contexts are declared and none can be inferred from the folders.');
  if (facts.rootSource === 'fallback') notes.push('No aggregates are declared in the spec: aggregate roots are inferred (identity-bearing domain types that a store method takes). Check them against the code.');
  if (facts.rootSource === 'none') notes.push('No aggregates are declared and none were inferred, so who_writes and the write facts of trace have nothing to report.');
  notes.push('Commands are the public methods of application-layer classes and the functions of a published module interface.');
  return {
    contexts, aggregates, unownedAggregates: facts.roots.filter((r) => r.context === null).map((r) => r.name),
    aggregatesFrom: facts.rootSource === 'spec' ? 'spec' : facts.rootSource === 'fallback' ? 'inferred' : 'none', notes,
  };
}

// ── who_writes ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface WriteRow { readonly at: string; readonly store: string; readonly storeDeclaredAt: string; readonly instance: string; readonly several: boolean; readonly chain: readonly string[] }
export interface WriterRow {
  readonly command: string; readonly id: string; readonly file: string; readonly line: number; readonly context: string | null;
  /** `direct write`: a unit that calls a write member of an inferred entity's store (GRAPH-SCALE (d)). */
  readonly entry: 'application service' | 'published interface' | 'direct write'; readonly eventHandler: boolean; readonly crossContext: boolean;
  readonly writes: readonly WriteRow[];
}
export interface WhoWrites {
  readonly aggregate: string; readonly owner: string | null; readonly source: 'declared' | 'inferred';
  readonly writers: Capped<WriterRow>; readonly notes: readonly string[];
  /** Where the writers come from: the DETECT-02 write footprints of commands, or the stores of an inferred entity. */
  readonly basis?: 'footprint' | 'entity stores';
  /** For `entity stores`: the entity declarations matched, with their evidence and stores. */
  readonly entities?: readonly EntityInfo[];
}

const instanceName = (w: FootprintWrite): string => w.instance.slice(w.instance.lastIndexOf(':') + 1).replace(/^this\./, '').replace(/\[\*\]$/, '');
const chainOf = (w: FootprintWrite): string[] => [...w.via, w.sink];

const findRoot = (ix: ComprehendIndex, name: string): ComprehendIndex['facts']['roots'][number] | undefined =>
  ix.facts.roots.find((x) => x.name === name) ?? ix.facts.roots.find((x) => x.name.toLowerCase() === name.toLowerCase());
const unknownAggregate = (ix: ComprehendIndex, name: string): ToolInputError => {
  const ents = [...new Set(ix.entities.map((e) => e.name))];
  return new ToolInputError(`unknown aggregate "${name}"; known aggregate roots: ${ix.facts.roots.map((x) => x.name).join(', ') || '(none)'}`
    + (ents.length > 0 ? `; inferred entities: ${ents.slice(0, 20).join(', ')}${ents.length > 20 ? `, … (${ents.length})` : ''}` : ''));
};

export function resolveAggregate(ix: ComprehendIndex, name: string): ComprehendIndex['facts']['roots'][number] {
  const r = findRoot(ix, name);
  if (r === undefined) throw unknownAggregate(ix, name);
  return r;
}

/** Entities inferred from the code whose name matches (exactly, else ignoring case). */
export function matchEntities(ix: ComprehendIndex, name: string): EntityInfo[] {
  const exact = ix.entities.filter((e) => e.name === name);
  return exact.length > 0 ? exact : ix.entities.filter((e) => e.name.toLowerCase() === name.toLowerCase());
}

// ── Type relations (GRAPH-SCALE (c)) ────────────────────────────────────────────────────────────────────────────────

interface Relations { readonly children: Map<string, string[]> }
const relCache = new WeakMap<ComprehendIndex, Relations>();
const relations = (ix: ComprehendIndex): Relations => {
  let r = relCache.get(ix);
  if (!r) {
    const children = new Map<string, string[]>();
    for (const t of ix.types.values()) for (const b of [...t.bases, ...t.implements]) children.set(b, [...(children.get(b) ?? []), t.key]);
    r = { children };
    relCache.set(ix, r);
  }
  return r;
};
/** Every type that extends or implements `key`, transitively (not `key` itself). */
export function subtypesOf(ix: ComprehendIndex, key: string): Set<string> {
  const { children } = relations(ix);
  const out = new Set<string>();
  const q = [key];
  while (q.length > 0) for (const c of children.get(q.pop()!) ?? []) if (!out.has(c) && c !== key) { out.add(c); q.push(c); }
  return out;
}
/** Every type `key` extends, transitively (classes: base classes; interfaces: base interfaces). */
export function ancestorsOf(ix: ComprehendIndex, key: string): Set<string> {
  const out = new Set<string>();
  const q = [key];
  while (q.length > 0) for (const b of ix.types.get(q.pop()!)?.bases ?? []) if (!out.has(b) && b !== key) { out.add(b); q.push(b); }
  return out;
}
const memberName = (mc: MemberCall): string => mc.member.slice(mc.member.indexOf('.') + 1);
const sigIn = (ix: ComprehendIndex, owner: string, name: string): MemberSig | undefined => ix.types.get(owner)?.members.find((m) => m.name === name);
/** Member names of a type, its own and inherited. */
const allMembers = (ix: ComprehendIndex, key: string): Set<string> => {
  const out = new Set<string>();
  for (const k of [key, ...ancestorsOf(ix, key)]) for (const m of ix.types.get(k)?.members ?? []) out.add(m.name);
  return out;
};

/** Units that call a write member of an inferred entity's stores (uncapped). */
export function entityWriteSites(ix: ComprehendIndex, ents: readonly EntityInfo[]): { unit: string; file: string; line: number; member: string; storeAt: string; store: string; how: string }[] {
  const out: { unit: string; file: string; line: number; member: string; storeAt: string; store: string; how: string }[] = [];
  const seen = new Set<string>();
  for (const e of ents) {
    const forms = entityNameForms(e.name);
    for (const s of e.stores) {
      const st = ix.types.get(s.key);
      if (!st) continue;
      const own = new Set([s.key, ...subtypesOf(ix, s.key)]);
      const anc = ancestorsOf(ix, s.key);
      const names = allMembers(ix, s.key);
      const writes = (m: MemberSig | undefined): boolean => {
        if (!m) return false;
        if (s.how === 'member named after it') { const v = WRITE_VERB.exec(m.name); return v !== null && forms.includes(m.name.slice(v[0].length)); }
        return isWriteMember(m);
      };
      for (const mc of ix.memberCalls) {
        const n = memberName(mc);
        let ok = false;
        if (mc.owner === s.key) ok = writes(sigIn(ix, mc.owner, n));
        else if (own.has(mc.owner)) ok = names.has(n) && writes(sigIn(ix, mc.owner, n));
        else if (anc.has(mc.owner)) ok = mc.receiver !== undefined && own.has(mc.receiver) && writes(sigIn(ix, mc.owner, n));
        if (!ok) continue;
        const k = `${mc.unit}|${mc.file}:${mc.line}|${mc.member}`;
        if (seen.has(k)) continue; seen.add(k);
        const sig = sigIn(ix, mc.owner, n);
        out.push({ unit: mc.unit, file: mc.file, line: mc.line, member: mc.member, storeAt: `${ix.types.get(mc.owner)?.file ?? '?'}:${sig?.line ?? '?'}`, store: st.name, how: s.how });
      }
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function whoWritesEntities(ix: ComprehendIndex, ents: EntityInfo[], declaredRoot: boolean): WhoWrites {
  const sites = entityWriteSites(ix, ents);
  const ctx = ix.spec.contextOf(ents[0]!.file);
  const byUnit = new Map<string, WriterRow>();
  for (const x of sites) {
    const u = ix.units.get(x.unit);
    const prev = byUnit.get(x.unit);
    const w: WriteRow = { at: `${x.file}:${x.line}`, store: x.member, storeDeclaredAt: x.storeAt, instance: '', several: false, chain: [u?.name ?? x.unit, x.member] };
    if (prev) { byUnit.set(x.unit, { ...prev, writes: [...prev.writes, w] }); continue; }
    const c = ix.spec.contextOf(x.file);
    byUnit.set(x.unit, {
      command: u?.name ?? x.unit, id: x.unit, file: x.file, line: u?.line ?? x.line, context: c, entry: 'direct write', eventHandler: false,
      crossContext: c !== null && ctx !== null && c !== ctx, writes: [w],
    });
  }
  const rows = [...byUnit.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const source = ents.some((e) => e.source === 'declared') ? 'declared' : 'inferred';
  const notes: string[] = [];
  notes.push(`${ents[0]!.name} is ${source === 'declared' ? 'named in the spec, but its declaration was found by inference' : 'an inferred entity (not declared in the spec)'}: ${ents.flatMap((e) => e.evidence.map((v) => `${v.kind}, ${v.detail}`)).slice(0, 4).join('; ')}.`);
  if (declaredRoot) notes.push('The DETECT-02 write footprints of the commands found no write of it, so the writers below are the units that call a write member of its stores.');
  notes.push(`Stores: ${ents.flatMap((e) => e.stores.map((s) => `${s.key.split('#')[1]} (${s.how})`)).slice(0, 8).join(', ') || 'none found'}. A store member writes when its name starts with a mutation verb or it returns nothing and takes an argument; inherited members count only when the receiver is the store.`);
  notes.push('Writers are the units that make the store call (one level); the commands that reach them are found with impact or callers.');
  return { aggregate: ents[0]!.name, owner: ctx, source, writers: cap(rows), notes, basis: 'entity stores', entities: ents };
}

export function whoWrites(ix: ComprehendIndex, aggregate: string): WhoWrites {
  const found = findRoot(ix, aggregate);
  const ents = matchEntities(ix, aggregate);
  if (found === undefined) {
    if (ents.length === 0) throw unknownAggregate(ix, aggregate);
    return whoWritesEntities(ix, ents, false);
  }
  const r = found;
  const rows: WriterRow[] = [];
  for (const c of ix.facts.commands) {
    const ws = c.writes.filter((w) => w.root === r.name);
    if (ws.length === 0) continue;
    const seen = new Set<string>();
    const writes: WriteRow[] = [];
    for (const w of ws) {
      const k = `${w.file}:${w.line}:${w.instance}`;
      if (seen.has(k)) continue; seen.add(k);
      writes.push({ at: `${w.file}:${w.line}`, store: w.sink, storeDeclaredAt: w.sinkSite, instance: instanceName(w), several: w.many, chain: chainOf(w) });
    }
    rows.push({
      command: c.name, id: c.id, file: c.file, line: c.line, context: c.context,
      entry: c.published ? 'published interface' : 'application service', eventHandler: c.eventHandler,
      crossContext: c.context !== null && r.context !== null && c.context !== r.context, writes,
    });
  }
  rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const notes: string[] = [];
  if (rows.some((x) => x.entry === 'published interface')) notes.push('A published-interface function that calls an application service is listed with that service: both start the same write.');
  if (rows.some((x) => x.eventHandler)) notes.push('eventHandler = the command takes a domain event: it runs when the event is delivered, after the command that recorded it.');
  if (!ix.facts.roots.find((x) => x.name === r.name)?.declared) notes.push(`${r.name} is an inferred aggregate root (not declared in the spec).`);
  notes.push(`Writes are followed through up to 4 levels of calls, through ports to their in-tree implementations; a write reached deeper or through an untyped call is not seen.`);
  // GRAPH-SCALE (d): a declared or inferred root whose footprints find no writer falls back to the entity's stores.
  const sameEnts = ents.filter((e) => e.name === r.name);
  if (rows.length === 0 && sameEnts.length > 0) return whoWritesEntities(ix, sameEnts, true);
  return { aggregate: r.name, owner: r.context, source: r.declared ? 'declared' : 'inferred', writers: cap(rows), notes, basis: 'footprint' };
}

// ── callers (GRAPH-SCALE (c)) ───────────────────────────────────────────────────────────────────────────────────────

export interface CallerSite { readonly at: string; readonly member: string; readonly how: 'port' | 'implementation' | 'inherited'; readonly receiver?: string }
export interface CallerRow { readonly unit: string; readonly id: string; readonly file: string; readonly line: number; readonly context: string | null; readonly role: string; readonly sites: readonly CallerSite[] }
export interface Callers {
  readonly target: string; readonly type: string; readonly file: string; readonly line: number; readonly kind: 'class' | 'interface';
  readonly member: string | null;
  /** In-tree types that implement or extend the target (`file#Name`). */
  readonly implementations: Capped<string>;
  readonly sites: number; readonly files: number;
  readonly callers: Capped<CallerRow>;
  readonly notes: readonly string[];
}

export function resolveType(ix: ComprehendIndex, ref: string): { type: TypeInfo; member: string | null } {
  const r = ref.trim().replace(/^\.\//, '');
  const [file, rest] = r.includes('#') ? [r.slice(0, r.indexOf('#')), r.slice(r.indexOf('#') + 1)] : [null, r];
  const dot = rest.indexOf('.');
  const tname = dot >= 0 ? rest.slice(0, dot) : rest;
  const member = dot >= 0 ? rest.slice(dot + 1) : null;
  const hits = [...ix.types.values()].filter((t) => t.name === tname && (file === null || t.file === file));
  if (hits.length === 0) throw new ToolInputError(`unknown type "${tname}"${file !== null ? ` in ${file}` : ''}; give an interface or class declared in the project (Type, Type.method, file#Type or file#Type.method)`);
  if (hits.length > 1) throw new ToolInputError(`"${tname}" is ambiguous: ${hits.slice(0, 8).map((t) => t.key).join(', ')}; give file#${tname}`);
  const type = hits[0]!;
  if (member !== null && !allMembers(ix, type.key).has(member)) throw new ToolInputError(`${type.name} has no member "${member}"; members: ${[...allMembers(ix, type.key)].slice(0, 30).join(', ')}`);
  return { type, member };
}

/**
 * Every call site of a port's members (uncapped): calls resolved to the type's own members (`port`), to a member of a
 * type that implements or extends it, for a member the port has (`implementation`), and to a member it inherits from
 * a base type when the receiver is the port or one of its subtypes (`inherited`).
 */
export function callerSites(ix: ComprehendIndex, ref: string): { type: TypeInfo; member: string | null; sites: (CallerSite & { unit: string; file: string; line: number })[]; implementations: string[] } {
  const { type, member } = resolveType(ix, ref);
  const subs = subtypesOf(ix, type.key);
  const anc = ancestorsOf(ix, type.key);
  const names = allMembers(ix, type.key);
  const want = (n: string): boolean => (member === null ? names.has(n) : n === member);
  const own = new Set([type.key, ...subs]);
  const sites: (CallerSite & { unit: string; file: string; line: number })[] = [];
  const seen = new Set<string>();
  for (const mc of ix.memberCalls) {
    const n = memberName(mc);
    if (!want(n)) continue;
    let how: CallerSite['how'] | null = null;
    if (mc.owner === type.key) how = 'port';
    else if (subs.has(mc.owner)) how = 'implementation';
    else if (anc.has(mc.owner) && mc.receiver !== undefined && own.has(mc.receiver)) how = 'inherited';
    if (how === null) continue;
    const k = `${mc.file}:${mc.line}:${n}`;
    if (seen.has(k)) continue; seen.add(k);
    sites.push({ unit: mc.unit, file: mc.file, line: mc.line, at: `${mc.file}:${mc.line}`, member: mc.member, how, ...(mc.receiver !== undefined && mc.receiver !== mc.owner ? { receiver: mc.receiver } : {}) });
  }
  sites.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return { type, member, sites, implementations: [...subs].sort() };
}

export function callers(ix: ComprehendIndex, ref: string): Callers {
  const { type, member, sites, implementations } = callerSites(ix, ref);
  const byUnit = new Map<string, CallerRow>();
  for (const s of sites) {
    const u = ix.units.get(s.unit);
    const site: CallerSite = { at: s.at, member: s.member, how: s.how, ...(s.receiver !== undefined ? { receiver: s.receiver } : {}) };
    const prev = byUnit.get(s.unit);
    if (prev) { byUnit.set(s.unit, { ...prev, sites: [...prev.sites, site] }); continue; }
    byUnit.set(s.unit, { unit: u?.name ?? s.unit, id: s.unit, file: s.file, line: u?.line ?? s.line, context: ix.spec.contextOf(s.file), role: u?.role ?? ix.spec.roleOf(s.file), sites: [site] });
  }
  const rows = [...byUnit.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const notes = [
    'Callers are the units (methods, functions, factory callbacks) whose body calls the member: through the port, through a class that implements or extends it, or through a member it inherits when the receiver is typed by it.',
    'Calls through an untyped receiver (`any`, a string-keyed container) have no resolved member and are not listed.',
  ];
  return {
    target: ref.trim(), type: type.name, file: type.file, line: type.line, kind: type.kind, member,
    implementations: cap(implementations), sites: sites.length, files: new Set(sites.map((s) => s.file)).size, callers: cap(rows), notes,
  };
}

// ── trace ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface TraceStep {
  readonly unit: string; readonly file: string; readonly line: number; readonly role: string;
  /** How the parent reached this unit (`interface` = through a port to an implementation). */
  readonly via: 'start' | 'direct' | 'interface';
  readonly port?: string;
  readonly calledAt?: string;
  readonly reads: readonly { readonly at: string; readonly method: string; readonly aggregates: readonly string[] }[];
  readonly writes: readonly { readonly at: string; readonly store: string; readonly aggregate: string; readonly instance: string }[];
  readonly io: readonly { readonly at: string; readonly module: string; readonly call: string }[];
  readonly unresolved: readonly { readonly at: string; readonly call: string; readonly reason: string }[];
  readonly note?: string;
  readonly children: readonly TraceStep[];
}
export interface Trace {
  readonly command: string; readonly file: string; readonly line: number; readonly context: string | null; readonly isCommand: boolean;
  readonly root: TraceStep;
  readonly writes: readonly { readonly aggregate: string; readonly instance: string; readonly at: string; readonly store: string; readonly path: readonly string[] }[];
  readonly reads: readonly { readonly aggregates: readonly string[]; readonly at: string; readonly method: string; readonly path: readonly string[] }[];
  readonly adapters: readonly string[];
  readonly nodes: number; readonly hidden: number; readonly truncated: boolean;
  readonly notes: readonly string[];
}

export function resolveUnit(ix: ComprehendIndex, ref: string): UnitInfo {
  const r = ref.trim().replace(/^\.\//, '');
  if (ix.units.has(r)) return ix.units.get(r)!;
  const all = [...ix.units.values()];
  let hits = r.includes('#') ? all.filter((u) => u.id === r || `${u.file}#${u.name}` === r) : all.filter((u) => u.name === r);
  if (hits.length === 0 && !r.includes('#')) hits = all.filter((u) => u.name.endsWith(`.${r}`) || u.owner === r && u.name.endsWith('.execute'));
  const cmds = hits.filter((u) => ix.facts.commands.some((c) => c.id === u.id));
  if (cmds.length === 1) return cmds[0]!;
  if (hits.length === 1) return hits[0]!;
  if (hits.length === 0) throw new ToolInputError(`unknown command "${ref}"; give Class.method or file#Class.method (commands: ${ix.facts.commands.slice(0, 12).map((c) => c.name).join(', ')}${ix.facts.commands.length > 12 ? ', …' : ''})`);
  throw new ToolInputError(`"${ref}" is ambiguous: ${hits.slice(0, 8).map((u) => u.id).join(', ')}; give file#Class.method`);
}

/** Write sites per unit id, from the footprint facts of every command (the unit that makes the store call). */
function writesByUnit(ix: ComprehendIndex): Map<string, { at: string; store: string; aggregate: string; instance: string }[]> {
  const m = new Map<string, { at: string; store: string; aggregate: string; instance: string }[]>();
  const seen = new Set<string>();
  for (const c of ix.facts.commands) for (const w of c.writes) {
    const unitName = w.via[w.via.length - 1];
    const u = [...ix.units.values()].find((x) => x.file === w.file && x.name === unitName);
    if (u === undefined) continue;
    const k = `${u.id}|${w.file}:${w.line}|${w.root}|${w.sink}|${w.instance}`;
    if (seen.has(k)) continue; seen.add(k);
    m.set(u.id, [...(m.get(u.id) ?? []), { at: `${w.file}:${w.line}`, store: w.sink, aggregate: w.root, instance: instanceName(w) }]);
  }
  return m;
}
const wbuCache = new WeakMap<ComprehendIndex, ReturnType<typeof writesByUnit>>();

export function trace(ix: ComprehendIndex, command: string, opts: { readonly full?: boolean } = {}): Trace {
  const start = resolveUnit(ix, command);
  const wbu = wbuCache.get(ix) ?? writesByUnit(ix);
  wbuCache.set(ix, wbu);
  const isHandler = (id: string): boolean => ix.facts.commands.some((c) => c.id === id && c.eventHandler);
  let nodes = 0; let truncated = false;
  const flatWrites: Trace['writes'][number][] = []; const flatReads: Trace['reads'][number][] = []; const adapters = new Set<string>();
  const expanded = new Set<string>();
  const visit = (u: UnitInfo, via: TraceStep['via'], port: string | undefined, calledAt: string | undefined, depth: number, pathNames: string[]): TraceStep => {
    nodes++;
    const base = { unit: u.name, file: u.file, line: u.line, role: u.role, via, ...(port !== undefined ? { port } : {}), ...(calledAt !== undefined ? { calledAt } : {}) };
    if (expanded.has(u.id)) return { ...base, reads: [], writes: [], io: [], unresolved: [], note: 'expanded above', children: [] };
    expanded.add(u.id);
    const p = [...pathNames, u.name];
    const writes = wbu.get(u.id) ?? [];
    // A store call that both writes and returns the aggregate (`insert(user): Promise<User>`) is a write, not a read.
    const reads = (ix.reads.get(u.id) ?? []).filter((r) => !writes.some((w) => w.at === `${r.file}:${r.line}`)).map((r) => ({ at: `${r.file}:${r.line}`, method: r.method, aggregates: r.roots }));
    for (const w of writes) flatWrites.push({ ...w, path: p });
    for (const r of reads) flatReads.push({ ...r, path: p });
    if (via === 'interface') adapters.add(`${u.name} (${u.file}:${u.line})`);
    const children: TraceStep[] = [];
    let note: string | undefined;
    if (depth >= MAX_TRACE_DEPTH) note = `depth limit (${MAX_TRACE_DEPTH}) reached: calls below are not shown`;
    else if (via !== 'start' && isHandler(u.id)) note = 'a domain-event handler: in the running system it is reached when the event is delivered';
    if (depth < MAX_TRACE_DEPTH) {
      for (const e of ix.calls.get(u.id) ?? []) {
        const t = ix.units.get(e.to);
        if (!t || t.id === start.id) continue;
        children.push(visit(t, e.via, e.port, `${e.file}:${e.line}`, depth + 1, p));
      }
    }
    return {
      ...base, reads, writes, io: (ix.externals.get(u.id) ?? []).map((x) => ({ at: `${x.file}:${x.line}`, module: x.module, call: x.call })),
      unresolved: (ix.unresolved.get(u.id) ?? []).map((x) => ({ at: `${x.file}:${x.line}`, call: x.call, reason: x.reason })),
      ...(note !== undefined ? { note } : {}), children,
    };
  };
  const full = visit(start, 'start', undefined, undefined, 0, []);
  // Default view: keep a step only if it crosses a port, reads, writes, does IO, has an unresolved call or leads to
  // such a step; a unit met again is shown once more only if its first expansion was kept. `full` keeps every step.
  let hidden = 0;
  const keptUnits = new Set<string>();
  // A port crossing counts when it leaves the domain model (to an adapter, a service or a published function); a step
  // into an adapter (infrastructure, persistence) counts however it is reached (revision T1, 2026-10-22: a Layered tree
  // with no aggregates reaches its store by a direct call).
  const significant = (s: TraceStep): boolean => (s.via === 'interface' && s.role !== 'domain' && s.role !== 'shared-kernel') || s.role === 'adapter' || s.reads.length + s.writes.length + s.io.length + s.unresolved.length > 0 || (s.note !== undefined && s.note !== 'expanded above');
  const count = (s: TraceStep): number => 1 + s.children.reduce((a, c) => a + count(c), 0);
  const prune = (s: TraceStep): TraceStep | null => {
    const key = `${s.file}#${s.unit}`;
    if (s.note === 'expanded above') return keptUnits.has(key) && s.via === 'interface' ? s : null;
    const kids: TraceStep[] = [];
    for (const c of s.children) { const k = prune(c); if (k === null) hidden += count(c); else kids.push(k); }
    if (s.via !== 'start' && !significant(s) && kids.length === 0) return null;
    keptUnits.add(key);
    return { ...s, children: kids };
  };
  /** Keep at most MAX_TRACE_NODES steps, in pre-order. */
  let budget = MAX_TRACE_NODES;
  const capNodes = (s: TraceStep): TraceStep => {
    budget--;
    const kids: TraceStep[] = [];
    for (const c of s.children) { if (budget <= 0) { truncated = true; break; } kids.push(capNodes(c)); }
    return { ...s, children: kids };
  };
  const root = capNodes(opts.full === true ? full : prune(full)!);
  nodes = count(root);
  const cmd = ix.facts.commands.find((c) => c.id === start.id);
  const notes: string[] = [];
  if (!cmd) notes.push(`${start.name} is not a command (commands are public methods of application-layer classes and published module functions); its calls are traced anyway.`);
  if (truncated) notes.push(`The trace was cut at ${MAX_TRACE_NODES} steps.`);
  if (hidden > 0) notes.push(`${hidden} step(s) with no port crossing, read, write or IO below them are hidden (pass full: true to see them).`);
  notes.push('Reads are calls on a repository, port or adapter that return an aggregate; writes are the store calls of the write-footprint facts.');
  return {
    command: start.name, file: start.file, line: start.line, context: ix.spec.contextOf(start.file), isCommand: cmd !== undefined,
    root, writes: flatWrites, reads: flatReads, adapters: [...adapters], nodes, hidden, truncated, notes,
  };
}

// ── impact ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface RuleRisk { readonly rule: string; readonly why: string; readonly source: 'role' | 'finding' }
export interface Impact {
  readonly target: string; readonly file: string; readonly symbol: string | null;
  readonly kind: readonly string[]; readonly layer: string | null; readonly context: string | null;
  readonly importers: Capped<string>; readonly references: Capped<string> | null;
  readonly commands: Capped<{ readonly command: string; readonly file: string; readonly line: number; readonly path: readonly string[] }>;
  readonly rulesAtRisk: readonly RuleRisk[];
  readonly currentFindings: readonly { readonly rule: string; readonly at: string; readonly subject: string; readonly evidence: string }[];
  readonly layering: { readonly mayImport: readonly string[]; readonly importersBreaking: readonly string[] } | null;
  readonly notes: readonly string[];
}

const RISK_TEXT: Record<string, Record<string, string>> = {
  aggregate: {
    'R-D5': 'a business rule on this aggregate\'s state moved into a service (outside the aggregate)',
    'R-D9': 'this aggregate\'s type exposed through a published contract of its context',
  },
  store: {
    'R-D4': 'a write that takes several aggregate instances, or a command that saves a second aggregate through this store',
    'R-XCTX': 'this store called from another context\'s command, writing an aggregate that context does not own',
    'R-H5': 'a vendor type, an adapter type or a lock/transaction callback in the store\'s signature',
  },
  port: { 'R-H5': 'a vendor type, an adapter type or a lock/transaction callback in the port\'s signature' },
  'application service': {
    'R-D4': 'the command saving a second aggregate instance in the same call',
    'R-XCTX': 'the command writing an aggregate owned by another context',
    'R-D5': 'a business decision on an aggregate\'s state taken in the service',
    'R-INJ': 'a concrete adapter injected instead of a port',
    'R-RTX': 'a remote or vendor call made inside a transaction or lock scope',
  },
  'published interface': {
    'R-D9': 'an entity or aggregate type exposed through this contract',
    'R-XCTX': 'a write exposed here and called by another context inside its own command',
  },
  adapter: {
    'R-INJ': 'application code depending on this concrete class instead of its port',
    'R-RTX': 'remote IO reached inside a transaction or lock scope',
  },
};

interface RawSpec { layers: { name?: string; directories?: string[] }[]; allowed: { from?: string; to?: string[] }[] }
function rawSpec(ix: ComprehendIndex): RawSpec {
  if (ix.specPath === undefined || !fs.existsSync(ix.specPath)) return { layers: [], allowed: [] };
  const doc = YAML.parse(fs.readFileSync(ix.specPath, 'utf8')) as { architecture?: { layers?: RawSpec['layers']; allowed_dependencies?: RawSpec['allowed'] } } | null;
  return { layers: doc?.architecture?.layers ?? [], allowed: doc?.architecture?.allowed_dependencies ?? [] };
}
const layerOf = (rs: RawSpec, f: string): string | null => rs.layers.find((l) => globMatch(l.directories ?? [], f))?.name ?? null;

const findingsCache = new WeakMap<ComprehendIndex, Promise<Finding[]>>();
export function findingsOf(ix: ComprehendIndex, tsconfig?: string): Promise<Finding[]> {
  let p = findingsCache.get(ix);
  if (!p) {
    p = runTree(ix.root, loadRules(), { spec: ix.specPath, tsconfig, withApg: false }).then((r) => r.findings.filter((f) => f.status === 'violation'));
    findingsCache.set(ix, p);
  }
  return p;
}

/** Commands whose call tree reaches a unit accepted by `hit`, with the path to the first such unit. */
function commandsReaching(ix: ComprehendIndex, hit: (u: UnitInfo) => boolean): { command: string; file: string; line: number; path: string[] }[] {
  const out: { command: string; file: string; line: number; path: string[] }[] = [];
  for (const c of ix.facts.commands) {
    const start = ix.units.get(c.id);
    if (!start) continue;
    const seen = new Set<string>([start.id]);
    const queue: { u: UnitInfo; path: string[]; d: number }[] = [{ u: start, path: [start.name], d: 0 }];
    let found: string[] | undefined;
    while (queue.length > 0 && found === undefined) {
      const { u, path, d } = queue.shift()!;
      if (hit(u)) { found = path; break; }
      if (d >= MAX_TRACE_DEPTH) continue;
      for (const e of ix.calls.get(u.id) ?? []) {
        if (seen.has(e.to)) continue; seen.add(e.to);
        const t = ix.units.get(e.to); if (t) queue.push({ u: t, path: [...path, t.name], d: d + 1 });
      }
    }
    if (found) out.push({ command: c.name, file: c.file, line: c.line, path: found });
  }
  return out;
}

export function kindsOf(ix: ComprehendIndex, file: string): string[] {
  const { spec, facts } = ix;
  const kinds: string[] = [];
  const role = spec.roleOf(file);
  if (facts.roots.some((r) => r.file === file || globMatch([r.module], file))) kinds.push('aggregate');
  const storeFile = (spec.repositories.length > 0 && globMatch(spec.repositories, file))
    || facts.commands.some((c) => c.writes.some((w) => w.sinkSite.split(':')[0] === file));
  if (storeFile) kinds.push('store');
  if (role === 'port' && !kinds.includes('store')) kinds.push('port');
  if (role === 'application' && facts.commands.some((c) => c.file === file && !c.published)) kinds.push('application service');
  if (spec.isPublished(file) || role === 'contract') kinds.push('published interface');
  if (role === 'adapter' && !kinds.includes('store')) kinds.push('adapter');
  if (kinds.length === 0) kinds.push(role);
  return kinds;
}

export async function impact(ix: ComprehendIndex, target: string, tsconfig?: string): Promise<Impact> {
  const t = target.trim().replace(/^\.\//, '');
  const [file, symbol] = t.includes('#') ? [t.slice(0, t.indexOf('#')), t.slice(t.indexOf('#') + 1)] : [t, null];
  if (!ix.files.includes(file)) {
    const near = ix.files.filter((f) => f.endsWith(`/${file.split('/').pop()}`)).slice(0, 5);
    throw new ToolInputError(`unknown file "${file}" (project-relative production .ts files only)${near.length ? `; did you mean ${near.join(', ')}` : ''}`);
  }
  if (symbol !== null && !ix.declarations.get(file)?.has(symbol)) throw new ToolInputError(`no top-level declaration "${symbol}" in ${file}; declared: ${[...(ix.declarations.get(file)?.keys() ?? [])].join(', ')}`);
  const importers = ix.importedBy.get(file) ?? [];
  const references = symbol !== null ? ix.referencesOf(file, symbol) : null;
  const inTarget = (u: UnitInfo): boolean => u.file === file && (symbol === null || u.owner === symbol || u.name === symbol || u.name.startsWith(`${symbol}.`));
  const commands = commandsReaching(ix, inTarget);
  const kind = kindsOf(ix, file);
  const risks: RuleRisk[] = [];
  for (const k of kind) for (const [rule, why] of Object.entries(RISK_TEXT[k] ?? {})) if (!risks.some((r) => r.rule === rule)) risks.push({ rule, why: `${k}: ${why}`, source: 'role' });
  const findings = await findingsOf(ix, tsconfig);
  const involved = findings.filter((f) => f.file === file || f.path.some((p) => p.startsWith(`${file}:`) || p.startsWith(`${file} `)));
  for (const f of involved) if (!risks.some((r) => r.rule === f.rule && r.source === 'finding')) risks.push({ rule: f.rule, why: `already reported here: ${f.evidence}`, source: 'finding' });
  const rs = rawSpec(ix);
  const layer = layerOf(rs, file);
  let layering: Impact['layering'] = null;
  if (layer !== null) {
    const mayImport = [layer, ...(rs.allowed.find((a) => a.from === layer)?.to ?? [])];
    const importersBreaking = importers.filter((i) => {
      const il = layerOf(rs, i);
      if (il === null || il === layer) return false;
      const ctxI = ix.spec.contextOf(i); const ctxT = ix.spec.contextOf(file);
      if (ctxI !== null && ctxT !== null && ctxI !== ctxT) return false; // cross-context imports are FF-DS02's question
      return !(rs.allowed.find((a) => a.from === il)?.to ?? []).includes(layer);
    });
    layering = { mayImport, importersBreaking };
  }
  const notes: string[] = [
    'rulesAtRisk with source "role" are the DETECT-02 rules whose facts read this kind of file: what a change here could break, not a finding.',
    'Commands are found by following calls (through ports to implementations) up to 8 levels.',
  ];
  return {
    target: t, file, symbol, kind, layer, context: ix.spec.contextOf(file),
    importers: cap(importers), references: references === null ? null : cap(references),
    commands: cap(commands), rulesAtRisk: risks,
    currentFindings: involved.map((f) => ({ rule: f.rule, at: `${f.file}:${f.line ?? '?'}`, subject: f.subject, evidence: f.evidence })),
    layering, notes,
  };
}

// ── Text forms (the MCP result's text block) ────────────────────────────────────────────────────────────────────────

const more = <T>(c: Capped<T>): string => (c.truncated ? ` (showing ${c.shown.length} of ${c.total})` : '');

export function contextMapText(m: ContextMap): string {
  const out = [`context_map: ${m.contexts.length} context(s), ${m.aggregates.length} aggregate root(s) (${m.aggregatesFrom === 'spec' ? 'declared in the spec' : m.aggregatesFrom}).`];
  for (const c of m.contexts) {
    out.push(`- context ${c.name} [${c.source}] root ${c.root}: ${c.files} files, ${c.commands} commands; aggregates: ${c.aggregates.join(', ') || 'none'}; published: ${c.published.join(', ') || 'none'}`);
  }
  for (const a of m.aggregates) out.push(`- aggregate ${a.name} [${a.source}] owned by ${a.context ?? '(no context)'} [${a.ownerSource}], root ${a.file}:${a.line}, module ${a.module}`);
  if (m.unownedAggregates.length) out.push(`Unowned: ${m.unownedAggregates.join(', ')}`);
  return [...out, ...m.notes.map((n) => `Note: ${n}`)].join('\n');
}

export function callersText(c: Callers): string {
  const out = [`callers ${c.type}${c.member !== null ? `.${c.member}` : ''} (${c.kind} at ${c.file}:${c.line}): ${c.callers.total} unit(s)${more(c.callers)}, ${c.sites} call site(s) in ${c.files} file(s).`];
  out.push(`Implemented or extended by ${c.implementations.total}${more(c.implementations)}: ${c.implementations.shown.join(', ') || 'none in the tree'}`);
  for (const r of c.callers.shown) {
    out.push(`- ${r.unit} (${r.file}:${r.line}) [${r.role}] context ${r.context ?? '-'}`);
    for (const s of r.sites) out.push(`    ${s.at} ${s.member} [${s.how}${s.receiver !== undefined ? `, receiver ${s.receiver.split('#')[1]}` : ''}]`);
  }
  return [...out, ...c.notes.map((n) => `Note: ${n}`)].join('\n');
}

export function whoWritesText(w: WhoWrites): string {
  const out = [`who_writes ${w.aggregate} (owned by ${w.owner ?? 'no context'}, ${w.source}): ${w.writers.total} ${w.basis === 'entity stores' ? 'unit(s) writing it through its stores' : 'command(s)'}${more(w.writers)}.`];
  for (const c of w.writers.shown) {
    out.push(`- ${c.command} (${c.file}:${c.line}) context ${c.context ?? '-'}${c.crossContext ? ' [CROSS-CONTEXT]' : ''}${c.eventHandler ? ' [event handler]' : ''}${c.entry === 'published interface' ? ' [published interface]' : ''}`);
    for (const x of c.writes) out.push(`    write ${x.instance}${x.several ? ' (several)' : ''} at ${x.at} ${x.store} (declared ${x.storeDeclaredAt}) via ${x.chain.join(' → ')}`);
  }
  return [...out, ...w.notes.map((n) => `Note: ${n}`)].join('\n');
}

export function traceText(t: Trace): string {
  const out = [`trace ${t.command} (${t.file}:${t.line}), context ${t.context ?? '-'}: ${t.nodes} step(s), ${t.writes.length} write(s), ${t.reads.length} read(s).`];
  const walk = (s: TraceStep, ind: string): void => {
    const how = s.via === 'interface' ? ` via port ${s.port}` : '';
    out.push(`${ind}${s.unit} [${s.role}] ${s.file}:${s.line}${s.calledAt ? ` (called at ${s.calledAt}${how})` : ''}${s.note ? ` — ${s.note}` : ''}`);
    for (const r of s.reads) out.push(`${ind}  READ ${r.aggregates.join(', ')} at ${r.at} ${r.method}`);
    for (const w of s.writes) out.push(`${ind}  WRITE ${w.aggregate} (${w.instance}) at ${w.at} ${w.store}`);
    for (const x of s.io) out.push(`${ind}  IO ${x.module} at ${x.at} ${x.call}`);
    for (const x of s.unresolved) out.push(`${ind}  UNRESOLVED ${x.call} at ${x.at}: ${x.reason}`);
    for (const c of s.children) walk(c, `${ind}  `);
  };
  walk(t.root, '');
  return [...out, ...t.notes.map((n) => `Note: ${n}`)].join('\n');
}

export function impactText(i: Impact): string {
  const out = [`impact ${i.target}: ${i.kind.join(', ')}; layer ${i.layer ?? '-'}; context ${i.context ?? '-'}.`];
  out.push(`Imported by ${i.importers.total} file(s)${more(i.importers)}: ${i.importers.shown.join(', ') || 'none'}`);
  if (i.references) out.push(`Referenced (by symbol) in ${i.references.total} file(s)${more(i.references)}: ${i.references.shown.join(', ') || 'none'}`);
  out.push(`Commands reaching it: ${i.commands.total}${more(i.commands)}`);
  for (const c of i.commands.shown) out.push(`- ${c.command} (${c.file}:${c.line}) via ${c.path.join(' → ')}`);
  out.push('Rules a change here would risk:');
  for (const r of i.rulesAtRisk) out.push(`- ${r.rule} [${r.source}]: ${r.why}`);
  if (i.layering) out.push(`Layering: ${i.layer} may import ${i.layering.mayImport.join(', ')}; importers already breaking the allowed dependencies: ${i.layering.importersBreaking.join(', ') || 'none'}`);
  return [...out, ...i.notes.map((n) => `Note: ${n}`)].join('\n');
}

