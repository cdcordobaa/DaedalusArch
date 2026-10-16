import {
  declaresExport, importedNames, propose, reExportChain, reviewSample, score, statementAt,
} from '../../../../scripts/v1.3/lib/fidelity-adjudication.js';
import type { ProjectContext, ProjectEdge } from '../../../../scripts/v1.3/lib/fidelity-adjudication.js';

const edge = (source: string, target: string, present: Record<string, boolean>, tscKinds: string[] = [], specifiers: string[] = []): ProjectEdge =>
  ({ source, target, scope: 'in-scope', tscKinds, specifiers, present });

const FILES: Record<string, string> = {
  'src/app/use.ts': "import { Order } from '../domain';\nimport {\n  Thing,\n} from '../domain';\n",
  'src/domain/index.ts': "export * from './order';\nexport { Thing } from './thing';\n",
  'src/domain/order.ts': 'export class Order {}\n',
  'src/domain/thing.ts': 'export interface Thing { n: number }\n',
};
const EDGES: ProjectEdge[] = [
  edge('src/app/use.ts', 'src/domain/index.ts', { 'apg-v12e-default': false, tsc: true, depcruise: true }, ['import'], ['../domain']),
  edge('src/app/use.ts', 'src/domain/order.ts', { 'apg-v12e-default': true, tsc: false, depcruise: false }),
  edge('src/domain/index.ts', 'src/domain/order.ts', { 'apg-v12e-default': true, tsc: true, depcruise: true }, ['re-export'], ['./order']),
  edge('src/domain/index.ts', 'src/domain/thing.ts', { 'apg-v12e-default': true, tsc: true, depcruise: true }, ['re-export'], ['./thing']),
];
const CTX: ProjectContext = { read: (p) => FILES[p], sourceLabel: 'test', edges: EDGES, specExcludes: ['**/*.spec.ts'], apgFiles: new Set(Object.keys(FILES)) };

const row = (over: Record<string, string>): Record<string, string> => ({
  row_type: 'disagreement', project: 'p', source: 'src/app/use.ts', specifier: '../domain', line: '1',
  source_line_text: "import { Order } from '../domain';", 'verdict_apg-v12e-default': 'no-edge', verdict_tsc: 'edge', verdict_depcruise: 'edge', ...over,
});

describe('source helpers', () => {
  it('finds the whole statement of a multi-line import and its names', () => {
    expect(statementAt(FILES['src/app/use.ts'] ?? '', 4)).toBe("import {\n  Thing,\n} from '../domain';");
    expect(importedNames("import type { A, B as C } from 'x'")).toEqual(['A', 'B']);
    expect(importedNames("import D, * as N from 'x'")).toEqual(['*', 'default']);
  });

  it('tells a declaration from a re-export', () => {
    expect(declaresExport('export abstract class Foo {}', 'Foo')).toBe(true);
    expect(declaresExport("export { Foo } from './foo';", 'Foo')).toBe(false);
    expect(declaresExport('class Foo {}\nexport { Foo };\n', 'Foo')).toBe(true);
  });

  it('follows re-export edges from a barrel', () => {
    expect(reExportChain('src/domain/index.ts', 'src/domain/order.ts', EDGES)).toEqual(['src/domain/index.ts', 'src/domain/order.ts']);
    expect(reExportChain('src/domain/order.ts', 'src/domain/index.ts', EDGES)).toBeUndefined();
  });
});

describe('propose', () => {
  it('the dropped module edge to a pure barrel: reference-correct, re-export, required', () => {
    const p = propose(row({ target: 'src/domain/index.ts', 'class_apg-v12e-default_vs_tsc': 'missing-in-apg:re-export/barrel' }), CTX);
    expect(p).toMatchObject({ verdict: 'reference-correct', cls: 're-export', status: 'required', rule: 'R-barrel-module-edge' });
    expect(p.evidence).toContain("src/app/use.ts:1 `import { Order } from '../domain';`");
  });

  it('the routed edge to the declaring file: both-acceptable when the chain and the declaration check out', () => {
    const p = propose(row({ target: 'src/domain/order.ts', 'verdict_apg-v12e-default': 'edge', verdict_tsc: 'no-edge', verdict_depcruise: 'no-edge', 'class_apg-v12e-default_vs_tsc': 'missing-in-ref:re-export/barrel' }), CTX);
    expect(p).toMatchObject({ verdict: 'both-acceptable', cls: 're-export', status: 'acceptable', rule: 'R-barrel-routed' });
  });

  it('a routed edge to a file that declares none of the names is a tool-bug', () => {
    const p = propose(row({ target: 'src/domain/thing.ts', 'verdict_apg-v12e-default': 'edge', verdict_tsc: 'no-edge', verdict_depcruise: 'no-edge', 'class_apg-v12e-default_vs_tsc': 'missing-in-ref:re-export/barrel' }), CTX);
    expect(p).toMatchObject({ verdict: 'reference-correct', cls: 'tool-bug', status: 'absent' });
  });

  it('a cited line that does not match the file is never proposed silently', () => {
    const p = propose(row({ target: 'src/domain/index.ts', source_line_text: "import { X } from '../elsewhere';", 'class_apg-v12e-default_vs_tsc': 'missing-in-apg:re-export/barrel' }), CTX);
    expect(p.rule).toBe('R-unverified');
    expect(p.evidence).toContain('LINE MISMATCH');
  });
});

describe('score', () => {
  it('counts acceptable edges as correct except in strict mode', () => {
    const status = (e: ProjectEdge): 'required' | 'acceptable' | undefined =>
      e.target === 'src/domain/index.ts' ? 'required' : e.target === 'src/domain/order.ts' && e.source === 'src/app/use.ts' ? 'acceptable' : undefined;
    expect(score(EDGES, 'apg-v12e-default', status, false, false)).toEqual({ apgEdges: 3, correct: 3, required: 3, found: 2, unadjudicated: 0 });
    expect(score(EDGES, 'apg-v12e-default', status, true, false)).toEqual({ apgEdges: 3, correct: 2, required: 3, found: 2, unadjudicated: 0 });
  });
});

describe('reviewSample', () => {
  const items = Array.from({ length: 45 }, (_, i) => ({ id: `r${String(i).padStart(2, '0')}`, stratum: i < 3 ? 'tool-bug' : i < 25 ? 'alias' : 'other' }));

  it('takes every tool-bug row and 10% (rounded up) of each other class, the same for the same seed', () => {
    const a = reviewSample(items, 7);
    expect(a.filter((s) => s.item.stratum === 'tool-bug')).toHaveLength(3);
    expect(a.filter((s) => s.item.stratum === 'alias')).toHaveLength(3);
    expect(a.filter((s) => s.item.stratum === 'other')).toHaveLength(2);
    expect(reviewSample([...items].reverse(), 7)).toEqual(a);
  });
});
