/**
 * `explain_finding`: given a rule (spec id, template name, violation type, or an `APG2.` / `CHEAP.` hint id) and
 * optionally where it was reported, returns the construct, its literature (`Docs/v1.3/style-rule-sources.md`), the
 * tier, a minimal violating/compliant example, and how the firewall checks it: the full evaluation's template and
 * edge view, and what the MCP fast path reads (or why it leaves the rule to `evaluate_project`). Pure apart from
 * reading the one source line named by the location, when a project root is configured.
 */
import type { ParsedSpec } from '../shared/types/spec.js';
import { CYPHER_TEMPLATES } from '../fitness-compiler/cypher-templates.js';
import { HEXAGONAL_TEMPLATES } from '../fitness-compiler/hexagonal-templates.js';
import { DDD_TEMPLATES } from '../fitness-compiler/ddd-templates.js';
import { APG2_TEMPLATES } from '../fitness-compiler/apg2-templates.js';
import { TEMPLATE_EDGE_VIEWS } from '../fitness-compiler/edge-views.js';
import { explainViolation } from './rule-explainer.js';
import { hintMeta, ruleMetaFor, CONSTRUCTS } from './rule-meta.js';
import { APG2_HINT_NAMES, CHEAP_HINT_NAMES } from './fast-hints.js';
import { fileCheckedRulesV2 } from './file-check.js';
import { normalisePath, resolveLayer } from './layer-resolver.js';
import type { ProjectView } from './project-files.js';
import type { FindingExplanation } from './types.js';

interface Example {
  readonly violating: string;
  readonly compliant: string;
  readonly note: string;
}

const LAYER_EXAMPLE: Example = {
  violating: "// src/domain/Loan.ts\nimport { SystemClock } from '../infrastructure/SystemClock';\nexport class Loan { isOverdue() { return new SystemClock().now() > this.due; } }",
  compliant: "// src/domain/Clock.ts\nexport interface Clock { now(): Date }\n// src/domain/Loan.ts\nimport type { Clock } from './Clock';\nexport class Loan { isOverdue(clock: Clock) { return clock.now() > this.due; } }\n// src/infrastructure/SystemClock.ts\nexport class SystemClock implements Clock { now() { return new Date(); } }",
  note: 'The inner layer owns the interface; the outer layer implements it; the composition root injects it.',
};

/** Minimal violating/compliant pairs by template (or hint) name. */
export const EXAMPLES: Readonly<Record<string, Example>> = Object.freeze({
  'dependency-direction': LAYER_EXAMPLE,
  'dependency-direction-graph': {
    violating: "// src/application/CancelBooking.ts\nimport { HttpError } from '../adapters/inbound/http/HttpTypes';\nthrow new HttpError(404, 'not found');",
    compliant: "// src/application/errors.ts\nexport class BookingNotFound extends Error {}\n// src/application/CancelBooking.ts\nthrow new BookingNotFound(id);\n// src/adapters/inbound/http/BookingController.ts maps BookingNotFound to a 404",
    note: 'Adapters depend on the application, never the reverse; translate at the adapter.',
  },
  'no-domain-outward-dep': LAYER_EXAMPLE,
  'core-isolation': LAYER_EXAMPLE,
  'no-layer-skip': {
    violating: "// src/presentation/CatalogController.ts\nimport { ProductGateway } from '../persistence/ProductGateway';",
    compliant: "// src/presentation/CatalogController.ts\nimport { CatalogService } from '../business/services/CatalogService';\n// CatalogService wraps ProductGateway",
    note: 'Strict layering: each layer talks only to the one directly below it.',
  },
  'layer-skip-graph': {
    violating: "// src/adapters/inbound/http/RoomController.ts\nimport { InMemoryRoomRepository } from '../../outbound/persistence/InMemoryRoomRepository';",
    compliant: "// src/adapters/inbound/http/RoomController.ts\nimport type { FindRooms } from '../../../application/ports/in/FindRooms';",
    note: 'Adapters reach each other only through the application core.',
  },
  'domain-purity': {
    violating: "// src/domain/Book.ts\nimport { Entity, Column } from 'typeorm';\n@Entity() export class Book { @Column() title!: string; }",
    compliant: "// src/domain/Book.ts\nexport class Book { constructor(readonly title: string) {} }\n// src/infrastructure/BookOrmEntity.ts\nimport { Entity, Column } from 'typeorm';\n@Entity('books') export class BookOrmEntity { @Column() title!: string; }",
    note: 'Map the ORM entity to the domain class in the repository implementation.',
  },
  'no-cyclic-deps': {
    violating: "// src/domain/Loan.ts\nimport { Member } from './Member';\n// src/domain/Member.ts\nimport { Loan } from './Loan';",
    compliant: "// src/domain/Member.ts holds memberId only; Loan imports Member, Member does not import Loan\n// (or move the shared type to a third module both import)",
    note: 'Break the cycle by extracting the shared part or inverting one dependency.',
  },
  'domain-state-purity': {
    violating: "// src/domain/LoanPolicy.ts\nimport { SystemClock } from '../infrastructure/SystemClock';\nexport class LoanPolicy { constructor(private readonly clock: SystemClock) {} }",
    compliant: "// src/domain/LoanPolicy.ts\nimport type { Clock } from './Clock';\nexport class LoanPolicy { constructor(private readonly clock: Clock) {} }",
    note: 'The domain holds ports, never infrastructure objects.',
  },
  'repository-pattern': {
    violating: "// src/infrastructure/InMemoryLoanRepository.ts\nexport class InMemoryLoanRepository { save(l: Loan) { /* ... */ } }",
    compliant: "// src/domain/LoanRepository.ts\nexport interface LoanRepository { save(l: Loan): Promise<void> }\n// src/infrastructure/InMemoryLoanRepository.ts\nexport class InMemoryLoanRepository implements LoanRepository { /* ... */ }",
    note: 'The port lives in the domain; the implementation outside.',
  },
  'port-adapter-pattern': {
    violating: "// src/adapters/outbound/persistence/InMemoryRoomRepository.ts\ninterface RoomStore { findAll(): Room[] }\nexport class InMemoryRoomRepository implements RoomStore { /* ... */ }",
    compliant: "// src/application/ports/out/RoomRepository.ts\nexport interface RoomRepository { findAll(): Promise<Room[]> }\n// adapter\nexport class InMemoryRoomRepository implements RoomRepository { /* ... */ }",
    note: 'A driven adapter implements a port the core or application declares.',
  },
  'bounded-context-modules': {
    violating: '// src/utils/formatCurrency.ts (src/utils is no declared context)',
    compliant: '// src/billing/domain/formatCurrency.ts, or src/shared-kernel/formatCurrency.ts when it is shared on purpose',
    note: 'Every file belongs to a context or to a path declared outside the contexts.',
  },
  'context-isolation': {
    violating: "// src/billing/application/IssueInvoice.ts\nimport { Order } from '../../ordering/domain/order/Order.js';",
    compliant: "// src/billing/application/IssueInvoice.ts\nimport type { OrderSummary } from '../../ordering/index.js';\n// or translate in src/billing/acl/OrderingAcl.ts",
    note: "Cross-context imports go through the other context's published API or an anti-corruption layer.",
  },
  'aggregate-boundary': {
    violating: "// src/ordering/application/GetOrderSummary.ts\nimport type { OrderLine } from '../domain/order/OrderLine.js';",
    compliant: "// src/ordering/application/GetOrderSummary.ts\nconst count = order.lineCount(); // through the root Order",
    note: 'Outside the aggregate, reference only its root.',
  },
  'repository-aggregate-root': {
    violating: "// src/ordering/domain/order/OrderLineRepository.ts\nexport interface OrderLineRepository { save(line: OrderLine): Promise<void> }",
    compliant: "// src/ordering/domain/order/OrderRepository.ts\nexport interface OrderRepository { save(order: Order): Promise<void> } // lines saved with their Order",
    note: 'One repository per aggregate root.',
  },
  'value-object-immutability': {
    violating: 'export class Quantity { value: number; setValue(v: number) { this.value = v; } }',
    compliant: 'export class Quantity { constructor(readonly value: number) {} withValue(v: number): Quantity { return new Quantity(v); } }',
    note: 'Replace a value object rather than modify it.',
  },
  'domain-event-placement': {
    violating: '// src/billing/application/InvoiceIssued.ts\nexport class InvoiceIssued implements DomainEvent {}',
    compliant: '// src/billing/domain/invoice/InvoiceIssued.ts\nexport class InvoiceIssued implements DomainEvent {}',
    note: 'Domain events are part of the domain model.',
  },
  'application-service-thin': {
    violating: 'export class IssueInvoice { execute() {} private discount() {} private taxExempt() {} private round() {} /* ... */ }',
    compliant: 'export class IssueInvoice { execute() { const invoice = Invoice.issue(order, policy); /* rules live in Invoice and DiscountPolicy */ } }',
    note: 'Application services coordinate; business rules live in the domain.',
  },
  'naming-services': { violating: 'export class OrderServiceHelper {}', compliant: 'export class OrderService {}', note: 'Follow the spec naming pattern.' },
  'naming-repos': { violating: 'export class OrderRepoImpl2 {}', compliant: 'export class OrderRepository {}', note: 'Follow the spec naming pattern.' },
  'naming-controllers': { violating: "@Controller('orders') export class Orders {}", compliant: "@Controller('orders') export class OrdersController {}", note: 'Follow the spec naming pattern.' },
  'boundary-type-leak': {
    violating: "// src/application/dto/LoanDto.ts\nimport { HttpRequest } from '../../infrastructure/http/HttpTypes';\nexport function toDto(req: HttpRequest): LoanDto { /* ... */ }",
    compliant: "// src/application/dto/LoanDto.ts\nexport function toDto(input: { memberId: string; bookId: string }): LoanDto { /* ... */ }\n// the controller maps HttpRequest to that input",
    note: 'Exposing signatures name only types of their own layer or inner ones.',
  },
  'io-outside-adapters': {
    violating: "// src/application/ExportReport.ts\nimport { writeFileSync } from 'fs';\nwriteFileSync(path, csv);",
    compliant: "// src/application/ports/ReportSink.ts\nexport interface ReportSink { write(csv: string): Promise<void> }\n// src/infrastructure/FileReportSink.ts does the fs call",
    note: 'I/O happens in adapters behind ports.',
  },
  'nondeterminism-in-core': {
    violating: 'export class Loan { isOverdue() { return Date.now() > this.due.getTime(); } }',
    compliant: 'export class Loan { isOverdue(now: Date) { return now > this.due; } } // a Clock port supplies now',
    note: 'Inject time, randomness and configuration so the core is deterministic.',
  },
  'deep-import-declared-api': {
    violating: "import { GetOrderSummary } from '../../ordering/application/GetOrderSummary.js';",
    compliant: "import { GetOrderSummary } from '../../ordering/index.js'; // the declared public API",
    note: "Rely on a component's published interface, not on its internals.",
  },
  'deep-import-inferred-api': {
    violating: "import { Money } from '../business/model/Money';",
    compliant: "import { Money } from '../business'; // the component's index.ts",
    note: 'Import through the entry file the component exports from.',
  },
  'repository-bypass': {
    violating: "// src/application/ReportService.ts\nimport { getRepository } from 'typeorm';\nconst rows = await getRepository(Order).find();",
    compliant: "// src/application/ReportService.ts\nconstructor(private readonly orders: OrderRepository) {}\nconst rows = await this.orders.findAll();",
    note: 'Clients go through the repository port.',
  },
  'framework-in-core': {
    violating: "// src/application/PlaceOrder.ts\nimport type { Request } from 'express';\nexecute(req: Request) { /* ... */ }",
    compliant: '// src/application/PlaceOrder.ts\nexecute(cmd: PlaceOrderCommand) { /* ... */ } // the controller maps Request to the command',
    note: 'Frameworks are details at the outer circle.',
  },
});

/** What check_file / check_diff read for each rule they decide. */
const FAST_PATH: Readonly<Record<string, string>> = Object.freeze({
  'dependency-direction': 'each import specifier is resolved lexically (relative to the file, or a bare project path) and both ends are placed in layers by the spec globs; literal view (the module the import names, a barrel included)',
  'no-layer-skip': 'as dependency-direction, against the allowed adjacent transitions (literal view)',
  'no-domain-outward-dep': 'as dependency-direction, for files of the domain layer (literal view)',
  'domain-purity': 'each package import of a domain file against forbidden_imports; with a project root, names imported through a barrel are followed to their declaring package (resolved view)',
  'dependency-direction-graph': 'each import placed in layers and checked against architecture.allowed_dependencies: the reverse edge is allowed, this one is not (literal view)',
  'layer-skip-graph': 'each import between two layers with no allowed edge either way (literal view)',
  'core-isolation': 'each import of a core file into any other layer (literal view)',
  'no-cyclic-deps': 'with a project root: the literal import graph of the project with the proposed content, searched for a path back from each imported file (bounded at the template length)',
  'domain-state-purity': 'constructor parameter types of domain classes, through their import (and barrels) to the declaring file; an infrastructure class or interface is reported. The FLOWS_TO (field) half is N/A in v1.3 and not checked',
  'repository-pattern': 'classes of the infrastructure layer whose name ends with Repository/Repo(Impl) and that implement nothing',
  'port-adapter-pattern': 'outbound-adapter classes ending with Repository/Repo/Adapter/Gateway(Impl): each implemented name is followed to its declaring file, which must be an interface in a port layer',
  'bounded-context-modules': 'the file path against the declared context roots and outside_contexts',
  'context-isolation': "each import across contexts against the target context's public_api globs, unless the file is in a declared ACL (literal view)",
  'aggregate-boundary': "each import's declaring file (resolved view) against the aggregates' inner entities",
  'repository-aggregate-root': "imports of files matching the repository globs, declaring file (resolved view) against inner entities",
  'value-object-immutability': 'the class member facts of files matching value_objects (public mutable fields, set accessors, public methods assigning this.<field>), extracted with the same code as the extractor',
  'domain-event-placement': 'classes whose direct extends/implements names a domain-event type, outside the domain layers (one hop; the full rule follows chains)',
  'application-service-thin': 'the method count of classes in files matching application_services, against the threshold',
  'naming-services': 'class names in application layers that mention Service/UseCase, against the pattern',
  'naming-repos': 'class names that mention Repository/Repo, against the pattern',
  'naming-controllers': 'decorated controller classes of the controller layer, against the pattern',
  'boundary-type-leak': 'annotated parameter and return types of exported public methods and functions in controller/application layers, through their import to an infrastructure file (inferred types are not seen)',
  'io-outside-adapters': 'calls on values imported from catalogued db, http and fs packages (IO_PACKAGES), and global fetch, in domain/application files',
  'nondeterminism-in-core': 'Date.now(), new Date(), performance.now(), Math.random(), crypto random functions and process.* reads in domain/application files',
  'deep-import-declared-api': "imports into another component's file that is not in its declared public API (DDD contexts)",
  'deep-import-inferred-api': "with a project root: imports into another layer component past its root index.ts (and the barrels it re-exports)",
  'repository-bypass': 'outside infrastructure and repository classes: calls of ORM accessors imported from a db package, or calls on a field typed with a raw DB client type',
  'framework-in-core': 'annotated parameter and return types of application/domain methods and functions that name a transport (express, fastify, koa, Nest HTTP, node http) type, or in the domain a db type',
});

const ALL_TEMPLATES = new Map([...CYPHER_TEMPLATES, ...HEXAGONAL_TEMPLATES, ...DDD_TEMPLATES, ...APG2_TEMPLATES]);

export interface ExplainFindingInput {
  readonly rule: string;
  readonly file?: string | undefined;
  readonly line?: number | undefined;
}

function hintName(query: string): { kind: 'apg2' | 'cheap'; name: string } | undefined {
  const q = query.trim();
  const bare = q.replace(/^(APG2|CHEAP)\./i, '');
  if (APG2_HINT_NAMES.includes(bare) || (/^APG2\./i.test(q) && APG2_TEMPLATES.has(bare))) return { kind: 'apg2', name: bare };
  if (CHEAP_HINT_NAMES.includes(bare)) return { kind: 'cheap', name: bare };
  return undefined;
}

export function explainFinding(spec: ParsedSpec | undefined, input: ExplainFindingInput, view?: ProjectView): FindingExplanation | undefined {
  const hint = hintName(input.rule);
  let base: Omit<FindingExplanation, 'location'>;
  if (hint !== undefined) {
    const meta = hintMeta(hint.kind, hint.name);
    const template = APG2_TEMPLATES.get(hint.name);
    const example = EXAMPLES[hint.name] ?? { violating: '', compliant: '', note: '' };
    base = {
      ruleId: meta.ruleId,
      ruleName: hint.name,
      tier: 'advisory',
      tierSource: 'hint',
      ...(meta.candidateTier !== undefined ? { candidateTier: meta.candidateTier } : {}),
      construct: meta.construct,
      literature: { source: meta.source, row: 'other' },
      detects: template?.description ?? CONSTRUCTS[hint.name] ?? hint.name,
      intent: `${meta.construct}. ${hint.kind === 'apg2' ? 'An APG v2 template (Docs/v1.3/apg2-design.md); not in the sealed tier table, so advisory until an ADR adds it.' : 'A cheap semantic proxy (Docs/v1.3/cheap-semantics-design.md): it proposes candidate sites, not verdicts.'}`,
      fix: example.note,
      example,
      howChecked: {
        fullEvaluation: hint.kind === 'apg2'
          ? `APG v2 template ${hint.name} over the ${template?.template.includes('SIGNATURE_USES') === true ? 'SIGNATURE_USES' : template?.template.includes('PERFORMS_IO') === true ? 'PERFORMS_IO' : 'DEEP_IMPORT'} edges of a graph extracted with V13_APG2_OPTIONS (type checker); not part of evaluate_project's verdict`
          : 'The cheap-proxy pass (src/apg-enrich/cheap), with the type checker over the whole project; not part of evaluate_project',
        edgeView: meta.edgeView,
        fastPath: FAST_PATH[hint.name] ?? '',
        checkedByFastPath: FAST_PATH[hint.name] !== undefined,
      },
      specContext: [],
    };
  } else {
    const explained = explainViolation(input.rule, spec);
    if (explained === undefined) {
      const ff = spec?.fitnessFunctions.find((f) => f.name === input.rule.trim().toLowerCase() || String(f.id).toLowerCase() === input.rule.trim().toLowerCase());
      if (ff === undefined && !ALL_TEMPLATES.has(input.rule.trim())) return undefined;
    }
    const name = explained?.ruleName ?? input.rule.trim();
    const ff = spec?.fitnessFunctions.find((f) => f.name === name);
    const id = explained?.ruleId ?? (ff !== undefined ? String(ff.id) : name);
    const meta = ruleMetaFor(spec?.style, { id, name });
    const template = ALL_TEMPLATES.get(name);
    const example = EXAMPLES[name] ?? { violating: '', compliant: '', note: 'No example recorded for this rule.' };
    const fast = spec !== undefined && ff !== undefined && fileCheckedRulesV2(spec, true).includes(String(ff.id));
    const detects = template?.description ?? explained?.detects ?? name;
    const genericIntent = explained === undefined || explained.violationType.startsWith('CUSTOM_');
    base = {
      ruleId: id,
      ruleName: name,
      tier: meta.tier,
      tierSource: meta.tierSource,
      construct: meta.construct,
      literature: { source: meta.source, row: meta.sourceRow },
      detects,
      intent: genericIntent ? `${meta.construct}. ${meta.source}` : explained.intent,
      fix: genericIntent ? example.note : explained.fix,
      example,
      howChecked: {
        fullEvaluation: template !== undefined
          ? `evaluate_project compiles template ${name} (${template.tag}) under V13_COMPILE_OPTIONS and runs it on the project graph in Neo4j; edge view ${TEMPLATE_EDGE_VIEWS.get(name)?.view ?? 'none'}${TEMPLATE_EDGE_VIEWS.get(name)?.reason !== undefined ? ` (${TEMPLATE_EDGE_VIEWS.get(name)?.reason ?? ''})` : ''}`
          : 'evaluate_project (semantic or custom rule)',
        edgeView: meta.edgeView,
        fastPath: fast ? FAST_PATH[name] ?? 'decided by check_file / check_diff' : `not decided by check_file / check_diff: run evaluate_project`,
        checkedByFastPath: fast,
      },
      specContext: explained?.specContext ?? [],
    };
  }
  if (input.file === undefined) return base;
  const file = normalisePath(input.file);
  const layer = spec !== undefined ? resolveLayer(spec, file)?.layer ?? null : null;
  const text = input.line !== undefined ? view?.read(file)?.split(/\r?\n/)[input.line - 1] : undefined;
  return {
    ...base,
    location: { file, ...(input.line !== undefined ? { line: input.line } : {}), layer, ...(text !== undefined ? { text } : {}) },
  };
}
