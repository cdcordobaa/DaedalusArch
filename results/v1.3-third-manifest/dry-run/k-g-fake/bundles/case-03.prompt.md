## Task

Write the expected findings for this project, before any checking tool has run on it.

1. Give every source file its layer, and for DDD its bounded context, from the declarations. A file that no declaration covers gets layer null.
2. List every internal import edge between the source files (from, to, kind "import" or "re-export"). An import of a package outside the project is not an edge. Mark an edge `typeOnly` when it imports types only, and `viaReExport` when it reaches the file through a barrel (an index file that re-exports it); then list the barrel files in `through`.
3. List every place where the project breaks one of the rules in the tier table. One finding per rule, file and target:
   - `ruleId`: the rule exactly as the tier table names it (the Rule column, for example `FF-S01`, or the rule name of the second table, for example `core-isolation` or `DDD aggregate boundary`). A problem that no listed rule states is named `OTHER: <the construct in a few words>`.
   - `file`: the project-relative path of the file that holds the problem.
   - `target`: for an import rule, the imported project file (or the package name for a framework import); for a class rule, null.
   - `tier`: the tier the table gives the rule for this style (`blocking` or `advisory`).
   - `reason`: one or two sentences: which declaration or source statement the code breaks, and how.
   - `confidence`: `high`, `medium` or `low`.
   - `alsoMatches`: other rule names from the table that the same problem also breaks (may be empty).
4. List near misses in `nearMissOk`: files (or globs) that look like a break of a rule but are not, with the reason.
5. `verdict` is `fail` when at least one finding is on a blocking rule, otherwise `pass`.

Do not guess what a checking tool would report. Write what an architect following the sources would expect. A clean project has no findings.

## Case

Case case-03. Style: ddd.

## Style rules and their sources

- Aggregate boundary: Objects outside the aggregate may hold references only to the root. Inner entities are reached through the root. (Evans, *Domain-Driven Design* (2003), ch. 6 "Aggregates"; Vernon, *Implementing DDD* (2013), ch. 10)
- Repository only for aggregate roots: Repositories are provided only for aggregate roots that actually need direct access. (Evans 2003, ch. 6 "Repositories"; Vernon 2013, ch. 12)
- Value-object immutability: A value object is treated as immutable. Replace it rather than modify it. (Evans 2003, ch. 5 "Value Objects"; Vernon 2013, ch. 6)
- Isolated domain: Domain code is separated from UI, application and infrastructure concerns. (Evans 2003, ch. 4 "Isolating the Domain" (Layered Architecture))
- Bounded-context isolation: Each model applies within an explicit boundary. Integration across contexts is explicit, through a published interface, or translated by an anticorruption layer. (Evans 2003, ch. 14 "Maintaining Model Integrity" (Bounded Context, Context Map, Anticorruption Layer); Vernon 2013, ch. 2–3)

## Rule tiers (rule names and constructs)

| Rule | Template or note | v1.3 tier | Construct reason |
|---|---|---|---|
| FF-S01 | dependency-direction | **blocking** | The dependency rule: dependencies point inward or downward. This defines Clean, Layered and Hexagonal. |
| FF-S02 | no-cyclic-deps | **blocking** | Acyclic dependencies principle; a structural fact |
| FF-S03 | no-layer-skip | **blocking only for `layered`** (strict layering); advisory elsewhere | Only strict layering forbids skipping. Clean and Hexagonal allow skipping inward. |
| FF-S04 | no-domain-outward-dep | **blocking** | Core isolation |
| FF-P01 | domain-purity | **blocking** | The domain is framework-free (Clean, Hexagonal, DDD) |
| FF-P02 | dependency-inversion | advisory | A ratio with a threshold (0.85), so a proxy |
| FF-P03 | repository-pattern | **blocking** | Port in the core, implementation in infrastructure or an outbound adapter: a structural placement fact |
| FF-P04 | use-case-isolation | advisory | Design guideline, not a defining constraint |
| FF-P05 | controller-no-entity | advisory | Guideline (DTOs at boundaries); styles differ on it |
| FF-P06 | domain-state-purity | **blocking, partial** | Core isolation of state. The field half needs FLOWS_TO, which is near-empty: that half is reported N/A with its denominator. Only the constructor-injection half is valid. (Finding 9) |
| FF-C01..C06 | stability, fan-out, instability, orphans, fan-in, abstraction ratio | advisory | Metric thresholds |
| FF-SO01..SO03 | SRP proxy, ISP proxy, inheritance depth | advisory | Proxies |
| FF-CV01..CV06 | naming, test pairing, index logic | advisory | Conventions |
| FF-N01, FF-N02 | judge integrity and intent | reported, non-blocking in v1.3 | LLM judgement; its validity is measured separately (FR-V8, V9) |
| dependency-direction-graph | hexagonal | blocking | Defining: adapters depend on ports, and the core depends on nothing outward |
| core-isolation | hexagonal | blocking | Defining |
| port-adapter-pattern | hexagonal | blocking | Defining: outbound adapters implement core or application ports |
| port-dependency-inversion | hexagonal | blocking if it is a pure edge fact; advisory if it is ratio-based | Decided from its Cypher form, recorded in the hexagonal notes |
| layer-skip-graph | hexagonal | advisory | Hexagonal does not define strict layering |
| DDD aggregate boundary |  | blocking | Evans: outside objects hold references only to the root |
| DDD repository only for aggregate roots |  | blocking | Evans: repositories are provided only for aggregate roots |
| DDD value-object immutability |  | blocking | Evans: value objects are immutable. Checked as a declaration fact (readonly, no setters). |
| DDD framework-free domain |  | blocking | Same construct as FF-P01 |
| DDD bounded-context isolation | imports only through the declared public API or ACL | blocking | Strategic DDD: explicit context boundaries and translation |
| DDD domain events defined in the domain |  | advisory | Placement guideline |
| DDD application services hold no business rules |  | advisory | Heuristic |

## Layer and context declarations

```yaml
architecture:
  style: ddd
  layers:
    - name: domain
      kind: domain
      directories:
        - src/*/domain/**
        - src/shared-kernel/**
      roles:
        - aggregate
        - entity
        - value-object
        - domain-event
        - repository-interface
    - name: application
      kind: application
      directories:
        - src/*/application/**
      roles:
        - application-service
        - port
    - name: infrastructure
      kind: infrastructure
      directories:
        - src/*/infrastructure/**
        - src/*/acl/**
      roles:
        - repository
        - anti-corruption-layer
    - name: api
      kind: presentation
      directories:
        - src/*/api/**
      roles:
        - controller
    - name: composition
      kind: application
      directories:
        - src/main.ts
      roles:
        - composition-root
  allowed_dependencies:
    - from: application
      to:
        - domain
    - from: infrastructure
      to:
        - application
        - domain
    - from: api
      to:
        - application
        - domain
    - from: composition
      to:
        - domain
        - application
        - infrastructure
        - api
  ddd:
    source_root: src/
    contexts:
      - name: ordering
        root: src/ordering/
        public_api:
          - src/ordering/index.ts
          - src/ordering/contracts/**
        acl: []
      - name: billing
        root: src/billing/
        public_api:
          - src/billing/index.ts
          - src/billing/contracts/**
        acl:
          - src/billing/acl/**
    outside_contexts:
      - src/shared-kernel/**
      - src/main.ts
    aggregates:
      - name: Order
        context: ordering
        module: src/ordering/domain/order/**
        root: src/ordering/domain/order/Order.ts
        inner_entities:
          - src/ordering/domain/order/OrderLine.ts
      - name: Customer
        context: ordering
        module: src/ordering/domain/customer/**
        root: src/ordering/domain/customer/Customer.ts
        inner_entities: []
      - name: Invoice
        context: billing
        module: src/billing/domain/invoice/**
        root: src/billing/domain/invoice/Invoice.ts
        inner_entities:
          - src/billing/domain/invoice/InvoiceLine.ts
    value_objects:
      - src/**/value-objects/**
    repositories:
      - src/*/domain/**/*Repository.ts
      - src/*/infrastructure/**/*Repository.ts
    domain_event_types:
      - DomainEvent
    application_services:
      - src/*/application/*.ts
```

## Source files (31, every comment removed)

### src/billing/acl/OrderingAcl.ts

```ts
import type { OrderSummaryQuery } from '../../ordering/index.js';
import type { BillableOrder, OrderSource } from '../application/ports/OrderSource.js';


export class OrderingAcl implements OrderSource {
  constructor(private readonly ordering: OrderSummaryQuery) {}

  async billableOrder(orderId: string): Promise<BillableOrder | null> {
    const summary = await this.ordering.summaryOf(orderId);
    if (summary === null) return null;
    return { orderId: summary.orderId, amountCents: summary.totalCents, currency: summary.currency };
  }
}
```

### src/billing/api/InvoiceController.ts

```ts
import type { InvoiceView } from '../contracts/InvoiceView.js';
import type { IssueInvoice } from '../application/IssueInvoice.js';

export class InvoiceController {
  constructor(private readonly issueInvoice: IssueInvoice) {}

  async post(body: { invoiceId: string; orderId: string }): Promise<{ status: number; location: string }> {
    await this.issueInvoice.execute(body.invoiceId, body.orderId);
    return { status: 201, location: `/invoices/${body.invoiceId}` };
  }

  describe(view: InvoiceView): string {
    return `${view.invoiceId}: ${String(view.totalCents)} ${view.currency}`;
  }
}
```

### src/billing/application/IssueInvoice.ts

```ts
import { Money } from '../../shared-kernel/value-objects/Money.js';
import { Invoice } from '../domain/invoice/Invoice.js';
import type { InvoiceRepository } from '../domain/invoice/InvoiceRepository.js';
import { InvoiceId } from '../domain/invoice/value-objects/InvoiceId.js';
import type { OrderSource } from './ports/OrderSource.js';

import type { Order } from '../../ordering/domain/order/Order.js';


export class IssueInvoice {
  constructor(private readonly orders: OrderSource, private readonly invoices: InvoiceRepository, private readonly taxRate: number) {}

  async execute(invoiceId: string, orderId: string): Promise<void> {
    const order = await this.orders.billableOrder(orderId);
    if (order === null) throw new Error('Unknown order');
    const invoice = new Invoice(new InvoiceId(invoiceId), order.orderId, order.currency);
    invoice.charge(`order ${order.orderId}`, Money.of(order.amountCents, order.currency));
    invoice.issue(this.taxRate);
    await this.invoices.save(invoice);
  }

  async executeFor(invoiceId: string, order: Order): Promise<void> {
    await this.execute(invoiceId, order.id.value);
  }
}
```

### src/billing/application/ports/OrderSource.ts

```ts

export interface BillableOrder {
  readonly orderId: string;
  readonly amountCents: number;
  readonly currency: string;
}

export interface OrderSource {
  billableOrder(orderId: string): Promise<BillableOrder | null>;
}
```

### src/billing/contracts/InvoiceView.ts

```ts
export interface InvoiceView {
  readonly invoiceId: string;
  readonly orderId: string;
  readonly totalCents: number;
  readonly currency: string;
}
```

### src/billing/domain/invoice/Invoice.ts

```ts
import type { DomainEvent } from '../../../shared-kernel/DomainEvent.js';
import { Money } from '../../../shared-kernel/value-objects/Money.js';
import { InvoiceLine } from './InvoiceLine.js';
import { InvoiceId } from './value-objects/InvoiceId.js';
import { InvoiceIssued } from './events/InvoiceIssued.js';


export class Invoice {
  private readonly lines: InvoiceLine[] = [];
  private readonly events: DomainEvent[] = [];
  private issued = false;

  constructor(readonly id: InvoiceId, readonly orderId: string, readonly currency: string) {}

  charge(description: string, amount: Money): void {
    if (this.issued) throw new Error('An issued invoice cannot change');
    this.lines.push(new InvoiceLine(this.lines.length + 1, description, amount));
  }

  issue(taxRate: number): void {
    if (this.lines.length === 0) throw new Error('Nothing to invoice');
    const net = this.net();
    this.lines.push(new InvoiceLine(this.lines.length + 1, 'tax', net.times(taxRate)));
    this.issued = true;
    this.events.push(new InvoiceIssued(this.id.value, this.orderId));
  }

  net(): Money {
    return this.lines.filter((l) => l.description !== 'tax').reduce((s, l) => s.add(l.amount), Money.of(0, this.currency));
  }

  total(): Money {
    return this.lines.reduce((s, l) => s.add(l.amount), Money.of(0, this.currency));
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
```

### src/billing/domain/invoice/InvoiceLine.ts

```ts
import type { Money } from '../../../shared-kernel/value-objects/Money.js';


export class InvoiceLine {
  constructor(readonly lineNo: number, readonly description: string, readonly amount: Money) {}
}
```

### src/billing/domain/invoice/InvoiceRepository.ts

```ts
import type { Invoice } from './Invoice.js';
import type { InvoiceId } from './value-objects/InvoiceId.js';

export interface InvoiceRepository {
  byId(id: InvoiceId): Promise<Invoice | null>;
  save(invoice: Invoice): Promise<void>;
}
```

### src/billing/domain/invoice/events/InvoiceIssued.ts

```ts
import type { DomainEvent } from '../../../../shared-kernel/DomainEvent.js';

export class InvoiceIssued implements DomainEvent {
  readonly name = 'billing.invoice-issued';
  readonly occurredAt = new Date();

  constructor(readonly invoiceId: string, readonly orderId: string) {}
}
```

### src/billing/domain/invoice/value-objects/InvoiceId.ts

```ts
export class InvoiceId {
  constructor(readonly value: string) {
    if (value.length === 0) throw new Error('InvoiceId is empty');
  }
}
```

### src/billing/index.ts

```ts

export type { InvoiceView } from './contracts/InvoiceView.js';
```

### src/billing/infrastructure/InMemoryInvoiceRepository.ts

```ts
import type { Invoice } from '../domain/invoice/Invoice.js';
import type { InvoiceRepository } from '../domain/invoice/InvoiceRepository.js';
import type { InvoiceId } from '../domain/invoice/value-objects/InvoiceId.js';

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private readonly rows = new Map<string, Invoice>();

  async byId(id: InvoiceId): Promise<Invoice | null> {
    return this.rows.get(id.value) ?? null;
  }

  async save(invoice: Invoice): Promise<void> {
    this.rows.set(invoice.id.value, invoice);
  }
}
```

### src/main.ts

```ts

import { PlaceOrder } from './ordering/application/PlaceOrder.js';
import { GetOrderSummary } from './ordering/application/GetOrderSummary.js';
import { InMemoryOrderRepository } from './ordering/infrastructure/InMemoryOrderRepository.js';
import { InMemoryCustomerRepository } from './ordering/infrastructure/InMemoryCustomerRepository.js';
import { OrderController } from './ordering/api/OrderController.js';
import { IssueInvoice } from './billing/application/IssueInvoice.js';
import { OrderingAcl } from './billing/acl/OrderingAcl.js';
import { InMemoryInvoiceRepository } from './billing/infrastructure/InMemoryInvoiceRepository.js';
import { InvoiceController } from './billing/api/InvoiceController.js';

export function compose(): { orders: OrderController; invoices: InvoiceController } {
  const orderRepo = new InMemoryOrderRepository();
  const customers = new InMemoryCustomerRepository(new Map());
  const orders = new OrderController(new PlaceOrder(orderRepo, customers));
  const acl = new OrderingAcl(new GetOrderSummary(orderRepo));
  const invoices = new InvoiceController(new IssueInvoice(acl, new InMemoryInvoiceRepository(), 0.2));
  return { orders, invoices };
}
```

### src/ordering/api/OrderController.ts

```ts
import type { PlaceOrder, PlaceOrderCommand } from '../application/PlaceOrder.js';


export class OrderController {
  constructor(private readonly placeOrder: PlaceOrder) {}

  async post(body: PlaceOrderCommand): Promise<{ status: number }> {
    await this.placeOrder.execute(body);
    return { status: 201 };
  }
}
```

### src/ordering/application/GetOrderSummary.ts

```ts
import type { OrderSummary, OrderSummaryQuery } from '../contracts/OrderSummary.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';
import { OrderId } from '../domain/order/value-objects/OrderId.js';


export class GetOrderSummary implements OrderSummaryQuery {
  constructor(private readonly orders: OrderRepository) {}

  async summaryOf(orderId: string): Promise<OrderSummary | null> {
    const order = await this.orders.byId(new OrderId(orderId));
    if (order === null) return null;
    const total = order.total();
    return { orderId, customerId: order.customerId.value, totalCents: total.cents, currency: total.currency, lineCount: order.lineCount() };
  }
}
```

### src/ordering/application/PlaceOrder.ts

```ts
import { Money } from '../../shared-kernel/value-objects/Money.js';
import { Order } from '../domain/order/Order.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';
import { OrderId } from '../domain/order/value-objects/OrderId.js';
import type { CustomerRepository } from '../domain/customer/CustomerRepository.js';
import { CustomerId } from '../domain/customer/value-objects/CustomerId.js';
import { Quantity } from '../domain/value-objects/Quantity.js';

export interface PlaceOrderCommand {
  readonly orderId: string;
  readonly customerId: string;
  readonly currency: string;
  readonly lines: readonly { productId: string; quantity: number; unitPriceCents: number }[];
}


export class PlaceOrder {
  constructor(private readonly orders: OrderRepository, private readonly customers: CustomerRepository) {}

  async execute(cmd: PlaceOrderCommand): Promise<void> {
    const customer = await this.customers.byId(new CustomerId(cmd.customerId));
    if (customer === null || !customer.canOrder()) throw new Error('Unknown or inactive customer');
    const order = new Order(new OrderId(cmd.orderId), customer.id, cmd.currency);
    for (const l of cmd.lines) order.addLine(l.productId, new Quantity(l.quantity), Money.of(l.unitPriceCents, cmd.currency));
    order.place();
    await this.orders.save(order);
  }
}
```

### src/ordering/contracts/OrderSummary.ts

```ts

export interface OrderSummary {
  readonly orderId: string;
  readonly customerId: string;
  readonly totalCents: number;
  readonly currency: string;
  readonly lineCount: number;
}

export interface OrderSummaryQuery {
  summaryOf(orderId: string): Promise<OrderSummary | null>;
}
```

### src/ordering/domain/customer/Customer.ts

```ts
import { CustomerId } from './value-objects/CustomerId.js';


export class Customer {
  private active = true;

  constructor(readonly id: CustomerId, readonly name: string) {}

  canOrder(): boolean {
    return this.active;
  }

  deactivate(): void {
    this.active = false;
  }
}
```

### src/ordering/domain/customer/CustomerRepository.ts

```ts
import type { Customer } from './Customer.js';
import type { CustomerId } from './value-objects/CustomerId.js';

export interface CustomerRepository {
  byId(id: CustomerId): Promise<Customer | null>;
}
```

### src/ordering/domain/customer/value-objects/CustomerId.ts

```ts
export class CustomerId {
  constructor(readonly value: string) {
    if (value.length === 0) throw new Error('CustomerId is empty');
  }
}
```

### src/ordering/domain/order/Order.ts

```ts
import type { DomainEvent } from '../../../shared-kernel/DomainEvent.js';
import { Money } from '../../../shared-kernel/value-objects/Money.js';
import { Quantity } from '../value-objects/Quantity.js';
import type { CustomerId } from '../customer/value-objects/CustomerId.js';
import { OrderLine } from './OrderLine.js';
import { OrderId } from './value-objects/OrderId.js';
import { OrderPlaced } from './events/OrderPlaced.js';


export class Order {
  private readonly lines: OrderLine[] = [];
  private placed = false;
  private readonly events: DomainEvent[] = [];

  constructor(readonly id: OrderId, readonly customerId: CustomerId, readonly currency: string) {}

  addLine(productId: string, quantity: Quantity, unitPrice: Money): void {
    if (this.placed) throw new Error('A placed order cannot change');
    if (unitPrice.currency !== this.currency) throw new Error('Currency mismatch');
    const existing = this.lines.find((l) => l.isFor(productId));
    if (existing) existing.increase(quantity);
    else this.lines.push(new OrderLine(this.lines.length + 1, productId, quantity, unitPrice));
  }

  place(): void {
    if (this.lines.length === 0) throw new Error('An order needs at least one line');
    this.placed = true;
    this.events.push(new OrderPlaced(this.id.value, this.total().cents));
  }

  total(): Money {
    return this.lines.reduce((sum, l) => sum.add(l.subtotal()), Money.of(0, this.currency));
  }

  lineCount(): number {
    return this.lines.length;
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
```

### src/ordering/domain/order/OrderLine.ts

```ts
import { Money } from '../../../shared-kernel/value-objects/Money.js';
import { Quantity } from '../value-objects/Quantity.js';


export class OrderLine {
  constructor(readonly lineNo: number, readonly productId: string, private quantity: Quantity, readonly unitPrice: Money) {}

  subtotal(): Money {
    return this.unitPrice.times(this.quantity.value);
  }

  increase(by: Quantity): void {
    this.quantity = this.quantity.plus(by);
  }

  isFor(productId: string): boolean {
    return this.productId === productId;
  }
}
```

### src/ordering/domain/order/OrderRepository.ts

```ts
import type { Order } from './Order.js';
import type { OrderId } from './value-objects/OrderId.js';


export interface OrderRepository {
  byId(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}
```

### src/ordering/domain/order/events/OrderPlaced.ts

```ts
import type { DomainEvent } from '../../../../shared-kernel/DomainEvent.js';

export class OrderPlaced implements DomainEvent {
  readonly name = 'ordering.order-placed';
  readonly occurredAt = new Date();

  constructor(readonly orderId: string, readonly totalCents: number) {}
}
```

### src/ordering/domain/order/value-objects/OrderId.ts

```ts
export class OrderId {
  constructor(readonly value: string) {
    if (value.length === 0) throw new Error('OrderId is empty');
  }

  equals(other: OrderId): boolean {
    return this.value === other.value;
  }
}
```

### src/ordering/domain/value-objects/Quantity.ts

```ts

export class Quantity {
  constructor(readonly value: number) {
    if (!Number.isInteger(value) || value <= 0) throw new Error('Quantity must be a positive integer');
  }

  plus(other: Quantity): Quantity {
    return new Quantity(this.value + other.value);
  }
}
```

### src/ordering/index.ts

```ts

export type { OrderSummary, OrderSummaryQuery } from './contracts/OrderSummary.js';
```

### src/ordering/infrastructure/InMemoryCustomerRepository.ts

```ts
import type { Customer } from '../domain/customer/Customer.js';
import type { CustomerRepository } from '../domain/customer/CustomerRepository.js';
import type { CustomerId } from '../domain/customer/value-objects/CustomerId.js';

export class InMemoryCustomerRepository implements CustomerRepository {
  constructor(private readonly rows: ReadonlyMap<string, Customer>) {}

  async byId(id: CustomerId): Promise<Customer | null> {
    return this.rows.get(id.value) ?? null;
  }
}
```

### src/ordering/infrastructure/InMemoryOrderRepository.ts

```ts
import type { Order } from '../domain/order/Order.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';
import type { OrderId } from '../domain/order/value-objects/OrderId.js';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly rows = new Map<string, Order>();

  async byId(id: OrderId): Promise<Order | null> {
    return this.rows.get(id.value) ?? null;
  }

  async save(order: Order): Promise<void> {
    this.rows.set(order.id.value, order);
  }
}
```

### src/shared-kernel/DomainEvent.ts

```ts

export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: Date;
}
```

### src/shared-kernel/value-objects/Money.ts

```ts

export class Money {
  private constructor(readonly cents: number, readonly currency: string) {}

  static of(cents: number, currency: string): Money {
    if (!Number.isInteger(cents)) throw new Error('Money is held in whole minor units');
    return new Money(cents, currency);
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error('Currency mismatch');
    return new Money(this.cents + other.cents, this.currency);
  }

  times(factor: number): Money {
    return new Money(Math.round(this.cents * factor), this.currency);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }
}
```

## Response schema

{"properties":{"expectedGraph":{"properties":{"edges":{"items":{"properties":{"from":{"type":"string"},"kind":{"enum":["import","re-export"],"type":"string"},"through":{"items":{"type":"string"},"type":"array"},"to":{"type":"string"},"typeOnly":{"type":"boolean"},"viaReExport":{"type":"boolean"}},"required":["from","to","kind"],"type":"object"},"type":"array"},"files":{"items":{"properties":{"context":{"nullable":true,"type":"string"},"file":{"type":"string"},"layer":{"nullable":true,"type":"string"}},"required":["file","layer"],"type":"object"},"type":"array"}},"required":["files","edges"],"type":"object"},"findings":{"items":{"properties":{"alsoMatches":{"items":{"type":"string"},"type":"array"},"confidence":{"enum":["high","medium","low"],"type":"string"},"file":{"type":"string"},"reason":{"type":"string"},"ruleId":{"type":"string"},"target":{"nullable":true,"type":"string"},"tier":{"enum":["blocking","advisory"],"type":"string"}},"required":["ruleId","file","tier","reason","confidence"],"type":"object"},"type":"array"},"nearMissOk":{"items":{"properties":{"nearMissOk":{"type":"string"},"reason":{"type":"string"}},"required":["nearMissOk","reason"],"type":"object"},"type":"array"},"verdict":{"enum":["pass","fail"],"type":"string"}},"required":["verdict","expectedGraph","findings","nearMissOk"],"type":"object"}