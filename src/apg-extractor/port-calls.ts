import { Node, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, InterfaceDeclaration, SourceFile, Type } from 'ts-morph';
import type { APGEdge } from '../shared/types/apg.js';
import type { NodeLookup } from './types.js';
import { generateEdgeId, normalizeFilePath } from './id-generator.js';

/**
 * v1.5.6 calls through ports (`portCalls` extractor option, OFF in every frozen default; ON in `V15_APG_OPTIONS`).
 * `ops/notes/v15-calls-through-ports.md`.
 *
 * CALLS_VIA_PORT (Method → Method): a class method calls a member of a port, an interface or an abstract class, on a
 * receiver whose static type is that port; the edge goes to every concrete method that can run there: the member's own
 * body-bearing declaration on each class that implements the port (directly, through a sub-interface, or as a
 * subclass of an implementer), or the nearest base class's body when the class inherits it. CALLS is unchanged: it
 * still targets class method declarations only, so a call on a concrete class writes CALLS and no CALLS_VIA_PORT.
 *
 * Everything is resolved by the type checker (aliased imports and re-exports resolve to the declaration), and an
 * endpoint must be an extracted node: a port, an implementation or a method outside the extracted set gives no edge.
 * Implementations by object literal or factory function are not classes and give no edge.
 */
export const PORT_CALL_EDGE = 'CALLS_VIA_PORT' as const;

type TypeDecl = ClassDeclaration | InterfaceDeclaration;

interface PortSite { readonly sourceId: string; readonly portId: string; readonly member: string; readonly line: number; readonly pos: number }

export function derivePortCallEdges(sourceFiles: readonly SourceFile[], lookup: NodeLookup, projectRoot: string): APGEdge[] {
  const typeId = (d: Node): string | undefined => {
    if (!Node.isClassDeclaration(d) && !Node.isInterfaceDeclaration(d)) return undefined;
    const name = d.getName();
    if (name === undefined) return undefined;
    return lookup.typeNodes.get(`${name.toLowerCase()}@${normalizeFilePath(d.getSourceFile().getFilePath(), projectRoot)}`);
  };

  // ── Pass 1: the type facts (resolved by the checker, keyed by node id) ─────────────────────────────────────
  const decls = new Map<string, TypeDecl>();
  const baseClass = new Map<string, string>(); // class → its base class (as EXTENDS)
  const implemented = new Map<string, Set<string>>(); // class → interfaces in its implements clause
  const baseIfaces = new Map<string, Set<string>>(); // interface → interfaces it extends
  const ownMethods = new Map<string, Map<string, string>>(); // class → member name → Method id, body-bearing only
  for (const sf of sourceFiles) {
    const filePath = normalizeFilePath(sf.getFilePath(), projectRoot);
    for (const cls of sf.getClasses()) {
      const id = typeId(cls);
      if (id === undefined) continue;
      decls.set(id, cls);
      const base = cls.getBaseClass();
      const baseId = base ? typeId(base) : undefined;
      if (baseId !== undefined) baseClass.set(id, baseId);
      const ifs = new Set<string>();
      for (const h of cls.getImplements()) {
        try {
          const t = h.getType();
          for (const d of (t.getSymbol() ?? t.getAliasSymbol())?.getDeclarations() ?? []) {
            const i = Node.isInterfaceDeclaration(d) ? typeId(d) : undefined;
            if (i !== undefined) ifs.add(i);
          }
        } catch {
          // lenient: an unresolvable heritage clause adds no implementation
        }
      }
      implemented.set(id, ifs);
      const own = new Map<string, string>();
      for (const m of cls.getMethods()) {
        if (m.isAbstract() || m.getBody() === undefined) continue;
        const mid = lookup.methodNodes.get(`${`${cls.getName() ?? '<anonymous>'}.${m.getName()}`.toLowerCase()}@${filePath}`);
        if (mid !== undefined) own.set(m.getName(), mid);
      }
      ownMethods.set(id, own);
    }
    for (const iface of sf.getInterfaces()) {
      const id = typeId(iface);
      if (id === undefined) continue;
      decls.set(id, iface);
      const bases = new Set<string>();
      for (const b of iface.getBaseDeclarations()) { const bid = typeId(b); if (bid !== undefined) bases.add(bid); }
      baseIfaces.set(id, bases);
    }
  }

  const isPort = (id: string): boolean => {
    const d = decls.get(id);
    return d !== undefined && (Node.isInterfaceDeclaration(d) || d.isAbstract());
  };
  const extendsIface = (i: string, port: string, seen = new Set<string>()): boolean => {
    if (i === port) return true;
    if (seen.has(i)) return false;
    seen.add(i);
    return [...(baseIfaces.get(i) ?? [])].some((b) => extendsIface(b, port, seen));
  };
  const chain = (cls: string): string[] => {
    const out: string[] = [];
    for (let c: string | undefined = cls; c !== undefined && !out.includes(c); c = baseClass.get(c)) out.push(c);
    return out;
  };
  /** The classes that implement a port: its implementers (and their subclasses), or an abstract class's subclasses. */
  const implementers = (port: string): string[] => {
    const d = decls.get(port);
    const iface = d !== undefined && Node.isInterfaceDeclaration(d);
    return [...ownMethods.keys()].filter((c) => chain(c).some((x) =>
      iface ? [...(implemented.get(x) ?? [])].some((i) => extendsIface(i, port)) : x === port && c !== port));
  };
  /** The method that runs for `member` on class `c`: its own body, else the nearest base class's. */
  const runs = (c: string, member: string): string | undefined => {
    for (const x of chain(c)) { const m = ownMethods.get(x)?.get(member); if (m !== undefined) return m; }
    return undefined;
  };

  // The in-tree port types a receiver's static type names (a union's members; a type parameter's constraint).
  const receiverPorts = (t: Type, depth = 0): string[] => {
    if (depth > 3) return [];
    if (t.isTypeParameter()) { const c = t.getConstraint(); return c ? receiverPorts(c, depth + 1) : []; }
    if (t.isUnion()) return t.getUnionTypes().flatMap((u) => receiverPorts(u, depth + 1));
    const ids = ((t.getSymbol() ?? t.getAliasSymbol())?.getDeclarations() ?? []).map(typeId).filter((x): x is string => x !== undefined);
    return [...new Set(ids)];
  };

  // ── Pass 2: call sites on a port-typed receiver, in class methods (the CALLS scope) ───────────────────────
  const sites: PortSite[] = [];
  for (const sf of sourceFiles) {
    const filePath = normalizeFilePath(sf.getFilePath(), projectRoot);
    for (const cls of sf.getClasses()) {
      const clsName = cls.getName() ?? '<anonymous>';
      if (typeId(cls) === undefined) continue;
      for (const method of cls.getMethods()) {
        const sourceId = lookup.methodNodes.get(`${`${clsName}.${method.getName()}`.toLowerCase()}@${filePath}`);
        if (sourceId === undefined) continue;
        for (const call of method.getDescendantsOfKind(SyntaxKind.CallExpression)) {
          try {
            const expr = call.getExpression();
            if (!Node.isPropertyAccessExpression(expr)) continue;
            const member = expr.getName();
            // The member must be a port member: an interface method signature or an abstract method.
            const portMember = (expr.getNameNode().getSymbol()?.getDeclarations() ?? []).some((d) =>
              (Node.isMethodSignature(d) && Node.isInterfaceDeclaration(d.getParent())) || (Node.isMethodDeclaration(d) && d.isAbstract()));
            if (!portMember) continue;
            for (const portId of receiverPorts(expr.getExpression().getType())) {
              if (isPort(portId)) sites.push({ sourceId, portId, member, line: call.getStartLineNumber(), pos: call.getStart() });
            }
          } catch {
            // lenient: skip an unresolvable call
          }
        }
      }
    }
  }

  // ── Edges: one per (call site method, implementation method), in first-site order ─────────────────────────
  const edges = new Map<string, { sourceId: string; targetId: string; lines: Set<number>; calls: Set<number>; ports: Set<string>; member: string }>();
  const implCache = new Map<string, string[]>();
  for (const s of sites) {
    const impls = implCache.get(s.portId) ?? implementers(s.portId);
    implCache.set(s.portId, impls);
    const port = decls.get(s.portId);
    if (port === undefined) continue;
    const portName = `${port.getName() ?? ''}@${normalizeFilePath(port.getSourceFile().getFilePath(), projectRoot)}`;
    for (const c of impls) {
      const targetId = runs(c, s.member);
      if (targetId === undefined) continue;
      const key = `${s.sourceId}\u0000${targetId}`;
      const e = edges.get(key) ?? { sourceId: s.sourceId, targetId, lines: new Set<number>(), calls: new Set<number>(), ports: new Set<string>(), member: s.member };
      e.lines.add(s.line); e.calls.add(s.pos); e.ports.add(portName);
      edges.set(key, e);
    }
  }
  return [...edges.values()].map((e) => ({
    id: generateEdgeId(PORT_CALL_EDGE, e.sourceId, e.targetId),
    type: PORT_CALL_EDGE,
    sourceId: e.sourceId,
    targetId: e.targetId,
    properties: { callCount: e.calls.size, lines: [...e.lines].sort((a, b) => a - b), ports: [...e.ports].sort(), member: e.member },
  }));
}
