/**
 * MCP v2 consistency check (scripts/v1.3/lib/mcp-consistency.ts): the full-evaluation reference (v1.3 tiers, FF-P06's
 * FLOWS_TO rows N/A, minus the clean variant), the comparison, the limits table, and the check itself over every
 * reference variant: with a project root the blocking answer and the blocking rules agree on every variant; spec-only,
 * every disagreement is a documented limit.
 */
import * as path from 'node:path';
import {
  blockingDelta,
  compareVariant,
  CONSISTENCY_MODES,
  countsAsBlocking,
  DOCUMENTED_LIMITS,
  percentile,
  projectDiff,
  readFullFindings,
  summarise,
} from '../../../../scripts/v1.3/lib/mcp-consistency.js';
import type { ConsistencyMode, FullFinding, VariantComparison } from '../../../../scripts/v1.3/lib/mcp-consistency.js';
import { loadAllReferences } from '../../../../scripts/v1.3/lib/reference-model.js';
import { makeTempRoot, materialiseVariant } from '../../../../scripts/v1.3/lib/materialise.js';
import { checkDiff } from '../../../../src/mcp-server/diff-check.js';
import { parseSpec } from '../../../../src/spec-parser/spec-parser.js';
import type { DiffCheckResult } from '../../../../src/mcp-server/types.js';

const REPO = path.resolve(__dirname, '../../../..');

describe('full-evaluation reference', () => {
  it('counts blocking-tier rows only, and FF-P06 FLOWS_TO rows as N/A', () => {
    expect(countsAsBlocking({ ruleId: 'FF-S01', file: 'a' }, 'clean-architecture')).toBe(true);
    expect(countsAsBlocking({ ruleId: 'FF-S03', file: 'a' }, 'clean-architecture')).toBe(false);
    expect(countsAsBlocking({ ruleId: 'FF-S03', file: 'a' }, 'layered')).toBe(true);
    expect(countsAsBlocking({ ruleId: 'FF-P06', file: 'a', relType: 'FLOWS_TO' }, 'clean-architecture')).toBe(false);
    expect(countsAsBlocking({ ruleId: 'FF-P06', file: 'a', relType: 'CONSTRUCTOR_INJECTS' }, 'clean-architecture')).toBe(true);
    expect(countsAsBlocking({ ruleId: 'FF-C03', file: 'a' }, 'layered')).toBe(false);
  });

  it('takes the variant\'s blocking rows the clean variant does not have', () => {
    const cleanRows: FullFinding[] = [{ ruleId: 'FF-S01', file: 'a', target: 'b' }];
    const variant: FullFinding[] = [...cleanRows, { ruleId: 'FF-S01', file: 'c', target: 'd' }, { ruleId: 'FF-C01', file: 'c' }];
    expect(blockingDelta(variant, cleanRows, 'layered')).toEqual([{ ruleId: 'FF-S01', file: 'c', target: 'd' }]);
  });

  it('reads the evidence rows (with relType) and checks them against the raw rows', () => {
    const r = readFullFindings(REPO, 'clean-architecture', 'v08-domain-service-holds-infrastructure-clock');
    expect(r.problems).toEqual([]);
    expect(r.findings.find((f) => f.ruleId === 'FF-P06')).toMatchObject({ relType: 'FLOWS_TO' });
  });
});

describe('comparison', () => {
  const result = (rules: readonly [string, 'blocking' | 'advisory'][]): DiffCheckResult => ({
    verdict: 'clean',
    summary: '',
    skipped: [],
    blockingVerdict: rules.some(([, t]) => t === 'blocking') ? 'block' : 'pass',
    blockingCount: 0,
    advisoryCount: 0,
    blockingSummary: '',
    files: [{ path: 'src/a.ts', findings: rules.map(([ruleId, tier]) => ({ ruleId, tier, line: 1 })), hints: [], basis: 'delta' }] as unknown as DiffCheckResult['files'],
  });
  const meta = (mode: ConsistencyMode): { style: string; variant: string; kind: string; plants: string | null; mode: ConsistencyMode } => ({ style: 'layered', variant: 'v', kind: 'violation', plants: 'FF-S02', mode });

  it('agrees on answer, rules and location', () => {
    const c = compareVariant(meta('after-write'), [{ ruleId: 'FF-S02', file: 'src/b.ts,src/a.ts,src/b.ts' }], result([['FF-S02', 'blocking']]), 3);
    expect(c).toMatchObject({ answerAgrees: true, rulesAgree: true, locationsAgree: true, unexplained: [] });
  });

  it('explains a spec-only cycle miss by limit L1 and reports anything else as unexplained', () => {
    const c = compareVariant(meta('spec-only'), [{ ruleId: 'FF-S02', file: 'src/a.ts' }], result([]), 3);
    expect(c).toMatchObject({ answerAgrees: false, fullOnlyRules: ['FF-S02'], explainedBy: ['L1-cycles-need-the-graph'], unexplained: [] });
    const d = compareVariant(meta('after-write'), [{ ruleId: 'FF-S02', file: 'src/a.ts' }], result([['FF-S01', 'blocking']]), 3);
    expect(d.unexplained).toEqual(['full-only FF-S02', 'tool-only FF-S01']);
    const e = compareVariant(meta('after-write'), [], result([['FF-S03', 'advisory']]), 3);
    expect(e).toMatchObject({ answerAgrees: true, rulesAgree: true });
  });

  it('limits are scoped to the spec-only mode', () => {
    for (const l of DOCUMENTED_LIMITS) expect(l.modes).toEqual(['spec-only']);
  });

  it('percentile is nearest-rank', () => {
    expect(percentile([5, 1, 4, 2, 3], 50)).toBe(3);
    expect(percentile([5, 1, 4, 2, 3], 95)).toBe(5);
    expect(percentile([], 50)).toBeNaN();
  });
});

describe('check_diff vs the full evaluation on every reference variant', () => {
  const rows: VariantComparison[] = [];

  beforeAll(async () => {
    const tmp = makeTempRoot('mcp-consistency-test-');
    for (const ref of loadAllReferences(REPO)) {
      const parsed = await parseSpec({ specFilePath: ref.specPath });
      if (!parsed.success) throw new Error(`${ref.style}: spec does not parse`);
      const cleanV = ref.variants.find((v) => v.manifest.variant === 'clean');
      if (cleanV === undefined) throw new Error('no clean variant');
      const clean = materialiseVariant(ref, cleanV, path.join(tmp, 'clean'));
      const cleanFull = readFullFindings(REPO, ref.style, 'clean').findings;
      for (const v of ref.variants.filter((x) => x.manifest.variant !== 'clean')) {
        const m = materialiseVariant(ref, v, path.join(tmp, 'v'));
        const diff = projectDiff(clean.projectDir, m.projectDir);
        const full = blockingDelta(readFullFindings(REPO, ref.style, v.manifest.variant).findings, cleanFull, ref.style);
        const roots: Record<ConsistencyMode, string | undefined> = { 'after-write': m.projectDir, 'before-write': clean.projectDir, 'spec-only': undefined };
        for (const mode of CONSISTENCY_MODES) {
          const res = checkDiff(parsed.data, diff, { projectRoot: roots[mode] });
          rows.push(compareVariant({ style: ref.style, variant: v.manifest.variant, kind: v.manifest.kind, plants: v.manifest.plants, mode }, full, res, 0));
        }
      }
    }
  }, 300_000);

  it('covers the 66 non-clean variants of the five styles in each mode', () => {
    expect(rows).toHaveLength(66 * 3);
    expect(new Set(rows.map((r) => r.style)).size).toBe(5);
  });

  it.each(['after-write', 'before-write'] as const)('%s: blocking answer and blocking rules agree on every variant; near-misses stay silent', (mode) => {
    const mine = rows.filter((r) => r.mode === mode);
    expect(mine.filter((r) => !r.answerAgrees || !r.rulesAgree).map((r) => `${r.style}/${r.variant}`)).toEqual([]);
    expect(mine.filter((r) => r.kind === 'near-miss' && r.tool.blocks)).toEqual([]);
    expect(mine.filter((r) => !r.locationsAgree).map((r) => `${r.style}/${r.variant}`)).toEqual([]);
  });

  it('spec-only: every disagreement is a documented limit', () => {
    const mine = rows.filter((r) => r.mode === 'spec-only');
    expect(mine.flatMap((r) => r.unexplained)).toEqual([]);
    const { byStyle } = summarise(mine);
    expect(byStyle.every((s) => s.unexplained === 0)).toBe(true);
  });
});
