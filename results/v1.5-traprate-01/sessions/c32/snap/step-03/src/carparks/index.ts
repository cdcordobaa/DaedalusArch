import { CloseCarPark } from './application/CloseCarPark';
import { GetCarPark } from './application/GetCarPark';
import { HoldBays } from './application/HoldBays';
import { OpenCarPark } from './application/OpenCarPark';
import { ReleaseBays } from './application/ReleaseBays';
import { TryHoldBays } from './application/TryHoldBays';
import type { CarParkView } from './contracts/CarParkView';
import type { CarParkRepository } from './domain/carpark/CarParkRepository';
import { InMemoryCarParkRepository } from './infrastructure/InMemoryCarParkRepository';

export type { CarParkView } from './contracts/CarParkView';

/** What the rest of the system may call. */
export interface CarParksModule {
  open(name: string, bays: number): string;
  carPark(carParkId: string): CarParkView | undefined;
  holdBays(carParkId: string, holder: string, bays: number): void;
  /** Holds the bays only if all are free; false (and nothing held) otherwise. */
  tryHoldBays(carParkId: string, holder: string, bays: number): boolean;
  releaseBays(carParkId: string, holder: string): void;
  close(carParkId: string): void;
}

export function createCarParks(carParks: CarParkRepository = new InMemoryCarParkRepository()): CarParksModule {
  return {
    open: (name, bays) => new OpenCarPark(carParks).execute(name, bays),
    carPark: (carParkId) => new GetCarPark(carParks).execute(carParkId),
    holdBays: (carParkId, holder, bays) => new HoldBays(carParks).execute(carParkId, holder, bays),
    tryHoldBays: (carParkId, holder, bays) => new TryHoldBays(carParks).execute(carParkId, holder, bays),
    releaseBays: (carParkId, holder) => new ReleaseBays(carParks).execute(carParkId, holder),
    close: (carParkId) => new CloseCarPark(carParks).execute(carParkId),
  };
}
