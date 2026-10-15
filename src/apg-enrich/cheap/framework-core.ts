/**
 * Proxy 7, FRAMEWORK TYPES IN CORE: a web-framework type (express / fastify / koa / Node `http` request and
 * response, NestJS execution-context types) in a parameter or return type of a method or function of an
 * application- or domain-kind layer file, read through the type checker — so a type-only import, an alias, a union
 * member, an array element, a `Promise<…>` argument or an inline `import('express').Request` all count. In a
 * domain-kind file a persistence type (an ORM / DB package type) counts too. Constructors are not read: constructor
 * parameters are dependency-injection wiring.
 */
import { Node } from 'ts-morph';
import type { Type } from 'ts-morph';
import type { CheapContext } from './context.js';
import { classesOf } from './context.js';
import { categoryOfModule, topLevelFunctions } from './behaviour.js';
import type { CheapFlag, CheapProxyOutput } from './types.js';

const NEST_HTTP_TYPES = new Set(['ExecutionContext', 'ArgumentsHost', 'CallHandler', 'HttpArgumentsHost', 'StreamableFile']);
const NODE_HTTP_TYPES = new Set(['IncomingMessage', 'ServerResponse', 'OutgoingMessage']);

/** The framework or persistence modules a type mentions (depth-limited walk over unions, intersections, type args). */
export function frameworkModulesOf(ctx: CheapContext, type: Type, includePersistence: boolean, depth = 0, seen = new Set<Type>()): string[] {
  if (depth > 4 || seen.has(type)) return [];
  seen.add(type);
  const out = new Set<string>();
  for (const sym of [type.getSymbol(), type.getAliasSymbol()]) {
    const decl = sym?.getDeclarations()[0];
    if (sym === undefined || decl === undefined) continue;
    const mod = ctx.moduleOf(decl);
    const cat = categoryOfModule(mod);
    const name = sym.getName();
    if (mod !== null && cat === 'transport') out.add(mod);
    else if (mod === '@nestjs/common' && NEST_HTTP_TYPES.has(name)) out.add(`${mod}:${name}`);
    else if ((mod === 'http' || mod === 'https') && NODE_HTTP_TYPES.has(name)) out.add(`${mod}:${name}`);
    else if (includePersistence && mod !== null && cat === 'db') out.add(mod);
  }
  const parts = [
    ...(type.isUnion() ? type.getUnionTypes() : []),
    ...(type.isIntersection() ? type.getIntersectionTypes() : []),
    ...type.getTypeArguments(),
    ...type.getAliasTypeArguments(),
    ...(type.isArray() ? [type.getArrayElementTypeOrThrow()] : []),
  ];
  for (const p of parts) for (const m of frameworkModulesOf(ctx, p, includePersistence, depth + 1, seen)) out.add(m);
  return [...out].sort();
}

export function runFrameworkInCore(ctx: CheapContext): CheapProxyOutput {
  const flags: CheapFlag[] = [];
  let checked = 0;
  for (const { file, sf } of ctx.sources) {
    const kind = ctx.info(file).layerKind;
    if (kind !== 'application' && kind !== 'domain') continue;
    const persistence = kind === 'domain';
    const check = (fn: Node & { getParameters(): import('ts-morph').ParameterDeclaration[]; getReturnType(): Type }, className: string | undefined, methodName: string): void => {
      checked++;
      for (const p of fn.getParameters()) {
        const mods = frameworkModulesOf(ctx, p.getType(), persistence);
        if (mods.length === 0) continue;
        flags.push({ proxy: 'framework-in-core', kind: 'framework-type-parameter', score: 1, evidence: ctx.evidence(p), ...(className !== undefined ? { className } : {}), methodName, message: `${kind} ${className ?? ''}${className !== undefined ? '.' : ''}${methodName} parameter ${p.getName()}: ${p.getType().getText(p)} (${mods.join(', ')})` });
      }
      const mods = frameworkModulesOf(ctx, fn.getReturnType(), persistence);
      if (mods.length > 0) flags.push({ proxy: 'framework-in-core', kind: 'framework-type-return', score: 1, evidence: ctx.evidence(fn), ...(className !== undefined ? { className } : {}), methodName, message: `${kind} ${className ?? ''}${className !== undefined ? '.' : ''}${methodName} returns ${mods.join(', ')} type` });
    };
    for (const cls of classesOf(sf)) {
      for (const m of cls.getMethods()) check(m, cls.getName(), m.getName());
    }
    for (const f of topLevelFunctions(sf)) {
      const fnNode = Node.isVariableDeclaration(f.node) ? f.node.getInitializer() : f.node;
      if (fnNode !== undefined && (Node.isFunctionDeclaration(fnNode) || Node.isArrowFunction(fnNode) || Node.isFunctionExpression(fnNode))) check(fnNode, undefined, f.name);
    }
  }
  return { edges: [], nodeFacts: [], flags, summary: { signaturesChecked: checked, sites: flags.length } };
}
