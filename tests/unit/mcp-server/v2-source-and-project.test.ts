/**
 * MCP v2 building blocks: the syntax facts of one file (`source-ast.ts`) and the project view (`project-files.ts`):
 * module resolution, barrels followed to the declaring file (the resolved view of ADR-V13-01), the literal import graph.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseSource, typeNamesOf } from '../../../src/mcp-server/source-ast.js';
import { candidateFiles, declaresName, pathTo, ProjectView, reExportsOf } from '../../../src/mcp-server/project-files.js';

function project(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-v2-proj-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

describe('parseSource', () => {
  it('reads imports with their bound names, kinds and lines, and re-exports', () => {
    const ast = parseSource(
      [
        "import def, { a, b as c } from './x';",
        "import type { T } from '../t';",
        "import * as ns from 'pkg';",
        "import 'side';",
        "export { d } from './d';",
        "export * from './all';",
        "const r = require('req');",
        "void import('dyn');",
      ].join('\n'),
    );
    expect(ast.imports.map((i) => [i.specifier, i.kind, i.line])).toEqual([
      ['./x', 'static', 1],
      ['../t', 'type', 2],
      ['pkg', 'static', 3],
      ['side', 'side-effect', 4],
      ['./d', 'reexport', 5],
      ['./all', 'reexport', 6],
      ['req', 'require', 7],
      ['dyn', 'dynamic', 8],
    ]);
    expect(ast.imports[0]?.names).toEqual([
      { imported: 'default', local: 'def' },
      { imported: 'a', local: 'a' },
      { imported: 'b', local: 'c' },
    ]);
    expect(ast.imports[5]?.all).toBe(true);
  });

  it('reads classes: heritage, constructor parameters, methods, field types and member facts', () => {
    const ast = parseSource(
      [
        "import { Clock } from './Clock';",
        '@Injectable()',
        'export class Policy extends Base implements Port, ns.Other {',
        '  value = 1;',
        '  private readonly items: Map<string, Item> = new Map();',
        '  constructor(private readonly clock: Clock, repo: Repo<Order>) { super(); }',
        '  set v(x: number) { this.value = x; }',
        '  run(a: Request): Promise<Response[]> { this.value = 2; return Promise.resolve([]); }',
        '  static make(): Policy { return new Policy(null as never, null as never); }',
        '}',
      ].join('\n'),
    );
    const [cls] = ast.classes;
    expect(cls).toMatchObject({ name: 'Policy', line: 3, exported: true, decorators: ['Injectable'], implementsNames: ['Port', 'Other'], extendsName: 'Base' });
    expect(cls?.ctorParams.map((p) => [p.name, p.typeNames, p.property])).toEqual([
      ['clock', ['Clock'], true],
      ['repo', ['Repo', 'Order'], false],
    ]);
    expect(cls?.methods.map((m) => [m.name, m.isStatic, m.params.flatMap((p) => p.typeNames), m.returnTypeNames])).toEqual([
      ['run', false, ['Request'], ['Promise', 'Response']],
      ['make', true, [], ['Policy']],
    ]);
    expect(cls?.fieldTypes.items).toEqual(['Map', 'Item']);
    expect(cls?.memberFacts.setAccessors).toEqual(['v']);
    expect(cls?.memberFacts.mutatorMethods).toEqual(['run']);
    expect(cls?.memberFacts.publicFields).toContain('value');
  });

  it('reads calls with their identifier chains, decorator calls and process reads', () => {
    const ast = parseSource(
      [
        "import axios from 'axios';",
        'class S {',
        '  @Column() name!: string;',
        '  async go() { await axios.get("u"); const d = new Date(); this.repo.find(); return process.env.X; }',
        '}',
      ].join('\n'),
    );
    expect(ast.calls.map((c) => [c.chain.join('.'), c.isNew, c.inDecorator, c.className])).toEqual([
      ['Column', false, true, 'S'],
      ['axios.get', false, false, 'S'],
      ['Date', true, false, 'S'],
      ['this.repo.find', false, false, 'S'],
    ]);
    expect(ast.propertyReads.map((r) => r.chain)).toEqual([['process', 'env']]);
  });

  it('marks partial text and still reads what parses', () => {
    const ast = parseSource("import { A } from './a';\n  foo(: {\n");
    expect(ast.partial).toBe(true);
    expect(ast.imports.map((i) => i.specifier)).toEqual(['./a']);
  });

  it('typeNamesOf reads inline import types', () => {
    const ast = parseSource("export function f(r: import('express').Request): void {}");
    expect(ast.functions[0]?.params[0]?.typeNames).toEqual(['import:express.Request']);
    expect(typeNamesOf(undefined)).toEqual([]);
  });
});

describe('ProjectView', () => {
  const root = project({
    'src/domain/index.ts': "export { Order } from './order/Order';\nexport * from './Money';\nexport { Column } from 'typeorm';\n",
    'src/domain/order/Order.ts': 'export class Order {}\n',
    'src/domain/Money.ts': 'export interface Money { cents: number }\nexport type Currency = string;\n',
    'src/app/Use.ts': "import { Order, Money } from '../domain';\nimport { X } from './X.js';\n",
    'src/app/X.ts': "import { Use } from './Use';\nexport class X {}\n",
  });
  afterAll(() => { fs.rmSync(root, { recursive: true, force: true }); });
  const view = new ProjectView({ root });

  it('resolves relative specifiers to existing files (directory index, .js written for .ts)', () => {
    expect(view.resolveModule('src/app/Use.ts', '../domain')).toEqual({ kind: 'file', path: 'src/domain/index.ts', exists: true });
    expect(view.resolveModule('src/app/Use.ts', './X.js')).toEqual({ kind: 'file', path: 'src/app/X.ts', exists: true });
    expect(view.resolveModule('src/app/Use.ts', './Missing')).toEqual({ kind: 'file', path: 'src/app/Missing.ts', exists: false });
    expect(view.resolveModule('src/app/Use.ts', '@scope/pkg/sub')).toEqual({ kind: 'package', name: '@scope/pkg' });
    expect(view.resolveModule('src/app/Use.ts', 'node:fs')).toEqual({ kind: 'builtin', name: 'node:fs' });
  });

  it('follows names through a barrel to their declaring files and packages (resolved view)', () => {
    const r = view.resolveNames('src/domain/index.ts', ['Order', 'Money', 'Column', 'Nope']);
    const by = (n: string): unknown => r.find((x) => x.names.includes(n));
    expect(by('Order')).toMatchObject({ target: { kind: 'file', path: 'src/domain/order/Order.ts' }, viaBarrels: ['src/domain/index.ts'] });
    expect(by('Money')).toMatchObject({ target: { kind: 'file', path: 'src/domain/Money.ts' }, viaBarrels: ['src/domain/index.ts'] });
    expect(by('Column')).toMatchObject({ target: { kind: 'package', name: 'typeorm' }, viaBarrels: ['src/domain/index.ts'] });
    expect(by('Nope')).toMatchObject({ target: { kind: 'file', path: 'src/domain/index.ts' }, viaBarrels: [] });
  });

  it('tells classes from interfaces and other declarations', () => {
    expect(view.declarationKind('src/domain/order/Order.ts', 'Order')).toBe('class');
    expect(view.declarationKind('src/domain/Money.ts', 'Money')).toBe('interface');
    expect(view.declarationKind('src/domain/Money.ts', 'Currency')).toBe('other');
    expect(view.declarationKind('src/domain/Money.ts', 'Nope')).toBeUndefined();
  });

  it('builds the literal import graph (the barrel is the target) and finds a path back', () => {
    const g = view.importGraph();
    expect([...(g.get('src/app/Use.ts') ?? [])].sort()).toEqual(['src/app/X.ts', 'src/domain/index.ts']);
    expect(pathTo(g, 'src/app/X.ts', 'src/app/Use.ts', 9)).toEqual(['src/app/X.ts', 'src/app/Use.ts']);
    expect(pathTo(g, 'src/domain/index.ts', 'src/app/Use.ts', 9)).toBeUndefined();
  });

  it('reads overrides before the disk and works with no root', () => {
    const o = new ProjectView({ root, overrides: new Map([['src/app/X.ts', 'export class X {}\n']]) });
    expect(o.importGraph().get('src/app/X.ts')?.size).toBe(0);
    const none = new ProjectView();
    expect(none.hasRoot).toBe(false);
    expect(none.read('src/app/X.ts')).toBeUndefined();
    expect(none.resolveModule('src/a/b.ts', '../c')).toEqual({ kind: 'file', path: 'src/c.ts', exists: false });
  });

  it('helpers: candidate files, declarations, re-export statements', () => {
    expect(candidateFiles('src/a.js')).toEqual(['src/a.ts', 'src/a.tsx', 'src/a.js']);
    expect(candidateFiles('src/a')).toContain('src/a/index.ts');
    expect(declaresName('export abstract class A {}', 'A')).toBe(true);
    expect(declaresName('const B = 1;', 'A')).toBe(false);
    expect(reExportsOf("export { a as b, type c } from './x';\nexport * as ns from './y';\nexport * from './z';")).toEqual([
      { specifier: './x', names: [{ local: 'a', exported: 'b' }, { local: 'c', exported: 'c' }] },
      { specifier: './y', names: [{ local: '*', exported: 'ns' }] },
      { specifier: './z', names: null },
    ]);
  });
});
