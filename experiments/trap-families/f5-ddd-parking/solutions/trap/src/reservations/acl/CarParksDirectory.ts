import type { CarParksModule } from '../../carparks';
import type { CarParkDirectory } from '../application/ports/CarParkDirectory';

/** Translates the car parks module's published calls into what reservations need. */
export class CarParksDirectory implements CarParkDirectory {
  constructor(private readonly carParks: CarParksModule) {}

  exists(carParkId: string): boolean {
    return this.carParks.carPark(carParkId) !== undefined;
  }

  isClosed(carParkId: string): boolean {
    return this.carParks.carPark(carParkId)?.closed === true;
  }

  holdBays(carParkId: string, holder: string, bays: number): void {
    this.carParks.holdBays(carParkId, holder, bays);
  }

  releaseBays(carParkId: string, holder: string): void {
    this.carParks.releaseBays(carParkId, holder);
  }
}
