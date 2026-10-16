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

Case case-01. Style: layered.

## Style rules and their sources

- Acyclic dependencies: The component dependency graph has no cycles. (Martin 2017, ch. 14 "Component Coupling", ADP)
- Downward-only, no skipping when strict: A higher layer uses services of lower layers, and lower layers do not use upper ones. Strict layering also forbids skipping a layer. (Fowler, *Patterns of Enterprise Application Architecture* (2002), ch. 1 "Layering"; Buschmann et al., *POSA vol. 1* (1996), Layers pattern)

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
  style: layered
  layers:
    - name: persistence
      kind: infrastructure
      directories:
        - src/persistence/**
      roles:
        - repository
        - data-access-object
        - orm-entity
    - name: business
      kind: domain
      directories:
        - src/business/**
      roles:
        - business-service
        - entity
        - value-object
    - name: presentation
      kind: presentation
      directories:
        - src/presentation/**
      roles:
        - controller
        - view
        - presenter
```

## Source files (28, every comment removed)

### src/business/ServiceFactory.ts

```ts
import { InMemoryDatabase } from '../persistence/Database';
import { CustomerGateway } from '../persistence/CustomerGateway';
import { OrderGateway } from '../persistence/OrderGateway';
import { ProductGateway } from '../persistence/ProductGateway';
import { CatalogService } from './services/CatalogService';
import { OrderService } from './services/OrderService';

export interface BusinessServices {
  catalog: CatalogService;
  orders: OrderService;
}





export function createServices(): BusinessServices {
  const db = new InMemoryDatabase();
  const products = new ProductGateway(db);
  new CustomerGateway(db).insert({ id: 'c-1', name: 'Grace', email: 'grace@example.org', loyaltyTier: 'gold' });
  return {
    catalog: new CatalogService(products),
    orders: new OrderService(new OrderGateway(db), products, new CustomerGateway(db)),
  };
}
```

### src/business/errors/BusinessError.ts

```ts
export class BusinessError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'INVALID' | 'CONFLICT', message: string) {
    super(message);
    this.name = 'BusinessError';
  }
}
```

### src/business/model/Customer.ts

```ts
export class Customer {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly email: string,
    readonly loyaltyTier: 'standard' | 'gold',
  ) {}

  get isGold(): boolean {
    return this.loyaltyTier === 'gold';
  }
}
```

### src/business/model/Money.ts

```ts
import { BusinessError } from '../errors/BusinessError';


export class Money {
  private constructor(readonly cents: number) {}

  static ofCents(cents: number): Money {
    if (!Number.isInteger(cents) || cents < 0) throw new BusinessError('INVALID', `Invalid amount: ${cents}`);
    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return Money.ofCents(Math.max(0, this.cents - other.cents));
  }

  times(quantity: number): Money {
    return Money.ofCents(this.cents * quantity);
  }

  percent(rate: number): Money {
    return Money.ofCents(Math.round((this.cents * rate) / 100));
  }

  format(): string {
    return `${(this.cents / 100).toFixed(2)} EUR`;
  }
}
```

### src/business/model/Order.ts

```ts
import { BusinessError } from '../errors/BusinessError';
import { Money } from './Money';
import { OrderLine } from './OrderLine';

export class Order {
  constructor(
    readonly id: string,
    readonly customerId: string,
    readonly lines: readonly OrderLine[],
    readonly createdAt: Date,
    readonly discount: Money,
    private orderStatus: 'placed' | 'cancelled' = 'placed',
  ) {
    if (lines.length === 0) throw new BusinessError('INVALID', 'An order needs at least one line');
  }

  get status(): 'placed' | 'cancelled' {
    return this.orderStatus;
  }

  subtotal(): Money {
    return this.lines.reduce((sum, line) => sum.add(line.total()), Money.zero());
  }

  total(): Money {
    return this.subtotal().subtract(this.discount);
  }

  cancel(): void {
    if (this.orderStatus === 'cancelled') throw new BusinessError('CONFLICT', `Order ${this.id} is already cancelled`);
    this.orderStatus = 'cancelled';
  }
}
```

### src/business/model/OrderLine.ts

```ts
import { Money } from './Money';

export class OrderLine {
  constructor(
    readonly sku: string,
    readonly quantity: number,
    readonly unitPrice: Money,
  ) {}

  total(): Money {
    return this.unitPrice.times(this.quantity);
  }
}
```

### src/business/model/Product.ts

```ts
import { BusinessError } from '../errors/BusinessError';
import { Money } from './Money';

export class Product {
  constructor(
    readonly sku: string,
    readonly name: string,
    readonly price: Money,
    private stockLevel: number,
  ) {}

  get stock(): number {
    return this.stockLevel;
  }

  reserve(quantity: number): void {
    if (quantity < 1) throw new BusinessError('INVALID', 'Quantity must be positive');
    if (quantity > this.stockLevel) throw new BusinessError('CONFLICT', `Only ${this.stockLevel} of ${this.sku} left`);
    this.stockLevel -= quantity;
  }

  release(quantity: number): void {
    this.stockLevel += quantity;
  }
}
```

### src/business/services/CatalogService.ts

```ts
import { ProductGateway } from '../../persistence/ProductGateway';
import { BusinessError } from '../errors/BusinessError';
import { Product } from '../model/Product';
import { toProduct } from './RecordMapping';


export class CatalogService {
  constructor(private readonly products: ProductGateway) {}

  listProducts(): Product[] {
    return this.products.findAll().map(toProduct);
  }

  getProduct(sku: string): Product {
    const record = this.products.findBySku(sku);
    if (record === undefined) throw new BusinessError('NOT_FOUND', `No product ${sku}`);
    return toProduct(record);
  }

  addProduct(sku: string, name: string, priceCents: number, stock: number): Product {
    if (this.products.findBySku(sku) !== undefined) throw new BusinessError('CONFLICT', `Product ${sku} exists`);
    this.products.insert({ sku, name, priceCents, stock });
    return this.getProduct(sku);
  }
}
```

### src/business/services/OrderService.ts

```ts
import { CustomerGateway } from '../../persistence/CustomerGateway';
import { OrderGateway } from '../../persistence/OrderGateway';
import { ProductGateway } from '../../persistence/ProductGateway';
import { BusinessError } from '../errors/BusinessError';
import { Money } from '../model/Money';
import { Order } from '../model/Order';
import { OrderLine } from '../model/OrderLine';
import { PricingPolicy } from './PricingPolicy';
import { toCustomer, toOrder, toOrderRecord, toProduct } from './RecordMapping';

export interface OrderItem {
  sku: string;
  quantity: number;
}


export class OrderService {
  private readonly pricing = new PricingPolicy();
  private sequence = 0;

  constructor(
    private readonly orders: OrderGateway,
    private readonly products: ProductGateway,
    private readonly customers: CustomerGateway,
  ) {}

  placeOrder(customerId: string, items: readonly OrderItem[]): Order {
    const customerRecord = this.customers.findById(customerId);
    if (customerRecord === undefined) throw new BusinessError('NOT_FOUND', `No customer ${customerId}`);

    const lines = items.map((item) => {
      const record = this.products.findBySku(item.sku);
      if (record === undefined) throw new BusinessError('NOT_FOUND', `No product ${item.sku}`);
      const product = toProduct(record);
      product.reserve(item.quantity);
      this.products.updateStock(product.sku, product.stock);
      return new OrderLine(product.sku, item.quantity, product.price);
    });

    const draft = new Order(this.nextId(), customerId, lines, new Date(), this.pricing.discountFor(toCustomer(customerRecord), sumOf(lines)));
    this.orders.save(toOrderRecord(draft));
    return draft;
  }

  cancelOrder(orderId: string): Order {
    const order = this.getOrder(orderId);
    order.cancel();
    for (const line of order.lines) {
      const record = this.products.findBySku(line.sku);
      if (record !== undefined) this.products.updateStock(line.sku, record.stock + line.quantity);
    }
    this.orders.save(toOrderRecord(order));
    return order;
  }

  getOrder(orderId: string): Order {
    const record = this.orders.findById(orderId);
    if (record === undefined) throw new BusinessError('NOT_FOUND', `No order ${orderId}`);
    return toOrder(record);
  }

  private nextId(): string {
    this.sequence += 1;
    return `ord-${this.sequence}`;
  }
}

function sumOf(lines: readonly OrderLine[]): Money {
  return lines.reduce((sum, line) => sum.add(line.total()), Money.zero());
}
```

### src/business/services/PricingPolicy.ts

```ts
import { Customer } from '../model/Customer';
import { Money } from '../model/Money';


export class PricingPolicy {
  discountFor(customer: Customer, subtotal: Money): Money {
    return customer.isGold && subtotal.cents >= 10_000 ? subtotal.percent(10) : Money.zero();
  }
}
```

### src/business/services/RecordMapping.ts

```ts
import { CustomerRecord } from '../../persistence/records/CustomerRecord';
import { OrderRecord } from '../../persistence/records/OrderRecord';
import { ProductRecord } from '../../persistence/records/ProductRecord';
import { Customer } from '../model/Customer';
import { Money } from '../model/Money';
import { Order } from '../model/Order';
import { OrderLine } from '../model/OrderLine';
import { Product } from '../model/Product';


export function toProduct(record: ProductRecord): Product {
  return new Product(record.sku, record.name, Money.ofCents(record.priceCents), record.stock);
}

export function toCustomer(record: CustomerRecord): Customer {
  return new Customer(record.id, record.name, record.email, record.loyaltyTier);
}

export function toOrder(record: OrderRecord): Order {
  const lines = record.lines.map((l) => new OrderLine(l.sku, l.quantity, Money.ofCents(l.unitPriceCents)));
  return new Order(record.id, record.customerId, lines, new Date(record.createdAt), Money.ofCents(record.discountCents), record.status);
}

export function toOrderRecord(order: Order): OrderRecord {
  return {
    id: order.id,
    customerId: order.customerId,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    discountCents: order.discount.cents,
    lines: order.lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPriceCents: l.unitPrice.cents })),
  };
}
```

### src/main.ts

```ts
import { createApp } from './presentation/app';

export const app = createApp();
```

### src/persistence/CustomerGateway.ts

```ts
import { InMemoryDatabase } from './Database';
import { CustomerRecord } from './records/CustomerRecord';


export class CustomerGateway {
  constructor(private readonly db: InMemoryDatabase) {}

  findById(id: string): CustomerRecord | undefined {
    return this.db.table<CustomerRecord>('customers').get(id);
  }

  insert(record: CustomerRecord): void {
    this.db.table<CustomerRecord>('customers').set(record.id, { ...record });
  }
}
```

### src/persistence/Database.ts

```ts

export class InMemoryDatabase {
  private readonly tables = new Map<string, Map<string, unknown>>();

  table<T>(name: string): Map<string, T> {
    let table = this.tables.get(name);
    if (table === undefined) {
      table = new Map<string, unknown>();
      this.tables.set(name, table);
    }
    return table as Map<string, T>;
  }
}
```

### src/persistence/OrderGateway.ts

```ts
import { InMemoryDatabase } from './Database';
import { OrderRecord } from './records/OrderRecord';


export class OrderGateway {
  constructor(private readonly db: InMemoryDatabase) {}

  findById(id: string): OrderRecord | undefined {
    return this.db.table<OrderRecord>('orders').get(id);
  }

  findByCustomer(customerId: string): OrderRecord[] {
    return [...this.db.table<OrderRecord>('orders').values()].filter((row) => row.customerId === customerId);
  }

  save(record: OrderRecord): void {
    this.db.table<OrderRecord>('orders').set(record.id, { ...record, lines: record.lines.map((l) => ({ ...l })) });
  }
}
```

### src/persistence/ProductGateway.ts

```ts
import { InMemoryDatabase } from './Database';
import { ProductRecord } from './records/ProductRecord';


export class ProductGateway {
  constructor(private readonly db: InMemoryDatabase) {}

  findBySku(sku: string): ProductRecord | undefined {
    return this.db.table<ProductRecord>('products').get(sku);
  }

  findAll(): ProductRecord[] {
    return [...this.db.table<ProductRecord>('products').values()];
  }

  insert(record: ProductRecord): void {
    this.db.table<ProductRecord>('products').set(record.sku, { ...record });
  }

  updateStock(sku: string, stock: number): void {
    const row = this.findBySku(sku);
    if (row !== undefined) this.db.table<ProductRecord>('products').set(sku, { ...row, stock });
  }
}
```

### src/persistence/records/CustomerRecord.ts

```ts
export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  loyaltyTier: 'standard' | 'gold';
}
```

### src/persistence/records/OrderRecord.ts

```ts
export interface OrderLineRecord {
  sku: string;
  quantity: number;
  unitPriceCents: number;
}

export interface OrderRecord {
  id: string;
  customerId: string;
  status: 'placed' | 'cancelled';
  createdAt: string;
  discountCents: number;
  lines: OrderLineRecord[];
}
```

### src/persistence/records/ProductRecord.ts

```ts
export interface ProductRecord {
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
}
```

### src/presentation/Router.ts

```ts
import { CatalogController } from './http/CatalogController';
import { HttpRequest, HttpResponse } from './http/HttpTypes';
import { OrderController } from './http/OrderController';

type Handler = (request: HttpRequest) => HttpResponse;

export class Router {
  private readonly routes = new Map<string, Handler>();

  constructor(catalog: CatalogController, orders: OrderController) {
    this.routes.set('GET /products', () => catalog.list());
    this.routes.set('POST /products', (r) => catalog.create(r));
    this.routes.set('POST /orders', (r) => orders.place(r));
    this.routes.set('GET /orders/:id', (r) => orders.show(r));
    this.routes.set('POST /orders/:id/cancel', (r) => orders.cancel(r));
  }

  handle(route: string, request: HttpRequest): HttpResponse {
    const handler = this.routes.get(route);
    return handler === undefined ? { status: 404, body: { error: `No route ${route}` } } : handler(request);
  }
}
```

### src/presentation/app.ts

```ts
import { createServices } from '../business/ServiceFactory';
import { CatalogController } from './http/CatalogController';
import { OrderController } from './http/OrderController';
import { Router } from './Router';

export function createApp(): Router {
  const services = createServices();
  return new Router(new CatalogController(services.catalog), new OrderController(services.orders));
}
```

### src/presentation/http/CatalogController.ts

```ts
import { CatalogService } from '../../business/services/CatalogService';
import { renderProduct } from '../views/ProductView';
import { errorResponse } from './ErrorHandling';
import { HttpRequest, HttpResponse } from './HttpTypes';

export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  list(): HttpResponse {
    return { status: 200, body: this.catalog.listProducts().map(renderProduct) };
  }

  create(request: HttpRequest): HttpResponse {
    try {
      const product = this.catalog.addProduct(
        String(request.body['sku']),
        String(request.body['name']),
        Number(request.body['priceCents']),
        Number(request.body['stock']),
      );
      return { status: 201, body: renderProduct(product) };
    } catch (error) {
      return errorResponse(error);
    }
  }
}
```

### src/presentation/http/ErrorHandling.ts

```ts
import { BusinessError } from '../../business/errors/BusinessError';
import { HttpResponse } from './HttpTypes';

const STATUS = { NOT_FOUND: 404, INVALID: 400, CONFLICT: 409 } as const;

export function errorResponse(error: unknown): HttpResponse {
  if (error instanceof BusinessError) return { status: STATUS[error.code], body: { error: error.message } };
  return { status: 500, body: { error: 'Internal error' } };
}
```

### src/presentation/http/HttpTypes.ts

```ts
export interface HttpRequest {
  params: Record<string, string>;
  body: Record<string, unknown>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}
```

### src/presentation/http/OrderController.ts

```ts
import { OrderItem, OrderService } from '../../business/services/OrderService';
import { renderOrder } from '../views/OrderView';
import { errorResponse } from './ErrorHandling';
import { HttpRequest, HttpResponse } from './HttpTypes';

export class OrderController {
  constructor(private readonly orders: OrderService) {}

  place(request: HttpRequest): HttpResponse {
    try {
      const items = (request.body['items'] as OrderItem[] | undefined) ?? [];
      return { status: 201, body: renderOrder(this.orders.placeOrder(String(request.body['customerId']), items)) };
    } catch (error) {
      return errorResponse(error);
    }
  }

  cancel(request: HttpRequest): HttpResponse {
    try {
      return { status: 200, body: renderOrder(this.orders.cancelOrder(String(request.params['id']))) };
    } catch (error) {
      return errorResponse(error);
    }
  }

  show(request: HttpRequest): HttpResponse {
    try {
      return { status: 200, body: renderOrder(this.orders.getOrder(String(request.params['id']))) };
    } catch (error) {
      return errorResponse(error);
    }
  }
}
```

### src/presentation/views/OrderView.ts

```ts
import { Order } from '../../business/model/Order';

export interface OrderViewModel {
  id: string;
  status: string;
  lines: { sku: string; quantity: number; total: string }[];
  discount: string;
  total: string;
}

export function renderOrder(order: Order): OrderViewModel {
  return {
    id: order.id,
    status: order.status,
    lines: order.lines.map((line) => ({ sku: line.sku, quantity: line.quantity, total: line.total().format() })),
    discount: order.discount.format(),
    total: order.total().format(),
  };
}
```

### src/presentation/views/ProductView.ts

```ts
import { Product } from '../../business/model/Product';

export interface ProductViewModel {
  sku: string;
  name: string;
  price: string;
  inStock: boolean;
}

export function renderProduct(product: Product): ProductViewModel {
  return { sku: product.sku, name: product.name, price: product.price.format(), inStock: product.stock > 0 };
}
```

### types/vendor.d.ts

```ts



declare module 'typeorm' {
  export function Entity(name?: string): ClassDecorator;
  export function Column(options?: Record<string, unknown>): PropertyDecorator;
  export function PrimaryColumn(options?: Record<string, unknown>): PropertyDecorator;
  export class Repository<T> {
    findOneBy(where: Partial<T>): Promise<T | null>;
    save(entity: T): Promise<T>;
  }
}

declare module 'express' {
  export interface Request {
    params: Record<string, string>;
    body: Record<string, unknown>;
    header(name: string): string | undefined;
  }
  export interface Response {
    status(code: number): Response;
    json(body: unknown): Response;
  }
}

declare module '@nestjs/common' {
  export function Injectable(): ClassDecorator;
  export function Controller(prefix?: string): ClassDecorator;
  export function Module(metadata: {
    imports?: unknown[];
    controllers?: unknown[];
    providers?: unknown[];
    exports?: unknown[];
  }): ClassDecorator;
  export function Inject(token: unknown): ParameterDecorator & PropertyDecorator;
  export function Catch(...exceptions: unknown[]): ClassDecorator;
  export function UseGuards(...guards: unknown[]): ClassDecorator & MethodDecorator;
  export function Get(path?: string): MethodDecorator;
  export function Post(path?: string): MethodDecorator;
  export function Delete(path?: string): MethodDecorator;
  export function Body(): ParameterDecorator;
  export function Param(name?: string): ParameterDecorator;
  export interface ExecutionContext {
    switchToHttp(): { getRequest<T = unknown>(): T; getResponse<T = unknown>(): T };
  }
  export interface ArgumentsHost {
    switchToHttp(): { getRequest<T = unknown>(): T; getResponse<T = unknown>(): T };
  }
  export interface CanActivate {
    canActivate(context: ExecutionContext): boolean;
  }
  export interface ExceptionFilter<T = unknown> {
    catch(exception: T, host: ArgumentsHost): void;
  }
  export class HttpException extends Error {
    constructor(response: string | Record<string, unknown>, status: number);
    getStatus(): number;
  }
  export class NotFoundException extends HttpException {
    constructor(message?: string);
  }
  export enum HttpStatus {
    BAD_REQUEST = 400,
    NOT_FOUND = 404,
    CONFLICT = 409,
  }
}

declare module '@nestjs/core' {
  export const APP_FILTER = 'APP_FILTER';
  export const APP_GUARD = 'APP_GUARD';
  export class NestFactory {
    static create(module: unknown): Promise<{ listen(port: number): Promise<void> }>;
  }
}
```

## Response schema

{"properties":{"expectedGraph":{"properties":{"edges":{"items":{"properties":{"from":{"type":"string"},"kind":{"enum":["import","re-export"],"type":"string"},"through":{"items":{"type":"string"},"type":"array"},"to":{"type":"string"},"typeOnly":{"type":"boolean"},"viaReExport":{"type":"boolean"}},"required":["from","to","kind"],"type":"object"},"type":"array"},"files":{"items":{"properties":{"context":{"nullable":true,"type":"string"},"file":{"type":"string"},"layer":{"nullable":true,"type":"string"}},"required":["file","layer"],"type":"object"},"type":"array"}},"required":["files","edges"],"type":"object"},"findings":{"items":{"properties":{"alsoMatches":{"items":{"type":"string"},"type":"array"},"confidence":{"enum":["high","medium","low"],"type":"string"},"file":{"type":"string"},"reason":{"type":"string"},"ruleId":{"type":"string"},"target":{"nullable":true,"type":"string"},"tier":{"enum":["blocking","advisory"],"type":"string"}},"required":["ruleId","file","tier","reason","confidence"],"type":"object"},"type":"array"},"nearMissOk":{"items":{"properties":{"nearMissOk":{"type":"string"},"reason":{"type":"string"}},"required":["nearMissOk","reason"],"type":"object"},"type":"array"},"verdict":{"enum":["pass","fail"],"type":"string"}},"required":["verdict","expectedGraph","findings","nearMissOk"],"type":"object"}