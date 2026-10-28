import type { CarPark } from './CarPark';
import type { CarParkId } from './value-objects/CarParkId';

export interface CarParkRepository {
  nextId(): CarParkId;
  byId(id: CarParkId): CarPark | undefined;
  /** Stores the car park and its pending events in one step. */
  save(carPark: CarPark): void;
}
