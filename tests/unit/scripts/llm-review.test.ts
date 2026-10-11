/**
 * ADR-036 plain LLM-review pilot: the pure parts (selection draw, prose rendering, argv, scoring rules).
 */
import {
  ADMITTED_BASES,
  OPERATORS,
  buildReviewArgs,
  callOrder,
  detectSeed,
  drawSelection,
  jaccard,
  keyOf,
  keySet,
  normFile,
  parseReviewOutput,
  permutations,
  projectedCost,
  rateCardCredits,
  renderPrompt,
  renderSpecProse,
  reviewPermissionsToml,
  scorePairRun,
} from '../../../scripts/llm-review.js';
import type { ReviewSeed } from '../../../scripts/llm-review.js';
import { FORBIDDEN_CODEX_FLAGS } from '../../../scripts/lib/generators/codex-cli.js';

describe('llm-review selection', () => {
  const rows = ADMITTED_BASES.flatMap((b) =>
    OPERATORS.map((op) => ({ seedId: `${b}:${op}:0`, projectId: b, operatorId: op, expected: { functionIds: ['FF-X'], dimension: 'd', keys: [] } })),
  );
  const coverage = new Map(rows.map((r) => [r.seedId, 'matched']));

  it('permutations enumerates n! orders', () => {
    expect(permutations([1, 2, 3])).toHaveLength(6);
  });

  it('draws a bijection of operators onto distinct bases, deterministically', () => {
    const a = drawSelection({ manifestRows: rows, coverage }, 9301);
    const b = drawSelection({ manifestRows: rows, coverage }, 9301);
    expect(a).toEqual(b);
    expect(a.feasibleAssignments).toBe(120);
    expect(new Set(a.assignment.map((x) => x.seedId.split(':')[0])).size).toBe(5);
    expect(a.assignment.map((x) => x.operatorId)).toEqual([...OPERATORS]);
    expect(['p3', 'p4']).toContain(a.drawnPair);
  });

  it('only draws seeds SO4 v2 scored', () => {
    const cov = new Map(coverage);
    for (const r of rows) if (r.projectId === 'v-aguiar__valex') cov.set(r.seedId, 'not-applicable');
    expect(() => drawSelection({ manifestRows: rows, coverage: cov }, 1)).toThrow('LLM_REVIEW_SELECTION_EMPTY');
  });
});

describe('llm-review prose and prompt', () => {
  const spec = `
architecture:
  style: layered
  layers:
    - name: persistence
      kind: infrastructure
      directories: [src/repositories/**]
    - name: business
      kind: domain
      directories: [src/services/**]
fitness_functions:
  - { id: FF-S01, name: dependency-direction, dimension: structural, severity: critical, route: symbolic }
  - { id: FF-P01, name: domain-purity, dimension: pattern, severity: critical, route: symbolic, forbidden_imports: [express, typeorm] }
  - { id: FF-CV05, name: test-file-pairing, dimension: convention, severity: advisory, route: symbolic }
  - { id: FF-C02, name: module-fan-out, dimension: coupling, severity: major, route: symbolic, threshold: 10, exclude_paths: ["src/main.ts"] }
  - { id: FF-CV01, name: naming-conventions, dimension: convention, severity: minor, route: symbolic, enabled: false }
  - id: FF-N02
    name: intent-alignment
    dimension: semantic
    severity: major
    route: neuronal
    semantic_criteria: { rule: "Match the layer.", rubric: { fail: "Wrong layer." } }
`;

  it('lists executed symbolic rules (not advisory, not disabled) and the neuronal ones, with parameters', () => {
    const { prose, ruleIds } = renderSpecProse(spec, new Set(['FF-S01', 'FF-P01', 'FF-CV05', 'FF-C02', 'FF-CV01']));
    expect(ruleIds).toEqual(['FF-S01', 'FF-P01', 'FF-C02', 'FF-N02']);
    expect(prose).toContain('express, typeorm');
    expect(prose).toContain('more than 10 distinct');
    expect(prose).toContain('Files under src/main.ts are exempt');
    expect(prose).toContain('1. persistence (kind: infrastructure)');
    expect(prose).not.toContain('FF-CV05');
  });

  it('leaves out a symbolic rule the firewall did not execute', () => {
    expect(renderSpecProse(spec, new Set(['FF-S01'])).ruleIds).toEqual(['FF-S01', 'FF-N02']);
  });

  it('fills the template placeholder', () => {
    expect(renderPrompt('A\n{{ARCHITECTURE}}\nB', 'X')).toBe('A\nX\nB');
    expect(() => renderPrompt('no placeholder', 'X')).toThrow();
  });
});

describe('llm-review argv', () => {
  it('uses a read-only profile with the denies and no network, and no forbidden flag', () => {
    const args = buildReviewArgs({ model: 'gpt-5.6-terra', reasoningEffort: 'medium' }, '/c.json', '/s.json', '/t/x', ['/deny/a']);
    const toml = reviewPermissionsToml(['/deny/a']);
    expect(toml).toContain('extends=":read-only"');
    expect(toml).toContain('"/deny/a"="deny"');
    expect(toml).toContain('network={enabled=false}');
    expect(args).toContain(toml);
    expect(args).toContain('--output-schema');
    expect(args[args.length - 1]).toBe('-');
    for (const f of FORBIDDEN_CODEX_FLAGS) expect(args).not.toContain(f);
    expect(args).not.toContain('--add-dir');
  });
});

describe('llm-review scoring rules', () => {
  const seed: ReviewSeed = {
    seedId: 's', operatorId: 'MO-S01', treeId: 't', baselineTreeId: 'b', dimension: 'structural',
    functionIds: ['FF-S01', 'FF-S04'], keys: [{ functionId: 'FF-S01', filePath: 'src/a.ts' }, { functionId: 'FF-S04', filePath: 'src/a.ts' }],
    editedFiles: ['src/a.ts'], createdFiles: [], firewallStatus: 'matched',
  };
  const dim = (r: string): string | undefined => ({ 'FF-S01': 'structural', 'FF-S02': 'structural', 'FF-S04': 'structural', 'FF-P01': 'pattern' } as Record<string, string>)[r];

  it('normalises files and rule case', () => {
    expect(normFile('./src/a.ts:12')).toBe('src/a.ts');
    expect(normFile('/root/p/src/a.ts', '/root/p')).toBe('src/a.ts');
    expect(keySet([{ file: 'src/a.ts', rule: 'ff-s01', reason: '' }]).has(keyOf('FF-S01', 'src/a.ts'))).toBe(true);
  });

  it('primary detection needs an expected (function, file) key that the same-index baseline run lacks', () => {
    const seeded = new Set([keyOf('FF-S01', 'src/a.ts')]);
    expect(detectSeed(seed, seeded, new Set(), dim)).toEqual({ primary: true, presence: true, family: true });
    expect(detectSeed(seed, seeded, new Set([keyOf('FF-S01', 'src/a.ts')]), dim)).toEqual({ primary: false, presence: true, family: false });
  });

  it('family reading accepts another rule of the seed dimension on the expected file', () => {
    const seeded = new Set([keyOf('FF-S02', 'src/a.ts'), keyOf('FF-S01', 'src/other.ts')]);
    expect(detectSeed(seed, seeded, new Set(), dim)).toEqual({ primary: false, presence: false, family: true });
  });

  it('real-pair rule maps renamed files and has a strict reading', () => {
    const touched = [{ status: 'R', from: 'src/old.ts', path: 'src/new.ts' }, { status: 'M', path: 'src/m.ts' }];
    const before = new Set([keyOf('FF-S01', 'src/old.ts'), keyOf('FF-P01', 'src/m.ts'), keyOf('FF-S01', 'src/far.ts')]);
    const after = new Set([keyOf('FF-S01', 'src/new.ts')]);
    const o = scorePairRun(before, after, touched);
    expect(o.beforeOnTouched).toBe(2);
    expect(o.resolved).toEqual([keyOf('FF-P01', 'src/m.ts')]);
    expect(o.detects).toBe(true);
    expect(o.strict).toBe(false);
    expect(scorePairRun(before, new Set(), touched).strict).toBe(true);
  });

  it('jaccard and output parsing', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3);
    expect(jaccard(new Set(), new Set())).toBeNull();
    expect(parseReviewOutput('{"violations":[{"file":"a","rule":"FF-S01","reason":"r"}]}')).toHaveLength(1);
    expect(parseReviewOutput('{"violations":[{"file":"a"}]}')).toBeNull();
    expect(parseReviewOutput('not json')).toBeNull();
  });

  it('rate card and budget projection', () => {
    expect(rateCardCredits({ input: 1_000_000, cached: 800_000, output: 10_000, reasoning: 0 })).toBeCloseTo(10 + 4 + 3);
    expect(projectedCost(new Map(), 'x', 6)).toBe(6);
    expect(projectedCost(new Map([['a', [2, 9]]]), 'x', 6)).toBe(9);
    expect(projectedCost(new Map([['x', [4]], ['a', [9]]]), 'x', 6)).toBe(6);
  });

  it('call order is run-major', () => {
    const order = callOrder({ runs: 2, trees: [{ treeId: 'a' }, { treeId: 'b' }] as never });
    expect(order).toEqual([{ treeId: 'a', run: 0 }, { treeId: 'b', run: 0 }, { treeId: 'a', run: 1 }, { treeId: 'b', run: 1 }]);
  });
});
