# Rule-gap reference run: sampled findings for labelling

Development data. 71 units, 0 errors. Each finding: the group (style or E1 task), the units it occurs in, the row, and a code excerpt (`>` marks the line). Label column left empty for the human labeller.

## use-case-framework-free

0 distinct findings; 0 sampled.

## controller-bypasses-application

3 distinct findings; 3 sampled.

### controller-bypasses-application #1 (clean-architecture)

- units: v07-controller-reads-entity
- row: `{"filePath":"src/infrastructure/http/LoanController.ts","controller":"LoanController","dependency":"LoanRepository","target":"src/domain/repositories/LoanRepository.ts","targetLayer":"domain"}`
- label: 

```ts
// src/infrastructure/http/LoanController.ts
  11       private readonly borrowBook: BorrowBookUseCase,
  12       private readonly returnBook: ReturnBookUseCase,
  13       private readonly listOverdue: ListOverdueLoansUseCase,
  14 >     private readonly loanRepository: LoanRepository,
  15     ) {}
  16   
  17     async show(request: HttpRequest): Promise<HttpResponse> {
```

### controller-bypasses-application #2 (hexagonal)

- units: v05-inbound-adapter-reads-outbound-adapter
- row: `{"filePath":"src/adapters/inbound/http/RoomController.ts","controller":"RoomController","dependency":"InMemoryRoomRepository","target":"src/adapters/outbound/persistence/InMemoryRoomRepository.ts","targetLayer":"adapters-outbound"}`
- label: 

```ts
// src/adapters/inbound/http/RoomController.ts
   5   export class RoomController {
   6     constructor(
   7       private readonly findAvailableRooms: FindAvailableRooms,
   8 >     private readonly roomStore: InMemoryRoomRepository,
   9     ) {}
  10   
  11     async show(request: HttpRequest): Promise<HttpResponse> {
```

### controller-bypasses-application #3 (layered)

- units: v03-controller-reads-gateway
- row: `{"filePath":"src/presentation/http/CatalogController.ts","controller":"CatalogController","dependency":"ProductGateway","target":"src/persistence/ProductGateway.ts","targetLayer":"persistence"}`
- label: 

```ts
// src/presentation/http/CatalogController.ts
   7   export class CatalogController {
   8     constructor(
   9       private readonly catalog: CatalogService,
  10 >     private readonly products: ProductGateway,
  11     ) {}
  12   
  13     stock(request: HttpRequest): HttpResponse {
```

## use-case-exposes-entity

2 distinct findings; 2 sampled.

### use-case-exposes-entity #1 (ddd)

- units: v08-cross-context-internal-import
- row: `{"filePath":"src/billing/application/IssueInvoice.ts","member":"IssueInvoice.executeFor","entity":"Order","target":"src/ordering/domain/order/Order.ts","positions":["param"]}`
- label: 

```ts
// src/billing/application/IssueInvoice.ts
  19       await this.invoices.save(invoice);
  20     }
  21   
  22 >   async executeFor(invoiceId: string, order: Order): Promise<void> {
  23       await this.execute(invoiceId, order.id.value);
  24     }
  25   }
```

### use-case-exposes-entity #2 (ddd)

- units: v01-aggregate-boundary
- row: `{"filePath":"src/ordering/application/GetOrderSummary.ts","member":"GetOrderSummary.describeLine","entity":"OrderLine","target":"src/ordering/domain/order/OrderLine.ts","positions":["param"]}`
- label: 

```ts
// src/ordering/application/GetOrderSummary.ts
  15     }
  16   
  17     // VIOLATION (aggregate boundary): code outside the Order aggregate names its inner entity OrderLine.
  18 >   describeLine(line: OrderLine): string {
  19       return `${String(line.lineNo)} ${line.productId} ${String(line.subtotal().cents)}`;
  20     }
  21   }
```

## aggregate-reference-by-identity

0 distinct findings; 0 sampled.

## aggregate-holds-service

0 distinct findings; 0 sampled.

## service-stateless

4 distinct findings; 4 sampled.

### service-stateless #1 (layered)

- units: clean, n01-controller-parses-money, n02-reporting-service-reads-database, n03-views-import-model-barrel … (13 units)
- row: `{"filePath":"src/business/services/OrderService.ts","class":"OrderService","layer":"business","fields":["sequence"]}`
- label: 

```ts
// src/business/services/OrderService.ts
  16   /** Service Layer (Fowler 2002): one transaction script per use of the order screen. */
  17   export class OrderService {
  18     private readonly pricing = new PricingPolicy();
  19 >   private sequence = 0;
  20   
  21     constructor(
  22       private readonly orders: OrderGateway,
```

### service-stateless #2 (nestjs)

- units: clean, n01-controller-catches-domain-error, n02-domain-port-named-dot-repository, n03-service-injects-sibling-service … (14 units)
- row: `{"filePath":"src/attendees/attendees.service.ts","class":"AttendeesService","layer":"application","fields":["sequence"]}`
- label: 

```ts
// src/attendees/attendees.service.ts
   6   
   7   @Injectable()
   8   export class AttendeesService {
   9 >   private sequence = 0;
  10   
  11     constructor(@Inject(ATTENDEE_REPOSITORY) private readonly attendees: AttendeeRepository) {}
  12   
```

### service-stateless #3 (nestjs)

- units: clean, n01-controller-catches-domain-error, n02-domain-port-named-dot-repository, n03-service-injects-sibling-service … (14 units)
- row: `{"filePath":"src/registrations/registrations.service.ts","class":"RegistrationsService","layer":"application","fields":["sequence"]}`
- label: 

```ts
// src/registrations/registrations.service.ts
  11   @Injectable()
  12   export class RegistrationsService {
  13     private readonly policy = new RegistrationPolicy();
  14 >   private sequence = 0;
  15   
  16     constructor(
  17       @Inject(WORKSHOP_REPOSITORY) private readonly workshops: WorkshopRepository,
```

### service-stateless #4 (nestjs)

- units: clean, n01-controller-catches-domain-error, n02-domain-port-named-dot-repository, n03-service-injects-sibling-service … (14 units)
- row: `{"filePath":"src/workshops/workshops.service.ts","class":"WorkshopsService","layer":"application","fields":["sequence"]}`
- label: 

```ts
// src/workshops/workshops.service.ts
   7   
   8   @Injectable()
   9   export class WorkshopsService {
  10 >   private sequence = 0;
  11   
  12     constructor(@Inject(WORKSHOP_REPOSITORY) private readonly workshops: WorkshopRepository) {}
  13   
```

## nest-provider-not-visible

0 distinct findings; 0 sampled.

## nest-provider-multiple-modules

0 distinct findings; 0 sampled.
