/**
 * Behaviour facts shared by the name-vs-behaviour, cohesion, logic-density, repository-bypass and framework-in-core
 * proxies: which known I/O APIs a class reaches through resolved calls, which framework decorators it carries, the
 * logic density of each method, and the role its name and its layer declare.
 *
 * I/O is read from the type checker: a call, `new` or decorator counts when its callee's declaration comes from a
 * catalogued package (`node_modules/<pkg>`, an ambient `declare module '<pkg>'`, or a tsconfig `paths` alias named
 * like a package). Nothing is matched on import text alone.
 */
import { Node, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, MethodDeclaration, SourceFile } from 'ts-morph';
import type { CheapContext } from './context.js';
import { classesOf } from './context.js';
import type { Evidence } from './types.js';

export type IoCategory = 'db' | 'http-client' | 'mail' | 'fs' | 'messaging' | 'transport';

const MODULE_CATEGORY: readonly (readonly [RegExp, IoCategory])[] = [
  [/^(typeorm|@nestjs\/typeorm|mongoose|@nestjs\/mongoose|@prisma\/client|prisma|sequelize|sequelize-typescript|@nestjs\/sequelize|@mikro-orm\/.+|drizzle-orm(\/.+)?|knex|pg|mysql2?|sqlite3|better-sqlite3|mongodb|redis|ioredis)$/, 'db'],
  [/^(axios|@nestjs\/axios|node-fetch|got|superagent|undici|http|https)$/, 'http-client'],
  [/^(nodemailer|@sendgrid\/mail|@nestjs-modules\/mailer|mailgun\.js|@aws-sdk\/client-ses)$/, 'mail'],
  [/^(fs|fs\/promises)$/, 'fs'],
  [/^(amqplib|kafkajs|@nestjs\/microservices|bull|bullmq|@nestjs\/bull|@nestjs\/bullmq)$/, 'messaging'],
  [/^(express|fastify|koa|@nestjs\/platform-express|@nestjs\/platform-fastify)$/, 'transport'],
];

/** The I/O category of a package, or null when it is not catalogued. */
export function categoryOfModule(mod: string | null): IoCategory | null {
  if (mod === null) return null;
  for (const [re, cat] of MODULE_CATEGORY) if (re.test(mod)) return cat;
  return null;
}

/** NestJS decorators that make a class or parameter part of the HTTP transport. */
const NEST_TRANSPORT_DECORATORS = new Set([
  'Controller', 'Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head', 'All', 'Body', 'Param', 'Query', 'Req',
  'Request', 'Res', 'Response', 'Headers', 'HttpCode', 'Header', 'Redirect', 'Render', 'Ip', 'Session', 'UploadedFile',
]);

/** Persistence-mapping decorators by package category `db` (TypeORM, Mongoose, Sequelize, MikroORM). */
const ORM_MAPPING_DECORATORS = /^(Entity|Column|PrimaryColumn|PrimaryGeneratedColumn|CreateDateColumn|UpdateDateColumn|ManyToOne|OneToMany|OneToOne|ManyToMany|JoinColumn|JoinTable|Index|Unique|Schema|Prop|Table|Model|Property|PrimaryKey)$/;

/** Global accessors of a DB / ORM handle: calling one is a direct client use wherever it happens. */
export const DB_ACQUIRERS = new Set([
  'getRepository', 'getCustomRepository', 'getTreeRepository', 'getMongoRepository', 'getManager', 'getConnection',
  'createConnection', 'createQueryBuilder', 'model', 'PrismaClient', 'DataSource', 'Sequelize', 'MongoClient', 'Pool',
  'Client', 'knex', 'connect', 'createPool', 'createClient',
]);

/** DB client types whose direct use (not through a repository) is a bypass even when injected. */
export const RAW_DB_TYPES = new Set([
  'DataSource', 'EntityManager', 'Connection', 'QueryRunner', 'QueryBuilder', 'SelectQueryBuilder', 'Knex', 'Sequelize',
  'Pool', 'PoolClient', 'MongoClient', 'Db', 'PrismaClient',
]);

export interface IoUse {
  readonly category: IoCategory;
  readonly module: string;
  readonly api: string;
  /** A global accessor call or a raw client type use (see `DB_ACQUIRERS`, `RAW_DB_TYPES`); db only. */
  readonly direct: boolean;
  readonly method: string | undefined;
  readonly evidence: Evidence;
}

export interface DensityCounts {
  readonly branches: number;
  readonly comparisons: number;
  readonly arithmetic: number;
  readonly validationThrows: number;
  readonly density: number;
}

export type NameRole = 'controller' | 'repository' | 'service' | 'adapter' | 'entity' | 'dto' | 'domain-service' | 'module' | 'transport-infra' | 'unknown';

export interface MethodBehaviour {
  readonly name: string;
  readonly node: MethodDeclaration;
  readonly density: DensityCounts;
  readonly evidence: Evidence;
}

export interface ClassBehaviour {
  readonly file: string;
  readonly name: string;
  readonly cls: ClassDeclaration;
  readonly nameRole: NameRole;
  /** The role the class's declared layer kind implies (`null` without a layer). */
  readonly layerRole: NameRole | null;
  readonly io: readonly IoUse[];
  readonly transportDecorators: readonly string[];
  readonly ormMappingDecorators: readonly { readonly name: string; readonly evidence: Evidence }[];
  readonly methods: readonly MethodBehaviour[];
  readonly evidence: Evidence;
}

/** Camel-case tokens of an identifier: `CreateOrderDTO` → [Create, Order, DTO]; `use_case` → [use, case]. */
export function camelTokens(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter((t) => t.length > 0);
}

const SUFFIX_ROLES: readonly (readonly [readonly string[], NameRole])[] = [
  [['use', 'case'], 'service'],
  [['value', 'object'], 'entity'],
  [['controller'], 'controller'], [['resource'], 'controller'], [['router'], 'controller'], [['endpoint'], 'controller'],
  [['repository'], 'repository'], [['repo'], 'repository'], [['dao'], 'repository'], [['store'], 'repository'],
  [['service'], 'service'], [['interactor'], 'service'], [['handler'], 'service'],
  [['adapter'], 'adapter'], [['client'], 'adapter'], [['gateway'], 'adapter'], [['sender'], 'adapter'],
  [['publisher'], 'adapter'], [['notifier'], 'adapter'], [['acl'], 'adapter'],
  [['entity'], 'entity'], [['model'], 'entity'], [['aggregate'], 'entity'],
  [['dto'], 'dto'], [['request'], 'dto'], [['response'], 'dto'], [['command'], 'dto'], [['query'], 'dto'],
  [['event'], 'dto'], [['view'], 'dto'], [['input'], 'dto'], [['output'], 'dto'], [['record'], 'dto'],
  [['mapper'], 'domain-service'], [['factory'], 'domain-service'], [['policy'], 'domain-service'],
  [['calculator'], 'domain-service'], [['specification'], 'domain-service'], [['checker'], 'domain-service'],
  [['validator'], 'domain-service'],
  [['module'], 'module'],
  [['guard'], 'transport-infra'], [['interceptor'], 'transport-infra'], [['pipe'], 'transport-infra'],
  [['filter'], 'transport-infra'], [['middleware'], 'transport-infra'],
];

/** The role a class name's camel-case suffix declares (`OrderRepository` → repository). */
export function roleFromName(name: string): NameRole {
  const toks = camelTokens(name).map((t) => t.toLowerCase());
  for (const [suffix, role] of SUFFIX_ROLES) {
    if (toks.length < suffix.length) continue;
    const tail = toks.slice(toks.length - suffix.length);
    if (tail.every((t, i) => t === suffix[i])) return role;
  }
  return 'unknown';
}

export function roleFromLayerKind(kind: string | null): NameRole | null {
  switch (kind) {
    case 'domain': return 'entity';
    case 'application': return 'service';
    case 'infrastructure': return 'adapter';
    case 'presentation': return 'controller';
    default: return null;
  }
}

/** The declaration a call or `new` target resolves to (aliases followed), if any. */
export function resolvedDeclaration(node: Node): Node | undefined {
  const target = Node.isPropertyAccessExpression(node) ? node.getNameNode() : node;
  let sym = target.getSymbol();
  if (sym === undefined) return undefined;
  if (sym.isAlias()) sym = sym.getAliasedSymbol() ?? sym;
  return sym.getDeclarations()[0];
}

function calleeName(expr: Node): string {
  if (Node.isPropertyAccessExpression(expr)) return expr.getName();
  if (Node.isIdentifier(expr)) return expr.getText();
  return expr.getText().slice(0, 40);
}

/** The type name of an expression's apparent type (symbol or alias symbol name), '' when anonymous. */
export function typeNameOf(node: Node): string {
  const t = node.getType();
  return t.getSymbol()?.getName() ?? t.getAliasSymbol()?.getName() ?? '';
}

function enclosingMethodName(node: Node): string | undefined {
  const m = node.getFirstAncestor((a) => Node.isMethodDeclaration(a) || Node.isConstructorDeclaration(a) || Node.isGetAccessorDeclaration(a) || Node.isSetAccessorDeclaration(a));
  if (m === undefined) return undefined;
  return Node.isConstructorDeclaration(m) ? 'constructor' : Node.isMethodDeclaration(m) || Node.isGetAccessorDeclaration(m) || Node.isSetAccessorDeclaration(m) ? m.getName() : undefined;
}

/** Every catalogued I/O use inside `scope` (a class, a function, or a whole file). */
export function ioUses(ctx: CheapContext, scope: Node): IoUse[] {
  const out: IoUse[] = [];
  const seenRaw = new Set<string>();
  scope.forEachDescendant((n) => {
    if (Node.isCallExpression(n) || Node.isNewExpression(n)) {
      // Decorators are configuration, read separately (`classBehaviour`), not I/O.
      if (Node.isDecorator(n.getParent())) return;
      const expr = n.getExpression();
      const decl = resolvedDeclaration(expr);
      let mod = decl === undefined ? null : ctx.moduleOf(decl);
      let cat = categoryOfModule(mod);
      const api = calleeName(expr);
      if (cat === null && Node.isIdentifier(expr) && api === 'fetch' && decl?.getSourceFile().isInNodeModules() === true) {
        cat = 'http-client';
        mod = 'fetch';
      }
      if (cat === null || mod === null) return;
      out.push({ category: cat, module: mod, api, direct: cat === 'db' && DB_ACQUIRERS.has(api), method: enclosingMethodName(n), evidence: ctx.evidence(n) });
      return;
    }
    // A raw client handle used directly (`this.dataSource.query(…)`, `manager.save(…)`): one use per receiver line.
    if (Node.isPropertyAccessExpression(n) && Node.isCallExpression(n.getParent()) && n.getParent()?.getChildAtIndex(0) === n) {
      const recv = n.getExpression();
      const tname = typeNameOf(recv);
      if (!RAW_DB_TYPES.has(tname)) return;
      const tdecl = recv.getType().getSymbol()?.getDeclarations()[0];
      const mod = tdecl === undefined ? null : ctx.moduleOf(tdecl);
      if (categoryOfModule(mod) !== 'db' || mod === null) return;
      const key = `${String(n.getStartLineNumber())}|${recv.getText()}`;
      if (seenRaw.has(key)) return;
      seenRaw.add(key);
      out.push({ category: 'db', module: mod, api: `${tname}.${n.getName()}`, direct: true, method: enclosingMethodName(n), evidence: ctx.evidence(n) });
    }
  });
  return out;
}

const COMPARISON = new Set([
  SyntaxKind.LessThanToken, SyntaxKind.GreaterThanToken, SyntaxKind.LessThanEqualsToken, SyntaxKind.GreaterThanEqualsToken,
  SyntaxKind.EqualsEqualsToken, SyntaxKind.EqualsEqualsEqualsToken, SyntaxKind.ExclamationEqualsToken, SyntaxKind.ExclamationEqualsEqualsToken,
]);
const ARITHMETIC = new Set([
  SyntaxKind.PlusToken, SyntaxKind.MinusToken, SyntaxKind.AsteriskToken, SyntaxKind.SlashToken, SyntaxKind.PercentToken,
  SyntaxKind.AsteriskAsteriskToken, SyntaxKind.PlusEqualsToken, SyntaxKind.MinusEqualsToken, SyntaxKind.AsteriskEqualsToken,
  SyntaxKind.SlashEqualsToken, SyntaxKind.PercentEqualsToken,
]);
const BRANCHES = new Set([
  SyntaxKind.IfStatement, SyntaxKind.ConditionalExpression, SyntaxKind.CaseClause, SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement, SyntaxKind.ForOfStatement, SyntaxKind.WhileStatement, SyntaxKind.DoStatement,
]);

function isNullish(n: Node): boolean {
  const k = n.getKind();
  return k === SyntaxKind.NullKeyword || (Node.isIdentifier(n) && n.getText() === 'undefined') || Node.isVoidExpression(n);
}

function isTypeofOperand(n: Node): boolean {
  return Node.isTypeOfExpression(n);
}

/**
 * Logic density of a body: branches (if, ?:, case, loops), value comparisons (not against null / undefined, not
 * `typeof` checks), arithmetic on numeric operands (not string concatenation) and validation throws (a `throw` under
 * an `if` of the same body). Nested functions and classes are walked: their logic runs on the caller's behalf.
 */
export function densityOf(body: Node | undefined): DensityCounts {
  let branches = 0;
  let comparisons = 0;
  let arithmetic = 0;
  let validationThrows = 0;
  if (body !== undefined) {
    body.forEachDescendant((n) => {
      const k = n.getKind();
      if (BRANCHES.has(k)) branches++;
      if (Node.isBinaryExpression(n)) {
        const op = n.getOperatorToken().getKind();
        if (COMPARISON.has(op)) {
          const l = n.getLeft();
          const r = n.getRight();
          if (!isNullish(l) && !isNullish(r) && !isTypeofOperand(l) && !isTypeofOperand(r)) comparisons++;
        } else if (ARITHMETIC.has(op)) {
          const lt = n.getLeft().getType();
          const rt = n.getRight().getType();
          const numeric = (lt.isNumber() || lt.isNumberLiteral() || lt.isBigInt()) && (rt.isNumber() || rt.isNumberLiteral() || rt.isBigInt());
          if (numeric) arithmetic++;
        }
      }
      if (Node.isThrowStatement(n) && n.getFirstAncestor((a) => a === body || Node.isIfStatement(a)) !== body) validationThrows++;
    });
  }
  return { branches, comparisons, arithmetic, validationThrows, density: branches + comparisons + arithmetic + validationThrows };
}

function decoratorModule(ctx: CheapContext, d: import('ts-morph').Decorator): string | null {
  const call = d.getCallExpression();
  const expr = call?.getExpression() ?? d.getExpression();
  const decl = resolvedDeclaration(expr);
  return decl === undefined ? null : ctx.moduleOf(decl);
}

/** Behaviour of one class. */
export function classBehaviour(ctx: CheapContext, file: string, cls: ClassDeclaration): ClassBehaviour {
  const name = cls.getName() ?? '<anonymous>';
  const transport: string[] = [];
  const orm: { name: string; evidence: Evidence }[] = [];
  const decorated = [
    ...cls.getDecorators(),
    ...cls.getMethods().flatMap((m) => [...m.getDecorators(), ...m.getParameters().flatMap((p) => p.getDecorators())]),
    ...cls.getProperties().flatMap((p) => p.getDecorators()),
    ...cls.getConstructors().flatMap((c) => c.getParameters().flatMap((p) => p.getDecorators())),
  ];
  for (const d of decorated) {
    const mod = decoratorModule(ctx, d);
    const dn = d.getName();
    if (mod === '@nestjs/common' && NEST_TRANSPORT_DECORATORS.has(dn)) {
      if (!transport.includes(dn)) transport.push(dn);
    } else if (categoryOfModule(mod) === 'db' && ORM_MAPPING_DECORATORS.test(dn)) {
      orm.push({ name: dn, evidence: ctx.evidence(d) });
    }
  }
  const methods: MethodBehaviour[] = cls
    .getMethods()
    .filter((m) => m.getBody() !== undefined)
    .map((m) => ({ name: m.getName(), node: m, density: densityOf(m.getBody()), evidence: ctx.evidence(m) }));
  return {
    file,
    name,
    cls,
    nameRole: roleFromName(name),
    layerRole: roleFromLayerKind(ctx.info(file).layerKind),
    io: ioUses(ctx, cls),
    transportDecorators: transport,
    ormMappingDecorators: orm,
    methods,
    evidence: ctx.evidence(cls),
  };
}

/** Behaviour of every named class of the project, path then declaration order. Computed once per context. */
const CACHE = new WeakMap<CheapContext, ClassBehaviour[]>();
export function allClassBehaviours(ctx: CheapContext): ClassBehaviour[] {
  const hit = CACHE.get(ctx);
  if (hit !== undefined) return hit;
  const out: ClassBehaviour[] = [];
  for (const { file, sf } of ctx.sources) for (const cls of classesOf(sf)) out.push(classBehaviour(ctx, file, cls));
  CACHE.set(ctx, out);
  return out;
}

/** The effective role of a class: its name role, else its decorators', else its layer's. */
export function effectiveRole(b: ClassBehaviour): NameRole {
  if (b.nameRole !== 'unknown') return b.nameRole;
  if (b.transportDecorators.includes('Controller')) return 'controller';
  return b.layerRole ?? 'unknown';
}

/** Top-level functions of a file with a body (declarations and `const f = () => …`). */
export function topLevelFunctions(sf: SourceFile): { name: string; node: Node; body: Node | undefined }[] {
  const out: { name: string; node: Node; body: Node | undefined }[] = [];
  for (const f of sf.getFunctions()) {
    const n = f.getName();
    if (n !== undefined) out.push({ name: n, node: f, body: f.getBody() });
  }
  for (const v of sf.getVariableDeclarations()) {
    const init = v.getInitializer();
    if (init !== undefined && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) out.push({ name: v.getName(), node: v, body: init.getBody() });
  }
  return out;
}
