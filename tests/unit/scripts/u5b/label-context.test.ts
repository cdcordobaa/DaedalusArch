/**
 * U5b Step 27: labeller populations, context exclusion, mechanical FN causes and budget (FR-27; BR-U5b-33..35, 38, 39).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  POPULATION_CAPS, allocateBudget, buildItems, classifyMissedSeeds, estimateExit, judgeUnitCandidates, labelItemId,
  mechanicalFnCause, p1Candidate, sampleCandidates, violationCandidates,
} from '../../../../scripts/lib/label-context.js';
import type { MissedSeedEvidence, ViolationCandidate } from '../../../../scripts/lib/label-context.js';
import type { ManifestRow } from '../../../../scripts/lib/manifest.js';
import type { JudgeGraphView } from '../../../../src/llm-critic/judge-graph.js';
import { row } from './score-fixture.js';

const SENTINEL = 'SENTINEL-7f3a-JUDGE-OUTPUT';
const EMPTY_VIEW: JudgeGraphView = { files: [], classes: [], interfaces: [], edges: [] };
const describeFn = (id: string): string => `description of ${id}`;

let root: string;
function put(rel: string, text: string): void {
  const f = join(root, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, text);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'u5b-label-'));
  put('tsconfig.json', JSON.stringify({ compilerOptions: { module: 'commonjs', moduleResolution: 'node', paths: { '@missing/*': ['nowhere/*'] } } }));
  put('src/target.ts', 'export const value = 1;\nexport interface Shape { a: number }\n');
  put('src/barrel/index.ts', "export * from '../target';\n");
  put('src/domain/a.ts', Array.from({ length: 40 }, (_, i) => `// line ${String(i + 1)}`).join('\n'));
  put('src/domain/unit.ts', 'export class Unit {\n  run(): number { return 1; }\n}\n');
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

function reportWithSentinel(): unknown {
  return {
    violations: [
      { functionId: 'FF-S01', filePath: 'src/domain/a.ts', target: 'src/target.ts', line: 20, message: `symbolic ${SENTINEL}`, evidence: [SENTINEL] },
      { functionId: 'FF-N02', filePath: 'src/domain/unit.ts', route: 'neuronal', unitId: 'src/domain/unit.ts', message: SENTINEL },
    ],
    neuralResults: [{
      functionId: 'FF-N02', dimension: 'semantic', reasoning: SENTINEL, evidence: [SENTINEL],
      unitResults: [{ unitId: 'src/domain/unit.ts', unitKind: 'file', layer: 'domain', filePaths: ['src/domain/unit.ts'], status: 'valid', verdict: 'fail', confidence: 0.9, rationale: SENTINEL }],
    }],
    judge: { provider: 'mock', model: SENTINEL },
  };
}

describe('context exclusion (BR-U5b-35, 39)', () => {
  it('a report whose judge rationale and verdict hold a sentinel yields contexts without it (P2 and P4)', () => {
    const report = reportWithSentinel();
    const p2 = violationCandidates(report, { population: 'P2', projectId: 'p', treeSha: 't'.repeat(40), stratumOwner: 'p', sourceRoot: root, describe: describeFn });
    const p4 = judgeUnitCandidates(report, { projectId: 'p', treeSha: 't'.repeat(40), stratumOwner: 'cell-1', sourceRoot: root, view: EMPTY_VIEW });
    expect(p2).toHaveLength(1); // the neuronal row is not a P2 violation
    expect(p4).toHaveLength(1);
    const built = buildItems(sampleCandidates([...p2, ...p4], POPULATION_CAPS, 7));
    if (!built.ok) throw new Error(built.detail);
    expect(built.items).toHaveLength(2);
    for (const item of built.items) expect(item.context).not.toContain(SENTINEL);
    const v = built.items.find((i) => i.kind === 'violation');
    expect(v?.context).toContain('Line: 20');
    expect(v?.context).toContain('    5 | // line 5');
    expect(v?.context).toContain('   35 | // line 35');
    expect(v?.context).not.toContain('// line 36');
    const u = built.items.find((i) => i.kind === 'judge-unit');
    expect(u?.context).toContain('## Rubric');
    expect(u?.context).toContain('export class Unit');
    expect(u?.dimension).toBe('semantic');
  });

  it('P1 candidates come from the scorer key; the item id is the stable-content hash', () => {
    const key = JSON.stringify(['FF-S01', 'src/domain/a.ts', 'src/target.ts', []]);
    const c = p1Candidate({ itemKey: key, projectId: 'p', treeSha: 'b'.repeat(40), sourceRoot: root, line: 3, describe: describeFn });
    expect(c.fields).toEqual({ functionId: 'FF-S01', functionDescription: 'description of FF-S01', filePath: 'src/domain/a.ts', line: 3, target: 'src/target.ts' });
    const [s] = sampleCandidates([c], POPULATION_CAPS, 1);
    expect(s?.sampled[0]?.itemId).toBe(labelItemId('violation', 'p', 'b'.repeat(40), key));
    expect(s?.sampled[0]?.inclusionProbability).toBe(1);
  });
});

describe('populations and seeded sampling (BR-U5b-33)', () => {
  function stratumOf(n: number, population: 'P2' | 'P1'): ViolationCandidate[] {
    return Array.from({ length: n }, (_, i) => ({
      kind: 'violation', population, projectId: 'p', treeSha: 't', stratumOwner: 'p', sourceRoot: root,
      key: JSON.stringify(['FF-S01', `src/f${String(i)}.ts`, '', []]),
      fields: { functionId: 'FF-S01', functionDescription: 'd', filePath: `src/f${String(i)}.ts` },
    }));
  }

  it('a stratum of 50 with cap 20 yields 20 items at inclusion probability 0.4, the same for the same seed', () => {
    const a = sampleCandidates(stratumOf(50, 'P2'), POPULATION_CAPS, 42);
    expect(a).toHaveLength(1);
    expect(a[0]?.size).toBe(50);
    expect(a[0]?.cap).toBe(20);
    expect(a[0]?.sampled).toHaveLength(20);
    expect(a[0]?.sampled.every((s) => s.inclusionProbability === 0.4)).toBe(true);
    const b = sampleCandidates(stratumOf(50, 'P2'), POPULATION_CAPS, 42);
    expect(b[0]?.sampled.map((s) => s.itemId)).toEqual(a[0]?.sampled.map((s) => s.itemId));
    const c = sampleCandidates(stratumOf(50, 'P2'), POPULATION_CAPS, 43);
    expect(c[0]?.sampled.map((s) => s.itemId)).not.toEqual(a[0]?.sampled.map((s) => s.itemId));
  });

  it('P1 is exhaustive (probability 1) and a stratum under its cap keeps every item', () => {
    expect(sampleCandidates(stratumOf(50, 'P1'), POPULATION_CAPS, 1)[0]?.sampled).toHaveLength(50);
    const small = sampleCandidates(stratumOf(5, 'P2'), POPULATION_CAPS, 1)[0];
    expect(small?.sampled).toHaveLength(5);
    expect(small?.sampled[0]?.inclusionProbability).toBe(1);
  });
});

describe('budget (BR-U5b-34)', () => {
  const strata = [
    { population: 'P2' as const, stratum: 'p, FF-S01', size: 30 },
    { population: 'P2' as const, stratum: 'p, FF-S02', size: 30 },
    { population: 'P3' as const, stratum: 'c, FF-S01', size: 25 },
    { population: 'P4' as const, stratum: 'c, semantic', size: 15 },
  ];

  it('P1 = 100, budget 300 calls: 50 items left for P2..P4, caps lowered uniformly so the total is <= 50', () => {
    const a = allocateBudget({ budgetCalls: 300, p1: 100, missedSeeds: 0, strata });
    expect(a.ok).toBe(true);
    expect(a.capacityItems).toBe(150);
    expect(a.sampledCapacity).toBe(50);
    expect(a.allocatedSampled).toBeLessThanOrEqual(50);
    expect(a.caps.P2).toBeLessThan(20);
    expect(a.caps.P2).toBe(a.caps.P3);
    expect(a.caps.P4).toBe(Math.floor(10 * a.scale));
    expect(a.estimatedCalls).toBe((100 + a.allocatedSampled) * 2);
    expect(estimateExit(a).exitCode).toBe(0);
    // Unconstrained: the registered caps stay.
    expect(allocateBudget({ budgetCalls: 10_000, p1: 100, missedSeeds: 0, strata }).caps).toEqual(POPULATION_CAPS);
  });

  it('budget 150 calls: P1 alone needs 200, --estimate refuses with exit 1', () => {
    const a = allocateBudget({ budgetCalls: 150, p1: 100, missedSeeds: 0, strata });
    expect(a.ok).toBe(false);
    const e = estimateExit(a);
    expect(e.exitCode).toBe(1);
    expect(e.line).toContain('LABEL_BUDGET_EXCEEDED');
  });
});

describe('mechanical FN causes (BR-U5b-38)', () => {
  function seedRow(seedId: string, site: Record<string, unknown>, expected: Record<string, unknown> = {}): ManifestRow {
    return { ...row({ seedId, expected: { functionIds: ['FF-S01'], ...expected } }), site } as unknown as ManifestRow;
  }
  function ev(r: ManifestRow, over: Partial<MissedSeedEvidence> = {}): MissedSeedEvidence {
    return { row: r, seededRoot: root, tsconfigPath: 'tsconfig.json', warnings: [], reportDisabled: [], ...over };
  }
  function siteFile(name: string, line1: string): string {
    const rel = `src/domain/${name}.ts`;
    put(rel, `${line1}\nexport const used = 1;\n`);
    return rel;
  }

  it('one missed seed per rule plus one unmatched: six mechanical causes in order (five codes) and one missed-seed item', () => {
    const seeds = [
      ev(seedRow('p:MO-X01:0', { filePath: siteFile('r1', "void import('../target');"), line: 1, kind: 'dynamic-import', detail: { targetFile: 'src/target.ts' } }, { coverage: 'outside' })),
      ev(seedRow('p:MO-S01:1', { filePath: siteFile('r2', "const t = require('../target');"), line: 1, kind: 'import-edge', detail: { targetFile: 'src/target.ts' } })),
      ev(seedRow('p:MO-S01:2', { filePath: siteFile('r3', "import { value } from '@missing/target';"), line: 1, kind: 'import-edge', detail: { targetFile: 'src/target.ts' } })),
      ev(seedRow('p:MO-S01:3', { filePath: siteFile('r4', "import { value } from '../target';"), line: 1, kind: 'import-edge', detail: { targetFile: 'src/target.ts' } }), { reportDisabled: ['FF-S01'] }),
      ev(seedRow('p:MO-S01:4', { filePath: siteFile('r5', "import type { Shape } from '../target';"), line: 1, kind: 'import-edge', detail: { targetFile: 'src/target.ts' } })),
      ev(seedRow('p:MO-S01:5', { filePath: siteFile('r6', "import { value } from '../barrel';"), line: 1, kind: 'import-edge', detail: { targetFile: 'src/target.ts' } })),
      ev(seedRow('p:MO-S01:6', { filePath: siteFile('r7', "import { value } from '../target';"), line: 1, kind: 'import-edge', detail: { targetFile: 'src/target.ts' } }, {
        keys: [{ functionId: 'FF-S01', filePath: 'src/domain/r7.ts', target: 'src/target.ts', discriminator: ['IMPORTS'], lineRule: 'site-line', line: 1 }],
      })),
    ];
    const { causes, candidates } = classifyMissedSeeds(seeds, describeFn);
    expect(causes.map((c) => [c.seedId, c.rule, c.rootCause, c.source])).toEqual([
      ['p:MO-X01:0', 1, 'RC-DYNAMIC-IMPORT', 'mechanical'],
      ['p:MO-S01:1', 2, 'RC-DYNAMIC-IMPORT', 'mechanical'],
      ['p:MO-S01:2', 3, 'RC-EXTRACT-ALIAS', 'mechanical'],
      ['p:MO-S01:3', 4, 'RC-STYLE-INAPPLICABLE', 'mechanical'],
      ['p:MO-S01:4', 5, 'RC-TYPE-ONLY', 'mechanical'],
      ['p:MO-S01:5', 6, 'RC-EXTRACT-BARREL', 'mechanical'],
    ]);
    expect(new Set(causes.map((c) => c.rootCause)).size).toBe(5);
    expect(candidates.map((c) => [c.seedId, c.population, c.kind, c.fields.filePath, c.fields.line])).toEqual([['p:MO-S01:6', 'MS', 'missed-seed', 'src/domain/r7.ts', 1]]);
    const built = buildItems(sampleCandidates(candidates, POPULATION_CAPS, 3));
    if (!built.ok) throw new Error(built.detail);
    expect(built.items[0]?.seedId).toBe('p:MO-S01:6');
    expect(built.items[0]?.inclusionProbability).toBe(1);
  });

  it('an alias seed whose EXTRACTOR_002 warning was cut by the cap still gets RC-EXTRACT-ALIAS with corroborated = false', () => {
    const file = siteFile('alias', "import { value } from '@missing/target';");
    const r = seedRow('p:MO-S01:9', { filePath: file, line: 1, kind: 'import-edge', detail: { targetFile: 'src/target.ts' } });
    expect(mechanicalFnCause(ev(r))).toEqual({ seedId: 'p:MO-S01:9', rootCause: 'RC-EXTRACT-ALIAS', rule: 3, source: 'mechanical', corroborated: false });
    const routed = [{ code: 'EXTRACTOR_002', context: { filePath: file } }];
    expect(mechanicalFnCause(ev(r, { warnings: routed }))?.corroborated).toBe(true);
    // Aggregate counters are not an input: a warning on another file does not corroborate.
    expect(mechanicalFnCause(ev(r, { warnings: [{ code: 'EXTRACTOR_002', context: { filePath: 'src/other.ts' } }] }))?.corroborated).toBe(false);
  });

  it('the site line is mapped through the row line shifts before the statement is read', () => {
    const rel = 'src/domain/shifted.ts';
    put(rel, "import { value } from '../target';\nimport type { Shape } from '../target';\n");
    const r = { ...seedRow('p:MO-S01:8', { filePath: rel, line: 1, kind: 'import-edge', detail: { targetFile: 'src/target.ts' } }), lineShifts: [{ filePath: rel, afterLine: 0, delta: 1 }] } as ManifestRow;
    expect(mechanicalFnCause(ev(r))?.rootCause).toBe('RC-TYPE-ONLY');
  });
});
