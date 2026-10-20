/**
 * Construct-switch interactions (Docs/v1.3/post-merge-review-2026-10-16.md), each on a hand-built fixture:
 * - R08: Q22 B's rebuild of FF-P02 must keep the FF-P02 rows Q9 B adds (and the change log must not say "dropped");
 * - R10: under Q5 B (FF-S03 blocking in hexagonal) the Q24 B inward-bypass rows stay advisory, as Q24 B states;
 * - U6 plan Step 7: the chosen set (Docs/v1.3/construct-answers.json, signed 2026-10-19: Q5 C, Q6 B, Q12 B with the other
 *   21 answers; Q10 D since 2026-10-20, the G0.9 Q10 criterion applied as written) moves each row as its switch alone
 *   does, and no switch undoes another.
 * Only rows and tiers are checked; no development-set effect is computed.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { withAnswers } from '../../../src/shared/construct-switches.js';
import { constructTierResolver } from '../../../src/construct-switches/pipeline.js';
import { constructRuleTier } from '../../../src/construct-switches/tiers.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseAnswersDocument } from '../../../scripts/v1.3/lib/construct-answers.js';
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

describe('U6 Step 7: the chosen answers together (Q5 C, Q6 B, Q10 D, Q12 B and the rest of the answers file)', () => {
  const CHOSEN = parseAnswersDocument(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../Docs/v1.3/construct-answers.json'), 'utf8')) as unknown).answers;

  it('the answers file holds the four U6 switches and the class (c) answers they are read with', () => {
    expect([CHOSEN.Q5, CHOSEN.Q6, CHOSEN.Q10, CHOSEN.Q12]).toEqual(['C', 'B', 'D', 'B']);
    expect([CHOSEN.Q4, CHOSEN.Q7, CHOSEN.Q8, CHOSEN.Q11, CHOSEN.Q13, CHOSEN.Q20]).toEqual(['A', 'A', 'B', 'A', 'B', 'A']);
  });

  // Hexagonal fixture: an inbound -> outbound adapter skip (Q5), an application -> adapter edge and a domain ->
  // application port edge (Q6).
  const hexFiles = {
    'src/adapters/inbound/http/RoomController.ts': 'adapters-inbound', 'src/adapters/outbound/persistence/Repo.ts': 'adapters-outbound',
    'src/application/services/Find.ts': 'application', 'src/application/ports/out/Sender.ts': 'application', 'src/domain/model/Booking.ts': 'domain',
  };
  const hex = graph({ files: hexFiles, edges: [
    { from: 'src/adapters/inbound/http/RoomController.ts', to: 'src/adapters/outbound/persistence/Repo.ts' },
    { from: 'src/application/services/Find.ts', to: 'src/adapters/outbound/persistence/Repo.ts' },
    { from: 'src/domain/model/Booking.ts', to: 'src/application/ports/out/Sender.ts' },
  ] });
  const hexResults = (): ReturnType<typeof result>[] => [
    result('FF-S01', [
      row('FF-S01', 'src/application/services/Find.ts', { target: 'src/adapters/outbound/persistence/Repo.ts' }),
      row('FF-S01', 'src/domain/model/Booking.ts', { target: 'src/application/ports/out/Sender.ts' }),
    ]),
    result('FF-S03', [row('FF-S03', 'src/adapters/inbound/http/RoomController.ts', { target: 'src/adapters/outbound/persistence/Repo.ts', type: 'LAYER_SKIP' })]),
    result('FF-S04', [row('FF-S04', 'src/domain/model/Booking.ts', { target: 'src/application/ports/out/Sender.ts' })]),
  ];

  it('hexagonal: the adapter pair moves to FF-S01 (blocking); application -> adapter is added to FF-S04 and domain -> application dropped', async () => {
    // Expected rows, written before the run.
    const expectedS01 = [
      'src/adapters/inbound/http/RoomController.ts -> src/adapters/outbound/persistence/Repo.ts',
      'src/application/services/Find.ts -> src/adapters/outbound/persistence/Repo.ts',
      'src/domain/model/Booking.ts -> src/application/ports/out/Sender.ts',
    ];
    const expectedS04 = ['src/application/services/Find.ts -> src/adapters/outbound/persistence/Repo.ts'];
    const out = await stage('hexagonal', CHOSEN, hexResults(), hex);
    expect(rowsOf(out, 'FF-S01').sort()).toEqual(expectedS01);
    expect(rowsOf(out, 'FF-S03')).toEqual([]);
    expect(rowsOf(out, 'FF-S04')).toEqual(expectedS04);
    expect(constructRuleTier('FF-S01', 'hexagonal', CHOSEN).tier).toBe('blocking');
    expect(constructRuleTier('FF-S04', 'hexagonal', CHOSEN).tier).toBe('blocking');
    // No switch undoes another: each switch alone gives the same rows of its own rule.
    const q5 = await stage('hexagonal', withAnswers({ Q5: 'C' }), hexResults(), hex);
    const q6 = await stage('hexagonal', withAnswers({ Q6: 'B' }), hexResults(), hex);
    expect(rowsOf(q5, 'FF-S01').sort()).toEqual(expectedS01);
    expect(rowsOf(q6, 'FF-S04')).toEqual(expectedS04);
  });

  // Layered fixture: a business service importing express (Q10), an adjacent upward import and a downward skip (Q12).
  const layered = graph({
    files: { 'src/business/services/OrderService.ts': 'business', 'src/persistence/ProductGateway.ts': 'persistence', 'src/business/model/Money.ts': 'business', 'src/presentation/v.ts': 'presentation' },
    edges: [{ from: 'src/persistence/ProductGateway.ts', to: 'src/business/model/Money.ts' }, { from: 'src/presentation/v.ts', to: 'src/persistence/ProductGateway.ts' }],
    packages: [{ from: 'src/business/services/OrderService.ts', pkg: 'express' }],
  });
  const layeredResults = (): ReturnType<typeof result>[] => [
    result('FF-S01', [row('FF-S01', 'src/persistence/ProductGateway.ts', { target: 'src/business/model/Money.ts' })]),
    result('FF-S03', [
      row('FF-S03', 'src/persistence/ProductGateway.ts', { target: 'src/business/model/Money.ts' }),
      row('FF-S03', 'src/presentation/v.ts', { target: 'src/persistence/ProductGateway.ts' }),
    ]),
  ];

  it('layered (Q10 D): no express row and FF-P01 is not compiled; the adjacent upward FF-S03 row is dropped, the skip kept', async () => {
    // Q10 D (2026-10-20): FF-P01 not applicable and no package-to-layer replacement, so express gives no row.
    const expectedS01 = ['src/persistence/ProductGateway.ts -> src/business/model/Money.ts'];
    const expectedS01UnderC = ['src/business/services/OrderService.ts -> express', ...expectedS01];
    const expectedS03 = ['src/presentation/v.ts -> src/persistence/ProductGateway.ts'];
    const out = await stage('layered', CHOSEN, layeredResults(), layered);
    expect(rowsOf(out, 'FF-S01').sort()).toEqual(expectedS01);
    expect(rowsOf(out, 'FF-S03')).toEqual(expectedS03);
    const { constructSwitches: _d, ...v13 } = V13_COMPILE_OPTIONS;
    const c = compileFunctions(compilerInputFromSpec(await presetSpec('layered')), { ...v13, constructSwitches: CHOSEN });
    if (!c.success) throw new Error('compile');
    expect(c.data.symbolicQueries.map((q) => String(q.functionId))).not.toContain('FF-P01');
    expect(c.data.disabledFunctions.map((d) => String(d.id))).toContain('FF-P01');
    // Each switch alone gives the same rows of its rule.
    expect(rowsOf(await stage('layered', withAnswers({ Q10: 'D' }), layeredResults(), layered), 'FF-S01').sort()).toEqual(expectedS01);
    // The Q10 C mechanism is unchanged; only the chosen answer moved.
    expect(rowsOf(await stage('layered', withAnswers({ Q10: 'C' }), layeredResults(), layered), 'FF-S01').sort()).toEqual(expectedS01UnderC);
    expect(rowsOf(await stage('layered', withAnswers({ Q12: 'B' }), layeredResults(), layered), 'FF-S03')).toEqual(expectedS03);
  });
});
