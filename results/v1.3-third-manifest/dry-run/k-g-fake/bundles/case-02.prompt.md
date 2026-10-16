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

Case case-02. Style: hexagonal.

## Style rules and their sources

- Core isolation, dependency direction: The application core communicates with the outside only through ports. It does not depend on adapters, UI or databases. (Cockburn, "Hexagonal Architecture" (2005))
- Port-adapter: Each external actor talks to the application through a port. Adapters convert between the port and the technology; secondary (driven) adapters implement ports the core defines. (Cockburn 2005)

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
  style: hexagonal
  layers:
    - name: domain
      kind: domain
      directories:
        - src/domain/**
      roles:
        - entity
        - value-object
        - domain-service
        - port
    - name: application
      kind: application
      directories:
        - src/application/**
      roles:
        - use-case
        - port
        - application-service
    - name: adapters-inbound
      kind: presentation
      directories:
        - src/adapters/inbound/**
      roles:
        - controller
        - cli-command
        - message-consumer
    - name: adapters-outbound
      kind: infrastructure
      directories:
        - src/adapters/outbound/**
      roles:
        - repository
        - gateway
        - external-api-client
    - name: config
      kind: application
      directories:
        - src/config/**
      roles:
        - composition-root
        - module
  allowed_dependencies:
    - from: application
      to:
        - domain
    - from: adapters-inbound
      to:
        - application
        - domain
    - from: adapters-outbound
      to:
        - application
        - domain
    - from: config
      to:
        - domain
        - application
        - adapters-inbound
        - adapters-outbound
```

## Source files (31, every comment removed)

### src/adapters/inbound/cli/BookingCli.ts

```ts
import { BookRoom } from '../../../application/ports/in/BookRoom';
import { BookingView } from '../../../application/ports/in/BookingView';

export function formatCliLine(view: BookingView): string {
  return `${view.id}\t${view.roomId}\t${view.checkIn.slice(0, 10)}..${view.checkOut.slice(0, 10)}\t${view.status}`;
}


export class BookingCli {
  constructor(private readonly bookRoom: BookRoom) {}

  async run(argv: readonly string[]): Promise<string> {
    const [command, roomId, guestId, checkIn, checkOut, guests] = argv;
    if (command !== 'book' || !roomId || !guestId || !checkIn || !checkOut) {
      return 'usage: book <roomId> <guestId> <checkIn> <checkOut> [guests]';
    }
    const view = await this.bookRoom.book({ roomId, guestId, checkIn, checkOut, guests: Number(guests ?? 1) });
    return formatCliLine(view);
  }
}
```

### src/adapters/inbound/http/BookingController.ts

```ts
import { BookRoom } from '../../../application/ports/in/BookRoom';
import { CancelBooking } from '../../../application/ports/in/CancelBooking';
import { BookingError } from '../../../domain/errors/BookingError';
import { HttpRequest, HttpResponse } from './HttpTypes';

const STATUS = { 'not-found': 404, unavailable: 409, invalid: 400, 'payment-declined': 402 } as const;


export class BookingController {
  constructor(
    private readonly bookRoom: BookRoom,
    private readonly cancelBooking: CancelBooking,
  ) {}

  async create(request: HttpRequest): Promise<HttpResponse> {
    try {
      const view = await this.bookRoom.book({
        roomId: String(request.body['roomId']),
        guestId: String(request.body['guestId']),
        checkIn: String(request.body['checkIn']),
        checkOut: String(request.body['checkOut']),
        guests: Number(request.body['guests'] ?? 1),
      });
      return { status: 201, body: view };
    } catch (error) {
      return this.toResponse(error);
    }
  }

  async cancel(request: HttpRequest): Promise<HttpResponse> {
    try {
      return { status: 200, body: await this.cancelBooking.cancel(String(request.params['id'])) };
    } catch (error) {
      return this.toResponse(error);
    }
  }

  private toResponse(error: unknown): HttpResponse {
    if (error instanceof BookingError) return { status: STATUS[error.reason], body: { error: error.message } };
    return { status: 500, body: { error: 'Internal error' } };
  }
}
```

### src/adapters/inbound/http/HttpTypes.ts

```ts
export interface HttpRequest {
  params: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, unknown>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
```

### src/adapters/inbound/http/RoomController.ts

```ts
import { FindAvailableRooms } from '../../../application/ports/in/FindAvailableRooms';
import { HttpRequest, HttpResponse } from './HttpTypes';

export class RoomController {
  constructor(private readonly findAvailableRooms: FindAvailableRooms) {}

  async available(request: HttpRequest): Promise<HttpResponse> {
    const rooms = await this.findAvailableRooms.find(
      String(request.query['checkIn']),
      String(request.query['checkOut']),
      Number(request.query['guests'] ?? 1),
    );
    return { status: 200, body: rooms };
  }
}
```

### src/adapters/outbound/notification/OutboxNotificationAdapter.ts

```ts
import { NotificationSender } from '../../../application/ports/out/NotificationSender';


export class OutboxNotificationAdapter implements NotificationSender {
  readonly outbox: { recipient: string; message: string }[] = [];

  async send(recipient: string, message: string): Promise<void> {
    this.outbox.push({ recipient, message });
  }
}
```

### src/adapters/outbound/payment/FakePaymentGateway.ts

```ts
import { PaymentGateway } from '../../../application/ports/out/PaymentGateway';
import { BookingError } from '../../../domain/errors/BookingError';
import { Money } from '../../../domain/model/Money';

export const PAYMENT_FEE_CENTS = 150;


export class FakePaymentGateway implements PaymentGateway {
  private readonly charges = new Map<string, number>();

  async charge(guestId: string, amount: Money): Promise<string> {
    if (amount.cents > 500_000) throw new BookingError('payment-declined', `Charge for ${guestId} declined`);
    const ref = `pay-${this.charges.size + 1}`;
    this.charges.set(ref, amount.cents);
    return ref;
  }

  async refund(paymentRef: string): Promise<void> {
    this.charges.delete(paymentRef);
  }
}
```

### src/adapters/outbound/persistence/InMemoryBookingRepository.ts

```ts
import { BookingRepository } from '../../../application/ports/out/BookingRepository';
import { Booking } from '../../../domain/model/Booking';

export class InMemoryBookingRepository implements BookingRepository {
  private readonly rows = new Map<string, Booking>();
  private sequence = 0;

  async findById(id: string): Promise<Booking | undefined> {
    return this.rows.get(id);
  }

  async findByRoom(roomId: string): Promise<Booking[]> {
    return [...this.rows.values()].filter((b) => b.roomId === roomId);
  }

  async findActive(): Promise<Booking[]> {
    return [...this.rows.values()].filter((b) => b.isActive);
  }

  async save(booking: Booking): Promise<void> {
    this.rows.set(booking.id, booking);
  }

  nextId(): string {
    this.sequence += 1;
    return `bk-${this.sequence}`;
  }
}
```

### src/adapters/outbound/persistence/InMemoryGuestRepository.ts

```ts
import { GuestRepository } from '../../../application/ports/out/GuestRepository';
import { Guest } from '../../../domain/model/Guest';

export class InMemoryGuestRepository implements GuestRepository {
  private readonly guests = new Map<string, Guest>([['g-1', new Guest('g-1', 'Alistair', 'alistair@example.org')]]);

  async findById(id: string): Promise<Guest | undefined> {
    return this.guests.get(id);
  }
}
```

### src/adapters/outbound/persistence/InMemoryRoomRepository.ts

```ts
import { RoomRepository } from '../../../application/ports/out/RoomRepository';
import { Money } from '../../../domain/model/Money';
import { Room } from '../../../domain/model/Room';

export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, Room>([
    ['r-101', new Room('r-101', '101', Money.ofCents(9_000), 2)],
    ['r-102', new Room('r-102', '102', Money.ofCents(12_000), 3)],
    ['r-201', new Room('r-201', '201', Money.ofCents(20_000), 4)],
  ]);

  async findById(id: string): Promise<Room | undefined> {
    return this.rooms.get(id);
  }

  async findAll(): Promise<Room[]> {
    return [...this.rooms.values()];
  }
}
```

### src/application/ports/in/BookRoom.ts

```ts
import { BookingView } from './BookingView';

export interface BookRoomCommand {
  roomId: string;
  guestId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}


export interface BookRoom {
  book(command: BookRoomCommand): Promise<BookingView>;
}
```

### src/application/ports/in/BookingView.ts

```ts
import { Booking } from '../../../domain/model/Booking';

export interface BookingView {
  id: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  totalCents: number;
  status: string;
}

export function toBookingView(booking: Booking): BookingView {
  return {
    id: booking.id,
    roomId: booking.roomId,
    checkIn: booking.stay.checkIn.toISOString(),
    checkOut: booking.stay.checkOut.toISOString(),
    totalCents: booking.total.cents,
    status: booking.status,
  };
}
```

### src/application/ports/in/CancelBooking.ts

```ts
import { BookingView } from './BookingView';

export interface CancelBooking {
  cancel(bookingId: string): Promise<BookingView>;
}
```

### src/application/ports/in/FindAvailableRooms.ts

```ts
export interface AvailableRoom {
  roomId: string;
  number: string;
  nightlyRateCents: number;
}

export interface FindAvailableRooms {
  find(checkIn: string, checkOut: string, guests: number): Promise<AvailableRoom[]>;
}
```

### src/application/ports/out/BookingRepository.ts

```ts
import { Booking } from '../../../domain/model/Booking';


export interface BookingRepository {
  findById(id: string): Promise<Booking | undefined>;
  findByRoom(roomId: string): Promise<Booking[]>;
  findActive(): Promise<Booking[]>;
  save(booking: Booking): Promise<void>;
  nextId(): string;
}
```

### src/application/ports/out/GuestRepository.ts

```ts
import { Guest } from '../../../domain/model/Guest';


export interface GuestRepository {
  findById(id: string): Promise<Guest | undefined>;
}
```

### src/application/ports/out/NotificationSender.ts

```ts

export interface NotificationSender {
  send(recipient: string, message: string): Promise<void>;
}
```

### src/application/ports/out/PaymentGateway.ts

```ts
import { Money } from '../../../domain/model/Money';


export interface PaymentGateway {
  charge(guestId: string, amount: Money): Promise<string>;
  refund(paymentRef: string): Promise<void>;
}
```

### src/application/ports/out/RoomRepository.ts

```ts
import { Room } from '../../../domain/model/Room';


export interface RoomRepository {
  findById(id: string): Promise<Room | undefined>;
  findAll(): Promise<Room[]>;
}
```

### src/application/services/BookRoomService.ts

```ts
import { BookingError } from '../../domain/errors/BookingError';
import { Booking } from '../../domain/model/Booking';
import { DateRange } from '../../domain/model/DateRange';
import { AvailabilityChecker } from '../../domain/services/AvailabilityChecker';
import { PriceCalculator } from '../../domain/services/PriceCalculator';
import { BookRoom, BookRoomCommand } from '../ports/in/BookRoom';
import { BookingView, toBookingView } from '../ports/in/BookingView';
import { BookingRepository } from '../ports/out/BookingRepository';
import { GuestRepository } from '../ports/out/GuestRepository';
import { NotificationSender } from '../ports/out/NotificationSender';
import { PaymentGateway } from '../ports/out/PaymentGateway';
import { RoomRepository } from '../ports/out/RoomRepository';

export class BookRoomService implements BookRoom {
  private readonly availability = new AvailabilityChecker();
  private readonly pricing = new PriceCalculator();

  constructor(
    private readonly rooms: RoomRepository,
    private readonly bookings: BookingRepository,
    private readonly guests: GuestRepository,
    private readonly payments: PaymentGateway,
    private readonly notifications: NotificationSender,
  ) {}

  async book(command: BookRoomCommand): Promise<BookingView> {
    const room = await this.rooms.findById(command.roomId);
    if (room === undefined) throw new BookingError('not-found', `No room ${command.roomId}`);
    const guest = await this.guests.findById(command.guestId);
    if (guest === undefined) throw new BookingError('not-found', `No guest ${command.guestId}`);
    if (!room.fits(command.guests)) throw new BookingError('invalid', `Room ${room.number} sleeps ${room.capacity}`);

    const stay = DateRange.parse(command.checkIn, command.checkOut);
    if (!this.availability.isAvailable(room, stay, await this.bookings.findByRoom(room.id))) {
      throw new BookingError('unavailable', `Room ${room.number} is taken for these dates`);
    }
    const total = this.pricing.quote(room, stay);
    const paymentRef = await this.payments.charge(guest.id, total);
    const booking = new Booking(this.bookings.nextId(), room.id, guest.id, stay, total, paymentRef);
    await this.bookings.save(booking);
    await this.notifications.send(guest.email, `Room ${room.number} is booked (${booking.id})`);
    return toBookingView(booking);
  }
}
```

### src/application/services/CancelBookingService.ts

```ts
import { BookingError } from '../../domain/errors/BookingError';
import { CancelBooking } from '../ports/in/CancelBooking';
import { BookingView, toBookingView } from '../ports/in/BookingView';
import { BookingRepository } from '../ports/out/BookingRepository';
import { GuestRepository } from '../ports/out/GuestRepository';
import { NotificationSender } from '../ports/out/NotificationSender';
import { PaymentGateway } from '../ports/out/PaymentGateway';

export class CancelBookingService implements CancelBooking {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly guests: GuestRepository,
    private readonly payments: PaymentGateway,
    private readonly notifications: NotificationSender,
  ) {}

  async cancel(bookingId: string): Promise<BookingView> {
    const booking = await this.bookings.findById(bookingId);
    if (booking === undefined) throw new BookingError('not-found', `No booking ${bookingId}`);
    booking.cancel();
    await this.payments.refund(booking.paymentRef);
    await this.bookings.save(booking);
    const guest = await this.guests.findById(booking.guestId);
    if (guest !== undefined) await this.notifications.send(guest.email, `Booking ${booking.id} is cancelled`);
    return toBookingView(booking);
  }
}
```

### src/application/services/FindAvailableRoomsService.ts

```ts
import { InMemoryRoomRepository } from '../../adapters/outbound/persistence/InMemoryRoomRepository';
import { DateRange } from '../../domain/model/DateRange';
import { AvailabilityChecker } from '../../domain/services/AvailabilityChecker';
import { AvailableRoom, FindAvailableRooms } from '../ports/in/FindAvailableRooms';
import { BookingRepository } from '../ports/out/BookingRepository';

export class FindAvailableRoomsService implements FindAvailableRooms {
  private readonly availability = new AvailabilityChecker();

  constructor(
    private readonly rooms: InMemoryRoomRepository,
    private readonly bookings: BookingRepository,
  ) {}

  async find(checkIn: string, checkOut: string, guests: number): Promise<AvailableRoom[]> {
    const stay = DateRange.parse(checkIn, checkOut);
    const active = await this.bookings.findActive();
    return (await this.rooms.findAll())
      .filter((room) => room.fits(guests) && this.availability.isAvailable(room, stay, active))
      .map((room) => ({ roomId: room.id, number: room.number, nightlyRateCents: room.nightlyRate.cents }));
  }
}
```

### src/config/container.ts

```ts
import { BookingCli } from '../adapters/inbound/cli/BookingCli';
import { BookingController } from '../adapters/inbound/http/BookingController';
import { RoomController } from '../adapters/inbound/http/RoomController';
import { OutboxNotificationAdapter } from '../adapters/outbound/notification/OutboxNotificationAdapter';
import { FakePaymentGateway } from '../adapters/outbound/payment/FakePaymentGateway';
import { InMemoryBookingRepository } from '../adapters/outbound/persistence/InMemoryBookingRepository';
import { InMemoryGuestRepository } from '../adapters/outbound/persistence/InMemoryGuestRepository';
import { InMemoryRoomRepository } from '../adapters/outbound/persistence/InMemoryRoomRepository';
import { BookRoomService } from '../application/services/BookRoomService';
import { CancelBookingService } from '../application/services/CancelBookingService';
import { FindAvailableRoomsService } from '../application/services/FindAvailableRoomsService';

export interface Container {
  bookings: BookingController;
  rooms: RoomController;
  cli: BookingCli;
}


export function createContainer(): Container {
  const rooms = new InMemoryRoomRepository();
  const bookings = new InMemoryBookingRepository();
  const guests = new InMemoryGuestRepository();
  const payments = new FakePaymentGateway();
  const notifications = new OutboxNotificationAdapter();

  const bookRoom = new BookRoomService(rooms, bookings, guests, payments, notifications);
  return {
    bookings: new BookingController(bookRoom, new CancelBookingService(bookings, guests, payments, notifications)),
    rooms: new RoomController(new FindAvailableRoomsService(rooms, bookings)),
    cli: new BookingCli(bookRoom),
  };
}
```

### src/domain/errors/BookingError.ts

```ts
export class BookingError extends Error {
  constructor(readonly reason: 'not-found' | 'unavailable' | 'invalid' | 'payment-declined', message: string) {
    super(message);
    this.name = 'BookingError';
  }
}
```

### src/domain/model/Booking.ts

```ts
import { BookingError } from '../errors/BookingError';
import { DateRange } from './DateRange';
import { Money } from './Money';

export type BookingStatus = 'confirmed' | 'cancelled';

export class Booking {
  private bookingStatus: BookingStatus = 'confirmed';

  constructor(
    readonly id: string,
    readonly roomId: string,
    readonly guestId: string,
    readonly stay: DateRange,
    readonly total: Money,
    readonly paymentRef: string,
  ) {}

  get status(): BookingStatus {
    return this.bookingStatus;
  }

  get isActive(): boolean {
    return this.bookingStatus === 'confirmed';
  }

  cancel(): void {
    if (!this.isActive) throw new BookingError('invalid', `Booking ${this.id} is already cancelled`);
    this.bookingStatus = 'cancelled';
  }
}
```

### src/domain/model/DateRange.ts

```ts
import { BookingError } from '../errors/BookingError';

const DAY_MS = 24 * 60 * 60 * 1000;

export class DateRange {
  constructor(
    readonly checkIn: Date,
    readonly checkOut: Date,
  ) {
    if (checkOut.getTime() <= checkIn.getTime()) {
      throw new BookingError('invalid', 'Check-out must be after check-in');
    }
  }

  static parse(checkIn: string, checkOut: string): DateRange {
    return new DateRange(new Date(checkIn), new Date(checkOut));
  }

  nights(): number {
    return Math.round((this.checkOut.getTime() - this.checkIn.getTime()) / DAY_MS);
  }

  overlaps(other: DateRange): boolean {
    return this.checkIn.getTime() < other.checkOut.getTime() && other.checkIn.getTime() < this.checkOut.getTime();
  }
}
```

### src/domain/model/Guest.ts

```ts
import { BookingError } from '../errors/BookingError';

export class Guest {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly email: string,
  ) {
    if (!email.includes('@')) throw new BookingError('invalid', `Invalid e-mail: ${email}`);
  }
}
```

### src/domain/model/Money.ts

```ts
import { BookingError } from '../errors/BookingError';

export class Money {
  private constructor(readonly cents: number) {}

  static ofCents(cents: number): Money {
    if (!Number.isInteger(cents) || cents < 0) throw new BookingError('invalid', `Invalid amount: ${cents}`);
    return new Money(cents);
  }

  times(factor: number): Money {
    return Money.ofCents(this.cents * factor);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }
}
```

### src/domain/model/Room.ts

```ts
import { Money } from './Money';

export class Room {
  constructor(
    readonly id: string,
    readonly number: string,
    readonly nightlyRate: Money,
    readonly capacity: number,
  ) {}

  fits(guests: number): boolean {
    return guests >= 1 && guests <= this.capacity;
  }
}
```

### src/domain/services/AvailabilityChecker.ts

```ts
import { Booking } from '../model/Booking';
import { DateRange } from '../model/DateRange';
import { Room } from '../model/Room';

export class AvailabilityChecker {
  isAvailable(room: Room, stay: DateRange, bookings: readonly Booking[]): boolean {
    return !bookings.some((b) => b.isActive && b.roomId === room.id && b.stay.overlaps(stay));
  }
}
```

### src/domain/services/PriceCalculator.ts

```ts
import { DateRange } from '../model/DateRange';
import { Money } from '../model/Money';
import { Room } from '../model/Room';

const CLEANING_FEE = Money.ofCents(2_500);

export class PriceCalculator {
  quote(room: Room, stay: DateRange): Money {
    return room.nightlyRate.times(stay.nights()).add(CLEANING_FEE);
  }
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