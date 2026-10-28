import type { Outbox } from '../../messaging/Outbox';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { CarPark, type CarParkState } from '../domain/carpark/CarPark';
import type { CarParkRepository } from '../domain/carpark/CarParkRepository';
import { CarParkId } from '../domain/carpark/value-objects/CarParkId';

/** Car parks and their outbox in one store: saving a car park stores its pending events in the same step. */
export class InMemoryCarParkRepository implements CarParkRepository, Outbox {
  private readonly rows = new Map<string, CarParkState>();
  private outbox: DomainEvent[] = [];
  private sequence = 0;

  nextId(): CarParkId {
    this.sequence += 1;
    return CarParkId.of(`P-${String(this.sequence).padStart(4, '0')}`);
  }

  byId(id: CarParkId): CarPark | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : CarPark.restore(row);
  }

  save(carPark: CarPark): void {
    const events = carPark.pullEvents();
    this.rows.set(carPark.id.value, carPark.state());
    this.outbox = [...this.outbox, ...events];
  }

  takePending(): DomainEvent[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }
}
