import { fileLayerScore, pool, questionCoverage, renderDisagreements, renderTable, specLayers, summariseTarget } from '../../../../scripts/v1.3/lib/init-infer-compare.js';
import type { VariantRow } from '../../../../scripts/v1.3/lib/init-infer-compare.js';

const spec = (dirs: Record<string, string[]>): string =>
  `architecture:\n  layers:\n${Object.entries(dirs).map(([n, d]) => `    - name: ${n}\n      directories: [${d.map((x) => `"${x}"`).join(', ')}]`).join('\n')}\n`;

describe('init-infer comparisons', () => {
  const truth = spec({ domain: ['src/domain/**'], application: ['src/application/**'] });
  it('reads spec layers', () => {
    expect(specLayers(truth).map((l) => l.name)).toEqual(['domain', 'application']);
  });

  it('scores files against the expected graph, falling back to the true spec for files it does not list', () => {
    const inferred = spec({ domain: ['src/domain/**'], application: ['src/application/**', 'src/extra/**'] });
    const files = ['src/domain/A.ts', 'src/application/B.ts', 'src/application/New.ts', 'src/extra/C.ts'];
    const s = fileLayerScore(files, inferred, truth, [{ path: 'src/domain/A.ts', layer: 'domain' }, { path: 'src/application/B.ts', layer: 'application' }, { path: 'src/extra/C.ts', layer: null }]);
    expect(s.correct).toBe(3);
    expect(s.wrong).toEqual([{ file: 'src/extra/C.ts', inferred: 'application', truth: null }]);
  });

  it('counts the wrong files a question covers and the questions on correct folders', () => {
    const layers = { correct: 1, total: 3, wrong: [{ file: 'src/kernel/A.ts', inferred: null, truth: 'domain' }, { file: 'src/main.ts', inferred: null, truth: 'config' }] };
    expect(questionCoverage(['style', 'src/kernel/', 'src/platform/'], layers)).toEqual({ wrongAsked: 1, questionsOnCorrect: 1 });
    expect(questionCoverage(['src/main.ts'], layers)).toEqual({ wrongAsked: 1, questionsOnCorrect: 0 });
  });

  it('summarises, pools and renders', () => {
    const agree = { inferredBlocking: 1, trueBlocking: 1, both: 1, jaccard: 1, verdictAgrees: true, onlyInferred: [], onlyTrue: [] };
    const planted = (d: boolean) => ({ variant: 'v', kind: 'violation' as const, plants: 'FF-S01', plantedDetected: d, matched: 1, expected: 1, touched: d });
    const rows: VariantRow[] = [
      { variant: 'clean', kind: 'clean', inferredStyle: 'layered', styleConfidence: 1, questions: 0, wrongAsked: 0, questionsOnCorrect: 0, layers: { correct: 2, total: 2, wrong: [] }, agreement: { ...agree, inferredBlocking: 0, trueBlocking: 0, both: 0 }, trueSpec: null, inferredSpec: null },
      { variant: 'v1', kind: 'violation', inferredStyle: 'layered', styleConfidence: 1, questions: 2, wrongAsked: 1, questionsOnCorrect: 1, layers: { correct: 1, total: 2, wrong: [{ file: 'x', inferred: null, truth: 'domain' }] }, agreement: { ...agree, jaccard: 0, verdictAgrees: false, onlyTrue: ['FF-S01|x|'] }, trueSpec: planted(true), inferredSpec: planted(false) },
    ];
    const s = summariseTarget('layered', 'layered', false, rows);
    expect(s).toMatchObject({ variants: 2, styleCorrect: 2, filesCorrect: 3, files: 4, verdictAgrees: 1, blockingIdentical: 1, meanJaccard: 0.5, plantedTrue: 1, plantedInferred: 0, meanQuestions: 1, wrongFiles: 1, wrongAsked: 1, questionsOnCorrect: 1 });
    const p = pool('all', [s, s]);
    expect(p).toMatchObject({ variants: 4, filesCorrect: 6, meanJaccard: 0.5 });
    expect(renderTable([s])).toMatch(/\| layered \| 2\/2 \| 3\/4 \(75\.0%\) \| 1\/2 \| 1\/2 \| 0\.50 \| 1\/1 \| 0\/1 \| 0 \| 1\.0 \|/);
    const d = renderDisagreements('layered', 'layered', rows);
    expect(d).toMatch(/\| v1 \| violation \|/);
    expect(d).not.toMatch(/\| clean \|/);
  });
});
