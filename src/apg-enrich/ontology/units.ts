/**
 * Ontology v0: the units the passes work on, read from the APG, the ts-morph project and the cheap enrichment.
 *
 * - A class unit per APG Class node: its source with line numbers, its methods (with the cheap logic density), its
 *   APG neighbourhood and the cheap facts and flags on it.
 * - A group unit per declared component and per Louvain community (cheap proxy 9) of two or more classes; a community
 *   whose class set equals a component's is dropped.
 * - Rule candidates: methods whose cheap logic density is at least `ruleMinDensity`, or that a clone or shared-literal
 *   flag names. They are grouped per class.
 *
 * Nothing here edits the APG.
 */
import type { MethodDeclaration, SourceFile } from 'ts-morph';
import type { APGNode } from '../../shared/types/apg.js';
import type { LayerKind } from '../../shared/types/enums.js';
import { classesOf, declaredContextOf } from '../cheap/context.js';
import type { CheapContext } from '../cheap/context.js';
import type { CheapEnrichment, Evidence } from '../cheap/types.js';
import { hostIndependentCompare } from '../../shared/collation.js';
import type { ProjectDoc } from './reading.js';

export interface MethodUnit {
  readonly nodeId: string;
  readonly name: string;
  readonly span: Evidence;
  readonly logicDensity: number | null;
}

export interface Neighbour {
  readonly relation: string;
  readonly direction: 'out' | 'in';
  readonly nodeId: string;
  readonly type: string;
  readonly name: string;
  readonly file: string;
}

export interface ClassUnit {
  readonly nodeId: string;
  readonly name: string;
  readonly file: string;
  readonly span: Evidence;
  readonly component: string;
  /** The declared DDD bounded context (a `ddd.contexts[].root` prefix matched), or null for a directory fallback. */
  readonly declaredContext: string | null;
  readonly layer: string | null;
  readonly layerKind: LayerKind | null;
  readonly fields: readonly string[];
  readonly methods: readonly MethodUnit[];
  readonly neighbours: readonly Neighbour[];
  /** `key=value` lines of the cheap node facts on the class and its methods. */
  readonly cheapFacts: readonly string[];
  /** Messages of the cheap flags inside the class span. */
  readonly cheapFlags: readonly string[];
  /** The class source, line-numbered (`  12| code`). */
  readonly numberedSource: string;
  /** JSDoc and leading comments of the class and its methods (`Name: text`; cheap proxy 10), amendment A1. */
  readonly comments: readonly string[];
}

export interface GroupUnit {
  /** `component:<name>` or `community:<n>`. */
  readonly id: string;
  readonly kind: 'component' | 'community';
  readonly classIds: readonly string[];
}

export interface RuleCandidateUnit {
  readonly cls: ClassUnit;
  readonly methods: readonly MethodUnit[];
}

export interface OntologyUnits {
  readonly classes: readonly ClassUnit[];
  readonly groups: readonly GroupUnit[];
  readonly ruleCandidates: readonly RuleCandidateUnit[];
  /** Declaration span of every APG Class, Interface, Method and Function node the project shows (grounding). */
  readonly nodeSpans: ReadonlyMap<string, Evidence>;
  /** ts-morph declaration of every method unit (deterministic verifiers). */
  readonly methodDecls: ReadonlyMap<string, MethodDeclaration>;
  /** The project's documentation (amendment A1): every prompt gets the excerpts that mention its code. */
  readonly docs: readonly ProjectDoc[];
}

const NEIGHBOUR_EDGES = new Set(['CONSTRUCTOR_INJECTS', 'EXTENDS', 'IMPLEMENTS', 'CALLS', 'FLOWS_TO']);
const MAX_NEIGHBOURS = 25;

function byId<T extends { readonly nodeId: string }>(a: T, b: T): number {
  return a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0;
}

export function numberLines(sf: SourceFile, span: Evidence): string {
  const lines = sf.getFullText().split('\n');
  const out: string[] = [];
  const width = String(span.endLine).length;
  for (let i = span.startLine; i <= span.endLine; i++) out.push(`${String(i).padStart(width, ' ')}| ${lines[i - 1] ?? ''}`);
  return out.join('\n');
}

export function buildUnits(ctx: CheapContext, cheap: CheapEnrichment, opts: { readonly ruleMinDensity: number; readonly docs?: readonly ProjectDoc[] }): OntologyUnits {
  const nodeById = new Map<string, APGNode>(ctx.apg.nodes.map((n) => [n.id, n]));
  const nodeSpans = new Map<string, Evidence>();
  const methodDecls = new Map<string, MethodDeclaration>();
  const density = new Map<string, number>();
  const factsOf = new Map<string, string[]>();
  const docTextOf = new Map<string, string>();
  for (const f of cheap.nodeFacts) {
    if (f.key === 'logicDensity') {
      const v = typeof f.value === 'number' ? f.value : (f.value as { readonly density?: unknown } | null)?.density;
      if (typeof v === 'number') density.set(f.nodeId, v);
    }
    if (f.key === 'docText' && typeof f.value === 'string') docTextOf.set(f.nodeId, f.value);
    if (f.key === 'docText' || f.key === 'community') continue;
    factsOf.set(f.nodeId, [...(factsOf.get(f.nodeId) ?? []), `${f.key}=${JSON.stringify(f.value)}`]);
  }
  const ruleFlagged = new Set<string>();
  for (const f of cheap.flags) {
    if (f.proxy !== 'clones' && f.proxy !== 'shared-literals') continue;
    for (const e of [f, f.related]) {
      if (e?.className !== undefined && e.methodName !== undefined) ruleFlagged.add(`${e.className}.${e.methodName}`);
    }
  }

  const classes: ClassUnit[] = [];
  const ruleCandidates: RuleCandidateUnit[] = [];
  for (const { file, sf } of ctx.sources) {
    for (const iface of sf.getInterfaces()) {
      const id = ctx.nodeId('Interface', file, iface.getName());
      if (id !== undefined) nodeSpans.set(id, ctx.evidence(iface));
    }
    for (const fn of sf.getFunctions()) {
      const name = fn.getName();
      const id = name === undefined ? undefined : ctx.nodeId('Function', file, name);
      if (id !== undefined) nodeSpans.set(id, ctx.evidence(fn));
    }
    for (const cls of classesOf(sf)) {
      const name = cls.getName() ?? '';
      const nodeId = ctx.nodeId('Class', file, name);
      if (nodeId === undefined) continue;
      const span = ctx.evidence(cls);
      nodeSpans.set(nodeId, span);
      const methods: MethodUnit[] = [];
      for (const m of cls.getMethods()) {
        const mid = ctx.nodeId('Method', file, `${name}.${m.getName()}`);
        if (mid === undefined) continue;
        const mspan = ctx.evidence(m);
        nodeSpans.set(mid, mspan);
        methodDecls.set(mid, m);
        methods.push({ nodeId: mid, name: m.getName(), span: mspan, logicDensity: density.get(mid) ?? null });
      }
      const info = ctx.info(file);
      const neighbours: Neighbour[] = [];
      const memberIds = new Set([nodeId, ...methods.map((m) => m.nodeId)]);
      for (const e of ctx.apg.edges) {
        if (!NEIGHBOUR_EDGES.has(e.type)) continue;
        const out = memberIds.has(e.sourceId);
        const inn = memberIds.has(e.targetId);
        if (out === inn) continue;
        const other = nodeById.get(out ? e.targetId : e.sourceId);
        if (other === undefined) continue;
        neighbours.push({ relation: e.type, direction: out ? 'out' : 'in', nodeId: other.id, type: other.type, name: other.name, file: other.filePath });
      }
      neighbours.sort((a, b) => hostIndependentCompare(`${a.relation}|${a.direction}|${a.name}|${a.nodeId}`, `${b.relation}|${b.direction}|${b.name}|${b.nodeId}`));
      const dedup = neighbours.filter((n, i) => i === 0 || `${n.relation}${n.direction}${n.nodeId}` !== `${neighbours[i - 1]?.relation ?? ''}${neighbours[i - 1]?.direction ?? ''}${neighbours[i - 1]?.nodeId ?? ''}`);
      const cheapFacts = [nodeId, ...methods.map((m) => m.nodeId)].flatMap((id) => {
        const label = id === nodeId ? name : (nodeById.get(id)?.name ?? id);
        return (factsOf.get(id) ?? []).map((f) => `${label}: ${f}`);
      });
      const cheapFlags = cheap.flags
        .filter((f) => f.evidence.file === file && f.evidence.startLine >= span.startLine && f.evidence.endLine <= span.endLine)
        .map((f) => `${f.proxy}/${f.kind}: ${f.message}`);
      const fieldsProp = nodeById.get(nodeId)?.properties.fields;
      const unit: ClassUnit = {
        nodeId, name, file, span, component: info.component, declaredContext: declaredContextOf(file, ctx.layerModel), layer: info.layer, layerKind: info.layerKind,
        fields: Array.isArray(fieldsProp) ? fieldsProp.filter((x): x is string => typeof x === 'string') : [],
        methods, neighbours: dedup.slice(0, MAX_NEIGHBOURS), cheapFacts, cheapFlags,
        numberedSource: numberLines(sf, span),
        comments: [nodeId, ...methods.map((m) => m.nodeId)].flatMap((id) => {
          const text = docTextOf.get(id);
          return text === undefined ? [] : [`${id === nodeId ? name : (nodeById.get(id)?.name ?? id)}: ${text}`];
        }),
      };
      classes.push(unit);
      const cands = methods.filter((m) => (m.logicDensity ?? 0) >= opts.ruleMinDensity || ruleFlagged.has(`${name}.${m.name}`));
      if (cands.length > 0) ruleCandidates.push({ cls: unit, methods: cands });
    }
  }
  classes.sort(byId);
  ruleCandidates.sort((a, b) => byId(a.cls, b.cls));

  const groups: GroupUnit[] = [];
  const compMembers = new Map<string, string[]>();
  for (const c of classes) compMembers.set(c.component, [...(compMembers.get(c.component) ?? []), c.nodeId]);
  for (const [comp, ids] of [...compMembers.entries()].sort((a, b) => hostIndependentCompare(a[0], b[0]))) {
    groups.push({ id: `component:${comp}`, kind: 'component', classIds: ids });
  }
  const communityOfFile = new Map<string, number>();
  for (const f of cheap.nodeFacts) {
    if (f.key !== 'community' || typeof f.value !== 'number') continue;
    const n = nodeById.get(f.nodeId);
    if (n !== undefined) communityOfFile.set(n.filePath, f.value);
  }
  const commMembers = new Map<number, string[]>();
  for (const c of classes) {
    const k = communityOfFile.get(c.file);
    if (k !== undefined) commMembers.set(k, [...(commMembers.get(k) ?? []), c.nodeId]);
  }
  const seen = new Set(groups.map((g) => g.classIds.join(',')));
  for (const [k, ids] of [...commMembers.entries()].sort((a, b) => a[0] - b[0])) {
    const key = ids.join(',');
    if (ids.length < 2 || seen.has(key)) continue;
    seen.add(key);
    groups.push({ id: `community:${String(k)}`, kind: 'community', classIds: ids });
  }
  return { classes, groups, ruleCandidates, nodeSpans, methodDecls, docs: opts.docs ?? [] };
}
