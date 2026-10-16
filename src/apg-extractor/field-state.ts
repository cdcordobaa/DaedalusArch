import { Node, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, PropertyDeclaration, Type } from 'ts-morph';
import type { APGEdge } from '../shared/types/apg.js';
import type { NodeLookup } from './types.js';
import { generateEdgeId, normalizeFilePath } from './id-generator.js';

/**
 * v1.3 field-level state facts (`ExtractorOptions.fieldState`, OFF in `V12E_DEFAULT_OPTIONS` and in
 * `V13_DEFAULT_OPTIONS`; ON in `V13_FIELD_STATE_OPTIONS`). `Class -[:HOLDS_STATE_OF {field, source, line, sources,
 * fields}]-> Class|Interface`: an instance field of the class holds a value of an extracted class or interface.
 *
 * ADR-023 recorded FLOWS_TO (D8 scope, `flows-to-deriver.ts`) as near-empty on real code, which is why the sealed
 * `Docs/v1.3/rule-tiers.md` reports the FF-P06 field half N/A. This edge widens the fact the field half needs, without
 * touching FLOWS_TO: what a field holds, from five sources (`source`):
 * - `declared-type`: the field's type annotation (`private repo: SqlRepo;`);
 * - `property-injection`: the same, on a property carrying an injection decorator (`@Inject() repo: SqlRepo`);
 * - `initializer`: an instance property initialiser `f = new X()`;
 * - `constructor-new`: `this.f = new X()` in the constructor body;
 * - `constructor-param`: `this.f = p` in the constructor body, `p` a constructor parameter whose type is `X`.
 * Constructor parameter properties (`constructor(private repo: X)`) are not sources: they are CONSTRUCTOR_INJECTS, the
 * other FF-P06 half, and a second edge for them would count the same holding twice.
 *
 * Type resolution: `T | null` and `T | undefined` (optional fields included) unwrap to `T`; the element or value type of
 * the built-in containers (`T[]`, `Array`, `ReadonlyArray`, `Promise`, `Set`, `ReadonlySet`, `Map` / `ReadonlyMap`
 * values, `WeakRef`) is followed; any other union or intersection is skipped. A user generic (`Repository<Order>`) holds
 * the generic class itself, not its type arguments, and an external generic (TypeORM's `Repository<T>`) is not extracted,
 * so it gives no edge. Static fields, self-loops and unextracted targets give no edge. One edge per target: the minimum
 * `(line, field)` candidate gives `field`, `source` and `line`; `sources` and `fields` list every candidate's kind and
 * field for that target, in source order.
 */
export type FieldStateSource = 'declared-type' | 'property-injection' | 'initializer' | 'constructor-new' | 'constructor-param';

export const FIELD_STATE_SOURCES: readonly FieldStateSource[] = Object.freeze([
  'declared-type', 'property-injection', 'initializer', 'constructor-new', 'constructor-param',
]);

export interface HoldsStateOfEdgeProperties {
  readonly field: string;
  readonly source: FieldStateSource;
  readonly line: number;
  readonly sources: readonly FieldStateSource[];
  readonly fields: readonly string[];
}

/** Property decorators that inject the field's value (NestJS, TypeORM, Mongoose, InversifyJS, TypeDI, tsyringe-style). */
export const PROPERTY_INJECTION_DECORATORS: ReadonlySet<string> = new Set([
  'Inject', 'inject', 'InjectRepository', 'InjectModel', 'InjectConnection', 'InjectDataSource', 'InjectEntityManager',
  'Autowired', 'LazyInject', 'lazyInject', 'injectProperty', 'Value',
]);

/** Built-in containers whose type arguments are what the field holds (the last argument: a Map's value). */
const CONTAINERS = new Set(['Array', 'ReadonlyArray', 'Promise', 'Set', 'ReadonlySet', 'Map', 'ReadonlyMap', 'WeakRef']);

interface Candidate {
  readonly field: string;
  readonly source: FieldStateSource;
  readonly line: number;
  readonly targetId: string;
}

export function deriveHoldsStateOfEdges(
  cls: ClassDeclaration,
  classNodeId: string,
  lookup: NodeLookup,
  projectRoot: string,
): readonly APGEdge[] {
  const fields = new Map<string, PropertyDeclaration>();
  for (const prop of cls.getProperties()) if (!prop.isStatic()) fields.set(prop.getName(), prop);
  if (fields.size === 0) return [];

  const candidates: Candidate[] = [];
  const consider = (field: string, source: FieldStateSource, type: Type, line: number): void => {
    for (const targetId of resolveHeldTargets(type, lookup, projectRoot)) {
      if (targetId !== classNodeId) candidates.push({ field, source, line, targetId });
    }
  };

  for (const prop of fields.values()) {
    const typeNode = prop.getTypeNode();
    if (typeNode !== undefined) {
      const injected = prop.getDecorators().some((d) => PROPERTY_INJECTION_DECORATORS.has(d.getName()));
      consider(prop.getName(), injected ? 'property-injection' : 'declared-type', typeNode.getType(), prop.getStartLineNumber());
    }
    const init = prop.getInitializer();
    if (init !== undefined && Node.isNewExpression(init)) consider(prop.getName(), 'initializer', init.getType(), init.getStartLineNumber());
  }

  for (const ctor of cls.getConstructors()) {
    const body = ctor.getBody();
    if (body === undefined) continue;
    const params = new Map(ctor.getParameters().map((p) => [p.getName(), p]));
    body.forEachDescendant((node, traversal) => {
      // Functions and classes rebind `this`; arrow functions do not.
      if (Node.isFunctionDeclaration(node) || Node.isFunctionExpression(node) || Node.isClassDeclaration(node) || Node.isClassExpression(node)) {
        traversal.skip();
        return;
      }
      if (!Node.isBinaryExpression(node) || node.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) return;
      const left = node.getLeft();
      if (!Node.isPropertyAccessExpression(left) || left.getExpression().getKind() !== SyntaxKind.ThisKeyword) return;
      const field = left.getName();
      if (!fields.has(field)) return;
      const right = unwrapExpression(node.getRight());
      if (Node.isNewExpression(right)) {
        consider(field, 'constructor-new', right.getType(), node.getStartLineNumber());
      } else if (Node.isIdentifier(right)) {
        const param = params.get(right.getText());
        if (param !== undefined && !param.isParameterProperty()) consider(field, 'constructor-param', param.getType(), node.getStartLineNumber());
      }
    });
  }

  const kept = new Map<string, { first: Candidate; sources: FieldStateSource[]; fields: string[] }>();
  const ordered = [...candidates].sort((a, b) => a.line - b.line || compare(a.field, b.field) || FIELD_STATE_SOURCES.indexOf(a.source) - FIELD_STATE_SOURCES.indexOf(b.source));
  for (const c of ordered) {
    const prev = kept.get(c.targetId);
    if (prev === undefined) {
      kept.set(c.targetId, { first: c, sources: [c.source], fields: [c.field] });
      continue;
    }
    if (!prev.sources.includes(c.source)) prev.sources.push(c.source);
    if (!prev.fields.includes(c.field)) prev.fields.push(c.field);
  }

  return [...kept.values()].map(({ first, sources, fields: fieldList }) => {
    const properties: HoldsStateOfEdgeProperties = { field: first.field, source: first.source, line: first.line, sources, fields: fieldList };
    return {
      id: generateEdgeId('HOLDS_STATE_OF', classNodeId, first.targetId),
      type: 'HOLDS_STATE_OF' as const,
      sourceId: classNodeId,
      targetId: first.targetId,
      properties: { ...properties },
    };
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** `(x)`, `x as T`, `x!` and `<T>x` hold the same value as `x`. */
function unwrapExpression(node: Node): Node {
  let cur = node;
  for (;;) {
    if (Node.isParenthesizedExpression(cur) || Node.isAsExpression(cur) || Node.isNonNullExpression(cur) || Node.isTypeAssertion(cur)) {
      cur = cur.getExpression();
    } else {
      return cur;
    }
  }
}

/** The extracted Class / Interface node ids a value of `type` holds (see the file comment); empty when none. */
export function resolveHeldTargets(type: Type, lookup: NodeLookup, projectRoot: string, depth = 0): string[] {
  if (depth > 4) return [];
  if (type.isUnion()) {
    const rest = type.getUnionTypes().filter((t) => !t.isNull() && !t.isUndefined());
    // `boolean` is the union `true | false`; a non-nullable union of several members is skipped.
    const only = rest.length === 1 ? rest[0] : undefined;
    return only === undefined ? [] : resolveHeldTargets(only, lookup, projectRoot, depth + 1);
  }
  if (type.isIntersection()) return [];
  if (type.isArray() || type.isReadonlyArray()) {
    const el = type.getArrayElementType();
    return el === undefined ? [] : resolveHeldTargets(el, lookup, projectRoot, depth + 1);
  }
  const symbol = type.getSymbol() ?? type.getAliasSymbol();
  if (symbol === undefined) return [];
  if (CONTAINERS.has(symbol.getName())) {
    const args = type.getTypeArguments();
    const held = args[args.length - 1];
    return held === undefined ? [] : resolveHeldTargets(held, lookup, projectRoot, depth + 1);
  }
  const decl = symbol.getDeclarations()[0];
  if (decl === undefined || (!Node.isClassDeclaration(decl) && !Node.isInterfaceDeclaration(decl))) return [];
  const name = decl.getName();
  if (name === undefined) return [];
  const targetPath = normalizeFilePath(decl.getSourceFile().getFilePath(), projectRoot);
  const targetId = lookup.typeNodes.get(`${name.toLowerCase()}@${targetPath}`);
  return targetId === undefined ? [] : [targetId];
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
