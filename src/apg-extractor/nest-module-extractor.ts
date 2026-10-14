/**
 * v1.3 NestJS module wiring (`moduleWiring` option, ON by default in v1.3).
 *
 * Reads the `@Module({ imports, providers, controllers, exports })` metadata of a class as edges between Class
 * nodes: MODULE_IMPORTS (module -> imported module), MODULE_PROVIDES (module -> provider or controller class,
 * property `role`) and MODULE_EXPORTS (module -> exported class or re-exported module). Array elements are read
 * syntactically: `Foo`, `Foo.forRoot(...)`, `forwardRef(() => Foo)` and `{ provide: X, useClass: Foo }`.
 */
import { Node } from 'ts-morph';
import type { ClassDeclaration, Expression } from 'ts-morph';
import type { APGEdge } from '../shared/types/apg.js';
import type { V13EdgeType } from '../shared/types/enums.js';
import type { NodeLookup } from './types.js';
import { generateEdgeId, normalizeFilePath } from './id-generator.js';

export type AddWarning = (filePath: string, code: string, message: string) => void;

/** A resolved class reference of one metadata element and the syntactic form it was written in. */
interface ElementRef {
  readonly cls: ClassDeclaration | undefined;
  readonly name: string;
  readonly dynamicModule: boolean;
  readonly forwardRef: boolean;
}

/** The `@Module` metadata object literal of a class, if it has one. */
function moduleMetadata(cls: ClassDeclaration): Node | undefined {
  const decorator = cls.getDecorators().find(d => d.getName() === 'Module');
  const arg = decorator?.getArguments()[0];
  return arg !== undefined && Node.isObjectLiteralExpression(arg) ? arg : undefined;
}

/** The class declaration an identifier refers to, following import aliases. */
function classOfIdentifier(id: Node): ClassDeclaration | undefined {
  const symbol = id.getSymbol();
  const target = symbol?.getAliasedSymbol() ?? symbol;
  return target?.getDeclarations().find(Node.isClassDeclaration);
}

function elementRef(expr: Expression, forwardRef = false, dynamicModule = false): ElementRef | undefined {
  if (Node.isIdentifier(expr)) {
    return { cls: classOfIdentifier(expr), name: expr.getText(), dynamicModule, forwardRef };
  }
  if (Node.isCallExpression(expr)) {
    const callee = expr.getExpression();
    // forwardRef(() => Foo)
    if (Node.isIdentifier(callee) && callee.getText() === 'forwardRef') {
      const fn = expr.getArguments()[0];
      const body = fn !== undefined && Node.isArrowFunction(fn) ? fn.getBody() : undefined;
      return body !== undefined && Node.isExpression(body) ? elementRef(body, true, dynamicModule) : undefined;
    }
    // Foo.forRoot(...), Foo.register(...): a dynamic module of class Foo
    if (Node.isPropertyAccessExpression(callee)) return elementRef(callee.getExpression(), forwardRef, true);
    return undefined;
  }
  if (Node.isObjectLiteralExpression(expr)) {
    // { provide: Token, useClass: Foo }: the class that is provided is `useClass`, else `provide`
    const prop = (name: string): Expression | undefined => {
      const p = expr.getProperty(name);
      return p !== undefined && Node.isPropertyAssignment(p) ? p.getInitializer() : undefined;
    };
    const init = prop('useClass') ?? prop('provide');
    return init !== undefined ? elementRef(init, forwardRef, dynamicModule) : undefined;
  }
  return undefined;
}

/** The elements of the array-literal property `key` of the metadata object, or `[]`. */
function elementsOf(metadata: Node, key: string): Expression[] {
  if (!Node.isObjectLiteralExpression(metadata)) return [];
  const prop = metadata.getProperty(key);
  const init = prop !== undefined && Node.isPropertyAssignment(prop) ? prop.getInitializer() : undefined;
  return init !== undefined && Node.isArrayLiteralExpression(init) ? init.getElements() : [];
}

const SECTIONS: readonly { readonly key: string; readonly type: V13EdgeType; readonly role?: string }[] = [
  { key: 'imports', type: 'MODULE_IMPORTS' },
  { key: 'providers', type: 'MODULE_PROVIDES', role: 'provider' },
  { key: 'controllers', type: 'MODULE_PROVIDES', role: 'controller' },
  { key: 'exports', type: 'MODULE_EXPORTS' },
];

/**
 * MODULE_* edges of the `@Module` classes of one file, in section order (imports, providers, controllers, exports)
 * then element order. One edge per (type, module, target): a class listed twice, or as both provider and controller, keeps the first.
 * An element that is not a class of the extracted set is skipped with `EXTRACTOR_010`.
 */
export function extractModuleWiringEdges(
  classes: readonly ClassDeclaration[],
  filePath: string,
  projectRoot: string,
  lookup: NodeLookup,
  addWarning: AddWarning,
): APGEdge[] {
  const edges = new Map<string, APGEdge>();
  for (const cls of classes) {
    const metadata = moduleMetadata(cls);
    if (metadata === undefined) continue;
    const moduleId = lookup.typeNodes.get(`${(cls.getName() ?? '<anonymous>').toLowerCase()}@${filePath}`);
    if (moduleId === undefined) continue;

    for (const section of SECTIONS) {
      for (const element of elementsOf(metadata, section.key)) {
        const ref = elementRef(element);
        const targetPath = ref?.cls !== undefined ? normalizeFilePath(ref.cls.getSourceFile().getFilePath(), projectRoot) : undefined;
        const targetId = ref?.cls !== undefined && targetPath !== undefined
          ? lookup.typeNodes.get(`${(ref.cls.getName() ?? '').toLowerCase()}@${targetPath}`)
          : undefined;
        if (ref === undefined || targetId === undefined) {
          addWarning(filePath, 'EXTRACTOR_010', `@Module ${section.key} element not in extracted set: ${ref?.name ?? element.getText()}`);
          continue;
        }
        const key = `${section.type}:${moduleId}:${targetId}`;
        if (edges.has(key)) continue;
        edges.set(key, {
          id: generateEdgeId(section.type, moduleId, targetId),
          type: section.type,
          sourceId: moduleId,
          targetId,
          properties: {
            ...(section.role !== undefined ? { role: section.role } : {}),
            ...(section.type !== 'MODULE_PROVIDES' ? { dynamicModule: ref.dynamicModule } : {}),
            forwardRef: ref.forwardRef,
            line: element.getStartLineNumber(),
          },
        });
      }
    }
  }
  return [...edges.values()];
}
