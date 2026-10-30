import { ParcelUpdate } from '../domain/parcel';
import { TrackingPort } from './ports/out/tracking.port';

export class UpdateCustomerUseCase {
  constructor(private readonly tracking: TrackingPort) {}

  /** The latest update, shown as is on the order page. */
  async execute(trackingNumber: string): Promise<ParcelUpdate> {
    return this.tracking.latest(trackingNumber);
  }
}
