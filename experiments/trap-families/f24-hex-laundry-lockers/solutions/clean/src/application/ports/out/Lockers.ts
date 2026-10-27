import type { Locker } from '../../../domain/Locker';

export interface Lockers {
  nextId(): string;
  save(locker: Locker): void;
  byId(id: string): Locker | undefined;
  /** Every locker of a building, in bay order. */
  inBuilding(buildingId: string): Locker[];
  atBay(buildingId: string, bay: number): Locker | undefined;
}
