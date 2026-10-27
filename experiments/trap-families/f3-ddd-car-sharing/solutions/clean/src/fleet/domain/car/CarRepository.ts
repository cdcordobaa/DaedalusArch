import type { Car } from './Car';
import type { CarId } from './value-objects/CarId';

export interface CarRepository {
  nextId(): CarId;
  nextBookingId(): string;
  nextMoveId(): string;
  byId(id: CarId): Car | undefined;
  /** Stores the car and its pending events in one step. */
  save(car: Car): void;
}
