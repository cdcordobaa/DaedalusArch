/**
 * The row stage of the construct switches, one minimal fixture per question and option (no Neo4j): each test shows
 * the option changes exactly the rows it names and leaves the rest, and that option A leaves every row as it is.
 */
import { STATUS_QUO_ANSWERS, withAnswers } from '../../../src/shared/construct-switches.js';
import { applyConstructRows } from '../../../src/construct-switches/rows.js';
import { EMPTY_CONSTRUCT_GRAPH } from '../../../src/construct-switches/graph.js';
import { cycleRow, graph, presetSpec, result, row, rowsOf, stage } from './fixtures.js';

describe('status quo', () => {
  it('returns the very same results array when every question is at A', async () => {
    const results = [result('FF-S01', [row('FF-S01', 'src/a.ts', { target: 'src/b.ts', isTypeOnly: true })])];
    const spec = await presetSpec('clean-architecture');
    const out = applyConstructRows(results, { answers: STATUS_QUO_ANSWERS, style: 'clean-architecture', layerModel: spec.layerModel, functions: spec.fitnessFunctions, graph: EMPTY_CONSTRUCT_GRAPH });
    expect(out.results).toBe(results);
    expect(out.changes).toEqual([]);
  });

  it('Q14 C (member facts, already merged) is the status quo too', async () => {
    const results = [result('FF-DT03', [row('FF-DT03', 'src/ordering/domain/value-objects/Q.ts', { discriminator: ['Q', 'Q.value (set accessor)'] })])];
    const out = await stage('ddd', withAnswers({ Q14: 'C' }), results, EMPTY_CONSTRUCT_GRAPH);
    expect(out.results).toBe(results);
  });
});

describe('Q2 type-only imports', () => {
  const files = { 'src/domain/entities/Member.ts': 'domain', 'src/domain/entities/Loan.ts': 'domain', 'src/application/ports/Clock.ts': 'application' };
  const g = graph({
    files,
    edges: [
      { from: 'src/domain/entities/Loan.ts', to: 'src/domain/entities/Member.ts', typeOnly: true },
      { from: 'src/domain/entities/Member.ts', to: 'src/domain/entities/Loan.ts' },
      { from: 'src/domain/entities/Member.ts', to: 'src/application/ports/Clock.ts' },
    ],
  });
  const results = (): ReturnType<typeof result>[] => [
    result('FF-S01', [
      row('FF-S01', 'src/domain/entities/Loan.ts', { target: 'src/application/ports/Clock.ts', isTypeOnly: true }),
      row('FF-S01', 'src/domain/entities/Member.ts', { target: 'src/application/ports/Clock.ts', isTypeOnly: false }),
    ]),
    result('FF-S02', [cycleRow('FF-S02', ['src/domain/entities/Loan.ts', 'src/domain/entities/Member.ts', 'src/domain/entities/Loan.ts'])]),
    result('FF-P03', [row('FF-P03', 'src/infrastructure/X.ts', { discriminator: ['X'] })]),
  ];

  it('A keeps every row', async () => {
    const out = await stage('clean-architecture', STATUS_QUO_ANSWERS, results(), g);
    expect(rowsOf(out, 'FF-S01')).toHaveLength(2);
    expect(rowsOf(out, 'FF-S02')).toHaveLength(1);
  });

  it('B drops the type-only edge row and the cycle closed by a type-only edge, nothing else', async () => {
    const out = await stage('clean-architecture', withAnswers({ Q2: 'B' }), results(), g);
    expect(rowsOf(out, 'FF-S01')).toEqual(['src/domain/entities/Member.ts -> src/application/ports/Clock.ts']);
    expect(rowsOf(out, 'FF-S02')).toEqual([]);
    expect(rowsOf(out, 'FF-P03')).toHaveLength(1);
    expect(out.results.find((r) => String(r.functionId) === 'FF-S02')?.passed).toBe(true);
  });
});

describe('Q3 in-layer cycles', () => {
  const inLayer = ['src/domain/entities/Loan.ts', 'src/domain/entities/Member.ts', 'src/domain/entities/Loan.ts'];
  const crossLayer = ['src/application/a.ts', 'src/domain/b.ts', 'src/application/a.ts'];
  const g = graph({ files: { 'src/domain/entities/Loan.ts': 'domain', 'src/domain/entities/Member.ts': 'domain', 'src/application/a.ts': 'application', 'src/domain/b.ts': 'domain' } });
  const results = (): ReturnType<typeof result>[] => [result('FF-S02', [cycleRow('FF-S02', inLayer), cycleRow('FF-S02', crossLayer)])];

  it('B drops the cycle inside one layer and keeps the crossing one', async () => {
    const out = await stage('clean-architecture', withAnswers({ Q3: 'B' }), results(), g);
    expect(rowsOf(out, 'FF-S02')).toEqual([`${crossLayer.join(',')} -> src/domain/b.ts`]);
  });

  it('B keeps a nestjs cycle across two feature modules of one layer (v04)', async () => {
    const cyc = ['src/registrations/dto/r.dto.ts', 'src/workshops/dto/w.dto.ts', 'src/registrations/dto/r.dto.ts'];
    const gn = graph({ files: { 'src/registrations/dto/r.dto.ts': 'application', 'src/workshops/dto/w.dto.ts': 'application' } });
    const out = await stage('nestjs', withAnswers({ Q3: 'B' }), [result('FF-S02', [cycleRow('FF-S02', cyc)])], gn);
    expect(rowsOf(out, 'FF-S02')).toHaveLength(1);
  });

  it('C changes no row (the split is a tier, see tiers.test.ts)', async () => {
    const out = await stage('clean-architecture', withAnswers({ Q3: 'C' }), results(), g);
    expect(rowsOf(out, 'FF-S02')).toHaveLength(2);
    expect(out.changes).toEqual([]);
  });
});

describe('Q4 layer cycles', () => {
  const files = { 'src/domain/entities/Loan.ts': 'domain', 'src/application/ports/Clock.ts': 'application', 'src/application/uc.ts': 'application', 'src/domain/x.ts': 'domain' };
  it('B adds an FF-S02 row for the upward edge that closes a layer cycle, and none for a downward edge', async () => {
    const g = graph({ files, edges: [
      { from: 'src/domain/entities/Loan.ts', to: 'src/application/ports/Clock.ts' },
      { from: 'src/application/uc.ts', to: 'src/domain/entities/Loan.ts' },
    ] });
    const out = await stage('clean-architecture', withAnswers({ Q4: 'B' }), [result('FF-S02')], g);
    expect(rowsOf(out, 'FF-S02')).toEqual(['src/domain/entities/Loan.ts,src/application/ports/Clock.ts -> src/application/ports/Clock.ts']);
  });

  it('B adds nothing without the reverse layer edge, or when the edge is in a file cycle (FF-S02 already reports it)', async () => {
    const lonely = graph({ files, edges: [{ from: 'src/domain/entities/Loan.ts', to: 'src/application/ports/Clock.ts' }] });
    expect(rowsOf(await stage('clean-architecture', withAnswers({ Q4: 'B' }), [result('FF-S02')], lonely), 'FF-S02')).toEqual([]);
    const fileCycle = graph({ files, edges: [
      { from: 'src/domain/entities/Loan.ts', to: 'src/application/ports/Clock.ts' },
      { from: 'src/application/ports/Clock.ts', to: 'src/domain/entities/Loan.ts' },
    ] });
    expect(rowsOf(await stage('clean-architecture', withAnswers({ Q4: 'B' }), [result('FF-S02')], fileCycle), 'FF-S02')).toEqual([]);
  });
});

describe('Q5 adapter -> adapter', () => {
  const files = { 'src/adapters/inbound/http/RoomController.ts': 'adapters-inbound', 'src/adapters/outbound/persistence/Repo.ts': 'adapters-outbound', 'src/config/x.ts': 'config', 'src/domain/a.ts': 'domain' };
  const g = graph({ files });
  const adapterRow = row('FF-S03', 'src/adapters/inbound/http/RoomController.ts', { target: 'src/adapters/outbound/persistence/Repo.ts', type: 'LAYER_SKIP' });
  const otherRow = row('FF-S03', 'src/domain/a.ts', { target: 'src/config/x.ts', type: 'LAYER_SKIP' });

  it('C moves the adapter pair from FF-S03 to FF-S01 and leaves the other FF-S03 row', async () => {
    const out = await stage('hexagonal', withAnswers({ Q5: 'C' }), [result('FF-S01'), result('FF-S03', [adapterRow, otherRow])], g);
    expect(rowsOf(out, 'FF-S01')).toEqual(['src/adapters/inbound/http/RoomController.ts -> src/adapters/outbound/persistence/Repo.ts']);
    expect(rowsOf(out, 'FF-S03')).toEqual(['src/domain/a.ts -> src/config/x.ts']);
    expect(String(out.results[0]?.violations[0]?.functionId)).toBe('FF-S01');
  });

  it('D moves the adapter pair to the new rule FF-S05', async () => {
    const out = await stage('hexagonal', withAnswers({ Q5: 'D' }), [result('FF-S03', [adapterRow, otherRow]), result('FF-S05')], g);
    expect(rowsOf(out, 'FF-S05')).toEqual(['src/adapters/inbound/http/RoomController.ts -> src/adapters/outbound/persistence/Repo.ts']);
    expect(rowsOf(out, 'FF-S03')).toEqual(['src/domain/a.ts -> src/config/x.ts']);
  });

  it('B changes no row (it is a tier) and C/D do nothing outside hexagonal and ddd', async () => {
    const results = [result('FF-S01'), result('FF-S03', [adapterRow])];
    const b = await stage('hexagonal', withAnswers({ Q5: 'B' }), results, g);
    expect(b.changes).toEqual([]);
    expect(b.results).toEqual(results);
    const out = await stage('clean-architecture', withAnswers({ Q5: 'C' }), results, g);
    expect(rowsOf(out, 'FF-S03')).toHaveLength(1);
  });
});

describe('Q6 hexagonal application core', () => {
  it('B adds application -> adapter rows to FF-S04 and drops domain -> application rows', async () => {
    const g = graph({ files: { 'src/application/s.ts': 'application', 'src/adapters/inbound/http/HttpTypes.ts': 'adapters-inbound', 'src/domain/d.ts': 'domain', 'src/adapters/outbound/o.ts': 'adapters-outbound' },
      edges: [{ from: 'src/application/s.ts', to: 'src/adapters/inbound/http/HttpTypes.ts' }, { from: 'src/domain/d.ts', to: 'src/application/s.ts' }] });
    const results = [result('FF-S04', [
      row('FF-S04', 'src/domain/d.ts', { target: 'src/application/s.ts' }),
      row('FF-S04', 'src/domain/d.ts', { target: 'src/adapters/outbound/o.ts' }),
    ])];
    const out = await stage('hexagonal', withAnswers({ Q6: 'B' }), results, g);
    expect(rowsOf(out, 'FF-S04').sort()).toEqual(['src/application/s.ts -> src/adapters/inbound/http/HttpTypes.ts', 'src/domain/d.ts -> src/adapters/outbound/o.ts']);
  });
});

describe('Q7 consumers of a concrete adapter', () => {
  it('B adds an FF-P03 row for the consumer, not for the composition root or the adapter layer itself', async () => {
    const g = graph({
      files: { 'src/application/services/Find.ts': 'application', 'src/adapters/outbound/persistence/InMemoryRoomRepository.ts': 'adapters-outbound', 'src/config/container.ts': 'config', 'src/adapters/outbound/persistence/Other.ts': 'adapters-outbound' },
      edges: [
        { from: 'src/application/services/Find.ts', to: 'src/adapters/outbound/persistence/InMemoryRoomRepository.ts' },
        { from: 'src/config/container.ts', to: 'src/adapters/outbound/persistence/InMemoryRoomRepository.ts' },
        { from: 'src/adapters/outbound/persistence/Other.ts', to: 'src/adapters/outbound/persistence/InMemoryRoomRepository.ts' },
      ],
      classes: [{ id: 'InMemoryRoomRepository', file: 'src/adapters/outbound/persistence/InMemoryRoomRepository.ts' }],
    });
    const out = await stage('hexagonal', withAnswers({ Q7: 'B' }), [result('FF-P03')], g);
    expect(rowsOf(out, 'FF-P03')).toEqual(['src/application/services/Find.ts -> src/adapters/outbound/persistence/InMemoryRoomRepository.ts']);
  });
});

describe('Q9 missing implements', () => {
  const g = graph({
    files: { 'src/infrastructure/persistence/InMemoryLoanRepository.ts': 'infrastructure', 'src/domain/repositories/LoanRepository.ts': 'domain', 'src/main.ts': 'infrastructure', 'src/application/uc.ts': 'application' },
    edges: [{ from: 'src/application/uc.ts', to: 'src/infrastructure/persistence/InMemoryLoanRepository.ts' }],
    classes: [
      { id: 'InMemoryLoanRepository', file: 'src/infrastructure/persistence/InMemoryLoanRepository.ts', methods: ['save', 'findById'] },
      { id: 'LoanRepository', kind: 'Interface', file: 'src/domain/repositories/LoanRepository.ts', methods: ['save', 'findById'] },
    ],
  });
  const p03 = (): ReturnType<typeof result> => result('FF-P03', [row('FF-P03', 'src/infrastructure/persistence/InMemoryLoanRepository.ts', { discriminator: ['InMemoryLoanRepository'] })]);

  it('B adds an FF-P02 row on the implementer', async () => {
    const out = await stage('clean-architecture', withAnswers({ Q9: 'B' }), [p03(), result('FF-P02')], g);
    expect(rowsOf(out, 'FF-P02')).toEqual(['src/infrastructure/persistence/InMemoryLoanRepository.ts -> ']);
    expect(rowsOf(out, 'FF-P03')).toHaveLength(1);
  });

  it('C drops the FF-P03 row of a class that conforms to a port and is wired; keeps one that is not wired', async () => {
    expect(rowsOf(await stage('clean-architecture', withAnswers({ Q9: 'C' }), [p03()], g), 'FF-P03')).toEqual([]);
    const unwired = graph({ ...{ files: { 'src/infrastructure/persistence/InMemoryLoanRepository.ts': 'infrastructure', 'src/domain/repositories/LoanRepository.ts': 'domain' } },
      classes: [
        { id: 'InMemoryLoanRepository', file: 'src/infrastructure/persistence/InMemoryLoanRepository.ts', methods: ['save', 'findById'] },
        { id: 'LoanRepository', kind: 'Interface', file: 'src/domain/repositories/LoanRepository.ts', methods: ['save', 'findById'] },
      ] });
    expect(rowsOf(await stage('clean-architecture', withAnswers({ Q9: 'C' }), [p03()], unwired), 'FF-P03')).toHaveLength(1);
  });
});

describe('Q10 FF-P01 in layered', () => {
  const results = (): ReturnType<typeof result>[] => [
    result('FF-P01', [row('FF-P01', 'src/business/model/Order.ts', { target: 'typeorm' }), row('FF-P01', 'src/business/services/OrderService.ts', { target: 'express' })]),
    result('FF-S01'),
  ];
  const g = graph({ files: { 'src/business/services/OrderService.ts': 'business', 'src/business/model/Order.ts': 'business' },
    packages: [{ from: 'src/business/services/OrderService.ts', pkg: 'express', typeOnly: true }, { from: 'src/business/model/Order.ts', pkg: 'typeorm' }] });

  it('B keeps the web framework row and drops the persistence one', async () => {
    const out = await stage('layered', withAnswers({ Q10: 'B' }), results(), g);
    expect(rowsOf(out, 'FF-P01')).toEqual(['src/business/services/OrderService.ts -> express']);
  });

  it('C adds the FF-S01 row from the declared package layer (FF-P01 itself is disabled at compile time)', async () => {
    const out = await stage('layered', withAnswers({ Q10: 'C' }), [result('FF-S01')], g);
    expect(rowsOf(out, 'FF-S01')).toEqual(['src/business/services/OrderService.ts -> express']);
  });

  it('D adds no row (FF-P01 is disabled at compile time)', async () => {
    const out = await stage('layered', withAnswers({ Q10: 'D' }), [result('FF-S01')], g);
    expect(rowsOf(out, 'FF-S01')).toEqual([]);
  });
});

describe('Q11 domain -> application inside the core', () => {
  it('B drops FF-S01 and FF-S04 rows from domain to application, keeps domain -> adapter', async () => {
    const g = graph({ files: { 'src/domain/d.ts': 'domain', 'src/application/p.ts': 'application', 'src/adapters/outbound/o.ts': 'adapters-outbound' } });
    const results = [
      result('FF-S01', [row('FF-S01', 'src/domain/d.ts', { target: 'src/application/p.ts' }), row('FF-S01', 'src/domain/d.ts', { target: 'src/adapters/outbound/o.ts' })]),
      result('FF-S04', [row('FF-S04', 'src/domain/d.ts', { target: 'src/application/p.ts' })]),
    ];
    const out = await stage('hexagonal', withAnswers({ Q11: 'B' }), results, g);
    expect(rowsOf(out, 'FF-S01')).toEqual(['src/domain/d.ts -> src/adapters/outbound/o.ts']);
    expect(rowsOf(out, 'FF-S04')).toEqual([]);
  });
});

describe('Q12 upward adjacent imports in layered', () => {
  it('B drops the FF-S03 row whose reverse is allowed and keeps the skip', async () => {
    const g = graph({ files: { 'src/persistence/ProductGateway.ts': 'persistence', 'src/business/model/Money.ts': 'business', 'src/presentation/v.ts': 'presentation' } });
    const results = [result('FF-S03', [
      row('FF-S03', 'src/persistence/ProductGateway.ts', { target: 'src/business/model/Money.ts' }),
      row('FF-S03', 'src/presentation/v.ts', { target: 'src/persistence/ProductGateway.ts' }),
    ])];
    const out = await stage('layered', withAnswers({ Q12: 'B' }), results, g);
    expect(rowsOf(out, 'FF-S03')).toEqual(['src/presentation/v.ts -> src/persistence/ProductGateway.ts']);
  });
});

describe('Q13 nestjs layer order', () => {
  const g = (depFile: string, depLayer: string): ReturnType<typeof graph> => graph({
    files: { 'src/registrations/registrations.service.ts': 'application', [depFile]: depLayer },
    classes: [{ id: 'RegistrationsService', file: 'src/registrations/registrations.service.ts' }, { id: 'Dep', file: depFile }],
    classEdges: [{ from: 'RegistrationsService', to: 'Dep', type: 'CONSTRUCTOR_INJECTS' }],
  });
  const p04 = (): ReturnType<typeof result> => result('FF-P04', [row('FF-P04', 'src/registrations/registrations.service.ts', { discriminator: ['RegistrationsService'] })]);

  it('B drops the FF-P04 row when the dependency lies below the use case (a repository)', async () => {
    const out = await stage('nestjs', withAnswers({ Q13: 'B' }), [p04()], g('src/registrations/in-memory.repository.ts', 'infrastructure'));
    expect(rowsOf(out, 'FF-P04')).toEqual([]);
  });

  it('B keeps it when the dependency lies above (presentation)', async () => {
    const out = await stage('nestjs', withAnswers({ Q13: 'B' }), [p04()], g('src/registrations/x.controller.ts', 'presentation'));
    expect(rowsOf(out, 'FF-P04')).toHaveLength(1);
  });
});

describe('Q17 DDD public API', () => {
  const files = {
    'src/billing/api/InvoiceController.ts': 'api', 'src/ordering/index.ts': null, 'src/ordering/application/GetOrderSummary.ts': 'application',
  };
  it('B adds the resolved barrel import to FF-DS02', async () => {
    const g = graph({ files, edges: [
      { from: 'src/billing/api/InvoiceController.ts', to: 'src/ordering/index.ts', reExportHop: true },
      { from: 'src/billing/api/InvoiceController.ts', to: 'src/ordering/application/GetOrderSummary.ts', viaReExport: true },
    ] });
    const out = await stage('ddd', withAnswers({ Q17: 'B' }), [result('FF-DS02')], g);
    expect(rowsOf(out, 'FF-DS02')).toEqual(['src/billing/api/InvoiceController.ts -> src/ordering/application/GetOrderSummary.ts']);
  });

  it('C reports the barrel that publishes an application file under FF-DS03, and changes no FF-DS02 row', async () => {
    const g = graph({ files, edges: [{ from: 'src/ordering/index.ts', to: 'src/ordering/application/GetOrderSummary.ts', type: 'RE_EXPORTS' }] });
    const out = await stage('ddd', withAnswers({ Q17: 'C' }), [result('FF-DS02'), result('FF-DS03')], g);
    expect(rowsOf(out, 'FF-DS03')).toEqual(['src/ordering/index.ts -> src/ordering/application/GetOrderSummary.ts']);
    expect(rowsOf(out, 'FF-DS02')).toEqual([]);
  });
});

describe('Q18 anti-corruption layer', () => {
  it('B adds the ACL import of an upstream internal file', async () => {
    const g = graph({ files: { 'src/billing/acl/OrderingAcl.ts': 'infrastructure', 'src/ordering/domain/order/value-objects/OrderId.ts': 'domain', 'src/ordering/contracts/x.ts': null },
      edges: [{ from: 'src/billing/acl/OrderingAcl.ts', to: 'src/ordering/domain/order/value-objects/OrderId.ts' }, { from: 'src/billing/acl/OrderingAcl.ts', to: 'src/ordering/contracts/x.ts' }] });
    const out = await stage('ddd', withAnswers({ Q18: 'B' }), [result('FF-DS02')], g);
    expect(rowsOf(out, 'FF-DS02')).toEqual(['src/billing/acl/OrderingAcl.ts -> src/ordering/domain/order/value-objects/OrderId.ts']);
  });
});

describe('Q19 aggregate boundary', () => {
  it('B keeps the row of a file that holds the inner entity and drops a plain import', async () => {
    const g = graph({ files: { 'src/ordering/application/A.ts': 'application', 'src/ordering/application/B.ts': 'application', 'src/ordering/domain/order/OrderLine.ts': 'domain' },
      classes: [{ id: 'A', file: 'src/ordering/application/A.ts' }, { id: 'B', file: 'src/ordering/application/B.ts' }, { id: 'OrderLine', file: 'src/ordering/domain/order/OrderLine.ts' }],
      classEdges: [{ from: 'A', to: 'OrderLine', type: 'FLOWS_TO', field: 'line' }] });
    const results = [result('FF-DT01', [
      row('FF-DT01', 'src/ordering/application/A.ts', { target: 'src/ordering/domain/order/OrderLine.ts' }),
      row('FF-DT01', 'src/ordering/application/B.ts', { target: 'src/ordering/domain/order/OrderLine.ts' }),
    ])];
    const out = await stage('ddd', withAnswers({ Q19: 'B' }), results, g);
    expect(rowsOf(out, 'FF-DT01')).toEqual(['src/ordering/application/A.ts -> src/ordering/domain/order/OrderLine.ts']);
  });
});

describe('Q20 transitive purity', () => {
  it('B adds the domain file that reaches @nestjs/common through a project file, not the direct importer twice', async () => {
    const g = graph({ files: { 'src/domain/registration-policy.ts': 'domain', 'src/registrations/in-memory.repository.ts': 'infrastructure', 'src/domain/direct.ts': 'domain' },
      edges: [{ from: 'src/domain/registration-policy.ts', to: 'src/registrations/in-memory.repository.ts' }],
      packages: [{ from: 'src/registrations/in-memory.repository.ts', pkg: '@nestjs/common' }, { from: 'src/domain/direct.ts', pkg: 'typeorm' }] });
    const results = [result('FF-P01', [row('FF-P01', 'src/domain/direct.ts', { target: 'typeorm' })])];
    const spec = await presetSpec('nestjs');
    const fp01 = spec.fitnessFunctions.find((f) => String(f.id) === 'FF-P01');
    expect(fp01?.forbiddenImports).toBeDefined();
    const out = await stage('nestjs', withAnswers({ Q20: 'B' }), results, g);
    // @nestjs/common is not on the nestjs preset's forbidden list, so only a listed package counts.
    const listed = (fp01?.forbiddenImports ?? []).some((p) => p === '@nestjs/common' || p === '@nestjs/*');
    expect(rowsOf(out, 'FF-P01')).toEqual(['src/domain/direct.ts -> typeorm', ...(listed ? ['src/domain/registration-policy.ts -> @nestjs/common'] : [])]);
    const g2 = graph({ files: { 'src/domain/p.ts': 'domain', 'src/infrastructure/r.ts': 'infrastructure' },
      edges: [{ from: 'src/domain/p.ts', to: 'src/infrastructure/r.ts' }], packages: [{ from: 'src/infrastructure/r.ts', pkg: 'typeorm' }] });
    expect(rowsOf(await stage('nestjs', withAnswers({ Q20: 'B' }), [result('FF-P01')], g2), 'FF-P01')).toEqual(['src/domain/p.ts -> typeorm']);
  });
});

describe('Q22 sibling-service injection', () => {
  it('B drops the row of a class whose only concrete dependency is a sibling service', async () => {
    const g = graph({
      files: { 'src/registrations/registrations.service.ts': 'application', 'src/workshops/workshops.service.ts': 'application', 'src/domain/registration.repository.ts': 'domain' },
      classes: [
        { id: 'RegistrationsService', file: 'src/registrations/registrations.service.ts' },
        { id: 'WorkshopsService', file: 'src/workshops/workshops.service.ts' },
        { id: 'RegistrationRepository', kind: 'Interface', file: 'src/domain/registration.repository.ts' },
      ],
      classEdges: [
        { from: 'RegistrationsService', to: 'WorkshopsService', type: 'CONSTRUCTOR_INJECTS' },
        { from: 'RegistrationsService', to: 'RegistrationRepository', type: 'CONSTRUCTOR_INJECTS' },
      ],
    });
    const results = [result('FF-P02', [row('FF-P02', 'src/registrations/registrations.service.ts', { discriminator: ['RegistrationsService'] })])];
    const out = await stage('nestjs', withAnswers({ Q22: 'B' }), results, g);
    expect(rowsOf(out, 'FF-P02')).toEqual([]);
  });

  it('B keeps the row of a class that injects a concrete class of another layer', async () => {
    const g = graph({
      files: { 'src/application/uc.ts': 'application', 'src/infrastructure/Repo.ts': 'infrastructure' },
      classes: [{ id: 'RegisterBookUseCase', file: 'src/application/uc.ts' }, { id: 'Repo', file: 'src/infrastructure/Repo.ts' }],
      classEdges: [{ from: 'RegisterBookUseCase', to: 'Repo', type: 'CONSTRUCTOR_INJECTS' }],
    });
    const results = [result('FF-P02', [row('FF-P02', 'src/application/uc.ts', { discriminator: ['RegisterBookUseCase'] })])];
    const out = await stage('clean-architecture', withAnswers({ Q22: 'B' }), results, g);
    expect(rowsOf(out, 'FF-P02')).toEqual(['src/application/uc.ts -> ']);
    expect(out.changes).toEqual([]);
  });
});

describe('Q23 FF-P05 entity by layer', () => {
  it('B finds a domain class without an Entity suffix that the controller reaches; A does not', async () => {
    const g = graph({
      files: { 'src/infrastructure/http/LoanController.ts': 'infrastructure', 'src/application/uc.ts': 'application', 'src/domain/entities/Loan.ts': 'domain' },
      classes: [{ id: 'LoanController', file: 'src/infrastructure/http/LoanController.ts' }, { id: 'UseCase', file: 'src/application/uc.ts' }, { id: 'Loan', file: 'src/domain/entities/Loan.ts' }],
      classEdges: [{ from: 'LoanController', to: 'UseCase', type: 'CONSTRUCTOR_INJECTS' }, { from: 'UseCase', to: 'Loan', type: 'CONSTRUCTOR_INJECTS' }],
    });
    expect(rowsOf(await stage('clean-architecture', STATUS_QUO_ANSWERS, [result('FF-P05')], g), 'FF-P05')).toEqual([]);
    expect(rowsOf(await stage('clean-architecture', withAnswers({ Q23: 'B' }), [result('FF-P05')], g), 'FF-P05')).toEqual(['src/infrastructure/http/LoanController.ts -> ']);
  });
});

describe('Q24 inward bypass', () => {
  it('B adds an advisory FF-S03 row for a controller that imports a domain file; not for a repository', async () => {
    const g = graph({
      files: { 'src/infrastructure/http/LoanController.ts': 'infrastructure', 'src/infrastructure/persistence/Repo.ts': 'infrastructure', 'src/domain/entities/Loan.ts': 'domain' },
      edges: [{ from: 'src/infrastructure/http/LoanController.ts', to: 'src/domain/entities/Loan.ts' }, { from: 'src/infrastructure/persistence/Repo.ts', to: 'src/domain/entities/Loan.ts' }],
      classes: [{ id: 'LoanController', file: 'src/infrastructure/http/LoanController.ts' }, { id: 'Repo', file: 'src/infrastructure/persistence/Repo.ts' }],
    });
    const out = await stage('clean-architecture', withAnswers({ Q24: 'B' }), [result('FF-S03')], g);
    expect(rowsOf(out, 'FF-S03')).toEqual(['src/infrastructure/http/LoanController.ts -> src/domain/entities/Loan.ts']);
  });

  it('B adds the hexagonal inbound adapter that uses a domain value type (hex n01)', async () => {
    const g = graph({ files: { 'src/adapters/inbound/http/RoomController.ts': 'adapters-inbound', 'src/domain/model/DateRange.ts': 'domain' },
      edges: [{ from: 'src/adapters/inbound/http/RoomController.ts', to: 'src/domain/model/DateRange.ts' }] });
    const out = await stage('hexagonal', withAnswers({ Q24: 'B' }), [result('FF-S03')], g);
    expect(rowsOf(out, 'FF-S03')).toEqual(['src/adapters/inbound/http/RoomController.ts -> src/domain/model/DateRange.ts']);
  });
});

describe('rows go only to executed functions', () => {
  it('Q4 B adds nothing when FF-S02 did not run', async () => {
    const g = graph({ files: { 'src/domain/a.ts': 'domain', 'src/application/b.ts': 'application' },
      edges: [{ from: 'src/domain/a.ts', to: 'src/application/b.ts' }, { from: 'src/application/b.ts', to: 'src/domain/a.ts' }] });
    const out = await stage('clean-architecture', withAnswers({ Q4: 'B' }), [result('FF-S01')], g);
    expect(out.results.map((r) => String(r.functionId))).toEqual(['FF-S01']);
  });
});
