/**
 * Batch 2, proxy 14, TEST TOPOLOGY: which production units the test files exercise.
 *
 * Test files: `*.spec.ts`, `*.test.ts` (and `.tsx`) and files under `__tests__/`, below the project root and outside
 * `node_modules`. The extractor excludes them from the APG, so each gets a `TestFile` virtual node (`test:<path>`). A
 * test file that the ts-morph project does not include (a tsconfig that leaves tests out) is added to it, read only.
 *
 * TESTS (test file → Class / Function / File node), with `via`:
 * - `instantiation`: `new C()` of a project class;
 * - `call`: a call that resolves to a project method or function (the class of the method is exercised);
 * - `reference`: a project class or function named in value position (a DI token, `Test.createTestingModule({
 *   providers: [C] })`, `jest.spyOn(C.prototype, …)`);
 * - `import`: a production file the test imports (its File node), whatever it uses from it.
 * Direct uses only: a class that a tested class calls is not counted as tested.
 *
 * A class is TESTED when some test instantiates it, calls one of its methods or references it in value position. A
 * component is TESTABLE when it declares a class with a method body or a top-level function; it is UNTESTED when it is
 * testable and none of its classes or functions is tested. This replaces FF-CV05's "a test file next to the file"
 * convention: a test anywhere that exercises the unit counts, and a co-located test that only imports a type does not.
 *
 * Flags: `untested-component` per untested component (only when the project has at least one test file); with no test
 * file at all, a single `no-tests` flag.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Node } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import type { CheapContext } from './context.js';
import { classesOf } from './context.js';
import { resolvedDeclaration, topLevelFunctions } from './behaviour.js';
import { countKinds } from './error-flow.js';
import type { CheapEdge, CheapFlag, CheapNodeFact, CheapProxyOutput, CheapVirtualNode } from './types.js';

const TEST_FILE = /(\.(spec|test)\.(ts|tsx|mts|cts)$)|(^|\/)__tests__\//;

export function isTestFile(rel: string): boolean {
  return TEST_FILE.test(rel) && !rel.endsWith('.d.ts');
}

function walkTests(root: string, rel = '', out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const d of entries) {
    if (d.name === 'node_modules' || d.name.startsWith('.') || d.name === 'dist') continue;
    const r = rel === '' ? d.name : `${rel}/${d.name}`;
    if (d.isDirectory()) walkTests(root, r, out);
    else if (isTestFile(r) && /\.(ts|tsx|mts|cts)$/.test(r)) out.push(r);
  }
  return out;
}

export function testSourceFiles(ctx: CheapContext): { file: string; sf: SourceFile }[] {
  const out = new Map<string, SourceFile>();
  for (const sf of ctx.project.getSourceFiles()) {
    const rel = ctx.rel(sf);
    if (!rel.startsWith('/') && !rel.includes('node_modules/') && isTestFile(rel)) out.set(rel, sf);
  }
  for (const rel of walkTests(ctx.root)) {
    if (out.has(rel)) continue;
    const sf = ctx.project.addSourceFileAtPathIfExists(`${ctx.root}/${rel}`);
    if (sf !== undefined) out.set(rel, sf);
  }
  return [...out.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([file, sf]) => ({ file, sf }));
}

type Via = 'instantiation' | 'call' | 'reference' | 'import';
const VIA_RANK: Readonly<Record<Via, number>> = { instantiation: 3, call: 2, reference: 1, import: 0 };

export function runTestTopology(ctx: CheapContext): CheapProxyOutput {
  const tests = testSourceFiles(ctx);
  const edges: CheapEdge[] = [];
  const nodeFacts: CheapNodeFact[] = [];
  const flags: CheapFlag[] = [];
  const virtualNodes: CheapVirtualNode[] = [];
  /** Exercised project declarations: `Class|file|name` / `Function|file|name` → strongest via. */
  const exercised = new Map<string, Via>();
  for (const { file: tf, sf } of tests) {
    const tid = `test:${tf}`;
    const hits = new Map<string, { via: Via; count: number; line: number }>();
    const hit = (key: string, via: Via, line: number): void => {
      const prev = hits.get(key);
      if (prev === undefined) hits.set(key, { via, count: 1, line });
      else hits.set(key, { via: VIA_RANK[via] > VIA_RANK[prev.via] ? via : prev.via, count: prev.count + 1, line: prev.line });
    };
    for (const imp of sf.getImportDeclarations()) {
      const target = imp.getModuleSpecifierSourceFile();
      if (target === undefined) continue;
      const rel = ctx.rel(target);
      if (ctx.files.has(rel) && !imp.isTypeOnly()) hit(`File|${rel}|${rel}`, 'import', imp.getStartLineNumber());
    }
    sf.forEachDescendant((n) => {
      if (!Node.isIdentifier(n)) return;
      if (n.getFirstAncestor((a) => Node.isImportDeclaration(a) || Node.isTypeNode(a)) !== undefined) return;
      let decl: Node | undefined;
      try {
        decl = resolvedDeclaration(n);
      } catch {
        return;
      }
      if (decl === undefined) return;
      const rel = ctx.rel(decl.getSourceFile());
      if (!ctx.files.has(rel)) return;
      const parent = n.getParent();
      const line = n.getStartLineNumber();
      if (Node.isClassDeclaration(decl)) {
        const isNew = parent !== undefined && Node.isNewExpression(parent) && parent.getExpression() === n;
        hit(`Class|${rel}|${decl.getName() ?? ''}`, isNew ? 'instantiation' : 'reference', line);
        return;
      }
      if (Node.isMethodDeclaration(decl)) {
        const cls = decl.getParent();
        if (Node.isClassDeclaration(cls)) hit(`Class|${rel}|${cls.getName() ?? ''}`, 'call', line);
        return;
      }
      if (Node.isFunctionDeclaration(decl) || (Node.isVariableDeclaration(decl) && decl.getVariableStatement()?.getParent() === decl.getSourceFile())) {
        const name = (decl as { getName(): string | undefined }).getName() ?? '';
        const isCall = parent !== undefined && Node.isCallExpression(parent) && parent.getExpression() === n;
        hit(`Function|${rel}|${name}`, isCall ? 'call' : 'reference', line);
      }
    });
    virtualNodes.push({ id: tid, kind: 'TestFile', name: tf, properties: { component: ctx.info(tf).component, exercises: hits.size } });
    for (const [key, h] of [...hits.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const [type, rel, name] = key.split('|') as [string, string, string];
      const nodeId = type === 'File' ? ctx.info(rel).fileNodeId : ctx.nodeId(type as 'Class' | 'Function', rel, name);
      if (type !== 'File') {
        const prev = exercised.get(key);
        if (prev === undefined || VIA_RANK[h.via] > VIA_RANK[prev]) exercised.set(key, h.via);
      }
      if (nodeId === undefined) continue;
      edges.push({ type: 'TESTS', proxy: 'test-topology', sourceId: tid, targetId: nodeId, score: VIA_RANK[h.via] / 3, evidence: [{ file: tf, startLine: h.line, endLine: h.line }], properties: { via: h.via, uses: h.count, unit: name } });
    }
  }
  // Tested status per class and function; testable / untested components.
  const comp = new Map<string, { testable: number; tested: number; files: string[]; untestedUnits: string[] }>();
  for (const { file, sf } of ctx.sources) {
    const c = ctx.info(file).component;
    const rec = comp.get(c) ?? { testable: 0, tested: 0, files: [], untestedUnits: [] };
    rec.files.push(file);
    for (const cls of classesOf(sf)) {
      const name = cls.getName() ?? '';
      const key = `Class|${file}|${name}`;
      const via = exercised.get(key);
      const id = ctx.nodeId('Class', file, name);
      if (id !== undefined) nodeFacts.push({ proxy: 'test-topology', nodeId: id, key: 'tested', value: via === undefined ? false : via !== 'import' });
      const runtime = cls.getMethods().some((m) => m.getBody() !== undefined) || cls.getConstructors().some((k) => (k.getBody()?.getChildCount() ?? 0) > 0);
      if (!runtime) continue;
      rec.testable++;
      if (via !== undefined) rec.tested++;
      else rec.untestedUnits.push(name);
    }
    for (const f of topLevelFunctions(sf)) {
      const key = `Function|${file}|${f.name}`;
      const via = exercised.get(key);
      const id = ctx.nodeId('Function', file, f.name);
      if (id !== undefined) nodeFacts.push({ proxy: 'test-topology', nodeId: id, key: 'tested', value: via !== undefined });
      rec.testable++;
      if (via !== undefined) rec.tested++;
      else rec.untestedUnits.push(f.name);
    }
    comp.set(c, rec);
  }
  const components: Record<string, { testable: number; tested: number; coverage: number | null }> = {};
  for (const [c, rec] of [...comp.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    components[c] = { testable: rec.testable, tested: rec.tested, coverage: rec.testable === 0 ? null : Math.round((rec.tested / rec.testable) * 1e4) / 1e4 };
    if (tests.length === 0 || rec.testable === 0 || rec.tested > 0) continue;
    const first = [...rec.files].sort()[0] ?? c;
    flags.push({ proxy: 'test-topology', kind: 'untested-component', score: 1, evidence: { file: first, startLine: 1, endLine: 1 }, message: `component ${c}: none of its ${String(rec.testable)} testable units (${rec.untestedUnits.slice(0, 6).join(', ')}${rec.untestedUnits.length > 6 ? ', …' : ''}) is exercised by a test` });
  }
  if (tests.length === 0 && ctx.sources.length > 0) {
    flags.push({ proxy: 'test-topology', kind: 'no-tests', score: 1, evidence: { file: ctx.sources[0]?.file ?? '', startLine: 1, endLine: 1 }, message: 'the project has no test file (*.spec.ts, *.test.ts, __tests__/)' });
  }
  const untestedClasses = [...comp.values()].reduce((s, r) => s + r.untestedUnits.length, 0);
  return { edges, nodeFacts, flags, virtualNodes, summary: { testFiles: tests.length, testsEdges: edges.length, components, untestedUnits: untestedClasses, flagsByKind: countKinds(flags) } };
}
