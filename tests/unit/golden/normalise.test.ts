/**
 * Pure tests of the golden snapshot normaliser (FR-30, D-U0-12). No Neo4j.
 */
import type { GoldenRun } from '../../golden/golden-runner.js';
import {
  canonicaliseCycle,
  normaliseForSnapshot,
  serialiseSnapshot,
  CYCLE_ROW_CAP,
} from '../../golden/normalise.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import type { PerDimensionScore, SymbolicFunctionResult } from '../../../src/shared/types/evaluation.js';
import type { Dimension } from '../../../src/shared/types/enums.js';
import { ahsScore, avrScore, functionId, runId } from '../../../src/shared/types/value-objects.js';

const ROOT = '/repo/root';
const REAL_ROOT = '/real/volume/repo/root';

let idCounter = 0;
function violation(fid: string, filePath: string, message: string, dimension: Dimension = 'structural'): Violation {
  return {
    id: `v-${fid}-${++idCounter}`,
    type: 'LAYER_VIOLATION',
    dimension,
    severity: 'major',
    functionId: functionId(fid),
    route: 'symbolic',
    filePath,
    message,
    deterministic: true,
  };
}

function fnResult(fid: string, violations: Violation[], dimension: Dimension = 'structural'): SymbolicFunctionResult {
  return {
    functionId: functionId(fid),
    dimension,
    passed: violations.length === 0,
    violations,
    executionTimeMs: Math.floor(Math.random() * 1000),
    deterministic: true,
  };
}

function score(dimension: Dimension, avr: number): PerDimensionScore {
  return { dimension, avr: avrScore(avr), weight: 0.2, violationCount: 1, functionCount: 3 };
}

interface RunSpec {
  readonly results: SymbolicFunctionResult[];
  readonly compiled?: { functionId: string; templateName: string }[];
  readonly scores?: PerDimensionScore[];
  readonly root?: string;
}

function makeRun(spec: RunSpec): GoldenRun {
  const root = spec.root ?? ROOT;
  return {
    report: {
      runId: runId(`run-${Date.now()}-${Math.random()}`),
      projectPath: `${root}/fixtures/case-x`,
      specVersion: '1.0.0',
      ahsDeterministic: ahsScore(0.75),
      verdict: 'warning',
      perDimensionScores: spec.scores ?? [score('structural', 0.5), score('coupling', 0)],
      violations: spec.results.flatMap((r) => r.violations),
      universalMetrics: {
        cyclicDependencyCount: 1, maxFanOut: 2, maxFanIn: 3,
        abstractionRatio: 0.25, averageInstability: 0.5, orphanFileCount: 0,
      },
      evaluationMode: 'symbolic-only',
      durationMs: Math.floor(Math.random() * 1000),
      warnings: [],
    },
    evaluationResults: { symbolicResults: spec.results, neuronalResults: [] },
    compiledSymbolic: spec.compiled ?? spec.results.map((r) => ({ functionId: String(r.functionId), templateName: 'dependency-direction' })),
    warnings: [],
  };
}

function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value !== null && typeof value === 'object') Object.values(value).forEach((v) => allStrings(v, out));
  return out;
}

describe('normaliseForSnapshot', () => {
  it('drops runId, durationMs, executionTimeMs and violation ids', () => {
    const run = makeRun({ results: [fnResult('F1', [violation('F1', `${ROOT}/src/a.ts`, 'm')])] });
    const text = serialiseSnapshot(normaliseForSnapshot('case-x', run, { repoRoot: ROOT }));
    expect(text).not.toContain('runId');
    expect(text).not.toContain('durationMs');
    expect(text).not.toContain('executionTimeMs');
    expect(text).not.toContain('startedAt');
    expect(text).not.toContain('auditLog');
    expect(text).not.toMatch(/"id"/);
    expect(text).not.toContain('v-F1-');
  });

  it('keeps the D-U0-12 field set and a repo-relative projectPath', () => {
    const run = makeRun({ results: [fnResult('F1', [violation('F1', `${ROOT}/src/a.ts`, 'm')])] });
    const snap = normaliseForSnapshot('case-x', run, { repoRoot: ROOT });
    expect(Object.keys(snap).sort()).toEqual([
      'ahsDeterministic', 'caseId', 'evaluationMode', 'functionResults', 'perDimensionScores',
      'projectPath', 'specVersion', 'unexecutedFunctionIds', 'universalMetrics', 'verdict',
      'violations', 'warnings',
    ]);
    expect(snap.projectPath).toBe('fixtures/case-x');
    expect(Object.keys(snap.violations[0]!).sort()).toEqual(
      ['dimension', 'filePath', 'functionId', 'message', 'route', 'severity', 'type'],
    );
    expect(snap.functionResults).toEqual([{ functionId: 'F1', dimension: 'structural', passed: false, violationCount: 1 }]);
  });

  it('replaces the resolved root with <root> in every string', () => {
    const run = makeRun({
      results: [fnResult('F1', [violation('F1', `${ROOT}/src/a.ts`, `${ROOT}/src/a.ts imports ${ROOT}/src/b.ts`)])],
    });
    const snap = normaliseForSnapshot('case-x', run, { repoRoot: ROOT });
    expect(snap.violations[0]).toMatchObject({
      filePath: '<root>/src/a.ts',
      message: '<root>/src/a.ts imports <root>/src/b.ts',
    });
    expect(allStrings(JSON.parse(serialiseSnapshot(snap))).some((s) => s.startsWith('/'))).toBe(false);
  });

  it('replaces the realpath root too (repo reached through a symlink)', () => {
    const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
    const spy = jest.spyOn(fs, 'realpathSync').mockImplementation(((p: unknown) =>
      (p === ROOT ? REAL_ROOT : String(p))) as unknown as typeof fs.realpathSync);
    try {
      const run = makeRun({
        root: REAL_ROOT,
        results: [fnResult('F1', [violation('F1', `${REAL_ROOT}/src/a.ts`, `in ${ROOT}/src/b.ts`)])],
      });
      const snap = normaliseForSnapshot('case-x', run, { repoRoot: ROOT });
      expect(snap.violations[0]!.filePath).toBe('<root>/src/a.ts');
      expect(snap.violations[0]!.message).toBe('in <root>/src/b.ts');
      expect(allStrings(JSON.parse(serialiseSnapshot(snap))).some((s) => s.startsWith('/'))).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('is stable across Neo4j row orders inside one function', () => {
    const rows = [
      violation('F1', `${ROOT}/src/c.ts`, 'c'),
      violation('F1', `${ROOT}/src/a.ts`, 'a2'),
      violation('F1', `${ROOT}/src/a.ts`, 'a1'),
      violation('F1', `${ROOT}/src/b.ts`, 'b'),
    ];
    const run1 = makeRun({ results: [fnResult('F1', rows), fnResult('F2', [])] });
    const run2 = makeRun({ results: [fnResult('F1', [rows[3]!, rows[2]!, rows[0]!, rows[1]!]), fnResult('F2', [])] });
    const s1 = serialiseSnapshot(normaliseForSnapshot('case-x', run1, { repoRoot: ROOT }));
    const s2 = serialiseSnapshot(normaliseForSnapshot('case-x', run2, { repoRoot: ROOT }));
    expect(s1).toBe(s2);
    const snap = normaliseForSnapshot('case-x', run1, { repoRoot: ROOT });
    expect(snap.violations.map((v) => v.message)).toEqual(['a1', 'a2', 'b', 'c']);
  });

  it('keeps perDimensionScores in emitted order (reordered → different snapshot)', () => {
    const results = [fnResult('F1', [])];
    const a = makeRun({ results, scores: [score('structural', 0.5), score('coupling', 0)] });
    const b = makeRun({ results, scores: [score('coupling', 0), score('structural', 0.5)] });
    expect(serialiseSnapshot(normaliseForSnapshot('case-x', a, { repoRoot: ROOT })))
      .not.toBe(serialiseSnapshot(normaliseForSnapshot('case-x', b, { repoRoot: ROOT })));
  });

  it('keeps function groups in emitted order (reordered groups → different snapshot)', () => {
    const f1 = fnResult('F1', [violation('F1', `${ROOT}/src/z.ts`, 'z')]);
    const f2 = fnResult('F2', [violation('F2', `${ROOT}/src/a.ts`, 'a')]);
    const a = serialiseSnapshot(normaliseForSnapshot('case-x', makeRun({ results: [f1, f2] }), { repoRoot: ROOT }));
    const b = serialiseSnapshot(normaliseForSnapshot('case-x', makeRun({ results: [f2, f1] }), { repoRoot: ROOT }));
    expect(a).not.toBe(b);
    const snap = normaliseForSnapshot('case-x', makeRun({ results: [f1, f2] }), { repoRoot: ROOT });
    expect(snap.violations.map((v) => v.functionId)).toEqual(['F1', 'F2']);
  });

  it('keeps a non-lexicographic function group order as emitted (no sort by functionId)', () => {
    const f1 = fnResult('F1', [violation('F1', `${ROOT}/src/z.ts`, 'z')]);
    const f2 = fnResult('F2', [violation('F2', `${ROOT}/src/a.ts`, 'a')]);
    const snap = normaliseForSnapshot('case-x', makeRun({ results: [f2, f1] }), { repoRoot: ROOT });
    expect(snap.violations.map((v) => v.functionId)).toEqual(['F2', 'F1']);
  });

  it('same functionResults order but reordered violation groups → different snapshot', () => {
    const v1 = violation('F1', `${ROOT}/src/z.ts`, 'z');
    const v2 = violation('F2', `${ROOT}/src/a.ts`, 'a');
    const base = makeRun({ results: [fnResult('F1', [v1]), fnResult('F2', [v2])] });
    const swapped: GoldenRun = { ...base, report: { ...base.report, violations: [v2, v1] } };
    expect(serialiseSnapshot(normaliseForSnapshot('case-x', swapped, { repoRoot: ROOT })))
      .not.toBe(serialiseSnapshot(normaliseForSnapshot('case-x', base, { repoRoot: ROOT })));
    expect(normaliseForSnapshot('case-x', swapped, { repoRoot: ROOT }).violations.map((v) => v.functionId))
      .toEqual(['F2', 'F1']);
  });

  it('replaces the root in non-path fields too (every string)', () => {
    const v = { ...violation('F1', `${ROOT}/src/a.ts`, 'm'), type: `${ROOT}/type` } as unknown as Violation;
    const base = makeRun({ results: [fnResult('F1', [v])] });
    const run: GoldenRun = { ...base, report: { ...base.report, specVersion: `${ROOT}/spec` } };
    const snap = normaliseForSnapshot('case-x', run, { repoRoot: ROOT });
    expect(snap.specVersion).toBe('<root>/spec');
    expect(snap.violations[0]!.type).toBe('<root>/type');
    expect(allStrings(JSON.parse(serialiseSnapshot(snap))).some((s) => s.startsWith('/'))).toBe(false);
  });

  it('replaces a symlinked alias of the root (dev-link) that resolves to the same real path', () => {
    const ALIAS = '/home/me/dev-link/repo/root';
    const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
    const spy = jest.spyOn(fs, 'realpathSync').mockImplementation(((p: unknown) =>
      (p === ROOT || p === ALIAS ? REAL_ROOT : String(p))) as unknown as typeof fs.realpathSync);
    try {
      const run = makeRun({
        results: [fnResult('F1', [violation('F1', `${ALIAS}/src/a.ts`, `in ${REAL_ROOT}/b.ts`)])],
      });
      const snap = normaliseForSnapshot('case-x', run, { repoRoot: ROOT, rootAliases: [ALIAS, '/unrelated'] });
      expect(snap.violations[0]!.filePath).toBe('<root>/src/a.ts');
      expect(snap.violations[0]!.message).toBe('in <root>/b.ts');
    } finally {
      spy.mockRestore();
    }
  });

  it('ignores an alias that resolves elsewhere', () => {
    const run = makeRun({ results: [fnResult('F1', [violation('F1', '/elsewhere/a.ts', 'm')])] });
    const snap = normaliseForSnapshot('case-x', run, { repoRoot: ROOT, rootAliases: ['/elsewhere'] });
    expect(snap.violations[0]!.filePath).toBe('/elsewhere/a.ts');
  });

  it('sorts unexecutedFunctionIds and warnings', () => {
    const run: GoldenRun = {
      ...makeRun({
        results: [fnResult('F2', [])],
        compiled: [
          { functionId: 'F9', templateName: 't' },
          { functionId: 'F2', templateName: 't' },
          { functionId: 'F3', templateName: 't' },
        ],
      }),
      warnings: [
        { stage: 'evaluate-symbolic', code: 'EVAL_001', message: 'z' },
        { stage: 'compile', code: 'W', message: `at ${ROOT}/x` },
        { stage: 'evaluate-symbolic', code: 'EVAL_001', message: 'a' },
      ],
    };
    const snap = normaliseForSnapshot('case-x', run, { repoRoot: ROOT });
    expect(snap.unexecutedFunctionIds).toEqual(['F3', 'F9']);
    expect(snap.warnings).toEqual([
      { stage: 'compile', code: 'W', message: 'at <root>/x' },
      { stage: 'evaluate-symbolic', code: 'EVAL_001', message: 'a' },
      { stage: 'evaluate-symbolic', code: 'EVAL_001', message: 'z' },
    ]);
  });

  it('canonicalises no-cyclic-deps rotations to the same string, without deduplicating rows', () => {
    const r1 = `${ROOT}/b.ts,${ROOT}/c.ts,${ROOT}/a.ts,${ROOT}/b.ts`;
    const r2 = `${ROOT}/a.ts,${ROOT}/b.ts,${ROOT}/c.ts,${ROOT}/a.ts`;
    const run = makeRun({
      results: [fnResult('CYC', [
        violation('CYC', r1, `Circular dependency: ${r1}`),
        violation('CYC', r2, `Circular dependency: ${r2}`),
      ])],
      compiled: [{ functionId: 'CYC', templateName: 'no-cyclic-deps' }],
    });
    const snap = normaliseForSnapshot('case-x', run, { repoRoot: ROOT });
    const canonical = '<root>/a.ts,<root>/b.ts,<root>/c.ts,<root>/a.ts';
    expect(snap.violations).toHaveLength(2);
    expect(snap.violations.map((v) => v.filePath)).toEqual([canonical, canonical]);
    expect(snap.violations.map((v) => v.message)).toEqual([`Circular dependency: ${canonical}`, `Circular dependency: ${canonical}`]);
  });

  it('does not canonicalise comma paths for non-cycle templates', () => {
    const p = `${ROOT}/b.ts,${ROOT}/a.ts,${ROOT}/b.ts`;
    const run = makeRun({ results: [fnResult('F1', [violation('F1', p, p)])] });
    expect(normaliseForSnapshot('case-x', run, { repoRoot: ROOT }).violations[0]!.filePath)
      .toBe('<root>/b.ts,<root>/a.ts,<root>/b.ts');
  });

  it('applies the cap fallback when no-cyclic-deps returns exactly 100 rows', () => {
    const rows = Array.from({ length: CYCLE_ROW_CAP }, (_, i) =>
      violation('CYC', `${ROOT}/f${i}.ts,${ROOT}/g.ts,${ROOT}/f${i}.ts`, `Circular dependency: ${i}`));
    const other = fnResult('F1', [violation('F1', `${ROOT}/src/a.ts`, 'm')]);
    const run = makeRun({
      results: [fnResult('CYC', rows), other],
      compiled: [
        { functionId: 'CYC', templateName: 'no-cyclic-deps' },
        { functionId: 'F1', templateName: 'dependency-direction' },
      ],
    });
    const snap = normaliseForSnapshot('case-x', run, { repoRoot: ROOT });
    expect(snap.truncatedFunctions).toEqual([{ functionId: 'CYC', count: 100, truncated: true }]);
    expect(snap.violations.map((v) => v.functionId)).toEqual(['F1']);
    expect(snap.functionResults.find((f) => f.functionId === 'CYC')!.violationCount).toBe(100);
  });

  it('omits truncatedFunctions below the cap', () => {
    const run = makeRun({
      results: [fnResult('CYC', [violation('CYC', `${ROOT}/a.ts,${ROOT}/b.ts,${ROOT}/a.ts`, 'x')])],
      compiled: [{ functionId: 'CYC', templateName: 'no-cyclic-deps' }],
    });
    expect(normaliseForSnapshot('case-x', run, { repoRoot: ROOT })).not.toHaveProperty('truncatedFunctions');
  });
});

describe('canonicaliseCycle', () => {
  it('rotates [b,c,a,b] and [a,b,c,a] to the same canonical string', () => {
    expect(canonicaliseCycle('b,c,a,b')).toBe('a,b,c,a');
    expect(canonicaliseCycle('a,b,c,a')).toBe('a,b,c,a');
    expect(canonicaliseCycle('c,a,b,c')).toBe('a,b,c,a');
  });

  it('keeps a reversed cycle distinct (direction is meaningful)', () => {
    expect(canonicaliseCycle('a,c,b,a')).toBe('a,c,b,a');
  });
});

describe('serialiseSnapshot', () => {
  it('sorts object keys, preserves array order, 2-space indent and trailing newline', () => {
    const run = makeRun({ results: [fnResult('F2', []), fnResult('F1', [])] });
    const text = serialiseSnapshot(normaliseForSnapshot('case-x', run, { repoRoot: ROOT }));
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.startsWith('{\n  "ahsDeterministic"')).toBe(true);
    const parsed = JSON.parse(text) as { functionResults: { functionId: string }[] };
    expect(parsed.functionResults.map((f) => f.functionId)).toEqual(['F2', 'F1']);
    const keys = Object.keys(JSON.parse(text) as object);
    expect(keys).toEqual([...keys].sort());
  });
});
