/**
 * Proxy 4, COHESION: LCOM4 (Hitz and Montazeri 1995) per class, and a responsibility-breadth count.
 *
 * LCOM4 is the number of connected components of the graph whose nodes are the class's instance methods and
 * accessors (constructor excluded) and whose edges join two methods that access a common field (`this.f`) or where
 * one calls the other (`this.m()`). The field list is the APG's member fact `fields` on the Class node when the
 * extraction wrote it (`memberFacts`), else it is read from the AST (property declarations and constructor parameter
 * properties). 1 is cohesive; 0 means the class has no method.
 *
 * Responsibility breadth = distinct I/O categories the class reaches + distinct other components its file imports
 * (literal edge view). A `*Module` class (DI wiring) is not flagged for breadth.
 */
import { Node, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration } from 'ts-morph';
import { literalEdgeView } from '../../shared/apg-edge-view.js';
import type { CheapContext } from './context.js';
import { allClassBehaviours } from './behaviour.js';
import type { CheapFlag, CheapNodeFact, CheapProxyOutput } from './types.js';

/** Instance members that LCOM4 treats as methods, with the fields they access and the members they call. */
function memberAccesses(cls: ClassDeclaration, fields: ReadonlySet<string>): { name: string; fields: Set<string>; calls: Set<string> }[] {
  const members = [
    ...cls.getMethods().filter((m) => !m.isStatic()),
    ...cls.getGetAccessors().filter((m) => !m.isStatic()),
    ...cls.getSetAccessors().filter((m) => !m.isStatic()),
  ];
  const names = new Set(members.map((m) => m.getName()));
  return members.map((m) => {
    const fs = new Set<string>();
    const calls = new Set<string>();
    m.forEachDescendant((n) => {
      if (!Node.isPropertyAccessExpression(n) || n.getExpression().getKind() !== SyntaxKind.ThisKeyword) return;
      const name = n.getName();
      if (fields.has(name)) fs.add(name);
      else if (names.has(name)) calls.add(name);
    });
    return { name: m.getName(), fields: fs, calls };
  });
}

/** LCOM4 of a class given its field names. */
export function lcom4(cls: ClassDeclaration, fields: readonly string[]): { lcom4: number; methods: number; components: string[][] } {
  const acc = memberAccesses(cls, new Set(fields));
  const parent = acc.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] ?? r;
    return r;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  const idx = new Map(acc.map((a, i) => [a.name, i]));
  const byField = new Map<string, number>();
  acc.forEach((a, i) => {
    for (const f of a.fields) {
      const j = byField.get(f);
      if (j === undefined) byField.set(f, i);
      else union(i, j);
    }
    for (const c of a.calls) {
      const j = idx.get(c);
      if (j !== undefined) union(i, j);
    }
  });
  const groups = new Map<number, string[]>();
  acc.forEach((a, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), a.name]);
  });
  return { lcom4: groups.size, methods: acc.length, components: [...groups.values()] };
}

/** Field names of a class: the APG member fact when present, else the AST. */
export function classFields(ctx: CheapContext, file: string, cls: ClassDeclaration): { fields: string[]; source: 'member-facts' | 'ast' } {
  const name = cls.getName() ?? '';
  const node = ctx.apg.nodes.find((n) => n.type === 'Class' && n.filePath === file && n.name === name);
  const fromApg = node?.properties.fields;
  if (Array.isArray(fromApg)) return { fields: fromApg.map(String), source: 'member-facts' };
  const fields = [
    ...cls.getProperties().filter((p) => !p.isStatic()).map((p) => p.getName()),
    ...cls.getConstructors().flatMap((c) => c.getParameters().filter((p) => p.isParameterProperty()).map((p) => p.getName())),
  ];
  return { fields: [...new Set(fields)], source: 'ast' };
}

export function runCohesion(ctx: CheapContext): CheapProxyOutput {
  const flags: CheapFlag[] = [];
  const nodeFacts: CheapNodeFact[] = [];
  const importsTo = new Map<string, Set<string>>();
  const fileOfId = new Map(ctx.apg.nodes.filter((n) => n.type === 'File').map((n) => [n.id, n.filePath]));
  for (const e of literalEdgeView(ctx.apg.edges)) {
    if (e.type !== 'IMPORTS') continue;
    const s = fileOfId.get(e.sourceId);
    const t = fileOfId.get(e.targetId);
    if (s === undefined || t === undefined) continue;
    const set = importsTo.get(s) ?? new Set<string>();
    set.add(t);
    importsTo.set(s, set);
  }
  let fromFacts = 0;
  const values: number[] = [];
  for (const b of allClassBehaviours(ctx)) {
    const { fields, source } = classFields(ctx, b.file, b.cls);
    if (source === 'member-facts') fromFacts++;
    const l = lcom4(b.cls, fields);
    const own = ctx.info(b.file).component;
    const deps = new Set([...(importsTo.get(b.file) ?? [])].map((t) => ctx.info(t).component).filter((c) => c !== own));
    const ioCats = new Set(b.io.map((u) => u.category));
    const breadth = ioCats.size + deps.size;
    if (l.methods > 0) values.push(l.lcom4);
    const id = ctx.nodeId('Class', b.file, b.name);
    if (id !== undefined) {
      nodeFacts.push({ proxy: 'cohesion', nodeId: id, key: 'lcom4', value: l.lcom4, evidence: b.evidence });
      nodeFacts.push({ proxy: 'cohesion', nodeId: id, key: 'responsibilityBreadth', value: { breadth, ioCategories: [...ioCats].sort(), componentDependencies: [...deps].sort() } });
    }
    if (l.lcom4 >= ctx.options.lcom4Threshold) {
      flags.push({ proxy: 'cohesion', kind: 'low-cohesion', score: l.lcom4, evidence: b.evidence, className: b.name, message: `${b.name}: LCOM4 ${String(l.lcom4)} over ${String(l.methods)} methods (${l.components.map((c) => `{${c.join(', ')}}`).join(' ')})` });
    }
    // Composition roots (`*Module`) import every component by design.
    if (breadth >= ctx.options.breadthThreshold && b.nameRole !== 'module') {
      flags.push({ proxy: 'cohesion', kind: 'broad-responsibility', score: breadth, evidence: b.evidence, className: b.name, message: `${b.name}: ${String(ioCats.size)} I/O categories, ${String(deps.size)} other components` });
    }
  }
  const mean = values.length === 0 ? 0 : values.reduce((s, x) => s + x, 0) / values.length;
  return { edges: [], nodeFacts, flags, summary: { classesWithMethods: values.length, meanLcom4: mean, fieldsFromMemberFacts: fromFacts } };
}
