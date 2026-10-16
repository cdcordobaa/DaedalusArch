/**
 * Semantic rule cases: one small hand-built graph per case and the exact findings the rule's real compiled query must
 * return on it. Kinds:
 * - `violating`: the rule must report exactly the planted findings;
 * - `clean`: conforming code, no finding;
 * - `near-miss`: code one step from a violation (wrong layer, allowed edge, name just off the pattern, edge outside
 *   the view, bound just exceeded), no finding unless stated.
 *
 * `blindSpot` names the item of Docs/DiagnosticRuns/v1.3-rule-mutation-2026-10-16.md §6 A that the case covers. The
 * expectations are what the frozen rule text says (the Cypher is canonical); where a case pins a choice the template
 * makes rather than a design endorsement, `why` says so.
 */
import { Graph } from './semantic-harness.js';
import type { Style } from './semantic-harness.js';
import type { CompileOptions } from '../../../src/fitness-compiler/fitness-compiler.js';

export interface SemanticCase {
  readonly id: string;
  readonly style: Style;
  readonly ruleId: string;
  readonly kind: 'violating' | 'clean' | 'near-miss';
  readonly blindSpot?: readonly string[];
  readonly why: string;
  readonly build: (g: Graph) => void;
  /** Sorted finding keys (`findingKey`). */
  readonly expected: readonly string[];
  /** Expected evaluator warning codes (only the cycle cap emits one). */
  readonly expectedWarnings?: readonly string[];
  readonly compile?: Partial<CompileOptions>;
}

// ── clean-architecture paths ──────────────────────────────────────────────────
const CA = {
  book: 'src/domain/entities/Book.ts',
  loanRepoIf: 'src/domain/repositories/LoanRepository.ts',
  domainIndex: 'src/domain/index.ts',
  money: 'src/domain/value-objects/Money.ts',
  borrow: 'src/application/use-cases/BorrowBook.ts',
  clock: 'src/application/ports/Clock.ts',
  sqlRepo: 'src/infrastructure/persistence/SqlLoanRepository.ts',
  ctrl: 'src/infrastructure/http/LoanController.ts',
  shared: 'src/shared/strings.ts',
};

const cycle = (...files: string[]): string => `cycle{${[...files].sort().join(' ')}}`;
const chain = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${prefix}/m${String(i + 1).padStart(2, '0')}.ts`);

function ring(g: Graph, files: readonly string[], layer: string): void {
  files.forEach((f) => g.file(f, layer));
  files.forEach((f, i) => g.imports(f, files[(i + 1) % files.length] ?? f));
}

export const CASES: readonly SemanticCase[] = [
  // ── FF-S01 dependency-direction (clean-architecture: domain < application < infrastructure) ──
  {
    id: 'ca-s01-inner-imports-outer', style: 'clean-architecture', ruleId: 'FF-S01', kind: 'violating',
    why: 'domain and application files importing outer layers break the dependency rule, one finding per edge',
    build: (g) => { g.file(CA.book, 'domain'); g.file(CA.borrow, 'application'); g.file(CA.sqlRepo, 'infrastructure'); g.imports(CA.book, CA.borrow).imports(CA.borrow, CA.sqlRepo); },
    expected: [`${CA.book} -> ${CA.borrow} (IMPORTS)`, `${CA.borrow} -> ${CA.sqlRepo} (IMPORTS)`],
  },
  {
    id: 'ca-s01-reexport-only', style: 'clean-architecture', ruleId: 'FF-S01', kind: 'violating', blindSpot: ['A5'],
    why: 'a domain barrel that re-exports an infrastructure module depends on it; the only edge is RE_EXPORTS',
    build: (g) => { g.file(CA.domainIndex, 'domain'); g.file(CA.sqlRepo, 'infrastructure'); g.reExports(CA.domainIndex, CA.sqlRepo); },
    expected: [`${CA.domainIndex} -> ${CA.sqlRepo} (RE_EXPORTS)`],
  },
  {
    id: 'ca-s01-inward-only', style: 'clean-architecture', ruleId: 'FF-S01', kind: 'clean',
    why: 'every edge points inward',
    build: (g) => { g.file(CA.book, 'domain'); g.file(CA.borrow, 'application'); g.file(CA.sqlRepo, 'infrastructure'); g.imports(CA.borrow, CA.book).imports(CA.sqlRepo, CA.borrow).imports(CA.sqlRepo, CA.book).reExports(CA.sqlRepo, CA.book); },
    expected: [],
  },
  {
    id: 'ca-s01-same-layer-and-unmapped', style: 'clean-architecture', ruleId: 'FF-S01', kind: 'near-miss',
    why: 'same-layer edges and edges to or from an unmapped file cross no layer boundary',
    build: (g) => { g.file(CA.book, 'domain'); g.file(CA.money, 'domain'); g.file(CA.shared); g.file(CA.sqlRepo, 'infrastructure'); g.imports(CA.book, CA.money).imports(CA.book, CA.shared).imports(CA.shared, CA.sqlRepo); },
    expected: [],
  },
  {
    id: 'ca-s01-literal-view', style: 'clean-architecture', ruleId: 'FF-S01', kind: 'near-miss',
    why: 'literal view (ADR-V13-01): the resolved twin of a barrel import (viaReExport) is not read; the barrel hop edge is',
    build: (g) => { g.file(CA.book, 'domain'); g.file(CA.borrow, 'application'); g.file(CA.sqlRepo, 'infrastructure'); g.imports(CA.book, CA.sqlRepo, { viaReExport: true }).imports(CA.book, CA.borrow, { reExportHop: true }); },
    expected: [`${CA.book} -> ${CA.borrow} (IMPORTS)`],
  },
  {
    id: 'nestjs-s01-order', style: 'nestjs', ruleId: 'FF-S01', kind: 'violating',
    why: 'nestjs order domain < infrastructure < application < presentation: a repository importing a service points outward, a service importing a repository does not',
    build: (g) => {
      g.file('src/persistence/loan.repository.ts', 'infrastructure'); g.file('src/services/loan.service.ts', 'application'); g.file('src/controllers/loan.controller.ts', 'presentation');
      g.imports('src/persistence/loan.repository.ts', 'src/services/loan.service.ts').imports('src/services/loan.service.ts', 'src/persistence/loan.repository.ts').imports('src/controllers/loan.controller.ts', 'src/services/loan.service.ts');
    },
    expected: ['src/persistence/loan.repository.ts -> src/services/loan.service.ts (IMPORTS)'],
  },
  {
    id: 'layered-s01-upward', style: 'layered', ruleId: 'FF-S01', kind: 'violating',
    why: 'layered order persistence < business < presentation: persistence importing business points outward',
    build: (g) => { g.file('src/persistence/LoanDao.ts', 'persistence'); g.file('src/business/LoanService.ts', 'business'); g.imports('src/persistence/LoanDao.ts', 'src/business/LoanService.ts').imports('src/business/LoanService.ts', 'src/persistence/LoanDao.ts'); },
    expected: ['src/persistence/LoanDao.ts -> src/business/LoanService.ts (IMPORTS)'],
  },

  // ── FF-S02 no-cyclic-deps ──
  {
    id: 'ca-s02-two-and-three-cycles', style: 'clean-architecture', ruleId: 'FF-S02', kind: 'violating',
    why: 'one finding per simple cycle, whatever its rotation',
    build: (g) => { ring(g, ['src/domain/a.ts', 'src/domain/b.ts'], 'domain'); ring(g, ['src/application/x.ts', 'src/application/y.ts', 'src/application/z.ts'], 'application'); },
    expected: [cycle('src/domain/a.ts', 'src/domain/b.ts'), cycle('src/application/x.ts', 'src/application/y.ts', 'src/application/z.ts')],
  },
  {
    id: 'ca-s02-acyclic', style: 'clean-architecture', ruleId: 'FF-S02', kind: 'clean',
    why: 'a diamond (a -> b, a -> c, b -> d, c -> d) has no cycle',
    build: (g) => { ['a', 'b', 'c', 'd'].forEach((x) => g.file(`src/domain/${x}.ts`, 'domain')); g.imports('src/domain/a.ts', 'src/domain/b.ts').imports('src/domain/a.ts', 'src/domain/c.ts').imports('src/domain/b.ts', 'src/domain/d.ts').imports('src/domain/c.ts', 'src/domain/d.ts'); },
    expected: [],
  },
  {
    id: 'layered-s02-ten-file-cycle', style: 'layered', ruleId: 'FF-S02', kind: 'violating', blindSpot: ['A1'],
    why: 'a cycle of exactly MAX_CYCLE_LENGTH = 10 files is inside the frozen bound (BR-U1-28)',
    build: (g) => { ring(g, chain('src/business/model', 10), 'business'); },
    expected: [cycle(...chain('src/business/model', 10))],
  },
  {
    id: 'layered-s02-eleven-file-cycle', style: 'layered', ruleId: 'FF-S02', kind: 'near-miss', blindSpot: ['A2'],
    why: 'an 11-file cycle is beyond the frozen bound: no finding. This pins the definitional limit of BR-U1-28, not a design endorsement',
    build: (g) => { ring(g, chain('src/business/model', 11), 'business'); },
    expected: [],
  },
  {
    id: 'ca-s02-self-import', style: 'clean-architecture', ruleId: 'FF-S02', kind: 'near-miss', blindSpot: ['A3'],
    why: 'a file importing itself is not a cycle under the template (minimum length 2)',
    build: (g) => { g.file(CA.book, 'domain'); g.imports(CA.book, CA.book, { isTypeOnly: true }); },
    expected: [],
  },
  {
    id: 'nestjs-s02-figure-eight', style: 'nestjs', ruleId: 'FF-S02', kind: 'violating', blindSpot: ['A4'],
    why: 'two 2-cycles sharing a file are two simple cycles; the closed walk through both is not simple and is not a finding',
    build: (g) => {
      const [a, b, c] = ['src/services/a.service.ts', 'src/services/b.service.ts', 'src/services/c.service.ts'];
      [a, b, c].forEach((f) => g.file(f, 'application'));
      g.imports(a, b).imports(b, a).imports(a, c).imports(c, a);
    },
    expected: [cycle('src/services/a.service.ts', 'src/services/b.service.ts'), cycle('src/services/a.service.ts', 'src/services/c.service.ts')],
  },
  {
    id: 'ca-s02-cycle-closed-by-reexport', style: 'clean-architecture', ruleId: 'FF-S02', kind: 'violating', blindSpot: ['A5', 'A11'],
    why: 'a cycle closed by an `export * from` edge is a cycle (ADR-V13-01); the barrel also imports the file it re-exports, so the pair has two parallel edges and two paths',
    build: (g) => { g.file(CA.domainIndex, 'domain'); g.file(CA.book, 'domain'); g.imports(CA.book, CA.domainIndex).reExports(CA.domainIndex, CA.book).imports(CA.domainIndex, CA.book); },
    expected: [cycle(CA.domainIndex, CA.book)],
  },
  {
    id: 'ca-s02-reexport-only-cycle', style: 'clean-architecture', ruleId: 'FF-S02', kind: 'violating', blindSpot: ['A5'],
    why: 'a cycle whose closing edge is only a re-export',
    build: (g) => { g.file(CA.domainIndex, 'domain'); g.file(CA.book, 'domain'); g.imports(CA.book, CA.domainIndex).reExports(CA.domainIndex, CA.book); },
    expected: [cycle(CA.domainIndex, CA.book)],
  },
  {
    id: 'ca-s02-literal-view', style: 'clean-architecture', ruleId: 'FF-S02', kind: 'near-miss',
    why: 'literal view: a cycle that exists only through resolved (viaReExport) edges is not read',
    build: (g) => { g.file(CA.book, 'domain'); g.file(CA.money, 'domain'); g.imports(CA.book, CA.money).imports(CA.money, CA.book, { viaReExport: true }); },
    expected: [],
  },
  {
    id: 'ca-s02-cap-keeps-first-100', style: 'clean-architecture', ruleId: 'FF-S02', kind: 'violating',
    why: 'BR-U1-28: 101 cycles hit the cap; the 100 kept are the first by ORDER BY cycle, the truncation is reported (EVAL_003)',
    build: (g) => {
      for (let i = 0; i < 101; i += 1) {
        const n = String(i).padStart(3, '0');
        ring(g, [`src/domain/c${n}a.ts`, `src/domain/c${n}b.ts`], 'domain');
      }
    },
    expected: Array.from({ length: 100 }, (_, i) => cycle(`src/domain/c${String(i).padStart(3, '0')}a.ts`, `src/domain/c${String(i).padStart(3, '0')}b.ts`)).sort(),
    expectedWarnings: ['EVAL_003'],
  },

  // ── FF-S04 no-domain-outward-dep ──
  {
    id: 'ca-s04-domain-outward', style: 'clean-architecture', ruleId: 'FF-S04', kind: 'violating',
    why: 'a domain file importing application and infrastructure files',
    build: (g) => { g.file(CA.book, 'domain'); g.file(CA.borrow, 'application'); g.file(CA.sqlRepo, 'infrastructure'); g.imports(CA.book, CA.borrow).imports(CA.book, CA.sqlRepo); },
    expected: [`${CA.book} -> ${CA.borrow} (IMPORTS)`, `${CA.book} -> ${CA.sqlRepo} (IMPORTS)`],
  },
  {
    id: 'ca-s04-reexport-only', style: 'clean-architecture', ruleId: 'FF-S04', kind: 'violating', blindSpot: ['A5'],
    why: 'a domain barrel re-exporting an infrastructure module',
    build: (g) => { g.file(CA.domainIndex, 'domain'); g.file(CA.sqlRepo, 'infrastructure'); g.reExports(CA.domainIndex, CA.sqlRepo); },
    expected: [`${CA.domainIndex} -> ${CA.sqlRepo} (RE_EXPORTS)`],
  },
  {
    id: 'ca-s04-outward-outside-domain', style: 'clean-architecture', ruleId: 'FF-S04', kind: 'near-miss',
    why: 'application -> infrastructure is outward but not from the domain; domain -> domain and domain -> unmapped are not outward',
    build: (g) => { g.file(CA.book, 'domain'); g.file(CA.money, 'domain'); g.file(CA.shared); g.file(CA.borrow, 'application'); g.file(CA.sqlRepo, 'infrastructure'); g.imports(CA.borrow, CA.sqlRepo).imports(CA.book, CA.money).imports(CA.book, CA.shared).imports(CA.borrow, CA.book); },
    expected: [],
  },

  // ── FF-P01 / FF-DT04 domain-purity ──
  {
    id: 'ca-p01-framework-in-domain', style: 'clean-architecture', ruleId: 'FF-P01', kind: 'violating',
    why: 'exact and prefix-wildcard forbidden packages, by import and by re-export',
    build: (g) => { g.file(CA.book, 'domain'); g.file(CA.domainIndex, 'domain'); g.imports(CA.book, g.pkg('typeorm')).imports(CA.book, g.pkg('@nestjs/common')).reExports(CA.domainIndex, g.pkg('express')); },
    expected: [`${CA.book} -> @nestjs/common (IMPORTS)`, `${CA.book} -> typeorm (IMPORTS)`, `${CA.domainIndex} -> express (RE_EXPORTS)`],
  },
  {
    id: 'ca-p01-clean-domain', style: 'clean-architecture', ruleId: 'FF-P01', kind: 'clean',
    why: 'the domain imports an allowed package and domain files; frameworks are imported outside the domain',
    build: (g) => { g.file(CA.book, 'domain'); g.file(CA.money, 'domain'); g.file(CA.sqlRepo, 'infrastructure'); g.imports(CA.book, g.pkg('date-fns')).imports(CA.book, CA.money).imports(CA.sqlRepo, g.pkg('typeorm')); },
    expected: [],
  },
  {
    id: 'ca-p01-lookalike-packages', style: 'clean-architecture', ruleId: 'FF-P01', kind: 'near-miss',
    why: 'names next to the forbidden ones: `typeorm-extension` (exact entry, not a prefix), `@nestjsx/crud` (outside the @nestjs/ scope)',
    build: (g) => { g.file(CA.book, 'domain'); g.imports(CA.book, g.pkg('typeorm-extension')).imports(CA.book, g.pkg('@nestjsx/crud')); },
    expected: [],
  },
  {
    id: 'ca-p01-resolved-view', style: 'clean-architecture', ruleId: 'FF-P01', kind: 'near-miss',
    why: 'resolved view: the barrel hop (reExportHop) is not read, the resolved edge (viaReExport) is',
    build: (g) => { g.file(CA.book, 'domain'); g.file(CA.money, 'domain'); g.imports(CA.book, g.pkg('prisma'), { reExportHop: true }).imports(CA.money, g.pkg('sequelize'), { viaReExport: true }); },
    expected: [`${CA.money} -> sequelize (IMPORTS)`],
  },
  {
    id: 'hex-p01-framework-in-domain', style: 'hexagonal', ruleId: 'FF-P01', kind: 'violating',
    why: 'hexagonal domain importing an ORM; the adapter importing it is fine',
    build: (g) => { g.file('src/domain/Order.ts', 'domain'); g.file('src/adapters/outbound/OrderRepo.ts', 'adapters-outbound'); g.imports('src/domain/Order.ts', g.pkg('@prisma/client')).imports('src/adapters/outbound/OrderRepo.ts', g.pkg('@prisma/client')); },
    expected: ['src/domain/Order.ts -> @prisma/client (IMPORTS)'],
  },
  {
    id: 'ddd-dt04-framework-in-domain', style: 'ddd', ruleId: 'FF-DT04', kind: 'violating',
    why: 'DDD domain importing class-transformer; application importing it is fine',
    build: (g) => { g.file('src/billing/domain/invoice/InvoiceId.ts', 'domain'); g.file('src/billing/application/IssueInvoice.ts', 'application'); g.imports('src/billing/domain/invoice/InvoiceId.ts', g.pkg('class-transformer')).imports('src/billing/application/IssueInvoice.ts', g.pkg('class-transformer')); },
    expected: ['src/billing/domain/invoice/InvoiceId.ts -> class-transformer (IMPORTS)'],
  },

  // ── FF-P02 dependency-inversion / port-dependency-inversion (threshold 0.85) ──
  {
    id: 'ca-p02-concrete-deps', style: 'clean-architecture', ruleId: 'FF-P02', kind: 'violating',
    why: 'an application class with one interface and one concrete dependency (ratio 0.5)',
    build: (g) => { const s = g.cls('BorrowBook', CA.borrow, 'application'); g.edge('CONSTRUCTOR_INJECTS', s, g.iface('LoanRepository', CA.loanRepoIf, 'domain')).edge('CONSTRUCTOR_INJECTS', s, g.cls('SqlLoanRepository', CA.sqlRepo, 'infrastructure')); },
    expected: [CA.borrow],
  },
  {
    id: 'ca-p02-interfaces-only', style: 'clean-architecture', ruleId: 'FF-P02', kind: 'clean',
    why: 'every dependency is an interface (ratio 1); a class with no dependency is not measured; methods and implemented interfaces are not dependencies',
    build: (g) => {
      const s = g.cls('BorrowBook', CA.borrow, 'application');
      g.edge('CONSTRUCTOR_INJECTS', s, g.iface('LoanRepository', CA.loanRepoIf, 'domain')).edge('CONSTRUCTOR_INJECTS', s, g.iface('Clock', CA.clock, 'application'));
      g.edge('IMPLEMENTS', s, g.iface('UseCase', 'src/application/UseCase.ts', 'application'));
      g.method(s, 'execute'); g.method(s, 'validate');
      const r = g.cls('ReturnBook', 'src/application/use-cases/ReturnBook.ts', 'application');
      g.method(r, 'execute');
    },
    expected: [],
  },
  {
    id: 'ca-p02-just-above-threshold', style: 'clean-architecture', ruleId: 'FF-P02', kind: 'near-miss',
    why: '6 interfaces of 7 (0.857 >= 0.85) passes; infrastructure classes injecting concrete classes are out of scope',
    build: (g) => {
      const s = g.cls('BorrowBook', CA.borrow, 'application');
      for (let i = 0; i < 6; i += 1) g.edge('CONSTRUCTOR_INJECTS', s, g.iface(`Port${String(i)}`, `src/domain/ports/Port${String(i)}.ts`, 'domain'));
      g.edge('CONSTRUCTOR_INJECTS', s, g.cls('Money', CA.money, 'domain'));
      g.edge('CONSTRUCTOR_INJECTS', g.cls('LoanController', CA.ctrl, 'infrastructure'), s);
    },
    expected: [],
  },
  {
    id: 'hex-p02-concrete-adapter', style: 'hexagonal', ruleId: 'FF-P02', kind: 'violating',
    why: 'an application service injecting an outbound adapter class directly (ratio 0)',
    build: (g) => { const s = g.cls('PlaceOrder', 'src/application/PlaceOrder.ts', 'application'); g.edge('CONSTRUCTOR_INJECTS', s, g.cls('PgOrderRepository', 'src/adapters/outbound/PgOrderRepository.ts', 'adapters-outbound')); },
    expected: ['src/application/PlaceOrder.ts'],
  },
  {
    id: 'hex-p02-ports-only', style: 'hexagonal', ruleId: 'FF-P02', kind: 'clean',
    why: 'the service injects ports only (its methods and the port it implements are not dependencies); the inbound adapter injecting the concrete service is out of scope',
    build: (g) => { const s = g.cls('PlaceOrder', 'src/application/PlaceOrder.ts', 'application'); g.edge('CONSTRUCTOR_INJECTS', s, g.iface('OrderRepository', 'src/domain/OrderRepository.ts', 'domain')); g.edge('IMPLEMENTS', s, g.iface('PlaceOrderPort', 'src/application/ports/PlaceOrderPort.ts', 'application')); g.method(s, 'execute'); g.edge('CONSTRUCTOR_INJECTS', g.cls('OrderController', 'src/adapters/inbound/OrderController.ts', 'adapters-inbound'), s); },
    expected: [],
  },

  // ── FF-P03 repository-pattern ──
  {
    id: 'ca-p03-repository-without-interface', style: 'clean-architecture', ruleId: 'FF-P03', kind: 'violating',
    why: 'infrastructure repositories (Repository, RepoImpl) that implement no interface; injecting an interface is not implementing one',
    build: (g) => { g.edge('CONSTRUCTOR_INJECTS', g.cls('SqlLoanRepository', CA.sqlRepo, 'infrastructure'), g.iface('Clock', CA.clock, 'application')); g.cls('BookRepoImpl', 'src/infrastructure/persistence/BookRepoImpl.ts', 'infrastructure'); },
    expected: ['src/infrastructure/persistence/BookRepoImpl.ts', CA.sqlRepo],
  },
  {
    id: 'ca-p03-repository-implements-interface', style: 'clean-architecture', ruleId: 'FF-P03', kind: 'clean',
    why: 'the infrastructure repository implements the domain interface',
    build: (g) => { g.edge('IMPLEMENTS', g.cls('SqlLoanRepository', CA.sqlRepo, 'infrastructure'), g.iface('LoanRepository', CA.loanRepoIf, 'domain')); },
    expected: [],
  },
  {
    id: 'ca-p03-name-near-miss', style: 'clean-architecture', ruleId: 'FF-P03', kind: 'near-miss',
    why: 'names just off the pattern (`LoanRepositoryFactory`, `LoanMapper`) are not repositories; an interface named like a repository is not an implementation',
    build: (g) => { g.cls('LoanRepositoryFactory', 'src/infrastructure/persistence/LoanRepositoryFactory.ts', 'infrastructure'); g.cls('LoanMapper', 'src/infrastructure/persistence/LoanMapper.ts', 'infrastructure'); g.iface('LoanReadRepository', 'src/infrastructure/persistence/LoanReadRepository.ts', 'infrastructure'); },
    expected: [],
  },
  {
    id: 'ca-p03-repository-outside-infrastructure', style: 'clean-architecture', ruleId: 'FF-P03', kind: 'near-miss', blindSpot: ['A6'],
    why: 'a repository-named class outside infrastructure that implements nothing: the rule is infrastructure-only',
    build: (g) => { g.cls('CachedLoanRepository', 'src/application/support/CachedLoanRepository.ts', 'application'); },
    expected: [],
  },
  {
    id: 'ca-p03-implements-abstract-class', style: 'clean-architecture', ruleId: 'FF-P03', kind: 'violating', blindSpot: ['A12'],
    why: 'TypeScript lets a class `implements` a class; the template asks for an Interface node, so implementing an abstract base class is a finding under the frozen text',
    build: (g) => { g.edge('IMPLEMENTS', g.cls('SqlLoanRepository', CA.sqlRepo, 'infrastructure'), g.cls('LoanRepositoryBase', 'src/infrastructure/persistence/LoanRepositoryBase.ts', 'infrastructure', { isAbstract: true })); },
    expected: [CA.sqlRepo],
  },
  {
    id: 'nestjs-p03-repository', style: 'nestjs', ruleId: 'FF-P03', kind: 'violating',
    why: 'nestjs: an infrastructure repository without interface is a finding, one with an interface is not',
    build: (g) => { g.cls('LoanRepository', 'src/persistence/loan.repository.ts', 'infrastructure'); g.edge('IMPLEMENTS', g.cls('BookRepository', 'src/persistence/book.repository.ts', 'infrastructure'), g.iface('IBookRepository', 'src/domain/book.repository.interface.ts', 'domain')); },
    expected: ['src/persistence/loan.repository.ts'],
  },

  // ── FF-P04 use-case-isolation ──
  {
    id: 'ca-p04-use-case-injects-infrastructure', style: 'clean-architecture', ruleId: 'FF-P04', kind: 'violating',
    why: 'use-case-role classes in the application layer injecting infrastructure classes',
    build: (g) => {
      const repo = g.cls('SqlLoanRepository', CA.sqlRepo, 'infrastructure');
      g.edge('CONSTRUCTOR_INJECTS', g.cls('BorrowBookUseCase', CA.borrow, 'application'), repo);
      g.edge('CONSTRUCTOR_INJECTS', g.cls('FineServiceImpl', 'src/application/services/FineServiceImpl.ts', 'application'), repo);
    },
    expected: [CA.borrow, 'src/application/services/FineServiceImpl.ts'].sort(),
  },
  {
    id: 'ca-p04-use-case-injects-inner', style: 'clean-architecture', ruleId: 'FF-P04', kind: 'clean',
    why: 'a use case injecting a domain interface and an application port',
    build: (g) => { const uc = g.cls('BorrowBookUseCase', CA.borrow, 'application'); g.edge('CONSTRUCTOR_INJECTS', uc, g.iface('LoanRepository', CA.loanRepoIf, 'domain')).edge('CONSTRUCTOR_INJECTS', uc, g.iface('Clock', CA.clock, 'application')); },
    expected: [],
  },
  {
    id: 'ca-p04-not-a-use-case', style: 'clean-architecture', ruleId: 'FF-P04', kind: 'near-miss',
    why: 'an application class without a use-case role suffix; a use case injecting an unmapped helper; a use case that extends an infrastructure base class (inheritance, not injection: FF-S01 business)',
    build: (g) => {
      g.edge('CONSTRUCTOR_INJECTS', g.cls('LoanAssembler', 'src/application/LoanAssembler.ts', 'application'), g.cls('SqlLoanRepository', CA.sqlRepo, 'infrastructure'));
      g.edge('CONSTRUCTOR_INJECTS', g.cls('ReturnBookUseCase', 'src/application/use-cases/ReturnBook.ts', 'application'), g.cls('Strings', CA.shared));
      g.edge('EXTENDS', g.cls('RenewLoanUseCase', 'src/application/use-cases/RenewLoan.ts', 'application'), g.cls('TransactionalBase', 'src/infrastructure/db/TransactionalBase.ts', 'infrastructure'));
    },
    expected: [],
  },
  {
    id: 'ca-p04-use-case-name-outside-application', style: 'clean-architecture', ruleId: 'FF-P04', kind: 'near-miss', blindSpot: ['A8'],
    why: 'an infrastructure class named like a use case (`ExpireLoansHandler`) that injects an infrastructure class is not a use case',
    build: (g) => { g.edge('CONSTRUCTOR_INJECTS', g.cls('ExpireLoansHandler', 'src/infrastructure/jobs/ExpireLoansHandler.ts', 'infrastructure'), g.cls('SqlLoanRepository', CA.sqlRepo, 'infrastructure')); },
    expected: [],
  },

  // ── FF-P05 controller-no-entity (frozen branch only; see the note in the test file) ──
  {
    id: 'ca-p05-controller-reaches-entity', style: 'clean-architecture', ruleId: 'FF-P05', kind: 'violating', compile: { signatureTypes: false },
    why: 'a controller injecting an entity directly, and one reaching an aggregate through one injected class (2 hops)',
    build: (g) => {
      const ent = g.cls('BookEntity', 'src/domain/entities/BookEntity.ts', 'domain');
      g.edge('CONSTRUCTOR_INJECTS', g.cls('BookController', 'src/infrastructure/http/BookController.ts', 'infrastructure'), ent);
      const facade = g.cls('LoanFacade', 'src/application/LoanFacade.ts', 'application');
      g.edge('CONSTRUCTOR_INJECTS', g.cls('LoanController', CA.ctrl, 'infrastructure'), facade).edge('CONSTRUCTOR_INJECTS', facade, g.cls('LoanAggregate', 'src/domain/entities/LoanAggregate.ts', 'domain'));
    },
    expected: ['src/infrastructure/http/BookController.ts', CA.ctrl].sort(),
  },
  {
    id: 'ca-p05-controller-uses-use-case', style: 'clean-architecture', ruleId: 'FF-P05', kind: 'clean', compile: { signatureTypes: false },
    why: 'a controller injecting a use case that works on a domain interface',
    build: (g) => { const uc = g.cls('BorrowBook', CA.borrow, 'application'); g.edge('CONSTRUCTOR_INJECTS', g.cls('LoanController', CA.ctrl, 'infrastructure'), uc).edge('CONSTRUCTOR_INJECTS', uc, g.iface('LoanRepository', CA.loanRepoIf, 'domain')); },
    expected: [],
  },
  {
    id: 'ca-p05-near-misses', style: 'clean-architecture', ruleId: 'FF-P05', kind: 'near-miss', compile: { signatureTypes: false },
    why: 'an entity 3 hops away (bound 2), a domain class without an entity role, an application class injecting an entity, an ORM entity outside the domain, a domain interface named like an aggregate, an entity held in a field without injection (the frozen branch reads IMPORTS and CONSTRUCTOR_INJECTS only)',
    build: (g) => {
      const a = g.cls('A', 'src/application/A.ts', 'application'); const b = g.cls('B', 'src/application/B.ts', 'application');
      g.edge('CONSTRUCTOR_INJECTS', g.cls('LoanController', CA.ctrl, 'infrastructure'), a).edge('CONSTRUCTOR_INJECTS', a, b).edge('CONSTRUCTOR_INJECTS', b, g.cls('FineEntity', 'src/domain/entities/FineEntity.ts', 'domain'));
      g.edge('CONSTRUCTOR_INJECTS', g.cls('BookController', 'src/infrastructure/http/BookController.ts', 'infrastructure'), g.cls('Book', CA.book, 'domain'));
      g.edge('CONSTRUCTOR_INJECTS', g.cls('BorrowBook', CA.borrow, 'application'), g.cls('MemberEntity', 'src/domain/entities/MemberEntity.ts', 'domain'));
      const fines = g.cls('FineController', 'src/infrastructure/http/FineController.ts', 'infrastructure');
      g.edge('CONSTRUCTOR_INJECTS', fines, g.cls('FineOrmEntity', 'src/infrastructure/persistence/FineOrmEntity.ts', 'infrastructure'));
      g.edge('CONSTRUCTOR_INJECTS', fines, g.iface('MemberAggregate', 'src/domain/entities/MemberAggregate.ts', 'domain'));
      g.edge('FLOWS_TO', fines, g.cls('LoanEntity', 'src/domain/entities/LoanEntity.ts', 'domain'), { field: 'draft', line: 9 });
    },
    expected: [],
  },

  // ── FF-P06 domain-state-purity ──
  {
    id: 'ca-p06-domain-holds-infrastructure', style: 'clean-architecture', ruleId: 'FF-P06', kind: 'violating',
    why: 'a domain class holding an infrastructure class in a field and one injecting an infrastructure interface',
    build: (g) => {
      g.edge('FLOWS_TO', g.cls('Book', CA.book, 'domain'), g.cls('SqlConnection', 'src/infrastructure/db/SqlConnection.ts', 'infrastructure'), { field: 'conn', line: 3 });
      g.edge('CONSTRUCTOR_INJECTS', g.cls('Money', CA.money, 'domain'), g.iface('RateClient', 'src/infrastructure/http/RateClient.ts', 'infrastructure'), { parameterName: 'rates', line: 4 });
    },
    expected: [`${CA.book} -> src/infrastructure/db/SqlConnection.ts`, `${CA.money} -> src/infrastructure/http/RateClient.ts`],
  },
  {
    id: 'ca-p06-domain-holds-domain', style: 'clean-architecture', ruleId: 'FF-P06', kind: 'clean',
    why: 'domain state of domain types only',
    build: (g) => { g.edge('FLOWS_TO', g.cls('Book', CA.book, 'domain'), g.cls('Money', CA.money, 'domain'), { field: 'price', line: 3 }); },
    expected: [],
  },
  {
    id: 'ca-p06-wrong-layer-pairs', style: 'clean-architecture', ruleId: 'FF-P06', kind: 'near-miss',
    why: 'an application class holding an infrastructure class; a domain class holding an application class',
    build: (g) => {
      g.edge('FLOWS_TO', g.cls('BorrowBook', CA.borrow, 'application'), g.cls('SqlConnection', 'src/infrastructure/db/SqlConnection.ts', 'infrastructure'), { field: 'conn', line: 3 });
      g.edge('FLOWS_TO', g.cls('Book', CA.book, 'domain'), g.cls('Clock', CA.clock, 'application'), { field: 'clock', line: 4 });
    },
    expected: [],
  },
  {
    id: 'ca-p06-extends-infrastructure-base', style: 'clean-architecture', ruleId: 'FF-P06', kind: 'near-miss', blindSpot: ['A14'],
    why: 'a domain class extending or implementing an infrastructure type is FF-S01/FF-S04 business, not state: no FF-P06 finding',
    build: (g) => {
      const book = g.cls('Book', CA.book, 'domain');
      g.edge('EXTENDS', book, g.cls('AuditedRecord', 'src/infrastructure/persistence/AuditedRecord.ts', 'infrastructure'));
      g.edge('IMPLEMENTS', book, g.iface('Persistable', 'src/infrastructure/persistence/Persistable.ts', 'infrastructure'));
    },
    expected: [],
  },
  {
    id: 'hex-p06-domain-holds-adapter', style: 'hexagonal', ruleId: 'FF-P06', kind: 'violating',
    why: 'hexagonal: the infrastructure layer is adapters-outbound; holding an inbound adapter is not this rule',
    build: (g) => {
      g.edge('FLOWS_TO', g.cls('Order', 'src/domain/Order.ts', 'domain'), g.cls('PgPool', 'src/adapters/outbound/PgPool.ts', 'adapters-outbound'), { field: 'pool', line: 2 });
      g.edge('FLOWS_TO', g.cls('Customer', 'src/domain/Customer.ts', 'domain'), g.cls('HttpCtx', 'src/adapters/inbound/HttpCtx.ts', 'adapters-inbound'), { field: 'ctx', line: 2 });
    },
    expected: ['src/domain/Order.ts -> src/adapters/outbound/PgPool.ts'],
  },

  // ── FF-S03 no-layer-skip (layered: presentation > business > persistence) ──
  {
    id: 'layered-s03-skip', style: 'layered', ruleId: 'FF-S03', kind: 'violating',
    why: 'presentation importing persistence skips business; persistence importing presentation is not an allowed transition either',
    build: (g) => { g.file('src/presentation/LoanController.ts', 'presentation'); g.file('src/persistence/LoanDao.ts', 'persistence'); g.imports('src/presentation/LoanController.ts', 'src/persistence/LoanDao.ts').imports('src/persistence/LoanDao.ts', 'src/presentation/LoanController.ts'); },
    expected: ['src/persistence/LoanDao.ts -> src/presentation/LoanController.ts (IMPORTS)', 'src/presentation/LoanController.ts -> src/persistence/LoanDao.ts (IMPORTS)'],
  },
  {
    id: 'layered-s03-reexport-skip', style: 'layered', ruleId: 'FF-S03', kind: 'violating', blindSpot: ['A5'],
    why: 'a presentation barrel re-exporting a persistence module skips business',
    build: (g) => { g.file('src/presentation/index.ts', 'presentation'); g.file('src/persistence/LoanDao.ts', 'persistence'); g.reExports('src/presentation/index.ts', 'src/persistence/LoanDao.ts'); },
    expected: ['src/presentation/index.ts -> src/persistence/LoanDao.ts (RE_EXPORTS)'],
  },
  {
    id: 'layered-s03-adjacent', style: 'layered', ruleId: 'FF-S03', kind: 'clean',
    why: 'presentation -> business -> persistence, same-layer and unmapped edges',
    build: (g) => {
      g.file('src/presentation/LoanController.ts', 'presentation'); g.file('src/business/LoanService.ts', 'business'); g.file('src/business/Fine.ts', 'business'); g.file('src/persistence/LoanDao.ts', 'persistence'); g.file('src/util.ts');
      g.imports('src/presentation/LoanController.ts', 'src/business/LoanService.ts').imports('src/business/LoanService.ts', 'src/persistence/LoanDao.ts').imports('src/business/LoanService.ts', 'src/business/Fine.ts').imports('src/persistence/LoanDao.ts', 'src/util.ts').imports('src/util.ts', 'src/presentation/LoanController.ts');
    },
    expected: [],
  },

  // ── hexagonal FF-S01 dependency-direction-graph / FF-S03 layer-skip-graph / FF-S04 core-isolation ──
  {
    id: 'hex-s01-reverse-of-allowed', style: 'hexagonal', ruleId: 'FF-S01', kind: 'violating',
    why: 'domain -> application and application -> adapters-inbound reverse an allowed dependency',
    build: (g) => { g.file('src/domain/Order.ts', 'domain'); g.file('src/application/PlaceOrder.ts', 'application'); g.file('src/adapters/inbound/OrderController.ts', 'adapters-inbound'); g.imports('src/domain/Order.ts', 'src/application/PlaceOrder.ts').imports('src/application/PlaceOrder.ts', 'src/adapters/inbound/OrderController.ts'); },
    expected: ['src/application/PlaceOrder.ts -> src/adapters/inbound/OrderController.ts (IMPORTS)', 'src/domain/Order.ts -> src/application/PlaceOrder.ts (IMPORTS)'],
  },
  {
    id: 'hex-s01-reexport', style: 'hexagonal', ruleId: 'FF-S01', kind: 'violating', blindSpot: ['A5'],
    why: 'a domain barrel re-exporting an outbound adapter reverses adapters-outbound > domain',
    build: (g) => { g.file('src/domain/index.ts', 'domain'); g.file('src/adapters/outbound/SmtpMailer.ts', 'adapters-outbound'); g.reExports('src/domain/index.ts', 'src/adapters/outbound/SmtpMailer.ts'); },
    expected: ['src/domain/index.ts -> src/adapters/outbound/SmtpMailer.ts (RE_EXPORTS)'],
  },
  {
    id: 'hex-s01-allowed-and-sideways', style: 'hexagonal', ruleId: 'FF-S01', kind: 'near-miss',
    why: 'allowed edges are clean; an adapter-to-adapter edge is allowed in neither direction, so it is FF-S03, not FF-S01',
    build: (g) => {
      g.file('src/domain/Order.ts', 'domain'); g.file('src/application/PlaceOrder.ts', 'application'); g.file('src/adapters/inbound/OrderController.ts', 'adapters-inbound'); g.file('src/adapters/outbound/PgOrderRepository.ts', 'adapters-outbound'); g.file('src/config/main.ts', 'config');
      g.imports('src/application/PlaceOrder.ts', 'src/domain/Order.ts').imports('src/adapters/inbound/OrderController.ts', 'src/application/PlaceOrder.ts').imports('src/config/main.ts', 'src/adapters/outbound/PgOrderRepository.ts').imports('src/adapters/inbound/OrderController.ts', 'src/adapters/outbound/PgOrderRepository.ts');
    },
    expected: [],
  },
  {
    id: 'hex-s03-adapter-to-adapter', style: 'hexagonal', ruleId: 'FF-S03', kind: 'violating',
    why: 'an inbound adapter importing an outbound adapter: allowed in neither direction',
    build: (g) => { g.file('src/adapters/inbound/OrderController.ts', 'adapters-inbound'); g.file('src/adapters/outbound/PgOrderRepository.ts', 'adapters-outbound'); g.imports('src/adapters/inbound/OrderController.ts', 'src/adapters/outbound/PgOrderRepository.ts'); },
    expected: ['src/adapters/inbound/OrderController.ts -> src/adapters/outbound/PgOrderRepository.ts (IMPORTS)'],
  },
  {
    id: 'hex-s03-reexport', style: 'hexagonal', ruleId: 'FF-S03', kind: 'violating', blindSpot: ['A5'],
    why: 'an inbound barrel re-exporting an outbound adapter',
    build: (g) => { g.file('src/adapters/inbound/index.ts', 'adapters-inbound'); g.file('src/adapters/outbound/SmtpMailer.ts', 'adapters-outbound'); g.reExports('src/adapters/inbound/index.ts', 'src/adapters/outbound/SmtpMailer.ts'); },
    expected: ['src/adapters/inbound/index.ts -> src/adapters/outbound/SmtpMailer.ts (RE_EXPORTS)'],
  },
  {
    id: 'hex-s03-allowed-or-reversed', style: 'hexagonal', ruleId: 'FF-S03', kind: 'near-miss',
    why: 'an allowed edge and its reverse (FF-S01 business), a same-layer edge and an unmapped file',
    build: (g) => {
      g.file('src/domain/Order.ts', 'domain'); g.file('src/domain/Money.ts', 'domain'); g.file('src/application/PlaceOrder.ts', 'application'); g.file('src/shared/ids.ts');
      g.imports('src/application/PlaceOrder.ts', 'src/domain/Order.ts').imports('src/domain/Order.ts', 'src/application/PlaceOrder.ts').imports('src/domain/Order.ts', 'src/domain/Money.ts').imports('src/domain/Order.ts', 'src/shared/ids.ts');
    },
    expected: [],
  },
  {
    id: 'hex-s04-core-outward', style: 'hexagonal', ruleId: 'FF-S04', kind: 'violating',
    why: 'the domain importing application and an adapter',
    build: (g) => { g.file('src/domain/Order.ts', 'domain'); g.file('src/application/PlaceOrder.ts', 'application'); g.file('src/adapters/outbound/PgPool.ts', 'adapters-outbound'); g.imports('src/domain/Order.ts', 'src/application/PlaceOrder.ts').imports('src/domain/Order.ts', 'src/adapters/outbound/PgPool.ts'); },
    expected: ['src/domain/Order.ts -> src/adapters/outbound/PgPool.ts (IMPORTS)', 'src/domain/Order.ts -> src/application/PlaceOrder.ts (IMPORTS)'],
  },
  {
    id: 'hex-s04-domain-barrel-reexports-adapter', style: 'hexagonal', ruleId: 'FF-S04', kind: 'violating', blindSpot: ['A5'],
    why: 'a domain barrel re-exporting an outbound adapter (`export { SmtpMailer } from ...`)',
    build: (g) => { g.file('src/domain/index.ts', 'domain'); g.file('src/adapters/outbound/SmtpMailer.ts', 'adapters-outbound'); g.reExports('src/domain/index.ts', 'src/adapters/outbound/SmtpMailer.ts'); },
    expected: ['src/domain/index.ts -> src/adapters/outbound/SmtpMailer.ts (RE_EXPORTS)'],
  },
  {
    id: 'hex-s04-not-from-core', style: 'hexagonal', ruleId: 'FF-S04', kind: 'near-miss',
    why: 'application -> adapter is not from the core; domain -> domain and domain -> unmapped are not outward',
    build: (g) => {
      g.file('src/domain/Order.ts', 'domain'); g.file('src/domain/Money.ts', 'domain'); g.file('src/application/PlaceOrder.ts', 'application'); g.file('src/adapters/outbound/PgPool.ts', 'adapters-outbound'); g.file('src/shared/ids.ts');
      g.imports('src/application/PlaceOrder.ts', 'src/adapters/outbound/PgPool.ts').imports('src/domain/Order.ts', 'src/domain/Money.ts').imports('src/domain/Order.ts', 'src/shared/ids.ts');
    },
    expected: [],
  },

  // ── hexagonal FF-P03 port-adapter-pattern ──
  {
    id: 'hex-p03-adapter-without-port', style: 'hexagonal', ruleId: 'FF-P03', kind: 'violating',
    why: 'outbound adapters (Adapter, Gateway, RepoImpl) implementing no port; one implementing an interface outside the port layers',
    build: (g) => {
      g.cls('SmtpNotificationAdapter', 'src/adapters/outbound/SmtpNotificationAdapter.ts', 'adapters-outbound');
      g.cls('StripePaymentGateway', 'src/adapters/outbound/StripePaymentGateway.ts', 'adapters-outbound');
      g.edge('IMPLEMENTS', g.cls('PgOrderRepoImpl', 'src/adapters/outbound/PgOrderRepoImpl.ts', 'adapters-outbound'), g.iface('Disposable', 'src/adapters/outbound/Disposable.ts', 'adapters-outbound'));
    },
    expected: ['src/adapters/outbound/PgOrderRepoImpl.ts', 'src/adapters/outbound/SmtpNotificationAdapter.ts', 'src/adapters/outbound/StripePaymentGateway.ts'],
  },
  {
    id: 'hex-p03-adapter-implements-port', style: 'hexagonal', ruleId: 'FF-P03', kind: 'clean',
    why: 'adapters implementing an application port and a domain port',
    build: (g) => {
      g.edge('IMPLEMENTS', g.cls('SmtpNotificationAdapter', 'src/adapters/outbound/SmtpNotificationAdapter.ts', 'adapters-outbound'), g.iface('NotificationPort', 'src/application/ports/NotificationPort.ts', 'application'));
      g.edge('IMPLEMENTS', g.cls('PgOrderRepository', 'src/adapters/outbound/PgOrderRepository.ts', 'adapters-outbound'), g.iface('OrderRepository', 'src/domain/OrderRepository.ts', 'domain'));
    },
    expected: [],
  },
  {
    id: 'hex-p03-adapter-name-outside-adapters', style: 'hexagonal', ruleId: 'FF-P03', kind: 'near-miss', blindSpot: ['A7'],
    why: 'an adapter-role name in the application layer, an outbound class without an adapter role, and an outbound interface named like a gateway implement nothing: no finding',
    build: (g) => { g.cls('LegacyPaymentGateway', 'src/application/services/LegacyPaymentGateway.ts', 'application'); g.cls('SmtpMailer', 'src/adapters/outbound/SmtpMailer.ts', 'adapters-outbound'); g.iface('StripeGateway', 'src/adapters/outbound/StripeGateway.ts', 'adapters-outbound'); },
    expected: [],
  },
  {
    id: 'hex-p03-injects-port-without-implementing', style: 'hexagonal', ruleId: 'FF-P03', kind: 'violating', blindSpot: ['A13'],
    why: 'an adapter that injects its port through the constructor but does not implement it',
    build: (g) => { g.edge('CONSTRUCTOR_INJECTS', g.cls('SmtpNotificationAdapter', 'src/adapters/outbound/SmtpNotificationAdapter.ts', 'adapters-outbound'), g.iface('NotificationPort', 'src/application/ports/NotificationPort.ts', 'application')); },
    expected: ['src/adapters/outbound/SmtpNotificationAdapter.ts'],
  },
  {
    id: 'hex-p03-implements-abstract-port', style: 'hexagonal', ruleId: 'FF-P03', kind: 'violating', blindSpot: ['A12'],
    why: 'an adapter implementing an abstract class in a port layer: the template asks for an Interface, so this is a finding under the frozen text',
    build: (g) => { g.edge('IMPLEMENTS', g.cls('PgOrderRepository', 'src/adapters/outbound/PgOrderRepository.ts', 'adapters-outbound'), g.cls('OrderRepositoryBase', 'src/domain/OrderRepositoryBase.ts', 'domain', { isAbstract: true })); },
    expected: ['src/adapters/outbound/PgOrderRepository.ts'],
  },

  // ── DDD (presets/ddd.yaml: contexts ordering and billing) ──
  {
    id: 'ddd-ds01-module-outside-context', style: 'ddd', ruleId: 'FF-DS01', kind: 'violating',
    why: 'an undeclared top-level module under src/',
    build: (g) => { g.file('src/utils/strings.ts'); g.method(g.cls('Strings', 'src/utils/strings.ts'), 'pad'); g.file('src/ordering/domain/order/Order.ts', 'domain'); },
    expected: ['src/utils/strings.ts'],
  },
  {
    id: 'ddd-ds01-declared-modules', style: 'ddd', ruleId: 'FF-DS01', kind: 'clean',
    why: 'files in a context, the shared kernel and the composition root',
    build: (g) => { g.file('src/ordering/domain/order/Order.ts', 'domain'); g.file('src/billing/application/IssueInvoice.ts', 'application'); g.file('src/shared-kernel/Money.ts'); g.file('src/main.ts', 'composition'); },
    expected: [],
  },
  {
    id: 'ddd-ds01-outside-source-root', style: 'ddd', ruleId: 'FF-DS01', kind: 'near-miss',
    why: 'files outside the source root (`scripts/`, `test/`) and a file whose name only starts like a context root',
    build: (g) => { g.file('scripts/seed.ts'); g.file('test/helpers.ts'); g.file('src/main.tsx'); },
    expected: ['src/main.tsx'],
  },
  {
    id: 'ddd-ds02-internal-cross-context', style: 'ddd', ruleId: 'FF-DS02', kind: 'violating',
    why: 'billing importing ordering internals, by import and by re-export',
    build: (g) => {
      g.file('src/billing/application/IssueInvoice.ts', 'application'); g.file('src/billing/index.ts'); g.file('src/ordering/domain/order/Order.ts', 'domain');
      g.imports('src/billing/application/IssueInvoice.ts', 'src/ordering/domain/order/Order.ts').reExports('src/billing/index.ts', 'src/ordering/domain/order/Order.ts');
    },
    expected: ['src/billing/application/IssueInvoice.ts -> src/ordering/domain/order/Order.ts (IMPORTS)', 'src/billing/index.ts -> src/ordering/domain/order/Order.ts (RE_EXPORTS)'],
  },
  {
    id: 'ddd-ds02-public-api', style: 'ddd', ruleId: 'FF-DS02', kind: 'clean',
    why: 'cross-context imports through the public API (index.ts, contracts/), intra-context imports, shared kernel',
    build: (g) => {
      g.file('src/billing/application/IssueInvoice.ts', 'application'); g.file('src/ordering/index.ts'); g.file('src/ordering/contracts/OrderSummary.ts'); g.file('src/billing/domain/invoice/Invoice.ts', 'domain'); g.file('src/shared-kernel/Money.ts');
      g.imports('src/billing/application/IssueInvoice.ts', 'src/ordering/index.ts').imports('src/billing/application/IssueInvoice.ts', 'src/ordering/contracts/OrderSummary.ts').imports('src/billing/application/IssueInvoice.ts', 'src/billing/domain/invoice/Invoice.ts').imports('src/billing/domain/invoice/Invoice.ts', 'src/shared-kernel/Money.ts');
    },
    expected: [],
  },
  {
    id: 'ddd-ds02-acl-and-outside-contexts', style: 'ddd', ruleId: 'FF-DS02', kind: 'near-miss',
    why: 'the anti-corruption layer may read ordering internals; the composition root belongs to no context; the resolved twin of a barrel import is not read',
    build: (g) => {
      g.file('src/billing/acl/OrderingAcl.ts', 'infrastructure'); g.file('src/ordering/domain/order/OrderId.ts', 'domain'); g.file('src/main.ts', 'composition'); g.file('src/billing/application/IssueInvoice.ts', 'application');
      g.imports('src/billing/acl/OrderingAcl.ts', 'src/ordering/domain/order/OrderId.ts').imports('src/main.ts', 'src/ordering/domain/order/OrderId.ts').imports('src/billing/application/IssueInvoice.ts', 'src/ordering/domain/order/OrderId.ts', { viaReExport: true });
    },
    expected: [],
  },
  {
    id: 'ddd-dt01-inner-entity-from-outside', style: 'ddd', ruleId: 'FF-DT01', kind: 'violating',
    why: 'an application service naming the inner entity OrderLine; a barrel re-exporting it',
    build: (g) => {
      g.file('src/ordering/application/PlaceOrder.ts', 'application'); g.file('src/ordering/index.ts'); g.file('src/ordering/domain/order/OrderLine.ts', 'domain');
      g.imports('src/ordering/application/PlaceOrder.ts', 'src/ordering/domain/order/OrderLine.ts').reExports('src/ordering/index.ts', 'src/ordering/domain/order/OrderLine.ts');
    },
    expected: ['src/ordering/application/PlaceOrder.ts -> src/ordering/domain/order/OrderLine.ts (IMPORTS)', 'src/ordering/index.ts -> src/ordering/domain/order/OrderLine.ts (RE_EXPORTS)'],
  },
  {
    id: 'ddd-dt01-through-root', style: 'ddd', ruleId: 'FF-DT01', kind: 'clean',
    why: 'the root uses its inner entity; outsiders use the root',
    build: (g) => {
      g.file('src/ordering/application/PlaceOrder.ts', 'application'); g.file('src/ordering/domain/order/Order.ts', 'domain'); g.file('src/ordering/domain/order/OrderLine.ts', 'domain');
      g.imports('src/ordering/domain/order/Order.ts', 'src/ordering/domain/order/OrderLine.ts').imports('src/ordering/application/PlaceOrder.ts', 'src/ordering/domain/order/Order.ts');
    },
    expected: [],
  },
  {
    id: 'ddd-dt01-resolved-view', style: 'ddd', ruleId: 'FF-DT01', kind: 'near-miss',
    why: 'resolved view: a barrel hop (reExportHop) to the inner entity is not read; the resolved edge (viaReExport) is',
    build: (g) => {
      g.file('src/billing/application/IssueInvoice.ts', 'application'); g.file('src/billing/api/InvoiceController.ts', 'api'); g.file('src/billing/domain/invoice/InvoiceLine.ts', 'domain');
      g.imports('src/billing/application/IssueInvoice.ts', 'src/billing/domain/invoice/InvoiceLine.ts', { reExportHop: true }).imports('src/billing/api/InvoiceController.ts', 'src/billing/domain/invoice/InvoiceLine.ts', { viaReExport: true });
    },
    expected: ['src/billing/api/InvoiceController.ts -> src/billing/domain/invoice/InvoiceLine.ts (IMPORTS)'],
  },
  {
    id: 'ddd-dt02-repository-for-inner-entity', style: 'ddd', ruleId: 'FF-DT02', kind: 'violating',
    why: 'a domain repository importing the inner entity, and an infrastructure repository re-exporting it',
    build: (g) => {
      g.file('src/ordering/domain/order/OrderLineRepository.ts', 'domain'); g.file('src/ordering/infrastructure/InMemoryOrderLineRepository.ts', 'infrastructure'); g.file('src/ordering/domain/order/OrderLine.ts', 'domain');
      g.imports('src/ordering/domain/order/OrderLineRepository.ts', 'src/ordering/domain/order/OrderLine.ts').reExports('src/ordering/infrastructure/InMemoryOrderLineRepository.ts', 'src/ordering/domain/order/OrderLine.ts');
    },
    expected: ['src/ordering/domain/order/OrderLineRepository.ts -> src/ordering/domain/order/OrderLine.ts (IMPORTS)', 'src/ordering/infrastructure/InMemoryOrderLineRepository.ts -> src/ordering/domain/order/OrderLine.ts (RE_EXPORTS)'],
  },
  {
    id: 'ddd-dt02-reexport-only', style: 'ddd', ruleId: 'FF-DT02', kind: 'violating', blindSpot: ['A5'],
    why: 'a repository whose only edge to the inner entity is a re-export',
    build: (g) => { g.file('src/billing/domain/invoice/InvoiceLineRepository.ts', 'domain'); g.file('src/billing/domain/invoice/InvoiceLine.ts', 'domain'); g.reExports('src/billing/domain/invoice/InvoiceLineRepository.ts', 'src/billing/domain/invoice/InvoiceLine.ts'); },
    expected: ['src/billing/domain/invoice/InvoiceLineRepository.ts -> src/billing/domain/invoice/InvoiceLine.ts (RE_EXPORTS)'],
  },
  {
    id: 'ddd-dt02-root-repository', style: 'ddd', ruleId: 'FF-DT02', kind: 'clean',
    why: 'repositories import aggregate roots only',
    build: (g) => { g.file('src/ordering/domain/order/OrderRepository.ts', 'domain'); g.file('src/ordering/domain/order/Order.ts', 'domain'); g.imports('src/ordering/domain/order/OrderRepository.ts', 'src/ordering/domain/order/Order.ts'); },
    expected: [],
  },
  {
    id: 'ddd-dt02-non-repository-imports-inner', style: 'ddd', ruleId: 'FF-DT02', kind: 'near-miss',
    why: 'a non-repository file importing the inner entity is FF-DT01 business, and so is a repository-named file in the application layer',
    build: (g) => {
      g.file('src/ordering/application/PlaceOrder.ts', 'application'); g.file('src/ordering/application/OrderLineRepository.ts', 'application'); g.file('src/ordering/domain/order/OrderLine.ts', 'domain');
      g.imports('src/ordering/application/PlaceOrder.ts', 'src/ordering/domain/order/OrderLine.ts').imports('src/ordering/application/OrderLineRepository.ts', 'src/ordering/domain/order/OrderLine.ts');
    },
    expected: [],
  },
  {
    id: 'ddd-dt03-mutable-value-objects', style: 'ddd', ruleId: 'FF-DT03', kind: 'violating',
    why: 'a public mutable field, a set accessor, a mutator method',
    build: (g) => {
      g.cls('Quantity', 'src/ordering/domain/value-objects/Quantity.ts', 'domain', { publicFields: ['value'], readonlyFields: [], staticFields: [] });
      g.cls('OrderId', 'src/ordering/domain/value-objects/OrderId.ts', 'domain', { setAccessors: ['raw'] });
      g.cls('CustomerId', 'src/ordering/domain/value-objects/CustomerId.ts', 'domain', { mutatorMethods: ['setValue'] });
    },
    expected: ['src/ordering/domain/value-objects/CustomerId.ts', 'src/ordering/domain/value-objects/OrderId.ts', 'src/ordering/domain/value-objects/Quantity.ts'],
  },
  {
    id: 'ddd-dt03-immutable-value-object', style: 'ddd', ruleId: 'FF-DT03', kind: 'clean',
    why: 'public readonly fields only',
    build: (g) => { g.cls('Quantity', 'src/ordering/domain/value-objects/Quantity.ts', 'domain', { publicFields: ['value'], readonlyFields: ['value'], staticFields: [] }); },
    expected: [],
  },
  {
    id: 'ddd-dt03-static-fields', style: 'ddd', ruleId: 'FF-DT03', kind: 'near-miss', blindSpot: ['A9'],
    why: 'public static fields (readonly and not) are not instance state',
    build: (g) => { g.cls('Money', 'src/billing/domain/value-objects/Money.ts', 'domain', { publicFields: ['amount', 'ZERO_CURRENCY', 'precision'], readonlyFields: ['amount', 'ZERO_CURRENCY'], staticFields: ['ZERO_CURRENCY', 'precision'] }); },
    expected: [],
  },
  {
    id: 'ddd-dt03-mutable-outside-value-objects', style: 'ddd', ruleId: 'FF-DT03', kind: 'near-miss',
    why: 'an entity with a mutable field is not a value object',
    build: (g) => { g.cls('Order', 'src/ordering/domain/order/Order.ts', 'domain', { publicFields: ['status'], readonlyFields: [], mutatorMethods: ['cancel'] }); },
    expected: [],
  },
  {
    id: 'ddd-dt05-event-outside-domain', style: 'ddd', ruleId: 'FF-DT05', kind: 'violating',
    why: 'an event implementing DomainEvent in the application layer, and one in an unmapped file',
    build: (g) => {
      const de = g.iface('DomainEvent', 'src/shared-kernel/DomainEvent.ts');
      g.edge('IMPLEMENTS', g.cls('InvoiceIssued', 'src/billing/application/events/InvoiceIssued.ts', 'application'), de);
      g.edge('IMPLEMENTS', g.cls('OrderShipped', 'src/ordering/events/OrderShipped.ts'), de);
    },
    expected: ['src/billing/application/events/InvoiceIssued.ts', 'src/ordering/events/OrderShipped.ts'],
  },
  {
    id: 'ddd-dt05-event-in-domain', style: 'ddd', ruleId: 'FF-DT05', kind: 'clean',
    why: 'events in the domain layer; an application class implementing another interface',
    build: (g) => {
      const de = g.iface('DomainEvent', 'src/shared-kernel/DomainEvent.ts');
      g.edge('IMPLEMENTS', g.cls('OrderPlaced', 'src/ordering/domain/events/OrderPlaced.ts', 'domain'), de);
      g.edge('IMPLEMENTS', g.cls('InvoiceIssuedDto', 'src/billing/application/InvoiceIssuedDto.ts', 'application'), g.iface('IntegrationEvent', 'src/shared-kernel/IntegrationEvent.ts'));
    },
    expected: [],
  },
  {
    id: 'ddd-dt05-event-by-inheritance', style: 'ddd', ruleId: 'FF-DT05', kind: 'violating', blindSpot: ['A10'],
    why: 'events reaching DomainEvent by inheritance: one EXTENDS hop, a chain of three, and a class with two paths (extends and implements) reported once',
    build: (g) => {
      const de = g.iface('DomainEvent', 'src/shared-kernel/DomainEvent.ts');
      const issued = g.cls('InvoiceIssued', 'src/billing/domain/events/InvoiceIssued.ts', 'domain');
      g.edge('IMPLEMENTS', issued, de);
      const reissued = g.cls('InvoiceReissued', 'src/billing/application/events/InvoiceReissued.ts', 'application');
      g.edge('EXTENDS', reissued, issued);
      g.edge('EXTENDS', g.cls('InvoiceReissuedTwice', 'src/billing/application/events/InvoiceReissuedTwice.ts', 'application'), reissued);
      const both = g.cls('InvoiceCorrected', 'src/billing/application/events/InvoiceCorrected.ts', 'application');
      g.edge('EXTENDS', both, issued).edge('IMPLEMENTS', both, de);
    },
    expected: ['src/billing/application/events/InvoiceCorrected.ts', 'src/billing/application/events/InvoiceReissued.ts', 'src/billing/application/events/InvoiceReissuedTwice.ts'],
  },
  {
    id: 'ddd-dt06-fat-service', style: 'ddd', ruleId: 'FF-DT06', kind: 'violating',
    why: 'an application service with 4 methods (threshold 3)',
    build: (g) => { const c = g.cls('IssueInvoice', 'src/billing/application/IssueInvoice.ts', 'application'); ['execute', 'discount', 'taxExempt', 'round'].forEach((m) => g.method(c, m)); },
    expected: ['src/billing/application/IssueInvoice.ts'],
  },
  {
    id: 'ddd-dt06-thin-service', style: 'ddd', ruleId: 'FF-DT06', kind: 'clean',
    why: 'exactly 3 methods is at the threshold, not above it',
    build: (g) => { const c = g.cls('IssueInvoice', 'src/billing/application/IssueInvoice.ts', 'application'); ['execute', 'validate', 'toDto'].forEach((m) => g.method(c, m)); },
    expected: [],
  },
  {
    id: 'ddd-dt06-fat-class-elsewhere', style: 'ddd', ruleId: 'FF-DT06', kind: 'near-miss',
    why: 'fat classes outside the service pattern (a nested application directory, the domain) and an application interface with 5 method signatures',
    build: (g) => {
      const p = g.iface('InvoicePort', 'src/billing/application/InvoicePort.ts', 'application'); ['a', 'b', 'c', 'd', 'e'].forEach((m) => g.method(p, m));
      const a = g.cls('InvoiceMapper', 'src/billing/application/mappers/InvoiceMapper.ts', 'application'); ['a', 'b', 'c', 'd', 'e'].forEach((m) => g.method(a, m));
      const b = g.cls('Invoice', 'src/billing/domain/invoice/Invoice.ts', 'domain'); ['a', 'b', 'c', 'd', 'e'].forEach((m) => g.method(b, m));
    },
    expected: [],
  },
  {
    id: 'ddd-s01-domain-imports-application', style: 'ddd', ruleId: 'FF-S01', kind: 'violating',
    why: 'DDD layering: the domain importing its application layer reverses application > domain',
    build: (g) => { g.file('src/ordering/domain/customer/Customer.ts', 'domain'); g.file('src/ordering/application/GetOrderSummary.ts', 'application'); g.imports('src/ordering/domain/customer/Customer.ts', 'src/ordering/application/GetOrderSummary.ts').imports('src/ordering/application/GetOrderSummary.ts', 'src/ordering/domain/customer/Customer.ts'); },
    expected: ['src/ordering/domain/customer/Customer.ts -> src/ordering/application/GetOrderSummary.ts (IMPORTS)'],
  },
  {
    id: 'ddd-s03-api-imports-infrastructure', style: 'ddd', ruleId: 'FF-S03', kind: 'violating',
    why: 'the API layer importing infrastructure is allowed in neither direction; api -> application is allowed',
    build: (g) => { g.file('src/ordering/api/OrderController.ts', 'api'); g.file('src/ordering/infrastructure/InMemoryOrderRepository.ts', 'infrastructure'); g.file('src/ordering/application/PlaceOrder.ts', 'application'); g.imports('src/ordering/api/OrderController.ts', 'src/ordering/infrastructure/InMemoryOrderRepository.ts').imports('src/ordering/api/OrderController.ts', 'src/ordering/application/PlaceOrder.ts'); },
    expected: ['src/ordering/api/OrderController.ts -> src/ordering/infrastructure/InMemoryOrderRepository.ts (IMPORTS)'],
  },
  // ── Clean and near-miss cases for the remaining (style, rule) pairs ──
  {
    id: 'nestjs-s01-inward', style: 'nestjs', ruleId: 'FF-S01', kind: 'clean',
    why: 'controller -> service -> repository -> entity follows the nestjs order',
    build: (g) => {
      g.file('src/controllers/loan.controller.ts', 'presentation'); g.file('src/services/loan.service.ts', 'application'); g.file('src/persistence/loan.repository.ts', 'infrastructure'); g.file('src/entities/loan.entity.ts', 'domain');
      g.imports('src/controllers/loan.controller.ts', 'src/services/loan.service.ts').imports('src/services/loan.service.ts', 'src/persistence/loan.repository.ts').imports('src/persistence/loan.repository.ts', 'src/entities/loan.entity.ts');
    },
    expected: [],
  },
  {
    id: 'nestjs-s01-unmapped-and-same-layer', style: 'nestjs', ruleId: 'FF-S01', kind: 'near-miss',
    why: 'an entity importing another entity and an unmapped helper',
    build: (g) => { g.file('src/entities/loan.entity.ts', 'domain'); g.file('src/entities/book.entity.ts', 'domain'); g.file('src/config.ts'); g.imports('src/entities/loan.entity.ts', 'src/entities/book.entity.ts').imports('src/entities/loan.entity.ts', 'src/config.ts'); },
    expected: [],
  },
  {
    id: 'layered-s01-downward', style: 'layered', ruleId: 'FF-S01', kind: 'clean',
    why: 'presentation -> business -> persistence',
    build: (g) => { g.file('src/presentation/LoanController.ts', 'presentation'); g.file('src/business/LoanService.ts', 'business'); g.file('src/persistence/LoanDao.ts', 'persistence'); g.imports('src/presentation/LoanController.ts', 'src/business/LoanService.ts').imports('src/business/LoanService.ts', 'src/persistence/LoanDao.ts'); },
    expected: [],
  },
  {
    id: 'layered-s01-skip-downward', style: 'layered', ruleId: 'FF-S01', kind: 'near-miss',
    why: 'presentation -> persistence skips a layer but points inward: FF-S03 business, not FF-S01',
    build: (g) => { g.file('src/presentation/LoanController.ts', 'presentation'); g.file('src/persistence/LoanDao.ts', 'persistence'); g.imports('src/presentation/LoanController.ts', 'src/persistence/LoanDao.ts'); },
    expected: [],
  },
  {
    id: 'layered-s02-acyclic-chain', style: 'layered', ruleId: 'FF-S02', kind: 'clean',
    why: 'a 10-file chain that is not closed',
    build: (g) => { const f = chain('src/business/model', 10); f.forEach((x) => g.file(x, 'business')); f.slice(1).forEach((x, i) => g.imports(f[i] ?? x, x)); },
    expected: [],
  },
  {
    id: 'nestjs-s02-cycle-across-layers', style: 'nestjs', ruleId: 'FF-S02', kind: 'violating',
    why: 'a service and a repository importing each other',
    build: (g) => { g.file('src/services/loan.service.ts', 'application'); g.file('src/persistence/loan.repository.ts', 'infrastructure'); g.imports('src/services/loan.service.ts', 'src/persistence/loan.repository.ts').imports('src/persistence/loan.repository.ts', 'src/services/loan.service.ts'); },
    expected: [cycle('src/persistence/loan.repository.ts', 'src/services/loan.service.ts')],
  },
  {
    id: 'nestjs-s02-no-cycle', style: 'nestjs', ruleId: 'FF-S02', kind: 'clean',
    why: 'one-way imports',
    build: (g) => { g.file('src/services/loan.service.ts', 'application'); g.file('src/persistence/loan.repository.ts', 'infrastructure'); g.imports('src/services/loan.service.ts', 'src/persistence/loan.repository.ts'); },
    expected: [],
  },
  {
    id: 'ca-s04-inward', style: 'clean-architecture', ruleId: 'FF-S04', kind: 'clean',
    why: 'the domain imports only the domain; outer layers import it',
    build: (g) => { g.file(CA.book, 'domain'); g.file(CA.money, 'domain'); g.file(CA.borrow, 'application'); g.imports(CA.book, CA.money).imports(CA.borrow, CA.book); },
    expected: [],
  },
  {
    id: 'hex-p01-clean-domain', style: 'hexagonal', ruleId: 'FF-P01', kind: 'clean',
    why: 'the domain imports a utility package only',
    build: (g) => { g.file('src/domain/Order.ts', 'domain'); g.imports('src/domain/Order.ts', g.pkg('uuid')); },
    expected: [],
  },
  {
    id: 'hex-p01-framework-in-application', style: 'hexagonal', ruleId: 'FF-P01', kind: 'near-miss',
    why: 'the application layer importing a framework is not domain purity',
    build: (g) => { g.file('src/application/PlaceOrder.ts', 'application'); g.imports('src/application/PlaceOrder.ts', g.pkg('@nestjs/common')); },
    expected: [],
  },
  {
    id: 'ddd-dt04-clean-domain', style: 'ddd', ruleId: 'FF-DT04', kind: 'clean',
    why: 'the domain imports the shared kernel and a utility package',
    build: (g) => { g.file('src/billing/domain/invoice/Invoice.ts', 'domain'); g.file('src/shared-kernel/Money.ts'); g.imports('src/billing/domain/invoice/Invoice.ts', 'src/shared-kernel/Money.ts').imports('src/billing/domain/invoice/Invoice.ts', g.pkg('decimal.js')); },
    expected: [],
  },
  {
    id: 'ddd-dt04-framework-outside-domain', style: 'ddd', ruleId: 'FF-DT04', kind: 'near-miss',
    why: 'infrastructure importing mongoose, and the domain importing `class-validator-extra` (not a listed package)',
    build: (g) => { g.file('src/ordering/infrastructure/MongoOrderRepository.ts', 'infrastructure'); g.file('src/ordering/domain/order/Order.ts', 'domain'); g.imports('src/ordering/infrastructure/MongoOrderRepository.ts', g.pkg('mongoose')).imports('src/ordering/domain/order/Order.ts', g.pkg('class-validator-extra')); },
    expected: [],
  },
  {
    id: 'hex-p02-just-above-threshold', style: 'hexagonal', ruleId: 'FF-P02', kind: 'near-miss',
    why: '6 ports of 7 dependencies passes; an outbound adapter injecting a concrete class is out of scope',
    build: (g) => {
      const s = g.cls('PlaceOrder', 'src/application/PlaceOrder.ts', 'application');
      for (let i = 0; i < 6; i += 1) g.edge('CONSTRUCTOR_INJECTS', s, g.iface(`Port${String(i)}`, `src/application/ports/Port${String(i)}.ts`, 'application'));
      g.edge('CONSTRUCTOR_INJECTS', s, g.cls('OrderPolicy', 'src/domain/OrderPolicy.ts', 'domain'));
      g.edge('CONSTRUCTOR_INJECTS', g.cls('PgOrderRepository', 'src/adapters/outbound/PgOrderRepository.ts', 'adapters-outbound'), g.cls('PgPool', 'src/adapters/outbound/PgPool.ts', 'adapters-outbound'));
    },
    expected: [],
  },
  {
    id: 'nestjs-p03-implements', style: 'nestjs', ruleId: 'FF-P03', kind: 'clean',
    why: 'the repository implements its domain interface',
    build: (g) => { g.edge('IMPLEMENTS', g.cls('BookRepository', 'src/persistence/book.repository.ts', 'infrastructure'), g.iface('IBookRepository', 'src/domain/book.repository.interface.ts', 'domain')); },
    expected: [],
  },
  {
    id: 'nestjs-p03-service-named-repository', style: 'nestjs', ruleId: 'FF-P03', kind: 'near-miss',
    why: 'a repository-named class in the application layer is out of scope',
    build: (g) => { g.cls('CachedBookRepository', 'src/services/cached-book.repository-cache.ts', 'application'); },
    expected: [],
  },
  {
    id: 'hex-p06-domain-holds-domain', style: 'hexagonal', ruleId: 'FF-P06', kind: 'clean',
    why: 'domain state of domain types; a domain class injecting a port',
    build: (g) => { const o = g.cls('Order', 'src/domain/Order.ts', 'domain'); g.edge('FLOWS_TO', o, g.cls('Money', 'src/domain/Money.ts', 'domain'), { field: 'total', line: 2 }).edge('CONSTRUCTOR_INJECTS', o, g.iface('Clock', 'src/domain/Clock.ts', 'domain'), { parameterName: 'clock', line: 3 }); },
    expected: [],
  },
  {
    id: 'hex-p06-application-holds-adapter', style: 'hexagonal', ruleId: 'FF-P06', kind: 'near-miss',
    why: 'an application class holding an outbound adapter is FF-P02 business, not domain state',
    build: (g) => { g.edge('FLOWS_TO', g.cls('PlaceOrder', 'src/application/PlaceOrder.ts', 'application'), g.cls('PgPool', 'src/adapters/outbound/PgPool.ts', 'adapters-outbound'), { field: 'pool', line: 2 }); },
    expected: [],
  },
  {
    id: 'layered-s03-reversed-adjacent', style: 'layered', ruleId: 'FF-S03', kind: 'near-miss',
    why: 'persistence -> business and business -> presentation are not allowed transitions: the template reports them (it lists allowed transitions, not skips)',
    build: (g) => { g.file('src/persistence/LoanDao.ts', 'persistence'); g.file('src/business/LoanService.ts', 'business'); g.file('src/presentation/LoanView.ts', 'presentation'); g.imports('src/persistence/LoanDao.ts', 'src/business/LoanService.ts').imports('src/business/LoanService.ts', 'src/presentation/LoanView.ts'); },
    expected: ['src/business/LoanService.ts -> src/presentation/LoanView.ts (IMPORTS)', 'src/persistence/LoanDao.ts -> src/business/LoanService.ts (IMPORTS)'],
  },
  {
    id: 'hex-s01-allowed', style: 'hexagonal', ruleId: 'FF-S01', kind: 'clean',
    why: 'adapters and application importing inward, config wiring everything',
    build: (g) => { g.file('src/domain/Order.ts', 'domain'); g.file('src/adapters/outbound/PgOrderRepository.ts', 'adapters-outbound'); g.file('src/config/main.ts', 'config'); g.imports('src/adapters/outbound/PgOrderRepository.ts', 'src/domain/Order.ts').imports('src/config/main.ts', 'src/domain/Order.ts'); },
    expected: [],
  },
  {
    id: 'hex-s03-allowed', style: 'hexagonal', ruleId: 'FF-S03', kind: 'clean',
    why: 'inbound adapter -> application -> domain',
    build: (g) => { g.file('src/adapters/inbound/OrderController.ts', 'adapters-inbound'); g.file('src/application/PlaceOrder.ts', 'application'); g.file('src/domain/Order.ts', 'domain'); g.imports('src/adapters/inbound/OrderController.ts', 'src/application/PlaceOrder.ts').imports('src/application/PlaceOrder.ts', 'src/domain/Order.ts'); },
    expected: [],
  },
  {
    id: 'hex-s04-core-inward', style: 'hexagonal', ruleId: 'FF-S04', kind: 'clean',
    why: 'the core imports itself only',
    build: (g) => { g.file('src/domain/Order.ts', 'domain'); g.file('src/domain/Money.ts', 'domain'); g.file('src/application/PlaceOrder.ts', 'application'); g.imports('src/domain/Order.ts', 'src/domain/Money.ts').imports('src/application/PlaceOrder.ts', 'src/domain/Order.ts'); },
    expected: [],
  },
  {
    id: 'ddd-dt05-other-event-type', style: 'ddd', ruleId: 'FF-DT05', kind: 'near-miss',
    why: 'an application class implementing IntegrationEvent (not DomainEvent); an application interface extending DomainEvent is an event type, not an event class; an application service that creates a domain event (FLOWS_TO) is not an event',
    build: (g) => {
      g.edge('IMPLEMENTS', g.cls('InvoiceSent', 'src/billing/application/InvoiceSent.ts', 'application'), g.iface('IntegrationEvent', 'src/shared-kernel/IntegrationEvent.ts'));
      g.edge('EXTENDS', g.iface('BillingEvent', 'src/billing/application/BillingEvent.ts', 'application'), g.iface('DomainEvent', 'src/shared-kernel/DomainEvent.ts'));
      const issued = g.cls('InvoiceIssued', 'src/billing/domain/events/InvoiceIssued.ts', 'domain');
      g.edge('IMPLEMENTS', issued, g.iface('DomainEvent', 'src/shared-kernel/DomainEvent.ts'));
      g.edge('FLOWS_TO', g.cls('IssueInvoice', 'src/billing/application/IssueInvoice.ts', 'application'), issued, { field: 'pending', line: 12 });
    },
    expected: [],
  },
  {
    id: 'ddd-s01-inward', style: 'ddd', ruleId: 'FF-S01', kind: 'clean',
    why: 'application -> domain, infrastructure -> application, composition -> api',
    build: (g) => {
      g.file('src/ordering/domain/order/Order.ts', 'domain'); g.file('src/ordering/application/PlaceOrder.ts', 'application'); g.file('src/ordering/infrastructure/InMemoryOrderRepository.ts', 'infrastructure'); g.file('src/ordering/api/OrderController.ts', 'api'); g.file('src/main.ts', 'composition');
      g.imports('src/ordering/application/PlaceOrder.ts', 'src/ordering/domain/order/Order.ts').imports('src/ordering/infrastructure/InMemoryOrderRepository.ts', 'src/ordering/application/PlaceOrder.ts').imports('src/main.ts', 'src/ordering/api/OrderController.ts');
    },
    expected: [],
  },
  {
    id: 'ddd-s01-sideways', style: 'ddd', ruleId: 'FF-S01', kind: 'near-miss',
    why: 'api -> infrastructure is allowed in neither direction: FF-S03 business, not FF-S01',
    build: (g) => { g.file('src/ordering/api/OrderController.ts', 'api'); g.file('src/ordering/infrastructure/InMemoryOrderRepository.ts', 'infrastructure'); g.imports('src/ordering/api/OrderController.ts', 'src/ordering/infrastructure/InMemoryOrderRepository.ts'); },
    expected: [],
  },
  {
    id: 'ddd-s03-allowed', style: 'ddd', ruleId: 'FF-S03', kind: 'clean',
    why: 'api -> application -> domain',
    build: (g) => { g.file('src/ordering/api/OrderController.ts', 'api'); g.file('src/ordering/application/PlaceOrder.ts', 'application'); g.file('src/ordering/domain/order/Order.ts', 'domain'); g.imports('src/ordering/api/OrderController.ts', 'src/ordering/application/PlaceOrder.ts').imports('src/ordering/application/PlaceOrder.ts', 'src/ordering/domain/order/Order.ts'); },
    expected: [],
  },
  {
    id: 'ddd-s03-reversed-allowed', style: 'ddd', ruleId: 'FF-S03', kind: 'near-miss',
    why: 'domain -> application reverses an allowed edge: FF-S01 business, not FF-S03',
    build: (g) => { g.file('src/ordering/domain/order/Order.ts', 'domain'); g.file('src/ordering/application/PlaceOrder.ts', 'application'); g.imports('src/ordering/domain/order/Order.ts', 'src/ordering/application/PlaceOrder.ts'); },
    expected: [],
  },
  // ── Edge views on the remaining edge rules (ADR-V13-01) ──
  {
    id: 'ca-s04-literal-view', style: 'clean-architecture', ruleId: 'FF-S04', kind: 'near-miss',
    why: 'literal view: the resolved twin (viaReExport) of a barrel import is not read',
    build: (g) => { g.file(CA.book, 'domain'); g.file(CA.sqlRepo, 'infrastructure'); g.imports(CA.book, CA.sqlRepo, { viaReExport: true }); },
    expected: [],
  },
  {
    id: 'layered-s03-literal-view', style: 'layered', ruleId: 'FF-S03', kind: 'near-miss',
    why: 'literal view: the resolved twin (viaReExport) of a barrel import is not read',
    build: (g) => { g.file('src/presentation/LoanController.ts', 'presentation'); g.file('src/persistence/LoanDao.ts', 'persistence'); g.imports('src/presentation/LoanController.ts', 'src/persistence/LoanDao.ts', { viaReExport: true }); },
    expected: [],
  },
  {
    id: 'hex-s01-literal-view', style: 'hexagonal', ruleId: 'FF-S01', kind: 'near-miss',
    why: 'literal view: the resolved twin (viaReExport) of a barrel import is not read',
    build: (g) => { g.file('src/domain/Order.ts', 'domain'); g.file('src/application/PlaceOrder.ts', 'application'); g.imports('src/domain/Order.ts', 'src/application/PlaceOrder.ts', { viaReExport: true }); },
    expected: [],
  },
  {
    id: 'hex-s03-literal-view', style: 'hexagonal', ruleId: 'FF-S03', kind: 'near-miss',
    why: 'literal view: the resolved twin (viaReExport) of a barrel import is not read',
    build: (g) => { g.file('src/adapters/inbound/OrderController.ts', 'adapters-inbound'); g.file('src/adapters/outbound/PgOrderRepository.ts', 'adapters-outbound'); g.imports('src/adapters/inbound/OrderController.ts', 'src/adapters/outbound/PgOrderRepository.ts', { viaReExport: true }); },
    expected: [],
  },
  {
    id: 'hex-s04-literal-view', style: 'hexagonal', ruleId: 'FF-S04', kind: 'near-miss',
    why: 'literal view: the resolved twin (viaReExport) of a barrel import is not read',
    build: (g) => { g.file('src/domain/Order.ts', 'domain'); g.file('src/adapters/outbound/PgPool.ts', 'adapters-outbound'); g.imports('src/domain/Order.ts', 'src/adapters/outbound/PgPool.ts', { viaReExport: true }); },
    expected: [],
  },
  {
    id: 'ddd-dt02-resolved-view', style: 'ddd', ruleId: 'FF-DT02', kind: 'near-miss',
    why: 'resolved view: a barrel hop (reExportHop) from a repository to the inner entity is not read',
    build: (g) => { g.file('src/ordering/domain/order/OrderLineRepository.ts', 'domain'); g.file('src/ordering/domain/order/OrderLine.ts', 'domain'); g.imports('src/ordering/domain/order/OrderLineRepository.ts', 'src/ordering/domain/order/OrderLine.ts', { reExportHop: true }); },
    expected: [],
  },
];
