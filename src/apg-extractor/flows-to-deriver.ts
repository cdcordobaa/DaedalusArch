import { Node, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, Expression, Type } from 'ts-morph';
import type { APGEdge, FlowsToEdgeProperties } from '../shared/types/apg.js';
import type { NodeLookup } from './types.js';
import { generateEdgeId, normalizeFilePath } from './id-generator.js';

/** One store of a value into an instance field of the source class (`domain-entities.md` §2.8). */
interface FlowsToCandidate {
  readonly field: string;
  readonly via: FlowsToEdgeProperties['via'];
  readonly line: number;
  readonly targetId: string;
}

/**
 * Derives `Class -[:FLOWS_TO {field, via, line}]-> Class|Interface` edges within the D8 scope
 * (FR-21 reduced; BR-U2-27..29; `business-logic-model.md` §5):
 * - instance property initialiser `f = new T(...)` → `via: 'new'`;
 * - `this.f = new T(...)` anywhere in the class → `via: 'new'`;
 * - `this.f = expr` (not a `new`) outside the constructor → `via: 'field-assignment'`.
 * `this` must bind to the class and `f` must be an instance field declared in the class
 * (property declaration or constructor parameter property). Constructor-parameter flows are
 * CONSTRUCTOR_INJECTS, not FLOWS_TO. Union and intersection value types are skipped, type
 * arguments are never inspected, self-loops are dropped, and the target must be an extracted
 * Class or Interface. One edge per target: the minimum `(line, field)` candidate with its `via`.
 * No FLOWS_TO-specific warning is emitted; `_addWarning` is kept for the C1 method contract.
 */
export function deriveFlowsToEdges(
  cls: ClassDeclaration,
  classNodeId: string,
  lookup: NodeLookup,
  projectRoot: string,
  _addWarning?: (filePath: string, code: string, message: string) => void,
): readonly APGEdge[] {
  const instanceFields = collectInstanceFields(cls);
  if (instanceFields.size === 0) return [];

  const candidates: FlowsToCandidate[] = [];
  const consider = (field: string, via: FlowsToCandidate['via'], valueExpr: Expression, line: number): void => {
    const targetId = resolveTarget(valueExpr.getType(), lookup, projectRoot);
    if (targetId === undefined || targetId === classNodeId) return; // not extracted, or self-loop
    candidates.push({ field, via, line, targetId });
  };

  // (1) Instance property initialisers `f = new T(...)`.
  for (const prop of cls.getProperties()) {
    if (prop.isStatic()) continue;
    const init = prop.getInitializer();
    if (init === undefined || !Node.isNewExpression(init)) continue;
    consider(prop.getName(), 'new', init, init.getStartLineNumber());
  }

  // (2) and (3) Assignments `this.f = …` whose `this` binds to the class.
  for (const bin of cls.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) continue;
    const left = bin.getLeft();
    if (!Node.isPropertyAccessExpression(left)) continue;
    if (left.getExpression().getKind() !== SyntaxKind.ThisKeyword) continue;
    const field = left.getName();
    if (!instanceFields.has(field)) continue;
    const container = thisContainer(left);
    if (container === undefined || !isInstanceMemberOf(container, cls)) continue;

    const right = bin.getRight();
    if (Node.isNewExpression(right)) {
      consider(field, 'new', right, bin.getStartLineNumber());
    } else if (!Node.isConstructorDeclaration(container)) {
      consider(field, 'field-assignment', right, bin.getStartLineNumber());
    }
    // Constructor-body assignments from non-`new` expressions are excluded (D8).
  }

  // One edge per target: keep the minimum (line, field) (BR-U2-29).
  const kept = new Map<string, FlowsToCandidate>();
  for (const c of candidates) {
    const prev = kept.get(c.targetId);
    if (prev === undefined || c.line < prev.line || (c.line === prev.line && c.field < prev.field)) {
      kept.set(c.targetId, c);
    }
  }

  return [...kept.values()]
    .sort((a, b) => a.line - b.line || compare(a.field, b.field) || compare(a.targetId, b.targetId))
    .map(c => {
      const properties: FlowsToEdgeProperties = { field: c.field, via: c.via, line: c.line };
      return {
        id: generateEdgeId('FLOWS_TO', classNodeId, c.targetId),
        type: 'FLOWS_TO' as const,
        sourceId: classNodeId,
        targetId: c.targetId,
        properties: { ...properties },
      };
    });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Instance fields declared in the class itself: non-static properties and constructor parameter properties. */
function collectInstanceFields(cls: ClassDeclaration): Set<string> {
  const fields = new Set<string>();
  for (const prop of cls.getProperties()) {
    if (!prop.isStatic()) fields.add(prop.getName());
  }
  for (const ctor of cls.getConstructors()) {
    for (const param of ctor.getParameters()) {
      if (param.isParameterProperty()) fields.add(param.getName());
    }
  }
  return fields;
}

/**
 * The node that gives `this` its binding: the nearest enclosing non-arrow function, property
 * declaration, class static block or class. Arrow functions are transparent.
 */
function thisContainer(node: Node): Node | undefined {
  for (let cur = node.getParent(); cur !== undefined; cur = cur.getParent()) {
    if (Node.isArrowFunction(cur)) continue;
    if (
      Node.isMethodDeclaration(cur) ||
      Node.isConstructorDeclaration(cur) ||
      Node.isGetAccessorDeclaration(cur) ||
      Node.isSetAccessorDeclaration(cur) ||
      Node.isPropertyDeclaration(cur) ||
      Node.isFunctionDeclaration(cur) ||
      Node.isFunctionExpression(cur) ||
      Node.isClassStaticBlockDeclaration(cur) ||
      Node.isClassDeclaration(cur) ||
      Node.isClassExpression(cur)
    ) {
      return cur;
    }
  }
  return undefined;
}

/** True when `container` is a non-static member of `cls`, so `this` is a `cls` instance. */
function isInstanceMemberOf(container: Node, cls: ClassDeclaration): boolean {
  if (container.getParent() !== cls) return false;
  if (Node.isConstructorDeclaration(container)) return true;
  if (
    Node.isMethodDeclaration(container) ||
    Node.isGetAccessorDeclaration(container) ||
    Node.isSetAccessorDeclaration(container) ||
    Node.isPropertyDeclaration(container)
  ) {
    return !container.isStatic();
  }
  return false;
}

/** The extracted Class/Interface node of a value type, or undefined (unions, intersections, unextracted types). */
function resolveTarget(type: Type, lookup: NodeLookup, projectRoot: string): string | undefined {
  if (type.isUnion() || type.isIntersection()) return undefined; // no unwrapping (Q9 A)
  const symbol = type.getSymbol() ?? type.getAliasSymbol();
  const decl = symbol?.getDeclarations()[0];
  if (decl === undefined) return undefined;
  if (!Node.isClassDeclaration(decl) && !Node.isInterfaceDeclaration(decl)) return undefined;
  const name = decl.getName();
  if (name === undefined) return undefined;
  const targetPath = normalizeFilePath(decl.getSourceFile().getFilePath(), projectRoot);
  return lookup.typeNodes.get(`${name.toLowerCase()}@${targetPath}`);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
