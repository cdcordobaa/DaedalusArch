/**
 * DETECT-01 experimental extractor (exploratory, zero model calls). It runs the instrument's own extractor
 * (`extractAPG`, imported read-only, with `V13_APG2_OPTIONS` so SIGNATURE_USES is present) and adds, from a second
 * ts-morph pass over the same tsconfig, the facts the coverage map (`ops/notes/detect-01-coverage-map.md` §0) found
 * missing:
 *
 * - `XCALL` (Method → Method): every resolved `obj.method()` call in a class method, **including calls whose target is
 *   an interface method signature** (a call through a port). The instrument's CALLS keeps class targets only.
 * - `DISPATCH` (interface Method → class Method): the class-hierarchy reading of a port call, one edge per class that
 *   IMPLEMENTS the interface and declares a method of the same name.
 * - `SIGNATURE_USES_EXTERNAL` (interface Method → ExternalType): a parameter or return type of an interface method that
 *   resolves to a declaration in a declaration file outside the TypeScript default libraries (a vendored
 *   `declare module` typing or a package under `node_modules`).
 * - `PROP_TYPE` (Interface → Class | Interface): the types named by the property signatures of an interface.
 * - `GUARDS` (Method → Guard): an `if` whose branch throws, with a numeric comparison against a literal (or a numeric
 *   constant) or a `Number.isInteger/isFinite/isNaN/isSafeInteger` test in its condition; `shape` is the condition
 *   with its subjects replaced by `$`, `flowsToDomain` says whether a guarded subject is passed, in the same method, to
 *   a constructor or method declared in a domain-role file (a repository read is not a domain sink).
 * - Node properties: `role` (from the path, `layers.ts`), `startLine` on methods, `returnShape` on public class methods
 *   whose return type is an anonymous object type (or an array of one), `propShape` on interfaces, `repoWrite` and
 *   `writes` (the identity-bearing domain types a repository write method takes), `messaging` (outbox, bus, publisher
 *   members), `isPort` on interfaces, `identity` on classes (an `id` field or accessor) and on interfaces (an `id`
 *   property; `identityViaSubtype` when a sub-interface adds it).
 *
 * Every fact is written into the interpreter's in-memory graph (`MemoryGraph`) next to the instrument's nodes and
 * edges, so the experimental rules (`../rules/*.cypher`) read both through Cypher, as the instrument's rules do.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Node, Project, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, ConstructorDeclaration, MethodDeclaration, SourceFile, Type } from 'ts-morph';
import { extractAPG, V13_APG2_OPTIONS } from '../../../src/apg-extractor/index.js';
import { declarationsOfType } from '../../../src/apg-extractor/apg2/type-flow.js';
import { MemoryGraph } from '../../../src/cypher-interp/index.js';
import { fromDriver } from '../../../src/cypher-interp/driver-values.js';
import type { GraphNode } from '../../../src/cypher-interp/values.js';
import { DOMAIN_ROLES, roleOf } from './layers.js';
import type { Role, Style } from './layers.js';

export interface BuiltGraph {
  readonly graph: MemoryGraph;
  readonly stats: Record<string, number>;
}

const REPO_OWNER = /(Repository|Repo|Store)$/;
const WRITE_NAME = /^(save|add|insert|update|upsert|put|store|persist|delete|remove|append)/i;
const MESSAGING_OWNER = /(Outbox|EventBus|Bus|Publisher|MessageBus|Dispatcher|Queue)$/;
const NUMBER_TESTS = new Set(['isInteger', 'isFinite', 'isNaN', 'isSafeInteger']);
const RELATIONAL = new Set([SyntaxKind.LessThanToken, SyntaxKind.LessThanEqualsToken, SyntaxKind.GreaterThanToken, SyntaxKind.GreaterThanEqualsToken]);

/** A harness-style tsconfig next to the tree (the pilot scorer's shape), so both passes see the same program. */
export function writeTsconfig(tree: string, scratch: string): string {
  const file = path.join(scratch, `${path.basename(path.dirname(tree))}__${path.basename(tree)}.tsconfig.json`);
  fs.mkdirSync(scratch, { recursive: true });
  const config = {
    compilerOptions: {
      strict: true, target: 'ES2022', lib: ['ES2022'], module: 'commonjs', moduleResolution: 'node', esModuleInterop: true,
      skipLibCheck: true, noEmit: true, types: [],
    },
    include: [`${tree.replace(/\/+$/, '')}/src/**/*.ts`],
  };
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  return file;
}

const rel = (root: string, abs: string): string => path.relative(root, abs).split(path.sep).join('/');

function isLibFile(sf: SourceFile): boolean {
  const p = sf.getFilePath();
  return /\/typescript\/lib\/lib\.[^/]*\.d\.ts$/.test(p);
}

/** The module an external declaration belongs to: an ambient `declare module 'x'`, else the package under node_modules. */
function externalModuleOf(decl: Node): string | null {
  const sf = decl.getSourceFile();
  if (!sf.isDeclarationFile() || isLibFile(sf)) return null;
  const ambient = decl.getFirstAncestor((a) => Node.isModuleDeclaration(a));
  if (ambient !== undefined && Node.isModuleDeclaration(ambient)) return ambient.getName().replace(/^['"]|['"]$/g, '');
  const m = /\/node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(sf.getFilePath());
  return m ? m[1]! : path.basename(sf.getFilePath());
}

/** Property names of an anonymous object type, or of the element of an array of one; null for named types. */
function anonymousShape(t: Type): string[] | null {
  let x = t;
  if (x.isArray()) x = x.getArrayElementTypeOrThrow();
  if (!x.isObject() || !x.isAnonymous() || x.getCallSignatures().length > 0) return null;
  const names = x.getProperties().map((p) => p.getName()).sort();
  return names.length > 0 ? names : null;
}

interface Guard {
  readonly line: number;
  readonly cond: string;
  readonly shape: string;
  readonly subjects: string[];
  readonly flowsToDomain: boolean;
}

/** Subjects of a guard condition (the operands compared or tested) and its normalised shape. */
function guardOf(cond: Node): { subjects: string[]; shape: string } | null {
  const subjects = new Set<string>();
  let numeric = false;
  const isNumericConst = (n: Node): boolean => {
    if (Node.isNumericLiteral(n)) return true;
    if (Node.isPrefixUnaryExpression(n) && Node.isNumericLiteral(n.getOperand())) return true;
    if (Node.isIdentifier(n)) {
      const d = n.getSymbol()?.getDeclarations()[0];
      if (d !== undefined && Node.isVariableDeclaration(d)) {
        const init = d.getInitializer();
        return init !== undefined && Node.isNumericLiteral(init);
      }
    }
    return false;
  };
  const subjectText = (n: Node): string | null =>
    Node.isIdentifier(n) || Node.isPropertyAccessExpression(n) ? n.getText() : null;
  cond.forEachDescendant((d) => {
    if (Node.isBinaryExpression(d) && RELATIONAL.has(d.getOperatorToken().getKind())) {
      const [l, r] = [d.getLeft(), d.getRight()];
      if (isNumericConst(r) && subjectText(l) !== null) { numeric = true; subjects.add(subjectText(l)!); }
      else if (isNumericConst(l) && subjectText(r) !== null) { numeric = true; subjects.add(subjectText(r)!); }
    }
    if (Node.isCallExpression(d)) {
      const e = d.getExpression();
      if (Node.isPropertyAccessExpression(e) && e.getExpression().getText() === 'Number' && NUMBER_TESTS.has(e.getName())) {
        const a = d.getArguments()[0];
        if (a !== undefined && subjectText(a) !== null) { numeric = true; subjects.add(subjectText(a)!); }
      }
    }
  });
  if (!numeric) return null;
  let shape = cond.getText().replace(/\s+/g, ' ');
  for (const s of [...subjects].sort((a, b) => b.length - a.length)) shape = shape.split(s).join('$');
  // Constants keep their value, not their name, so `x > MAX` and `x > 100` compare by value only when written alike.
  return { subjects: [...subjects], shape };
}

export async function buildGraph(tree: string, tsconfig: string, style: Style): Promise<BuiltGraph> {
  const root = path.resolve(tree);
  const apgResult = await extractAPG(root, V13_APG2_OPTIONS, tsconfig);
  if (!apgResult.success) throw new Error(`extractAPG failed on ${tree}: ${JSON.stringify(apgResult.errors)}`);
  const apg = apgResult.data;

  const graph = new MemoryGraph();
  const stats: Record<string, number> = {};
  const bump = (k: string): void => { stats[k] = (stats[k] ?? 0) + 1; };
  const byApgId = new Map<string, GraphNode>();
  const props = new Map<string, Map<string, unknown>>();
  const keyed = new Map<string, string>(); // `${type}:${name}@${filePath}` → APG id
  const typeOf = new Map<string, string>();

  for (const n of apg.nodes) {
    const p = new Map<string, unknown>([['id', n.id], ['name', n.name], ['filePath', n.filePath], ['nodeType', n.type]]);
    for (const [k, v] of Object.entries(n.properties)) if (typeof v !== 'object' || Array.isArray(v)) p.set(k, v);
    if (n.filePath) p.set('role', roleOf(n.filePath, style));
    props.set(n.id, p);
    keyed.set(`${n.type}:${n.name}@${n.filePath}`, n.id);
    typeOf.set(n.id, n.type);
  }
  const edges: { type: string; s: string; t: string; p: Record<string, unknown> }[] = apg.edges.map((e) => ({
    type: e.type, s: e.sourceId, t: e.targetId,
    p: Object.fromEntries(Object.entries(e.properties).filter(([, v]) => typeof v !== 'object' || Array.isArray(v))),
  }));
  const addEdge = (type: string, s: string, t: string, p: Record<string, unknown> = {}): void => {
    edges.push({ type, s, t, p });
    bump(type);
  };
  let synthetic = 0;
  const addNode = (type: string, p: Record<string, unknown>): string => {
    const id = `x${synthetic++}`;
    props.set(id, new Map(Object.entries({ id, nodeType: type, ...p })));
    typeOf.set(id, type);
    return id;
  };
  const methodId = (owner: string, method: string, file: string): string | undefined => keyed.get(`Method:${owner}.${method}@${file}`);
  const typeId = (decl: Node): string | undefined => {
    if (!Node.isClassDeclaration(decl) && !Node.isInterfaceDeclaration(decl)) return undefined;
    const f = rel(root, decl.getSourceFile().getFilePath());
    return keyed.get(`${Node.isClassDeclaration(decl) ? 'Class' : 'Interface'}:${decl.getName() ?? ''}@${f}`);
  };

  const project = new Project({ tsConfigFilePath: tsconfig, skipAddingFilesFromTsConfig: false });
  const files = project.getSourceFiles().filter((sf) => !sf.isDeclarationFile() && !sf.getFilePath().includes('/node_modules/'));
  const domainFile = (sf: SourceFile): boolean => DOMAIN_ROLES.has(roleOf(rel(root, sf.getFilePath()), style));

  for (const sf of files) {
    const file = rel(root, sf.getFilePath());
    const role: Role = roleOf(file, style);

    for (const cls of sf.getClasses()) {
      const clsName = cls.getName() ?? '';
      const clsId = keyed.get(`Class:${clsName}@${file}`);
      if (clsId !== undefined) {
        const p = props.get(clsId)!;
        const hasId = cls.getProperty('id') !== undefined || cls.getGetAccessor('id') !== undefined
          || cls.getConstructors().some((c) => c.getParameters().some((q) => q.getName() === 'id' && q.isParameterProperty()));
        p.set('identity', hasId);
        if (MESSAGING_OWNER.test(clsName)) p.set('messaging', true);
      }
      for (const m of cls.getMethods()) visitMethod(cls, m, file, role);
      if (clsId !== undefined) for (const c of cls.getConstructors()) guardsIn(c, clsId, file, role);
    }

    for (const iface of sf.getInterfaces()) {
      const name = iface.getName();
      const ifaceId = keyed.get(`Interface:${name}@${file}`);
      if (ifaceId === undefined) continue;
      const ip = props.get(ifaceId)!;
      // Identity of an interface-modelled entity: its own `id`, or a sub-interface that adds one ("the store adds the
      // id"). Added after the S1 step-3 miss (dev-time adjustment, reported as such).
      if (iface.getProperty('id') !== undefined) {
        ip.set('identity', true);
        for (const base of iface.getBaseDeclarations()) {
          const b = typeId(base);
          if (b !== undefined) props.get(b)!.set('identityViaSubtype', true);
        }
      }
      const propNames = iface.getProperties().map((p) => p.getName()).sort();
      if (propNames.length > 0) ip.set('propShape', propNames.join(','));
      ip.set('propCount', propNames.length);
      for (const ps of iface.getProperties()) {
        const found = new Set<Node>();
        declarationsOfType(ps.getType(), found);
        for (const d of found) {
          const t = typeId(d);
          if (t !== undefined && t !== ifaceId) addEdge('PROP_TYPE', ifaceId, t, { property: ps.getName(), line: ps.getStartLineNumber() });
        }
      }
      for (const ms of iface.getMethods()) {
        const mid = methodId(name, ms.getName(), file);
        if (mid === undefined) continue;
        const mp = props.get(mid)!;
        mp.set('startLine', ms.getStartLineNumber());
        if (MESSAGING_OWNER.test(name)) mp.set('messaging', true);
        if (REPO_OWNER.test(name) && WRITE_NAME.test(ms.getName())) mp.set('repoWrite', true);
        const types: Type[] = [...ms.getParameters().map((q) => q.getType()), ms.getReturnType()];
        const seen = new Set<string>();
        for (const t of types) {
          const found = new Set<Node>();
          collectAll(t, found);
          for (const d of found) {
            const mod = externalModuleOf(d);
            if (mod === null) continue;
            const tname = (Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d) || Node.isTypeAliasDeclaration(d)) ? d.getName() ?? '?' : '?';
            const key = `${mod}:${tname}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const ext = addNode('ExternalType', { name: tname, module: mod });
            addEdge('SIGNATURE_USES_EXTERNAL', mid, ext, { line: ms.getStartLineNumber() });
          }
        }
      }
    }
  }

  function collectAll(t: Type, out: Set<Node>, depth = 0): void {
    // declarationsOfType keeps classes and interfaces; type aliases from vendored modules are added here.
    declarationsOfType(t, out);
    const alias = t.getAliasSymbol();
    if (alias !== undefined) for (const d of alias.getDeclarations()) out.add(d);
    if (depth < 3) {
      for (const sig of t.getCallSignatures()) {
        for (const p of sig.getParameters()) {
          const d = p.getValueDeclaration();
          if (d !== undefined) collectAll(d.getType(), out, depth + 1);
        }
        collectAll(sig.getReturnType(), out, depth + 1);
      }
    }
  }

  function visitMethod(cls: ClassDeclaration, m: MethodDeclaration, file: string, role: Role): void {
    const mid = methodId(cls.getName() ?? '', m.getName(), file);
    if (mid === undefined) return;
    const mp = props.get(mid)!;
    mp.set('startLine', m.getStartLineNumber());
    if (MESSAGING_OWNER.test(cls.getName() ?? '')) mp.set('messaging', true);
    const isPublic = !m.hasModifier(SyntaxKind.PrivateKeyword) && !m.hasModifier(SyntaxKind.ProtectedKeyword) && !m.getName().startsWith('#');
    if (isPublic) {
      const shape = anonymousShape(m.getReturnType().isObject() && m.getReturnType().getSymbol()?.getName() === 'Promise'
        ? m.getReturnType().getTypeArguments()[0] ?? m.getReturnType() : m.getReturnType());
      if (shape !== null) mp.set('returnShape', shape.join(','));
    }

    // XCALL: every resolved obj.method() call, class or interface target.
    const targets = new Map<string, { count: number; line: number }>();
    for (const call of m.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) continue;
      const decl = expr.getNameNode().getSymbol()?.getDeclarations()[0];
      if (decl === undefined) continue;
      let owner: string | undefined;
      let tfile: string;
      if (Node.isMethodDeclaration(decl)) owner = decl.getParentIfKind(SyntaxKind.ClassDeclaration)?.getName();
      else if (Node.isMethodSignature(decl)) owner = decl.getParentIfKind(SyntaxKind.InterfaceDeclaration)?.getName();
      else continue;
      if (owner === undefined) continue;
      tfile = rel(root, decl.getSourceFile().getFilePath());
      const tid = methodId(owner, decl.getName(), tfile);
      if (tid === undefined || tid === mid) continue;
      const cur = targets.get(tid);
      targets.set(tid, { count: (cur?.count ?? 0) + 1, line: cur?.line ?? call.getStartLineNumber() });
    }
    for (const [tid, v] of targets) addEdge('XCALL', mid, tid, { callCount: v.count, line: v.line });

    guardsIn(m, mid, file, role);
  }

  /** GUARDS from a method or constructor body (constructor guards hang on the Class node). */
  function guardsIn(m: MethodDeclaration | ConstructorDeclaration, ownerId: string, file: string, role: Role): void {
    for (const ifs of m.getDescendantsOfKind(SyntaxKind.IfStatement)) {
      const then = ifs.getThenStatement();
      const throws = Node.isThrowStatement(then) || (Node.isBlock(then) && Node.isThrowStatement(then.getStatements()[0] ?? then));
      if (!throws) continue;
      const g = guardOf(ifs.getExpression());
      if (g === null) continue;
      const flowsToDomain = sinksOf(m).some((argText) => g.subjects.some((s) => argText === s || argText.includes(s)));
      const guard: Guard = { line: ifs.getStartLineNumber(), cond: ifs.getExpression().getText().replace(/\s+/g, ' '), ...g, flowsToDomain };
      const gid = addNode('Guard', { ...guard, filePath: file, role });
      addEdge('GUARDS', ownerId, gid, { line: guard.line });
    }
  }

  /** Argument texts passed, in this method, to a constructor or method declared in a domain-role file (repository reads excluded). */
  function sinksOf(m: MethodDeclaration | ConstructorDeclaration): string[] {
    const out: string[] = [];
    for (const n of m.getDescendants()) {
      if (!Node.isCallExpression(n) && !Node.isNewExpression(n)) continue;
      let decl: Node | undefined;
      if (Node.isNewExpression(n)) decl = n.getExpression().getSymbol()?.getDeclarations()[0];
      else {
        const e = n.getExpression();
        decl = (Node.isPropertyAccessExpression(e) ? e.getNameNode() : e).getSymbol()?.getDeclarations()[0];
      }
      if (decl === undefined || !domainFile(decl.getSourceFile())) continue;
      const owner = decl.getFirstAncestor((a) => Node.isInterfaceDeclaration(a) || Node.isClassDeclaration(a));
      const ownerName = owner !== undefined && (Node.isInterfaceDeclaration(owner) || Node.isClassDeclaration(owner)) ? owner.getName() ?? '' : '';
      const memberName = Node.isMethodSignature(decl) || Node.isMethodDeclaration(decl) ? decl.getName() : '';
      if (REPO_OWNER.test(ownerName) && !WRITE_NAME.test(memberName)) continue;
      for (const a of n.getArguments()) out.push(a.getText());
    }
    return out;
  }

  // DISPATCH: interface method → implementing class method of the same name (class-hierarchy analysis).
  const containsOf = new Map<string, string[]>();
  for (const e of apg.edges) if (e.type === 'CONTAINS') containsOf.set(e.sourceId, [...(containsOf.get(e.sourceId) ?? []), e.targetId]);
  const shortName = (id: string): string => String(props.get(id)?.get('name') ?? '').split('.').pop() ?? '';
  for (const e of apg.edges) {
    if (e.type !== 'IMPLEMENTS' || typeOf.get(e.targetId) !== 'Interface') continue;
    const classMethods = (containsOf.get(e.sourceId) ?? []).filter((x) => typeOf.get(x) === 'Method');
    for (const im of (containsOf.get(e.targetId) ?? []).filter((x) => typeOf.get(x) === 'Method')) {
      for (const cm of classMethods) if (shortName(cm) === shortName(im)) addEdge('DISPATCH', im, cm);
    }
    // isPort: an interface in a port role, or a domain interface implemented by an adapter class.
    const srcRole = props.get(e.sourceId)?.get('role');
    if (srcRole === 'adapter') props.get(e.targetId)!.set('implementedByAdapter', true);
  }
  for (const p of props.values()) {
    if (p.get('nodeType') !== 'Interface') continue;
    const r = p.get('role');
    p.set('isPort', r === 'port-out' || r === 'port-in' || (r === 'domain' && p.get('implementedByAdapter') === true));
  }

  // writes: the identity-bearing domain classes a repository write method takes as parameters (SIGNATURE_USES, apg2).
  for (const e of apg.edges) {
    if (e.type !== 'SIGNATURE_USES') continue;
    const mp = props.get(e.sourceId);
    if (mp?.get('repoWrite') !== true) continue;
    const positions = (e.properties as { positions?: string[] }).positions ?? [];
    const tp = props.get(e.targetId);
    const identity = tp?.get('identity') === true || tp?.get('identityViaSubtype') === true;
    if (!positions.includes('param') || !['Class', 'Interface'].includes(String(tp?.get('nodeType'))) || !identity) continue;
    if (!DOMAIN_ROLES.has(tp!.get('role') as Role)) continue;
    mp.set('writes', [...((mp.get('writes') as string[] | undefined) ?? []), String(tp.get('name'))].sort());
  }
  for (const p of props.values()) if (p.get('repoWrite') === true) p.set('writeCount', ((p.get('writes') as string[] | undefined) ?? []).length);

  // Load into the interpreter's graph: label = node type (plus APGNode), properties as Cypher values.
  for (const [id, p] of props) {
    const values = new Map([...p].map(([k, v]) => [k, fromDriver(v)] as const));
    byApgId.set(id, graph.createNode([String(p.get('nodeType')), 'APGNode'], values));
  }
  for (const e of edges) {
    const s = byApgId.get(e.s);
    const t = byApgId.get(e.t);
    if (s === undefined || t === undefined) continue;
    graph.createRelationship(e.type, s, t, new Map(Object.entries(e.p).map(([k, v]) => [k, fromDriver(v)] as const)));
  }
  stats.nodes = graph.nodes.length;
  stats.relationships = graph.relationships.length;
  return { graph, stats };
}
