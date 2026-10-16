/**
 * The tier overrides of the construct switches, and the v1.3 tiered scoring with them. The sealed table is untouched:
 * at the status quo every tier is `ruleTier`'s, and an override applies only under its switch.
 */
import { STATUS_QUO_ANSWERS, withAnswers } from '../../../src/shared/construct-switches.js';
import { ruleTier, RULE_TIERS } from '../../../src/scoring-engine/rule-tiers.js';
import { computeTieredScoring } from '../../../src/scoring-engine/tiered-scoring.js';
import { constructRowTiers, constructRuleTier } from '../../../src/construct-switches/tiers.js';
import { constructTierResolver } from '../../../src/construct-switches/pipeline.js';
import type { FitnessFunction } from '../../../src/shared/types/spec.js';
import type { FunctionId } from '../../../src/shared/types/value-objects.js';
import { cycleRow, presetSpec, result } from './fixtures.js';

const STYLES = ['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd'];
const IDS = [...RULE_TIERS.keys(), 'FF-DS01', 'FF-DS02', 'FF-DT01', 'FF-DT03', 'FF-DT05', 'FF-S05', 'FF-DS03'];

describe('status quo', () => {
  it('every rule under every style has its sealed tier', () => {
    for (const s of STYLES) for (const id of IDS) expect(constructRuleTier(id, s, STATUS_QUO_ANSWERS)).toEqual(ruleTier(id, s));
    expect(constructTierResolver(STATUS_QUO_ANSWERS, 'ddd', { layers: [] })).toBeUndefined();
  });
});

const cases: readonly [string, string, string, string, 'blocking' | 'advisory'][] = [
  ['Q1', 'B', 'FF-P06', 'layered', 'advisory'],
  ['Q5', 'B', 'FF-S03', 'hexagonal', 'blocking'],
  ['Q5', 'B', 'FF-S03', 'ddd', 'blocking'],
  ['Q5', 'D', 'FF-S05', 'hexagonal', 'blocking'],
  ['Q5', 'D', 'FF-S05', 'ddd', 'blocking'],
  ['Q14', 'B', 'FF-DT03', 'ddd', 'advisory'],
  ['Q15', 'B', 'FF-DS01', 'ddd', 'advisory'],
  ['Q17', 'C', 'FF-DS03', 'ddd', 'advisory'],
  ['Q21', 'B', 'FF-DT05', 'ddd', 'blocking'],
];

describe.each(cases)('%s %s', (q, o, id, style, tier) => {
  it(`${id} is ${tier} in ${style}, and nothing else moves`, () => {
    const answers = withAnswers({ [q]: o });
    expect(constructRuleTier(id, style, answers).tier).toBe(tier);
    expect(constructRuleTier(id, style, answers).source).toBe('table');
    for (const s of STYLES) {
      for (const other of IDS) {
        if (other === id && s === style) continue;
        if (q === 'Q5' && other === id && (s === 'hexagonal' || s === 'ddd')) continue;
        // The DDD ids resolve under any style (`ruleTier`), so their override does too.
        if (other === id && id.startsWith('FF-D')) continue;
        if (q === 'Q5' && o === 'D' && other === 'FF-S05') continue;
        expect(constructRuleTier(other, s, answers).tier).toBe(ruleTier(other, s).tier);
      }
    }
  });
});

it('Q1 B keeps FF-P06 blocking (and partial) outside layered', () => {
  const t = constructRuleTier('FF-P06', 'clean-architecture', withAnswers({ Q1: 'B' }));
  expect(t.tier).toBe('blocking');
  expect(t.entry?.partial?.naRelType).toBe('FLOWS_TO');
  expect(constructRuleTier('FF-P06', 'layered', withAnswers({ Q1: 'B' })).entry?.partial).toBeDefined();
});

it('Q5 B leaves FF-S03 advisory in clean and blocking in layered', () => {
  expect(constructRuleTier('FF-S03', 'clean-architecture', withAnswers({ Q5: 'B' })).tier).toBe('advisory');
  expect(constructRuleTier('FF-S03', 'layered', withAnswers({ Q5: 'B' })).tier).toBe('blocking');
});

describe('Q3 C row tiers', () => {
  it('an in-component cycle is advisory, a crossing one keeps the rule tier; off under A and B', async () => {
    const spec = await presetSpec('clean-architecture');
    const r = constructRowTiers('clean-architecture', spec.layerModel, withAnswers({ Q3: 'C' }));
    expect(r?.tierOf('FF-S02', { filePath: 'src/domain/entities/Loan.ts,src/domain/entities/Member.ts,src/domain/entities/Loan.ts', target: 'src/domain/entities/Member.ts' })).toBe('advisory');
    expect(r?.tierOf('FF-S02', { filePath: 'src/domain/a.ts,src/application/b.ts,src/domain/a.ts' })).toBeUndefined();
    expect(r?.tierOf('FF-S01', { filePath: 'src/domain/a.ts' })).toBeUndefined();
    expect(constructRowTiers('clean-architecture', spec.layerModel, STATUS_QUO_ANSWERS)).toBeUndefined();
    expect(constructRowTiers('clean-architecture', spec.layerModel, withAnswers({ Q3: 'B' }))).toBeUndefined();
  });

  it('the tiered scoring reports the in-component part as an advisory row and leaves the verdict to the crossing cycle', async () => {
    const spec = await presetSpec('clean-architecture');
    const fns: FitnessFunction[] = [{ id: 'FF-S02' as FunctionId, name: 'no-cyclic-deps', dimension: 'structural', severity: 'critical', route: 'symbolic', isBuiltIn: true, validated: true, enabled: true, excludePaths: [] }];
    const inLayer = cycleRow('FF-S02', ['src/domain/entities/Loan.ts', 'src/domain/entities/Member.ts', 'src/domain/entities/Loan.ts']);
    const score = (answers: ReturnType<typeof withAnswers>, rows = [inLayer]): ReturnType<typeof computeTieredScoring> => {
      const resolver = constructTierResolver(answers, 'clean-architecture', spec.layerModel);
      return computeTieredScoring({
        evaluationResults: { symbolicResults: [result('FF-S02', rows)], neuronalResults: [] },
        fitnessFunctions: fns, style: 'clean-architecture', scoringWeights: spec.scoringWeights, v12eVerdict: 'pass',
        ...(resolver !== undefined ? { tierResolver: resolver } : {}),
      });
    };
    const before = score(STATUS_QUO_ANSWERS);
    expect(before.verdict).toBe('fail');
    const after = score(withAnswers({ Q3: 'C' }));
    expect(after.verdict).toBe('pass');
    expect(after.blocking.rules.map((r) => [r.functionId, r.violationCount, r.violated])).toEqual([['FF-S02', 0, false]]);
    expect(after.advisory.rules.map((r) => [r.functionId, r.violationCount, r.tier])).toEqual([['FF-S02', 1, 'advisory']]);
    const crossing = cycleRow('FF-S02', ['src/application/a.ts', 'src/domain/b.ts', 'src/application/a.ts']);
    expect(score(withAnswers({ Q3: 'C' }), [inLayer, crossing]).verdict).toBe('fail');
  });

  it('a tier override reaches the verdict: Q21 B makes an FF-DT05 row fail it', async () => {
    const spec = await presetSpec('ddd');
    const fns: FitnessFunction[] = [{ id: 'FF-DT05' as FunctionId, name: 'domain-event-placement', dimension: 'pattern', severity: 'major', route: 'symbolic', isBuiltIn: false, validated: false, enabled: true, excludePaths: [] }];
    const rows = [cycleRow('FF-DT05', ['src/billing/application/InvoiceIssued.ts'])];
    const run = (answers: ReturnType<typeof withAnswers>): string => {
      const resolver = constructTierResolver(answers, 'ddd', spec.layerModel);
      return computeTieredScoring({
        evaluationResults: { symbolicResults: [result('FF-DT05', rows)], neuronalResults: [] },
        fitnessFunctions: fns, style: 'ddd', scoringWeights: spec.scoringWeights, v12eVerdict: 'pass',
        ...(resolver !== undefined ? { tierResolver: resolver } : {}),
      }).verdict;
    };
    expect(run(STATUS_QUO_ANSWERS)).toBe('pass');
    expect(run(withAnswers({ Q21: 'B' }))).toBe('fail');
  });
});
