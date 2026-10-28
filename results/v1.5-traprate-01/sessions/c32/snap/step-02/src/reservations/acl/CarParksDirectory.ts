import type { CarParksModule } from '../../carparks';
import type { CarParkDirectory } from '../application/ports/CarParkDirectory';

/** Translates the car parks module's published calls into what reservations need. */
export class CarParksDirectory implements CarParkDirectory {
  constructor(private readonly carParks: CarParksModule) {}

  exists(carParkId: string): boolean {
    return this.carParks.carPark(carParkId) !== undefined;
  }

  takeBays(carParkId: string, holder: string, bays: number): boolean {
    return this.carParks.tryHoldBays(carParkId, holder, bays);
  }

  returnBays(carParkId: string, holder: string): void {
    this.carParks.releaseBays(carParkId, holder);
  }
}
