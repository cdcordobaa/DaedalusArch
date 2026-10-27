import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { Outbox } from '../application/ports/Outbox';
import { Car, type CarState } from '../domain/car/Car';
import type { CarRepository } from '../domain/car/CarRepository';
import { CarId } from '../domain/car/value-objects/CarId';

/** Cars and their outbox in one store: saving a car stores its pending events in the same step. */
export class InMemoryCarRepository implements CarRepository, Outbox {
  private readonly rows = new Map<string, CarState>();
  private outbox: DomainEvent[] = [];
  private sequence = 0;
  private bookingSequence = 0;
  private moves = 0;

  nextId(): CarId {
    this.sequence += 1;
    return CarId.of(`C-${String(this.sequence).padStart(4, '0')}`);
  }

  nextBookingId(): string {
    this.bookingSequence += 1;
    return `B-${String(this.bookingSequence).padStart(4, '0')}`;
  }

  nextMoveId(): string {
    this.moves += 1;
    return `M-${String(this.moves).padStart(4, '0')}`;
  }

  byId(id: CarId): Car | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : Car.restore(row);
  }

  save(car: Car): void {
    const events = car.pullEvents();
    this.rows.set(car.id.value, car.state());
    this.outbox = [...this.outbox, ...events];
  }

  takePending(): DomainEvent[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }
}
