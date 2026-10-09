/**
 * ADR-025 (POST-HOC): the MO-S01 expectation style guard (layered specs allow domain-kind → infrastructure-kind, so
 * FF-S01 is expected disabled, not a detector) and the MO-DF01 / MO-DF01n constructor-scope precondition gap
 * (a protected constructor passed `type-shape` and gave TS2674 in SO4, nestjslatam__ddd MO-DF01n k = 1).
 */
import * as path from 'node:path';
import { Project } from 'ts-morph';
import { applyStyleGuard, loadCompiledSpec, styleGuardedFunctionIds } from '../../../../scripts/lib/mutation/expected.js';
import { constructorLiterals } from '../../../../scripts/lib/mutation/operators/mo-df01.js';

const ROOT = path.resolve(__dirname, '../../../..');

describe('MO-S01 style guard (ADR-025)', () => {
  it('v-aguiar__valex (layered): FF-S01 guarded; nestjs and clean-architecture specs: nothing guarded', async () => {
    const valex = await loadCompiledSpec(ROOT, 'corpus/specs/v-aguiar__valex.yaml');
    const truthy = await loadCompiledSpec(ROOT, 'corpus/specs/truthy-demo.yaml');
    if (!valex.success || !truthy.success) throw new Error('spec');
    expect(styleGuardedFunctionIds(valex.data, 'MO-S01')).toEqual(['FF-S01']);
    expect(styleGuardedFunctionIds(valex.data, 'MO-S03')).toEqual([]);
    expect(styleGuardedFunctionIds(truthy.data, 'MO-S01')).toEqual([]);
  });

  it('the SO4 valex MO-S01 expectation becomes FF-S01 + FF-S04 disabled with no key (seed not applicable, MAT-13 a)', () => {
    const k = { functionId: 'FF-S01', filePath: 'src/services/cardServices.ts', target: 'src/repositories/companyRepository.ts', discriminator: ['IMPORTS'] };
    const out = applyStyleGuard('MO-S01', 'layered', ['FF-S01'], {
      functionIds: ['FF-S01'], disabledFunctionIds: [{ functionId: 'FF-S04', reason: 'not applicable to style layered' }], keys: [k],
    });
    expect(out.functionIds).toEqual([]);
    expect(out.disabledFunctionIds.map((d) => d.functionId)).toEqual(['FF-S04', 'FF-S01']);
    expect(out.keys).toEqual([]);
    expect(applyStyleGuard('MO-S01', 'nestjs', ['FF-S01'], { functionIds: ['FF-S01'], disabledFunctionIds: [], keys: [k] }).functionIds).toEqual(['FF-S01']);
  });
});

describe('MO-DF01 / MO-DF01n constructor scope (ADR-025)', () => {
  const cls = (src: string) => new Project({ useInMemoryFileSystem: true }).createSourceFile('a.ts', src).getClassOrThrow('A');
  it('protected or private constructor → not constructible (type-shape); public / implicit → literals', () => {
    expect(constructorLiterals(cls('class A { protected constructor(x: string) {} }'), true)).toBeUndefined();
    expect(constructorLiterals(cls('class A { private constructor() {} }'), false)).toBeUndefined();
    expect(constructorLiterals(cls('class A { constructor(x: string, n: number) {} }'), true)).toEqual(["'u5a'", '0']);
    expect(constructorLiterals(cls('class A { public constructor() {} }'), false)).toEqual([]);
    expect(constructorLiterals(cls('class A {}'), false)).toEqual([]);
  });
});
