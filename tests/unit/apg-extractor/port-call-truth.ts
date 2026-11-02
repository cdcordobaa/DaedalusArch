/**
 * FR-1 fidelity truth for CALLS_VIA_PORT (v1.5.6, `ops/notes/v15-calls-through-ports.md`): the TypeScript language
 * service, independent of the extractor's class graph. Every reference to a port member (an interface method signature
 * or an abstract method) found by find-all-references that is the callee of a call inside a class method, and whose
 * symbol is that port member (not an implementing class's member: a call on a concrete receiver is not a port call),
 * paired with every class method that go-to-implementation gives for it. Not a test file: the fidelity test imports it.
 */
import * as path from 'node:path';
import { Node, Project } from 'ts-morph';
import type { MethodDeclaration } from 'ts-morph';
import { extractAPG, V15_APG_OPTIONS } from '../../../src/apg-extractor/index.js';
import { writeTsconfig } from '../../../src/v15-instrument/graph.js';

export interface PortCallFidelity {
  /** `Class.method@file -> Class.method@file`, sorted. */
  readonly truth: readonly string[];
  readonly extracted: readonly string[];
  readonly missing: readonly string[];
  readonly extra: readonly string[];
}

/** The outermost class method around a node (the CALLS scope: every call inside a class method belongs to it). */
function classMethod(n: Node): MethodDeclaration | undefined {
  let found: MethodDeclaration | undefined;
  for (let a: Node | undefined = n; a !== undefined; a = a.getParent()) {
    if (Node.isMethodDeclaration(a) && Node.isClassDeclaration(a.getParent())) found = a;
  }
  return found;
}

export async function portCallTruth(tree: string, scratch: string): Promise<PortCallFidelity> {
  const root = path.resolve(tree);
  const tsconfig = writeTsconfig(root, scratch);
  const r = await extractAPG(root, V15_APG_OPTIONS, tsconfig);
  if (!r.success) throw new Error(`extraction failed: ${tree}`);
  const key = new Map(r.data.nodes.filter((n) => n.type === 'Method').map((n) => [n.id, `${n.name}@${n.filePath}`]));
  const methods = new Set(key.values());
  const extracted = r.data.edges.filter((e) => e.type === 'CALLS_VIA_PORT').map((e) => `${key.get(e.sourceId) ?? '?'} -> ${key.get(e.targetId) ?? '?'}`);

  const project = new Project({ tsConfigFilePath: tsconfig });
  const ls = project.getLanguageService();
  const rel = (n: Node): string => path.relative(root, n.getSourceFile().getFilePath()).split(path.sep).join('/');
  const methodKey = (m: MethodDeclaration): string => {
    const cls = m.getParent();
    return `${Node.isClassDeclaration(cls) ? cls.getName() ?? '<anonymous>' : '?'}.${m.getName()}@${rel(m)}`;
  };
  const members: Node[] = [];
  for (const sf of project.getSourceFiles()) {
    if (sf.isDeclarationFile() || sf.getFilePath().includes('/node_modules/')) continue;
    for (const i of sf.getInterfaces()) for (const m of i.getMethods()) members.push(m);
    for (const c of sf.getClasses()) for (const m of c.getMethods()) if (m.isAbstract()) members.push(m);
  }
  const truth = new Set<string>();
  for (const m of members) {
    if (!Node.isMethodSignature(m) && !Node.isMethodDeclaration(m)) continue;
    for (const ref of ls.findReferencesAsNodes(m.getNameNode())) {
      const pae = ref.getParent();
      if (!Node.isPropertyAccessExpression(pae) || pae.getNameNode() !== ref) continue;
      const call = pae.getParent();
      if (!Node.isCallExpression(call) || call.getExpression() !== pae) continue;
      if (!(ref.getSymbol()?.getDeclarations() ?? []).includes(m)) continue;
      const src = classMethod(call);
      if (src === undefined || !methods.has(methodKey(src))) continue;
      for (const impl of ls.getImplementations(ref)) {
        // the location is the implementing member's name (or the declaration itself)
        const n = impl.getNode();
        const decl = Node.isMethodDeclaration(n) ? n : n.getParent();
        if (decl === undefined || !Node.isMethodDeclaration(decl) || !Node.isClassDeclaration(decl.getParent()) || decl.getBody() === undefined) continue;
        if (methods.has(methodKey(decl))) truth.add(`${methodKey(src)} -> ${methodKey(decl)}`);
      }
    }
  }
  const t = [...truth].sort();
  const x = [...new Set(extracted)].sort();
  return { truth: t, extracted: x, missing: t.filter((e) => !x.includes(e)), extra: x.filter((e) => !t.includes(e)) };
}
