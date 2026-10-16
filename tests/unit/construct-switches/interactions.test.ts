/**
 * Construct-switch interactions (Docs/v1.3/post-merge-review-2026-10-16.md), each on a hand-built fixture:
 * - R08: Q22 B's rebuild of FF-P02 must keep the FF-P02 rows Q9 B adds (and the change log must not say "dropped");
 * - R10: under Q5 B (FF-S03 blocking in hexagonal) the Q24 B inward-bypass rows stay advisory, as Q24 B states.
 * Only rows and tiers are checked; no development-set effect is computed.
 */
import { withAnswers } from '../../../src/shared/construct-switches.js';
import { constructTierResolver } from '../../../src/construct-switches/pipeline.js';
import { graph, presetSpec, result, row, rowsOf, stage } from './fixtures.js';

describe('R08: Q9 B together with Q22 B', () => {
  const g = graph({
    files: { 'src/infrastructure/persistence/InMemoryLoanRepository.ts': 'infrastructure', 'src/domain/repositories/LoanRepository.ts': 'domain', 'src/application/uc.ts': 'application' },
    edges: [{ from: 'src/application/uc.ts', to: 'src/infrastructure/persistence/InMemoryLoanRepository.ts' }],
    classes: [
      { id: 'InMemoryLoanRepository', file: 'src/infrastructure/persistence/InMemoryLoanRepository.ts', methods: ['save'] },
      { id: 'LoanRepository', kind: 'Interface', file: 'src/domain/repositories/LoanRepository.ts', methods: ['save'] },
    ],
  });
  const p03 = (): ReturnType<typeof result> => result('FF-P03', [row('FF-P03', 'src/infrastructure/persistence/InMemoryLoanRepository.ts', { discriminator: ['InMemoryLoanRepository'] })]);

  it('the Q9 B row on the implementer survives the Q22 B rebuild, with a consistent change log', async () => {
    const q9 = await stage('clean-architecture', withAnswers({ Q9: 'B' }), [p03(), result('FF-P02')], g);
    const both = await stage('clean-architecture', withAnswers({ Q9: 'B', Q22: 'B' }), [p03(), result('FF-P02')], g);
    expect(rowsOf(both, 'FF-P02')).toEqual(rowsOf(q9, 'FF-P02'));
    expect(rowsOf(both, 'FF-P02')).toEqual(['src/infrastructure/persistence/InMemoryLoanRepository.ts -> ']);
    expect(both.changes.filter((c) => c.functionId === 'FF-P02')).toEqual([
      { q: 'Q9', functionId: 'FF-P02', action: 'added', file: 'src/infrastructure/persistence/InMemoryLoanRepository.ts' },
    ]);
  });
});

describe('R10: Q5 B together with Q24 B in hexagonal', () => {
  const bypass = row('FF-S03', 'src/adapters/inbound/http/RoomController.ts', { target: 'src/domain/Room.ts', discriminator: ['bypass', 'IMPORTS'] });
  const skip = row('FF-S03', 'src/adapters/inbound/http/RoomController.ts', { target: 'src/adapters/outbound/Repo.ts', discriminator: ['IMPORTS'] });

  it('Q5 B makes FF-S03 blocking, but the Q24 B bypass rows keep the advisory tier Q24 B states', async () => {
    const spec = await presetSpec('hexagonal');
    const both = constructTierResolver(withAnswers({ Q5: 'B', Q24: 'B' }), 'hexagonal', spec.layerModel);
    expect(both?.rule('FF-S03', 'hexagonal').tier).toBe('blocking');
    expect(both?.row?.tierOf('FF-S03', bypass)).toBe('advisory');
    expect(both?.row?.tierOf('FF-S03', skip)).toBeUndefined();
  });

  it('without Q24 B no row tier is added; Q24 B alone splits nothing (FF-S03 is advisory in hexagonal anyway)', async () => {
    const spec = await presetSpec('hexagonal');
    expect(constructTierResolver(withAnswers({ Q5: 'B' }), 'hexagonal', spec.layerModel)?.row).toBeUndefined();
    const q24 = constructTierResolver(withAnswers({ Q24: 'B' }), 'hexagonal', spec.layerModel);
    expect(q24?.rule('FF-S03', 'hexagonal').tier).toBe('advisory');
    expect(q24?.row?.tierOf('FF-S03', bypass) ?? 'advisory').toBe('advisory');
  });
});
