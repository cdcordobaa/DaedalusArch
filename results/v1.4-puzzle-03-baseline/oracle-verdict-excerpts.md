## c02 p3r-shipping-quotes SG1

- Oracle evidence:
  - `src/application/ports/out/RatePort.ts:5 vendor symbol FastshipRate`
  - `src/application/services/QuoteShipmentService.ts:25 vendor symbol FastshipUnavailableError`
  - `src/application/services/QuoteShipmentService.ts:33 vendor symbol serviceCode`
  - `src/application/services/QuoteShipmentService.ts:33 vendor code 'FREIGHT'`
  - `src/application/services/QuoteShipmentService.ts:34 vendor symbol amount`
  - `src/application/services/QuoteShipmentService.ts:34 vendor symbol value`
  - `src/application/services/QuoteShipmentService.ts:36 vendor symbol amount`
  - `src/application/services/QuoteShipmentService.ts:36 vendor symbol currency`
  - `src/application/services/QuoteShipmentService.ts:37 vendor symbol serviceName`
- Category: (hand read)
- Proposed label: (hand read)

`src/application/ports/out/RatePort.ts` lines 2–7:

```ts
import type { Parcel } from '../../../domain/model/Parcel';

export interface RatePort {
  rates(parcel: Parcel): Promise<FastshipRate[]>;
}

```

`src/application/services/QuoteShipmentService.ts` lines 22–28:

```ts
    try {
      rates = await this.rates.rates(parcel);
    } catch (e) {
      if (!(e instanceof FastshipUnavailableError)) throw e;
      const house = this.fallback.quote(parcel);
      return { amount: house.price.amount(), currency: house.price.currency, service: house.service, estimated: true };
    }
```

`src/application/services/QuoteShipmentService.ts` lines 30–36:

```ts
    let cheapest: { price: Money; service: string } | undefined;
    const freightOnly = parcel.weightGrams > FREIGHT_THRESHOLD_GRAMS;
    for (const rate of rates) {
      if ((rate.serviceCode === 'FREIGHT') !== freightOnly) continue;
      const value = Number(rate.amount.value);
      if (!Number.isFinite(value)) continue;
      const price = Money.of(value, rate.amount.currency);
```

## c02 p3r-shipping-quotes SG2

- Oracle evidence:
  - `src/application/services/QuoteShipmentService.ts:1 runtime import of fastship-sdk`
- Category: (hand read)
- Proposed label: (hand read)

`src/application/services/QuoteShipmentService.ts` lines 1–4:

```ts
import { FastshipUnavailableError } from 'fastship-sdk';
import { ShippingError } from '../../domain/errors/ShippingError';
import { Money } from '../../domain/model/Money';
import { Parcel } from '../../domain/model/Parcel';
```

## c03 p5-ferry-seats SG1

- Oracle evidence:
  - `book: Sailing.hold (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:19 Object.book`
  - `book: InMemorySailingRepository.save (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:19 Object.book`
- Category: (hand read)
- Proposed label: (hand read)

`src/bookings/index.ts` lines 16–22:

```ts

export function createBookings(bookings: BookingRepository, sailings: SailingDirectory): BookingsModule {
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings).execute(passenger, sailingId, seats),
    booking: (bookingId) => new GetBooking(bookings, sailings).execute(bookingId),
    cancel: (bookingId) => new CancelBooking(bookings, sailings).execute(bookingId),
  };
```

## c03 p5-ferry-seats SG2

- Oracle evidence:
  - `cancelBooking: Sailing.release (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:21 Object.cancel`
  - `cancelBooking: InMemorySailingRepository.save (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:21 Object.cancel`
- Category: (hand read)
- Proposed label: (hand read)

`src/bookings/index.ts` lines 18–24:

```ts
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings).execute(passenger, sailingId, seats),
    booking: (bookingId) => new GetBooking(bookings, sailings).execute(bookingId),
    cancel: (bookingId) => new CancelBooking(bookings, sailings).execute(bookingId),
  };
}

```

## c05 p5-ferry-seats SG1

- Oracle evidence:
  - `book: Sailing.tryHold (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:19 Object.book`
  - `book: InMemorySailingRepository.save (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:19 Object.book`
- Category: (hand read)
- Proposed label: (hand read)

`src/bookings/index.ts` lines 16–22:

```ts

export function createBookings(bookings: BookingRepository, sailings: SailingDirectory): BookingsModule {
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings).execute(passenger, sailingId, seats),
    cancel: (bookingId) => new CancelBooking(bookings, sailings).execute(bookingId),
    booking: (bookingId) => new GetBooking(bookings, sailings).execute(bookingId),
  };
```

## c05 p5-ferry-seats SG2

- Oracle evidence:
  - `cancelBooking: Sailing.release (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:20 Object.cancel`
  - `cancelBooking: InMemorySailingRepository.save (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:20 Object.cancel`
- Category: (hand read)
- Proposed label: (hand read)

`src/bookings/index.ts` lines 17–23:

```ts
export function createBookings(bookings: BookingRepository, sailings: SailingDirectory): BookingsModule {
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings).execute(passenger, sailingId, seats),
    cancel: (bookingId) => new CancelBooking(bookings, sailings).execute(bookingId),
    booking: (bookingId) => new GetBooking(bookings, sailings).execute(bookingId),
  };
}
```

## c06 p6-workshop-jobs SG1

- Oracle evidence:
  - `src/presentation/ReportsController.ts:3 imports ../persistence/MechanicGateway (skips a layer)`
  - `src/presentation/ReportsController.ts:10 uses MechanicGateway declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:25 uses all declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:25 uses id declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:25 uses name declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:27 uses all declared in src/persistence/JobGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:28 uses closedOn declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:29 uses mechanicId declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:29 uses labourMinutes declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:29 uses partsCents declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:41 uses all declared in src/persistence/JobGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:41 uses closedOn declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:43 uses all declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:45 uses mechanicId declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:45 uses id declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:47 uses openedOn declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:48 uses name declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:48 uses plate declared in src/persistence/records/JobRecord.ts (skips a layer)`
- Category: (hand read)
- Proposed label: (hand read)

`src/presentation/ReportsController.ts` lines 1–6:

```ts
import { formatCents, jobTotalCents } from '../business/rules/Pricing';
import type { JobGateway } from '../persistence/JobGateway';
import type { MechanicGateway } from '../persistence/MechanicGateway';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD and GET /reports/workload. */
```

`src/presentation/ReportsController.ts` lines 7–13:

```ts
export class ReportsController {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicGateway,
  ) {}

  /** Jobs closed on the day and what they brought in. */
```

`src/presentation/ReportsController.ts` lines 22–28:

```ts
  /** Takings per mechanic for jobs closed in the month (YYYY-MM), highest first, then by name. */
  takingsByMechanic(month: string): HttpResponse {
    return handle(() => {
      const names = new Map(this.mechanics.all().map((m) => [m.id, m.name] as const));
      const totals = new Map<string, number>();
      for (const j of this.jobs.all()) {
        if (j.closedOn === null || !j.closedOn.startsWith(`${month}-`)) continue;
```

## c08 p6-workshop-jobs SG1

- Oracle evidence:
  - `src/presentation/ReportsController.ts:3 imports ../persistence/MechanicGateway (skips a layer)`
  - `src/presentation/ReportsController.ts:10 uses MechanicGateway declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:26 uses closedIn declared in src/persistence/JobGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:27 uses mechanicId declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:27 uses labourMinutes declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:27 uses partsCents declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:30 uses byId declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:30 uses name declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:39 uses open declared in src/persistence/JobGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:41 uses all declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:44 uses mechanicId declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:44 uses id declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:45 uses openedOn declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:46 uses name declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:46 uses plate declared in src/persistence/records/JobRecord.ts (skips a layer)`
- Category: (hand read)
- Proposed label: (hand read)

`src/presentation/ReportsController.ts` lines 1–6:

```ts
import { formatCents, jobTotalCents } from '../business/rules/Pricing';
import type { JobGateway } from '../persistence/JobGateway';
import type { MechanicGateway } from '../persistence/MechanicGateway';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD. */
```

`src/presentation/ReportsController.ts` lines 7–13:

```ts
export class ReportsController {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicGateway,
  ) {}

  /** Jobs closed on the day and what they brought in. */
```

`src/presentation/ReportsController.ts` lines 23–29:

```ts
  takingsByMechanic(month: string): HttpResponse {
    return handle(() => {
      const cents = new Map<string, number>();
      for (const j of this.jobs.closedIn(month)) {
        cents.set(j.mechanicId, (cents.get(j.mechanicId) ?? 0) + jobTotalCents(j.labourMinutes, j.partsCents));
      }
      return [...cents.entries()]
```

## c09 p6-workshop-jobs SG1

- Oracle evidence:
  - `src/presentation/ReportsController.ts:3 imports ../persistence/MechanicGateway (skips a layer)`
  - `src/presentation/ReportsController.ts:10 uses MechanicGateway declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:26 uses closedInMonth declared in src/persistence/JobGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:27 uses mechanicId declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:27 uses labourMinutes declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:27 uses partsCents declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:30 uses byId declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:30 uses name declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:41 uses all declared in src/persistence/JobGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:41 uses closedOn declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:42 uses all declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:43 uses mechanicId declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:43 uses id declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:46 uses openedOn declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:48 uses name declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:48 uses plate declared in src/persistence/records/JobRecord.ts (skips a layer)`
- Category: (hand read)
- Proposed label: (hand read)

`src/presentation/ReportsController.ts` lines 1–6:

```ts
import { formatCents, jobTotalCents } from '../business/rules/Pricing';
import type { JobGateway } from '../persistence/JobGateway';
import type { MechanicGateway } from '../persistence/MechanicGateway';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD. */
```

`src/presentation/ReportsController.ts` lines 7–13:

```ts
export class ReportsController {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicGateway,
  ) {}

  /** Jobs closed on the day and what they brought in. */
```

`src/presentation/ReportsController.ts` lines 23–29:

```ts
  takingsByMechanic(month: string): HttpResponse {
    return handle(() => {
      const cents = new Map<string, number>();
      for (const j of this.jobs.closedInMonth(month)) {
        cents.set(j.mechanicId, (cents.get(j.mechanicId) ?? 0) + jobTotalCents(j.labourMinutes, j.partsCents));
      }
      const rows = [...cents].map(([id, total]) => ({
```

## c12 p6-workshop-jobs SG1

- Oracle evidence:
  - `src/presentation/ReportsController.ts:3 imports ../persistence/MechanicGateway (skips a layer)`
  - `src/presentation/ReportsController.ts:10 uses MechanicGateway declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:16 uses open declared in src/persistence/JobGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:18 uses all declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:20 uses mechanicId declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:20 uses id declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:22 uses openedOn declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:23 uses name declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:23 uses plate declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:32 uses all declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:32 uses id declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:32 uses name declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:34 uses closedInMonth declared in src/persistence/JobGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:35 uses mechanicId declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:35 uses labourMinutes declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:35 uses partsCents declared in src/persistence/records/JobRecord.ts (skips a layer)`
- Category: (hand read)
- Proposed label: (hand read)

`src/presentation/ReportsController.ts` lines 1–6:

```ts
import { formatCents, jobTotalCents } from '../business/rules/Pricing';
import type { JobGateway } from '../persistence/JobGateway';
import type { MechanicGateway } from '../persistence/MechanicGateway';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD. */
```

`src/presentation/ReportsController.ts` lines 7–13:

```ts
export class ReportsController {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicGateway,
  ) {}

  /** Every mechanic with their open job count and the plate of their longest-open job, busiest first. */
```

`src/presentation/ReportsController.ts` lines 13–19:

```ts
  /** Every mechanic with their open job count and the plate of their longest-open job, busiest first. */
  workload(): HttpResponse {
    return handle(() => {
      const open = this.jobs.open();
      return this.mechanics
        .all()
        .map((m) => {
```

## c13 p5-ferry-seats SG1

- Oracle evidence:
  - `book: Sailing.hold (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:19 Object.book`
  - `book: InMemorySailingRepository.save (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:19 Object.book`
- Category: (hand read)
- Proposed label: (hand read)

`src/bookings/index.ts` lines 16–22:

```ts

export function createBookings(bookings: BookingRepository, sailings: SailingDirectory): BookingsModule {
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings).execute(passenger, sailingId, seats),
    booking: (bookingId) => new GetBooking(bookings, sailings).execute(bookingId),
    cancel: (bookingId) => new CancelBooking(bookings, sailings).execute(bookingId),
  };
```

## c13 p5-ferry-seats SG2

- Oracle evidence:
  - `cancelBooking: Sailing.release (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:21 Object.cancel`
  - `cancelBooking: InMemorySailingRepository.save (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:21 Object.cancel`
- Category: (hand read)
- Proposed label: (hand read)

`src/bookings/index.ts` lines 18–24:

```ts
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings).execute(passenger, sailingId, seats),
    booking: (bookingId) => new GetBooking(bookings, sailings).execute(bookingId),
    cancel: (bookingId) => new CancelBooking(bookings, sailings).execute(bookingId),
  };
}

```

## c14 p5-ferry-seats SG1

- Oracle evidence:
  - `book: Sailing.hold (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:19 Object.book`
  - `book: InMemorySailingRepository.save (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:19 Object.book`
- Category: (hand read)
- Proposed label: (hand read)

`src/bookings/index.ts` lines 16–22:

```ts

export function createBookings(bookings: BookingRepository, sailings: SailingDirectory): BookingsModule {
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings).execute(passenger, sailingId, seats),
    cancel: (bookingId) => new CancelBooking(bookings, sailings).execute(bookingId),
    booking: (bookingId) => new GetBooking(bookings, sailings).execute(bookingId),
  };
```

## c14 p5-ferry-seats SG2

- Oracle evidence:
  - `cancelBooking: Sailing.release (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:20 Object.cancel`
  - `cancelBooking: InMemorySailingRepository.save (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:20 Object.cancel`
- Category: (hand read)
- Proposed label: (hand read)

`src/bookings/index.ts` lines 17–23:

```ts
export function createBookings(bookings: BookingRepository, sailings: SailingDirectory): BookingsModule {
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings).execute(passenger, sailingId, seats),
    cancel: (bookingId) => new CancelBooking(bookings, sailings).execute(bookingId),
    booking: (bookingId) => new GetBooking(bookings, sailings).execute(bookingId),
  };
}
```

## c15 p6-workshop-jobs SG1

- Oracle evidence:
  - `src/presentation/ReportsController.ts:3 imports ../persistence/MechanicGateway (skips a layer)`
  - `src/presentation/ReportsController.ts:10 uses MechanicGateway declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:25 uses all declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:25 uses id declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:25 uses name declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:27 uses all declared in src/persistence/JobGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:28 uses closedOn declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:29 uses mechanicId declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:29 uses labourMinutes declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:29 uses partsCents declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:41 uses all declared in src/persistence/JobGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:41 uses closedOn declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:42 uses all declared in src/persistence/MechanicGateway.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:44 uses mechanicId declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:44 uses id declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:45 uses openedOn declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:45 uses id declared in src/persistence/records/JobRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:46 uses name declared in src/persistence/records/MechanicRecord.ts (skips a layer)`
  - `src/presentation/ReportsController.ts:46 uses plate declared in src/persistence/records/JobRecord.ts (skips a layer)`
- Category: (hand read)
- Proposed label: (hand read)

`src/presentation/ReportsController.ts` lines 1–6:

```ts
import { formatCents, jobTotalCents } from '../business/rules/Pricing';
import type { JobGateway } from '../persistence/JobGateway';
import type { MechanicGateway } from '../persistence/MechanicGateway';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD. */
```

`src/presentation/ReportsController.ts` lines 7–13:

```ts
export class ReportsController {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicGateway,
  ) {}

  /** Jobs closed on the day and what they brought in. */
```

`src/presentation/ReportsController.ts` lines 22–28:

```ts
  /** Takings per mechanic for jobs closed in the month (YYYY-MM), highest first. */
  takingsByMechanic(month: string): HttpResponse {
    return handle(() => {
      const names = new Map(this.mechanics.all().map((m) => [m.id, m.name]));
      const totals = new Map<string, number>();
      for (const j of this.jobs.all()) {
        if (j.closedOn === null || j.closedOn.slice(0, 7) !== month) continue;
```

## c16 p5-ferry-seats SG1

- Oracle evidence:
  - `book: Sailing.hold (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:19 Object.book`
  - `book: InMemorySailingRepository.save (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:19 Object.book`
- Category: (hand read)
- Proposed label: (hand read)

`src/bookings/index.ts` lines 16–22:

```ts

export function createBookings(bookings: BookingRepository, sailings: SailingDirectory): BookingsModule {
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings).execute(passenger, sailingId, seats),
    cancel: (bookingId) => new CancelBooking(bookings, sailings).execute(bookingId),
    booking: (bookingId) => new GetBooking(bookings, sailings).execute(bookingId),
  };
```

## c16 p5-ferry-seats SG2

- Oracle evidence:
  - `cancelBooking: Sailing.release (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:20 Object.cancel`
  - `cancelBooking: InMemorySailingRepository.save (sailings) changed with no event delivery on the stack, inside src/bookings/index.ts:20 Object.cancel`
- Category: (hand read)
- Proposed label: (hand read)

`src/bookings/index.ts` lines 17–23:

```ts
export function createBookings(bookings: BookingRepository, sailings: SailingDirectory): BookingsModule {
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings).execute(passenger, sailingId, seats),
    cancel: (bookingId) => new CancelBooking(bookings, sailings).execute(bookingId),
    booking: (bookingId) => new GetBooking(bookings, sailings).execute(bookingId),
  };
}
```

