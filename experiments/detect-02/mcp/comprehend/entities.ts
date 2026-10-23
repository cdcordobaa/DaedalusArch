/**
 * GRAPH-SCALE (v1.5-exp, U1 groundwork, fix (d)): entity-like types inferred from the code, for `who_writes` on trees
 * that declare no aggregates (or declare one whose root the DETECT-02 facts cannot resolve, such as a schema object).
 * Symbolic, zero model calls. Every entity says how it was found; an entity the spec does not name is `inferred`.
 *
 * Evidence, each a structural sign that a type is persisted state:
 *   - `orm-decorator`:   a class decorated `@Entity`, `@Table`, `@Schema`, `@Model` or `@Document` (TypeORM, MikroORM,
 *                        Sequelize, NestJS-Mongoose);
 *   - `schema`:          a module-level schema definition with a string name, `model.define("Product", …)`,
 *                        `mongoose.model<T>("Subscriber", schema)`;
 *   - `base-repository`: a type argument with identity (`id` or `_id`) of a generic base repository, store or DAO class
 *                        that a repository extends (`class SubscriberRepository extends BaseRepository<_, SubscriberEntity, _>`);
 *   - `loads-by-identity`: a repository, store, database or DAO type (by name, or a spec `repositories` file) with a
 *                        method returning one value (not a collection) of a type with identity (DETECT-02 revision R1).
 *
 * Stores of an entity: the repository of `base-repository` evidence, the owner of `loads-by-identity` evidence, and,
 * for every entity, a repository, store, service, database or DAO type with a member named `<verb><Entity>` or
 * `<verb><Entities>` (`createProducts` on `IProductModuleService`). A store member writes when its name starts with a
 * mutation verb, or when it returns nothing and takes an argument (a command-shaped member, R1's write method).
 */
import { Node } from 'ts-morph';
import type { SourceFile, Type } from 'ts-morph';
import { globMatch } from '../../lib/spec.js';
import type { DetectSpec } from '../../lib/spec.js';
import type { MemberSig, TypeInfo } from './index.js';

export type EntityEvidence = 'orm-decorator' | 'schema' | 'base-repository' | 'loads-by-identity';
export interface EntityStore {
  /** `file#Type` of the store. */
  readonly key: string;
  readonly how: 'repository type argument' | 'loads it by identity' | 'member named after it';
}
export interface EntityInfo {
  readonly name: string; readonly file: string; readonly line: number;
  /** `declared` only when the spec's `aggregates` names it; the declaration itself is always found by inference. */
  readonly source: 'declared' | 'inferred';
  readonly evidence: readonly { readonly kind: EntityEvidence; readonly detail: string }[];
  readonly stores: readonly EntityStore[];
}

const ORM_DECORATOR = /^(Entity|Table|Schema|Model|Document)$/;
const STORE_NAME = /(Repository|Store|Database|Dao|DAO)$/;
const STORE_OR_SERVICE_NAME = /(Repository|Store|Database|Dao|DAO|Service)$/;
export const WRITE_VERB = /^(create|insert|add|save|persist|store|update|upsert|patch|replace|set|delete|remove|softDelete|restore|destroy|bulk|increment|decrement)/;
const COLLECTION = new Set(['Array', 'ReadonlyArray', 'Set', 'ReadonlySet', 'Map', 'ReadonlyMap', 'Iterable', 'AsyncIterable']);

export interface EntityInputs {
  readonly root: string;
  readonly sources: readonly SourceFile[];
  readonly spec: DetectSpec;
  readonly types: ReadonlyMap<string, TypeInfo>;
  readonly inTree: (n: Node) => boolean;
  readonly fileOf: (n: Node) => string;
}

/** A store member that writes (by its name's verb, or by its shape: returns nothing and takes an argument). */
export const isWriteMember = (m: MemberSig): boolean => WRITE_VERB.test(m.name) || (m.returnsNothing && m.params > 0);

const plurals = (n: string): string[] => [n, `${n}s`, `${n}es`, ...(n.endsWith('y') ? [`${n.slice(0, -1)}ies`] : [])];

export function inferEntities(x: EntityInputs): EntityInfo[] {
  const { sources, spec, types, inTree, fileOf } = x;
  const byKey = new Map<string, { name: string; file: string; line: number; evidence: { kind: EntityEvidence; detail: string }[]; stores: EntityStore[] }>();
  const add = (key: string, name: string, file: string, line: number, kind: EntityEvidence, detail: string, store?: EntityStore): void => {
    let e = byKey.get(key);
    if (!e) { e = { name, file, line, evidence: [], stores: [] }; byKey.set(key, e); }
    if (!e.evidence.some((v) => v.kind === kind && v.detail === detail)) e.evidence.push({ kind, detail });
    if (store && !e.stores.some((s) => s.key === store.key)) e.stores.push(store);
  };
  const identity = (t: Type): boolean => t.getProperty('id') !== undefined || t.getProperty('_id') !== undefined;
  /** The in-tree class, interface or type alias a type names, with its key. */
  const namedDecl = (t: Type): { key: string; name: string; file: string; line: number; node: Node } | undefined => {
    const sym = t.getAliasSymbol() ?? t.getSymbol();
    for (const d of sym?.getDeclarations() ?? []) {
      if ((Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d) || Node.isTypeAliasDeclaration(d)) && inTree(d)) {
        const name = d.getName() ?? 'anonymous';
        return { key: `${fileOf(d)}#${name}`, name, file: fileOf(d), line: d.getStartLineNumber(), node: d };
      }
    }
    return undefined;
  };

  for (const sf of sources) {
    const f = fileOf(sf);
    // orm-decorator
    for (const c of sf.getClasses()) {
      const dec = c.getDecorators().find((d) => ORM_DECORATOR.test(d.getName()));
      if (dec) add(`${f}#${c.getName() ?? 'anonymous'}`, c.getName() ?? 'anonymous', f, c.getStartLineNumber(), 'orm-decorator', `@${dec.getName()} at ${f}:${dec.getStartLineNumber()}`);
    }
    // schema: a module-level `x = <chain of> define("Name", …)` or `model<T>("Name", …)`
    for (const v of sf.getVariableDeclarations()) {
      const init = v.getInitializer();
      if (!init) continue;
      let hit: { name: string; line: number; via: string } | undefined;
      const visit = (n: Node): void => {
        if (hit) return;
        if (Node.isCallExpression(n)) {
          const e = n.getExpression();
          const callee = Node.isPropertyAccessExpression(e) ? e.getName() : e.getText();
          const a0 = n.getArguments()[0];
          if ((callee === 'define' || callee === 'model') && a0 && Node.isStringLiteral(a0)) { hit = { name: a0.getLiteralValue(), line: n.getStartLineNumber(), via: callee }; return; }
          visit(e);
        } else if (Node.isPropertyAccessExpression(n) || Node.isAsExpression(n) || Node.isParenthesizedExpression(n)) visit(n.getExpression());
      };
      visit(init);
      if (hit) add(`${f}#${v.getName()}`, hit.name, f, v.getStartLineNumber(), 'schema', `${hit.via}("${hit.name}") at ${f}:${hit.line}`);
    }
    // base-repository: the identity-bearing type arguments of a generic store base class
    for (const c of sf.getClasses()) {
      const ext = c.getExtends();
      const base = c.getBaseClass();
      if (!ext || !base || !STORE_NAME.test(base.getName() ?? '')) continue;
      const store: EntityStore = { key: `${f}#${c.getName() ?? 'anonymous'}`, how: 'repository type argument' };
      for (const ta of ext.getTypeArguments()) {
        const t = ta.getType();
        const d = namedDecl(t);
        if (d && !Node.isTypeAliasDeclaration(d.node) && identity(t)) add(d.key, d.name, d.file, d.line, 'base-repository', `type argument of ${base.getName()} in ${c.getName()} (${f}:${c.getStartLineNumber()})`, store);
      }
    }
  }
  // loads-by-identity: a store type's method returning one value of a type with identity
  for (const t of types.values()) {
    if (!STORE_NAME.test(t.name) && !(spec.repositories.length > 0 && globMatch(spec.repositories, t.file))) continue;
    const sf = sources.find((s) => fileOf(s) === t.file);
    const decl = t.kind === 'class' ? sf?.getClass(t.name) : sf?.getInterface(t.name);
    if (!decl) continue;
    for (const m of decl.getMethods()) {
      let rt = m.getReturnType();
      if (rt.getSymbol()?.getName() === 'Promise') rt = rt.getTypeArguments()[0] ?? rt;
      for (const p of rt.isUnion() ? rt.getUnionTypes() : [rt]) {
        if (p.isUndefined() || p.isNull() || p.isArray() || p.isTuple() || COLLECTION.has(p.getSymbol()?.getName() ?? '')) continue;
        const d = namedDecl(p);
        if (d && d.key !== t.key && identity(p)) add(d.key, d.name, d.file, d.line, 'loads-by-identity', `${t.name}.${m.getName()} returns it (${t.file}:${m.getStartLineNumber()})`, { key: t.key, how: 'loads it by identity' });
      }
    }
  }
  // Stores by name, for every entity: `<verb><Entity>` / `<verb><Entities>` members of a store or service type.
  for (const e of byKey.values()) {
    const forms = plurals(e.name.replace(/Entity$/, ''));
    for (const t of types.values()) {
      if (!STORE_OR_SERVICE_NAME.test(t.name)) continue;
      const named = t.members.some((m) => { const v = WRITE_VERB.exec(m.name); return v !== null && forms.includes(m.name.slice(v[0].length)); });
      if (named && !e.stores.some((s) => s.key === t.key)) e.stores.push({ key: t.key, how: 'member named after it' });
    }
  }
  const declared = new Set(spec.aggregates.map((a) => a.name));
  return [...byKey.values()]
    .map((e) => ({ ...e, source: declared.has(e.name) ? 'declared' as const : 'inferred' as const }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file));
}

/** The forms of an entity name a store member may carry after its verb (`Product` → Product, Products). */
export const entityNameForms = (name: string): string[] => plurals(name.replace(/Entity$/, ''));
