import { Node, Scope, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, MethodDeclaration } from 'ts-morph';

/**
 * v1.3 class-member facts (`ExtractorOptions.memberFacts`, OFF in `V12E_DEFAULT_OPTIONS`). They let a template check
 * value-object immutability as a declaration fact (FF-DT03, Evans 2003 ch. 5) instead of a method-name proxy
 * (`aidlc-docs/construction/v1.3-member-facts/notes.md`).
 *
 * The facts are written as properties of the existing Class and Method nodes, not as new Member nodes: every fact is
 * a name list, which Neo4j stores as a property; a Member node type would change the node set every reader counts
 * (abstraction ratio, orphans, graph-mode allow-lists, ingestion checks) for facts no edge needs to point to.
 *
 * Every list holds member names in source order, without duplicates. A `#private` name keeps its `#`. Static
 * accessors and static methods are left out of the accessor and mutator lists: they act on the class, not on a value.
 */
export interface ClassMemberFacts {
  /** Property declarations and constructor parameter properties (instance and static). */
  readonly fields: string[];
  readonly readonlyFields: string[];
  readonly staticFields: string[];
  /** Visibility of each field: an explicit `public` or no modifier is public; `#name` is private. */
  readonly publicFields: string[];
  readonly protectedFields: string[];
  readonly privateFields: string[];
  /** Non-static `get` / `set` accessors, any visibility. */
  readonly getAccessors: string[];
  readonly setAccessors: string[];
  /**
   * Public non-static methods, and public non-static properties initialised with an arrow function, whose body
   * assigns a `this.<field>` (see {@link assignedThisFields}).
   */
  readonly mutatorMethods: string[];
  /** Fields assigned through `this.<field>` in any non-static member body other than the constructor. */
  readonly fieldsAssignedOutsideConstructor: string[];
}

/** Method-node facts: the method's visibility and the `this.<field>` names its body assigns. */
export interface MethodMemberFacts {
  readonly visibility: 'public' | 'protected' | 'private';
  readonly assignedFields: string[];
}

/** Every property name the option writes, on Class nodes then on Method nodes. */
export const MEMBER_FACT_KEYS: readonly string[] = Object.freeze([
  'fields', 'readonlyFields', 'staticFields', 'publicFields', 'protectedFields', 'privateFields',
  'getAccessors', 'setAccessors', 'mutatorMethods', 'fieldsAssignedOutsideConstructor',
  'visibility', 'assignedFields',
]);

const ASSIGNMENT_OPERATORS = new Set<SyntaxKind>([
  SyntaxKind.EqualsToken, SyntaxKind.PlusEqualsToken, SyntaxKind.MinusEqualsToken, SyntaxKind.AsteriskEqualsToken,
  SyntaxKind.AsteriskAsteriskEqualsToken, SyntaxKind.SlashEqualsToken, SyntaxKind.PercentEqualsToken,
  SyntaxKind.LessThanLessThanEqualsToken, SyntaxKind.GreaterThanGreaterThanEqualsToken,
  SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken, SyntaxKind.AmpersandEqualsToken, SyntaxKind.BarEqualsToken,
  SyntaxKind.CaretEqualsToken, SyntaxKind.BarBarEqualsToken, SyntaxKind.AmpersandAmpersandEqualsToken,
  SyntaxKind.QuestionQuestionEqualsToken,
]);

/** Nodes with their own `this`: a walk for the enclosing member's `this` does not enter them. */
const OWN_THIS = new Set<SyntaxKind>([
  SyntaxKind.FunctionDeclaration, SyntaxKind.FunctionExpression, SyntaxKind.ClassDeclaration,
  SyntaxKind.ClassExpression, SyntaxKind.MethodDeclaration, SyntaxKind.GetAccessor, SyntaxKind.SetAccessor,
  SyntaxKind.Constructor,
]);

function pushUnique(list: string[], name: string): void {
  if (!list.includes(name)) list.push(name);
}

/** The field named by `this.x`, `this.#x` or `this['x']`; undefined for anything else (`this.x.y` included). */
function thisFieldName(node: Node): string | undefined {
  const target = Node.isParenthesizedExpression(node) ? node.getExpression() : node;
  if (Node.isPropertyAccessExpression(target) && target.getExpression().getKind() === SyntaxKind.ThisKeyword) {
    return target.getName();
  }
  if (Node.isElementAccessExpression(target) && target.getExpression().getKind() === SyntaxKind.ThisKeyword) {
    const arg = target.getArgumentExpression();
    if (arg !== undefined && (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg))) return arg.getLiteralValue();
  }
  return undefined;
}

/** Assignment targets of a left-hand side: the side itself, or every `this` field inside a destructuring pattern. */
function collectTargets(lhs: Node, out: string[]): void {
  const direct = thisFieldName(lhs);
  if (direct !== undefined) {
    pushUnique(out, direct);
    return;
  }
  if (Node.isArrayLiteralExpression(lhs) || Node.isObjectLiteralExpression(lhs)) {
    lhs.forEachDescendant((d, traversal) => {
      const name = thisFieldName(d);
      if (name !== undefined) {
        pushUnique(out, name);
        traversal.skip();
      }
    });
  }
}

/**
 * The `this.<field>` names a body assigns: `=` and every compound assignment, `++` / `--`, `delete`, and `this`
 * fields inside a destructuring assignment. Only a direct field counts (`this.x = …`, not `this.x.y = …` or
 * `this.items.push(…)`): the fact is reassignment of the object's own fields, not mutation of what they hold.
 * Arrow functions are walked (they share `this`); functions, classes and object-literal methods are not.
 */
export function assignedThisFields(body: Node | undefined): string[] {
  const out: string[] = [];
  if (body === undefined) return out;
  body.forEachDescendant((node, traversal) => {
    if (OWN_THIS.has(node.getKind())) {
      traversal.skip();
      return;
    }
    if (Node.isBinaryExpression(node) && ASSIGNMENT_OPERATORS.has(node.getOperatorToken().getKind())) {
      collectTargets(node.getLeft(), out);
    } else if (Node.isPrefixUnaryExpression(node) || Node.isPostfixUnaryExpression(node)) {
      const op = node.getOperatorToken();
      if (op === SyntaxKind.PlusPlusToken || op === SyntaxKind.MinusMinusToken) collectTargets(node.getOperand(), out);
    } else if (Node.isDeleteExpression(node)) {
      collectTargets(node.getExpression(), out);
    }
  });
  return out;
}

/** Class members always have a scope; a parameter property without a keyword has none (public). */
interface Scoped {
  getScope(): Scope | undefined;
  getName(): string;
}

function visibilityOf(member: Scoped): 'public' | 'protected' | 'private' {
  if (member.getName().startsWith('#')) return 'private';
  const scope = member.getScope();
  return scope === Scope.Private ? 'private' : scope === Scope.Protected ? 'protected' : 'public';
}

export function extractMethodMemberFacts(method: MethodDeclaration): MethodMemberFacts {
  return { visibility: visibilityOf(method), assignedFields: assignedThisFields(method.getBody()) };
}

export function extractClassMemberFacts(cls: ClassDeclaration): ClassMemberFacts {
  const facts: ClassMemberFacts = {
    fields: [], readonlyFields: [], staticFields: [], publicFields: [], protectedFields: [], privateFields: [],
    getAccessors: [], setAccessors: [], mutatorMethods: [], fieldsAssignedOutsideConstructor: [],
  };
  const addField = (name: string, isReadonly: boolean, isStatic: boolean, visibility: 'public' | 'protected' | 'private'): void => {
    pushUnique(facts.fields, name);
    if (isReadonly) pushUnique(facts.readonlyFields, name);
    if (isStatic) pushUnique(facts.staticFields, name);
    pushUnique(visibility === 'public' ? facts.publicFields : visibility === 'protected' ? facts.protectedFields : facts.privateFields, name);
  };
  const outside = (names: readonly string[]): void => {
    for (const n of names) pushUnique(facts.fieldsAssignedOutsideConstructor, n);
  };

  // Source order: the constructor's parameter properties at the constructor's position among the members.
  for (const member of cls.getMembers()) {
    if (Node.isPropertyDeclaration(member)) {
      const isStatic = member.isStatic();
      const visibility = visibilityOf(member);
      addField(member.getName(), member.isReadonly(), isStatic, visibility);
      // An arrow-function initializer runs later with the instance's `this`: a method in all but name.
      const init = member.getInitializer();
      if (!isStatic && init !== undefined && Node.isArrowFunction(init)) {
        const assigned = assignedThisFields(init.getBody());
        outside(assigned);
        if (visibility === 'public' && assigned.length > 0) pushUnique(facts.mutatorMethods, member.getName());
      }
    } else if (Node.isConstructorDeclaration(member)) {
      for (const p of member.getParameters()) {
        if (!p.isParameterProperty()) continue;
        addField(p.getName(), p.isReadonly(), false, visibilityOf(p));
      }
    } else if (Node.isGetAccessorDeclaration(member)) {
      if (member.isStatic()) continue;
      pushUnique(facts.getAccessors, member.getName());
      outside(assignedThisFields(member.getBody()));
    } else if (Node.isSetAccessorDeclaration(member)) {
      if (member.isStatic()) continue;
      pushUnique(facts.setAccessors, member.getName());
      outside(assignedThisFields(member.getBody()));
    } else if (Node.isMethodDeclaration(member)) {
      if (member.isStatic()) continue;
      const assigned = assignedThisFields(member.getBody());
      outside(assigned);
      if (visibilityOf(member) === 'public' && assigned.length > 0) pushUnique(facts.mutatorMethods, member.getName());
    }
  }
  return facts;
}
