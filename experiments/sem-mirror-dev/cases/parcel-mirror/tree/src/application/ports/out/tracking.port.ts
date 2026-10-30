import { ParcelUpdate } from '../../../domain/parcel';

export interface TrackingPort {
  latest(trackingNumber: string): Promise<ParcelUpdate>;
}
