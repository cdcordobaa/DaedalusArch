/**
 * The loop evaluator's blocking findings are the rows the v1.3 scoring counts (review fix F17): FF-P06's N/A rows
 * (FLOWS_TO, HOLDS_STATE_OF) and rows a row-tier switch moves to advisory never reach the gate's repair prompt or the
 * pilot outcomes, and the list always has `blockingViolationCount` entries. The live evaluator records and checks the
 * graph engine (F7), and on cypher-interp it evaluates a work tree with the run's pinned tsconfig (F24). No Neo4j.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { engineProblems } from '../../../../scripts/v1.3/lib/study2-io.js';
import type { LoadedRun } from '../../../../scripts/v1.3/lib/study2-analysis.js';
import { buildContext } from '../../../../src/mcp-server/context.js';
import { CLEAN_ARCH_SPEC } from '../../mcp-server/helpers.js';
import { firewallEvaluator, toStepEvaluation } from '../../../../scripts/lib/loop/evaluator.js';
import { repairPrompt } from '../../../../scripts/lib/loop/prompts.js';
import { computeTieredScoring, countedTierOf } from '../../../../src/scoring-engine/tiered-scoring.js';
import type { TierResolver } from '../../../../src/scoring-engine/tiered-scoring.js';
import { ruleTier } from '../../../../src/scoring-engine/rule-tiers.js';
import { functionId } from '../../../../src/shared/types/value-objects.js';
import type { SymbolicFunctionResult } from '../../../../src/shared/types/evaluation.js';
import type { Violation } from '../../../../src/shared/taxonomy/violation-types.js';
import type { Dimension } from '../../../../src/shared/types/enums.js';
import type { EvaluateProjectResult } from '../../../../src/mcp-server/types.js';
import { LAYERED_TEMPLATE } from '../../../../src/spec-parser/template-registry.js';

const WEIGHTS = { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 };

const p06 = (n: number, relType: 'CONSTRUCTOR_INJECTS' | 'HOLDS_STATE_OF' | 'FLOWS_TO'): Violation => ({
  id: `p06-${String(n)}`,
  type: 'DOMAIN_STATE_PURITY_VIOLATION',
  dimension: 'pattern',
  severity: 'critical',
  functionId: functionId('FF-P06'),
  route: 'symbolic',
  filePath: `src/domain/order${String(n)}.ts`,
  message: `Domain class Order${String(n)} holds infrastructure Db via ${relType} (db)`,
  deterministic: true,
  discriminator: [`Order${String(n)}`, 'Db', relType, 'db'],
});

const cycle = (id: string, filePath: string): Violation => ({
  id,
  type: 'CYCLIC_DEPENDENCY',
  dimension: 'structural',
  severity: 'critical',
  functionId: functionId('FF-S02'),
  route: 'symbolic',
  filePath,
  message: `cycle ${filePath}`,
  deterministic: true,
});

const sym = (id: string, dimension: Dimension, violations: Violation[]): SymbolicFunctionResult => ({
  functionId: functionId(id), dimension, passed: violations.length === 0, violations, executionTimeMs: 1, deterministic: true,
});

/** A row-tier switch in the shape of Q3 C: a cycle inside `src/domain/` only is advisory. */
const ROW_SWITCH: TierResolver = {
  rule: ruleTier,
  row: {
    tierOf: (ruleId, row) => (ruleId === 'FF-S02' && row.filePath.split(',').every((f) => f.startsWith('src/domain/')) ? 'advisory' : undefined),
    label: () => 'in-component cycles',
  },
};

const ROWS = {
  injects: p06(1, 'CONSTRUCTOR_INJECTS'),
  holds: p06(2, 'HOLDS_STATE_OF'),
  flows: p06(3, 'FLOWS_TO'),
  inComponent: cycle('s02-in', 'src/domain/a.ts,src/domain/b.ts,src/domain/a.ts'),
  crossing: cycle('s02-cross', 'src/domain/a.ts,src/infrastructure/x.ts,src/domain/a.ts'),
};

/** An `evaluate_project` result whose tiers come from the real v1.3 scoring of the same rows. */
function evaluated(resolver: TierResolver | undefined): EvaluateProjectResult {
  const violations = Object.values(ROWS);
  const tiers = computeTieredScoring({
    evaluationResults: {
      symbolicResults: [
        sym('FF-P06', 'pattern', [ROWS.injects, ROWS.holds, ROWS.flows]),
        sym('FF-S02', 'structural', [ROWS.inComponent, ROWS.crossing]),
      ],
      neuronalResults: [],
    },
    fitnessFunctions: LAYERED_TEMPLATE.functions,
    style: 'clean-architecture',
    scoringWeights: WEIGHTS,
    v12eVerdict: 'warning',
    ...(resolver !== undefined ? { tierResolver: resolver } : {}),
  });
  return {
    projectPath: '/p',
    specPath: '/s.yaml',
    evaluationMode: 'symbolic-only',
    ahs: 0.7,
    verdict: 'hard-block',
    violationCount: violations.length,
    byRule: [
      { ruleId: 'FF-P06', ruleName: 'domain-state-purity', count: 3, truncated: false, violations: [] },
      { ruleId: 'FF-S02', ruleName: 'no-cycles', count: 2, truncated: false, violations: [] },
    ],
    durationMs: 5,
    scoringMode: 'v1.3',
    tiers,
    violations,
  };
}

describe('toStepEvaluation: blocking findings are the counted rows (F17)', () => {
  it('leaves out FF-P06 HOLDS_STATE_OF and FLOWS_TO rows and keeps CONSTRUCTOR_INJECTS', () => {
    const r = evaluated(undefined);
    expect(r.tiers?.blocking.violationCount).toBe(3);
    const ev = toStepEvaluation(r);
    if (!ev.success) throw new Error(ev.errors.map((e) => e.code).join());
    expect(ev.data.blockingViolationCount).toBe(3);
    expect(ev.data.blockingFindings.map((f) => f.violationId)).toEqual(['p06-1', 's02-in', 's02-cross']);
    expect(ev.data.blockingFindings).toHaveLength(ev.data.blockingViolationCount);
    expect(ev.data.blockingByRule).toEqual({ 'FF-P06': 1, 'FF-S02': 2 });
    expect(ev.data.graphEngine).toBe('neo4j');
  });

  it('leaves out a row-tier FF-S02 row the switch moves to advisory', () => {
    const r = evaluated(ROW_SWITCH);
    expect(r.tiers?.blocking.violationCount).toBe(2);
    const ev = toStepEvaluation(r, ROW_SWITCH);
    if (!ev.success) throw new Error(ev.errors.map((e) => e.code).join());
    expect(ev.data.blockingFindings.map((f) => f.violationId)).toEqual(['p06-1', 's02-cross']);
    expect(ev.data.blockingFindings).toHaveLength(ev.data.blockingViolationCount);
    expect(ev.data.advisoryByRule?.['FF-S02']).toBe(1);
  });

  it('fails with LOOP_EVAL_FINDINGS_MISMATCH when the rows and the tier count disagree', () => {
    // Tiers scored with the row switch, rows placed without it: one row more than the scoring counts.
    const ev = toStepEvaluation(evaluated(ROW_SWITCH));
    expect(ev.success ? [] : ev.errors.map((e) => e.code)).toEqual(['LOOP_EVAL_FINDINGS_MISMATCH']);
  });

  it('fails without the report violations instead of listing capped, uncounted rows', () => {
    const { violations: _drop, ...capped } = evaluated(undefined);
    const ev = toStepEvaluation(capped);
    expect(ev.success ? [] : ev.errors.map((e) => e.code)).toEqual(['LOOP_EVAL_NO_VIOLATIONS']);
  });

  it('records the engine that answered', () => {
    const ev = toStepEvaluation({ ...evaluated(undefined), engine: 'cypher-interp' });
    expect(ev.success && ev.data.graphEngine).toBe('cypher-interp');
  });

  it('countedTierOf places each row as computeTieredScoring counts it', () => {
    expect(countedTierOf(ROWS.injects, 'clean-architecture')).toBe('blocking');
    expect(countedTierOf(ROWS.holds, 'clean-architecture')).toBe('not-applicable');
    expect(countedTierOf(ROWS.flows, 'clean-architecture')).toBe('not-applicable');
    expect(countedTierOf(ROWS.inComponent, 'clean-architecture')).toBe('blocking');
    expect(countedTierOf(ROWS.inComponent, 'clean-architecture', ROW_SWITCH)).toBe('advisory');
    expect(countedTierOf(ROWS.crossing, 'clean-architecture', ROW_SWITCH)).toBe('blocking');
  });
});

describe('repairPrompt', () => {
  it('never announces a negative "more" when the list is longer than the count', () => {
    const f = { ruleId: 'FF-S01', ruleName: 'layers', filePath: 'src/domain/a.ts', message: 'm' };
    const text = repairPrompt([f, { ...f, filePath: 'src/domain/b.ts' }, { ...f, filePath: 'src/domain/c.ts' }], 1, 'tsc');
    expect(text).not.toMatch(/and -?\d+ more/);
  });
});

describe('firewallEvaluator on cypher-interp (F7, F24)', () => {
  it('evaluates a work tree without its own tsconfig through the pinned one, and records the engine', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-interp-'));
    try {
      const work = path.join(tmp, 'work');
      const files: Record<string, string> = {
        'src/domain/item.ts': "import { ItemStore } from '../infrastructure/item-store';\n\nexport interface Item {\n  readonly id: string;\n}\n\nexport function saveItem(item: Item): void {\n  new ItemStore().put(item.id);\n}\n",
        'src/application/item-service.ts': "import type { Item } from '../domain/item';\n\nexport class ItemService {\n  list(): readonly Item[] {\n    return [];\n  }\n}\n",
        'src/infrastructure/item-store.ts': 'export class ItemStore {\n  put(_id: string): void {}\n}\n',
      };
      for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(work, rel)), { recursive: true });
        fs.writeFileSync(path.join(work, rel), text);
      }
      const tsconfig = path.join(tmp, 'harness', 'tsconfig.json');
      fs.mkdirSync(path.dirname(tsconfig), { recursive: true });
      fs.writeFileSync(tsconfig, JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'commonjs', noEmit: true }, include: [`${work}/src/**/*.ts`] }));
      const env = { APG_STORE_PATH: path.join(tmp, 'apg') };
      const deps = buildContext({ engine: 'cypher-interp' }, env).evaluateDeps;
      const without = await firewallEvaluator(CLEAN_ARCH_SPEC, env, deps).evaluate(work, 'run');
      expect(without.success).toBe(false);
      const ev = await firewallEvaluator(CLEAN_ARCH_SPEC, env, deps, () => tsconfig).evaluate(work, 'run');
      if (!ev.success) throw new Error(ev.errors.map((e) => `${e.code}: ${e.message}`).join());
      expect(ev.data.graphEngine).toBe('cypher-interp');
      expect(ev.data.blockingViolationCount).toBeGreaterThan(0);
      expect(ev.data.blockingFindings).toHaveLength(ev.data.blockingViolationCount);
      expect(ev.data.blockingFindings.some((f) => f.filePath.endsWith('domain/item.ts'))).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 120_000);
});

describe('Study 2 engine assertion (F7)', () => {
  const run = (engines: (string | undefined | null)[]): LoadedRun => ({
    run: { schema: 'loop-run/v1', runId: 'a/m/t/none/run-0', spec: { adapterId: 'claude-code-cli', modelId: 'm', taskId: 't', arm: 'none', runIndex: 0 }, steps: engines.length, baseCommit: 'c', createdAt: 'x', dryRun: false },
    steps: engines.map((e, i) => ({
      turns: [{ snapshot: { evaluation: e === null ? null : { ...(e !== undefined ? { graphEngine: e } : {}) } } }],
      stepIndex: i,
    })),
  }) as unknown as LoadedRun;

  it('accepts runs evaluated on the expected engine (unevaluated snapshots aside) and names every other run', () => {
    expect(engineProblems([run(['neo4j', null, 'neo4j'])], 'neo4j')).toEqual([]);
    expect(engineProblems([run(['neo4j', 'cypher-interp'])], 'neo4j')).toEqual(['a/m/t/none/run-0: graph engine cypher-interp (expected neo4j)']);
    expect(engineProblems([run([undefined])], 'cypher-interp')).toEqual(['a/m/t/none/run-0: graph engine not recorded (expected cypher-interp)']);
  });
});
