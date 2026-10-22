import type { CarrierRate } from '../../../domain/model/CarrierRate';
import type { Parcel } from '../../../domain/model/Parcel';

/** The carrier's services and prices for a parcel, in the application's own terms. */
export interface CarrierRates {
  ratesFor(parcel: Parcel): Promise<CarrierRate[]>;
}
