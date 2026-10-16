import { blockingAgreement, dddBlockDiff, expectedFiles, fileSpecDiff, globDiff, layerAccuracy, newRows, plantedResult, touches } from '../../../../scripts/v1.3/lib/ise-compare.js';
import { renderDownstream, summarise } from '../../../../scripts/v1.3/ise-downstream.js';
import type { VariantDownstream } from '../../../../scripts/v1.3/ise-downstream.js';
import type { ExpectedFinding } from '../../../../scripts/v1.3/lib/reference-model.js';

const exp = (ruleId: string, file: string, target?: string): ExpectedFinding => ({ ruleId, ruleName: ruleId, file, reason: 'r', ...(target !== undefined ? { target } : {}) });

describe('ISE measurement comparisons', () => {
  it('(b) scores per-file layers, counts expected files the inferrer missed, and buckets by confidence', () => {
    const a = layerAccuracy(
      [{ file: 'a', layer: 'domain', confidence: 0.9 }, { file: 'b', layer: 'domain', confidence: 0.5 }, { file: 'x', layer: 'domain', confidence: 0.9 }],
      [{ path: 'a', layer: 'domain' }, { path: 'b', layer: 'application' }, { path: 'c', layer: null }],
    );
    expect([a.correct, a.total]).toEqual([1, 3]);
    expect(a.wrong.map((w) => w.file)).toEqual(['b', 'c']);
    expect(a.byConfidence.high).toEqual({ correct: 1, total: 1 });
    expect(a.byConfidence.low).toEqual({ correct: 0, total: 1 });
  });

  it('(c) diffs globs per layer (file patterns marked) and files whose layer differs', () => {
    const d = globDiff([{ name: 'domain', directories: ['src/kernel/**'], filePatterns: ['**/*.entity.ts'] }], [{ name: 'domain', directories: ['src/domain/**'] }, { name: 'api', directories: [] }]);
    expect(d).toEqual([
      { layer: 'domain', onlyInferred: ['pattern:**/*.entity.ts', 'src/kernel/**'], onlyTrue: ['src/domain/**'] },
      { layer: 'api', onlyInferred: [], onlyTrue: [] },
    ]);
    const f = fileSpecDiff(new Map([['a', 'domain'], ['b', null]]), new Map([['a', 'domain'], ['b', 'api']]));
    expect(f).toEqual({ files: 2, differing: [{ file: 'b', inferred: null, truth: 'api' }] });
  });

  it('(c) compares DDD blocks field by field, ignoring order', () => {
    const t = { contexts: [{ name: 'o', acl: [], root: 'src/o/' }], value_objects: ['a', 'b'] };
    const i = { contexts: [{ root: 'src/o/', name: 'o', acl: [] }], value_objects: ['b'], repositories: ['r'] };
    expect(dddBlockDiff(i, t)).toEqual([
      { field: 'repositories', onlyInferred: ['"r"'], onlyTrue: [] },
      { field: 'value_objects', onlyInferred: [], onlyTrue: ['"a"'] },
    ]);
  });

  it('(d) compares blocking findings under each spec’s own style tiers, cycles as file sets', () => {
    const inferred = [{ ruleId: 'FF-S01', file: 'a', target: 'b' }, { ruleId: 'FF-S02', file: 'x.ts,y.ts,x.ts', target: 'y.ts' }, { ruleId: 'FF-C02', file: 'a' }];
    const truth = [{ ruleId: 'FF-S01', file: 'a', target: 'b' }, { ruleId: 'FF-S02', file: 'y.ts,x.ts', target: 'x.ts' }, { ruleId: 'FF-P01', file: 'c', target: 'typeorm' }];
    const ag = blockingAgreement(inferred, 'clean-architecture', truth, 'clean-architecture');
    expect([ag.inferredBlocking, ag.trueBlocking, ag.both]).toEqual([2, 3, 2]);
    expect(ag.jaccard).toBeCloseTo(2 / 3);
    expect(ag.verdictAgrees).toBe(true);
    expect(ag.onlyTrue).toEqual(['FF-P01|c|typeorm']);
    const none = blockingAgreement([], 'layered', [{ ruleId: 'FF-C02', file: 'a' }], 'layered');
    expect([none.jaccard, none.verdictAgrees]).toEqual([1, true]);
    const flip = blockingAgreement([], 'layered', [{ ruleId: 'FF-S03', file: 'a', target: 'b' }], 'layered');
    expect(flip.verdictAgrees).toBe(false);
  });

  it('(d) scores the planted violation rule-exactly and by file touch, ignoring rows already on clean', () => {
    const manifest = { variant: 'v01', kind: 'violation' as const, plants: 'FF-S01', expectedFindings: [exp('FF-S01', 'src/domain/a.ts', 'src/app/b.ts')] };
    const scope = new Set(['FF-S01', 'FF-S04']);
    const hit = plantedResult('clean-architecture', manifest, [{ ruleId: 'FF-S01', file: 'src/domain/a.ts', target: 'src/app/b.ts' }], [], scope);
    expect([hit.plantedDetected, hit.touched, hit.matched, hit.expected]).toEqual([true, true, 1, 1]);
    const other = plantedResult('clean-architecture', manifest, [{ ruleId: 'FF-S04', file: 'src/domain/a.ts', target: 'src/app/b.ts' }], [], scope);
    expect([other.plantedDetected, other.touched]).toEqual([false, true]);
    const old = [{ ruleId: 'FF-S04', file: 'src/domain/a.ts', target: 'src/app/b.ts' }];
    expect(plantedResult('clean-architecture', manifest, old, old, scope).touched).toBe(false);
    expect(plantedResult('clean-architecture', { ...manifest, kind: 'near-miss', plants: null, expectedFindings: [] }, [], [], scope).touched).toBeNull();
  });

  it('splits cycle paths when collecting expected files and finds new rows', () => {
    expect([...expectedFiles([exp('FF-S02', 'a.ts,b.ts', 'b.ts')])].sort()).toEqual(['a.ts', 'b.ts']);
    expect(touches([{ rule: 'x', file: 'b.ts' }], [], [exp('FF-S02', 'a.ts,b.ts')])).toBe(true);
    expect(newRows([{ rule: 'r', file: 'a' }, { rule: 'r', file: 'b' }], [{ rule: 'r', file: 'a' }])).toEqual([{ rule: 'r', file: 'b' }]);
  });

  it('(d) summarises and renders per-target agreement and recall', () => {
    const ag = blockingAgreement([], 'layered', [], 'layered');
    const pr = (v: string, kind: 'violation' | 'clean', det: boolean | null): ReturnType<typeof plantedResult> => ({ variant: v, kind, plants: kind === 'violation' ? 'FF-S01' : null, plantedDetected: det, matched: det === true ? 1 : 0, expected: kind === 'violation' ? 1 : 0, touched: det });
    const rows: VariantDownstream[] = [
      { variant: 'clean', kind: 'clean', agreement: ag, trueSpec: pr('clean', 'clean', null), inferredSpec: pr('clean', 'clean', null) },
      { variant: 'v01', kind: 'violation', agreement: { ...ag, onlyTrue: ['FF-S01|a|b'], trueBlocking: 1, jaccard: 0, verdictAgrees: false }, trueSpec: pr('v01', 'violation', true), inferredSpec: pr('v01', 'violation', false) },
    ];
    const s = summarise(rows);
    expect(s).toMatchObject({ variants: 2, verdictAgreement: 1, exactBlockingAgreement: 1, meanJaccard: 0.5, violationVariants: 1, plantedTrue: 1, plantedInferred: 0, expectedMatchedTrue: 1, expectedMatchedInferred: 0, expectedTotal: 1 });
    const md = renderDownstream([{ id: 't', trueStyle: 'layered', inferredStyle: 'layered', variants: rows, summary: s }]);
    expect(md).toContain('| t | layered | layered | 1/2 | 1/2 | 0.50 | 1/1 | 0/1 |');
    expect(md).toContain('| v01 | violation |  | FF-S01|a|b | yes / no |');
  });
});

describe('renderDownstream: an inferred spec the firewall rejects', () => {
  it('voids the inferred columns and names the error', () => {
    const summary = summarise([]);
    const md = renderDownstream([{ id: 'S-x', trueStyle: 'ddd', inferredStyle: 'ddd', variants: [], summary, inferredSpecError: 'BR-SPEC-10 FF-DT02: repositoryPatterns' }]);
    expect(md).toContain('| S-x | ddd | ddd | inferred spec rejected | inferred spec rejected | - |');
    expect(md).toContain('The firewall refused every evaluation under the inferred spec: `BR-SPEC-10 FF-DT02: repositoryPatterns`.');
  });
});
