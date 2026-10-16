/** Ontology v0 deterministic verification of rule duplication. */
import { Project } from 'ts-morph';
import type { MethodDeclaration } from 'ts-morph';
import { comparisonPatterns, numericConstants, verifyRuleDuplication } from '../../../../src/apg-enrich/ontology/index.js';
import type { CheapEnrichment } from '../../../../src/apg-enrich/cheap/types.js';

const SRC = `
const FREE_MIN_CENTS = 5000;
let mutableMin = 50;
export class A { shipping(total: number): number { if (total >= 50) { return 0; } return 4.99; } }
export class B { fee(sum: number): number { return !(sum < FREE_MIN_CENTS) ? 0 : 499; } }
export class C { mirrored(x: number): boolean { return 50 <= x; } }
export class D { private readonly limit = 18; adult(age: number): boolean { return age >= this.limit; } }
export class E { notConst(x: number): boolean { return x >= mutableMin; } both(a: number, b: number): boolean { return a > b; } }
export class F { neq(x: number): boolean { return !(x === 3); } }
export class G { uses(x: number): number { return x * 50 + 1; } }
`;

function methods(): Map<string, MethodDeclaration> {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { strict: true } });
  const sf = project.createSourceFile('/m.ts', SRC);
  const out = new Map<string, MethodDeclaration>();
  for (const c of sf.getClasses()) for (const m of c.getMethods()) out.set(`${c.getName() ?? ''}.${m.getName()}`, m);
  return out;
}

const EMPTY: CheapEnrichment = { edges: [], nodeFacts: [], flags: [], summaries: {}, timingsMs: {} };

describe('comparison patterns', () => {
  const m = methods();
  const get = (k: string): MethodDeclaration => { const x = m.get(k); if (x === undefined) throw new Error(k); return x; };

  it('canonicalises negation, mirroring and resolves const and readonly constants', () => {
    expect(comparisonPatterns(get('A.shipping'))).toEqual([{ op: '>=', value: 50 }]);
    expect(comparisonPatterns(get('B.fee'))).toEqual([{ op: '>=', value: 5000 }]);
    expect(comparisonPatterns(get('C.mirrored'))).toEqual([{ op: '>=', value: 50 }]);
    expect(comparisonPatterns(get('D.adult'))).toEqual([{ op: '>=', value: 18 }]);
    expect(comparisonPatterns(get('F.neq'))).toEqual([{ op: '!=', value: 3 }]);
  });

  it('ignores non-constant comparisons (a let variable, two variables)', () => {
    expect(comparisonPatterns(get('E.notConst'))).toEqual([]);
    expect(comparisonPatterns(get('E.both'))).toEqual([]);
  });

  it('lists numeric constants other than 0 and 1', () => {
    expect(numericConstants(get('A.shipping'))).toEqual([4.99, 50]);
    expect(numericConstants(get('B.fee'))).toEqual([499, 5000]);
    expect(numericConstants(get('G.uses'))).toEqual([50]);
  });

  it('verifies a duplication by comparison pattern up to a decimal scale', () => {
    const decls = new Map([['a', get('A.shipping')], ['b', get('B.fee')], ['c', get('C.mirrored')], ['d', get('D.adult')], ['g', get('G.uses')], ['e', get('E.both')]]);
    const names = new Map<string, { className: string; methodName: string }>();
    expect(verifyRuleDuplication(['a', 'b'], decls, EMPTY, names, 3)).toMatchObject({ verified: true, method: 'comparison-pattern' });
    expect(verifyRuleDuplication(['a', 'c'], decls, EMPTY, names, 3)).toMatchObject({ verified: true, method: 'comparison-pattern' });
    expect(verifyRuleDuplication(['a', 'b'], decls, EMPTY, names, 1)).toMatchObject({ verified: false });
    expect(verifyRuleDuplication(['a', 'g'], decls, EMPTY, names, 3)).toMatchObject({ verified: true, method: 'constant-pattern' });
    expect(verifyRuleDuplication(['a', 'd'], decls, EMPTY, names, 3)).toEqual({ verified: false, method: 'none', detail: expect.stringContaining('model-only') as string });
  });

  it('falls back to the cheap clone and shared-literal proxies', () => {
    const decls = new Map([['d', get('D.adult')], ['e', get('E.both')]]);
    const clone: CheapEnrichment = { ...EMPTY, edges: [{ type: 'SAME_LOGIC_AS', proxy: 'clones', sourceId: 'd', targetId: 'e', score: 1, evidence: [], properties: {} }] };
    expect(verifyRuleDuplication(['d', 'e'], decls, clone, new Map(), 3)).toMatchObject({ verified: true, method: 'cheap-clone' });
    const flag = (className: string, methodName: string): CheapEnrichment['flags'][number] => ({ proxy: 'shared-literals', kind: 'shared-number-literal', score: 1, evidence: { file: 'f', startLine: 1, endLine: 1 }, className, methodName, message: '' });
    const lit: CheapEnrichment = { ...EMPTY, flags: [flag('D', 'adult'), flag('E', 'both')] };
    const names = new Map([['d', { className: 'D', methodName: 'adult' }], ['e', { className: 'E', methodName: 'both' }]]);
    expect(verifyRuleDuplication(['d', 'e'], decls, lit, names, 3)).toMatchObject({ verified: true, method: 'cheap-literal' });
  });
});
