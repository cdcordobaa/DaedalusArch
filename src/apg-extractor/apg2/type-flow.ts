import { Node, Scope } from 'ts-morph';
import type { SourceFile, Type } from 'ts-morph';
import type { APGEdge } from '../../shared/types/apg.js';
import type { NodeLookup } from '../types.js';
import { normalizeFilePath } from '../id-generator.js';
import { apg2Edge } from './common.js';

/**
 * Enrichment 1, type flow across boundaries: SIGNATURE_USES edges from a Method or Function node to every Class or
 * Interface node named by its parameter and return types, as the type checker resolves them (so an inferred return
 * type counts, and so does a type reached through an alias, a generic argument, `Promise<T>`, an array, a union or an
 * intersection, or a property of an anonymous object type). Edge properties:
 * - `positions`: `param` and/or `return`;
 * - `inferred`: true when the type reaches the edge only through a return type with no annotation;
 * - `visibility` of the method (`public` for functions), `ownerExported` (the declaring class / interface / function
 *   is exported) and `publicSurface` = public and exported.
 */

const MAX_DEPTH = 4;

interface Use {
  positions: Set<'param' | 'return'>;
  inferredOnly: boolean;
}

/** Every class or interface declaration a type names, through aliases, generics, arrays, unions and object members. */
export function declarationsOfType(type: Type, out: Set<Node>, seen = new Set<Type>(), depth = 0): void {
  if (depth > MAX_DEPTH || seen.has(type)) return;
  seen.add(type);
  if (type.isUnion()) {
    for (const t of type.getUnionTypes()) declarationsOfType(t, out, seen, depth + 1);
    return;
  }
  if (type.isIntersection()) {
    for (const t of type.getIntersectionTypes()) declarationsOfType(t, out, seen, depth + 1);
    return;
  }
  for (const a of type.getAliasTypeArguments()) declarationsOfType(a, out, seen, depth + 1);
  if (type.isArray()) {
    const el = type.getArrayElementType();
    if (el !== undefined) declarationsOfType(el, out, seen, depth + 1);
    return;
  }
  if (type.isTuple()) {
    for (const t of type.getTupleElements()) declarationsOfType(t, out, seen, depth + 1);
    return;
  }
  for (const a of type.getTypeArguments()) declarationsOfType(a, out, seen, depth + 1);
  const symbol = type.getSymbol();
  if (symbol !== undefined) {
    for (const d of symbol.getDeclarations()) {
      if (Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d)) out.add(d);
    }
  }
  if (type.isAnonymous() && !type.getCallSignatures().length && symbol !== undefined) {
    // An object literal type (`{ user: UserEntity }`): its members' types flow too.
    for (const prop of type.getProperties()) {
      const decl = prop.getValueDeclaration();
      if (decl !== undefined) declarationsOfType(decl.getType(), out, seen, depth + 1);
    }
  }
}

interface Signature {
  getParameters(): { getType(): Type }[];
  getReturnType(): Type;
  getReturnTypeNode(): Node | undefined;
}

function collectUses(sig: Signature, ownerDecl: Node | undefined): Map<Node, Use> {
  const uses = new Map<Node, Use>();
  const add = (decls: Set<Node>, pos: 'param' | 'return', inferred: boolean): void => {
    for (const d of decls) {
      if (d === ownerDecl) continue; // fluent `this`-returning methods name their own class
      const u = uses.get(d) ?? { positions: new Set(), inferredOnly: true };
      u.positions.add(pos);
      if (!inferred) u.inferredOnly = false;
      uses.set(d, u);
    }
  };
  for (const p of sig.getParameters()) {
    const decls = new Set<Node>();
    declarationsOfType(p.getType(), decls);
    add(decls, 'param', false);
  }
  const ret = new Set<Node>();
  declarationsOfType(sig.getReturnType(), ret);
  add(ret, 'return', sig.getReturnTypeNode() === undefined);
  return uses;
}

export function extractSignatureUses(sourceFiles: readonly SourceFile[], lookup: NodeLookup, projectRoot: string): APGEdge[] {
  const edges: APGEdge[] = [];
  const targetId = (d: Node): string | undefined => {
    const name = (Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d)) ? d.getName() ?? '<anonymous>' : undefined;
    if (name === undefined) return undefined;
    return lookup.typeNodes.get(`${name.toLowerCase()}@${normalizeFilePath(d.getSourceFile().getFilePath(), projectRoot)}`);
  };
  const emit = (sourceId: string, uses: Map<Node, Use>, visibility: string, ownerExported: boolean): void => {
    const seen = new Set<string>();
    for (const [decl, use] of uses) {
      const t = targetId(decl);
      if (t === undefined || seen.has(t)) continue;
      seen.add(t);
      const positions = [...use.positions].sort();
      edges.push(apg2Edge('SIGNATURE_USES', sourceId, t, {
        positions,
        inferred: use.inferredOnly && positions.length === 1 && positions[0] === 'return',
        visibility,
        ownerExported,
        publicSurface: visibility === 'public' && ownerExported,
      }));
    }
  };

  for (const sf of sourceFiles) {
    const filePath = normalizeFilePath(sf.getFilePath(), projectRoot);
    for (const cls of sf.getClasses()) {
      const clsName = cls.getName() ?? '<anonymous>';
      for (const m of cls.getMethods()) {
        const id = lookup.methodNodes.get(`${`${clsName}.${m.getName()}`.toLowerCase()}@${filePath}`);
        if (id === undefined) continue;
        try {
          const scope = m.getName().startsWith('#') ? Scope.Private : m.getScope();
          const visibility = scope === Scope.Private ? 'private' : scope === Scope.Protected ? 'protected' : 'public';
          emit(id, collectUses(m, cls), visibility, cls.isExported());
        } catch {
          // lenient: unresolvable signature
        }
      }
    }
    for (const iface of sf.getInterfaces()) {
      const seenNames = new Set<string>();
      for (const sig of iface.getMethods()) {
        if (seenNames.has(sig.getName())) continue;
        seenNames.add(sig.getName());
        const id = lookup.methodNodes.get(`${`${iface.getName()}.${sig.getName()}`.toLowerCase()}@${filePath}`);
        if (id === undefined) continue;
        try {
          emit(id, collectUses(sig, iface), 'public', iface.isExported());
        } catch {
          // lenient
        }
      }
    }
    for (const fn of sf.getFunctions()) {
      const name = fn.getName();
      const id = name !== undefined ? lookup.functionNodes.get(`${name.toLowerCase()}@${filePath}`) : undefined;
      if (id === undefined) continue;
      try {
        emit(id, collectUses(fn, undefined), 'public', fn.isExported());
      } catch {
        // lenient
      }
    }
    for (const vs of sf.getVariableStatements()) {
      for (const decl of vs.getDeclarations()) {
        const init = decl.getInitializer();
        if (init === undefined || !Node.isArrowFunction(init)) continue;
        const id = lookup.functionNodes.get(`${decl.getName().toLowerCase()}@${filePath}`);
        if (id === undefined) continue;
        try {
          emit(id, collectUses(init, undefined), 'public', vs.isExported());
        } catch {
          // lenient
        }
      }
    }
  }
  return edges;
}
