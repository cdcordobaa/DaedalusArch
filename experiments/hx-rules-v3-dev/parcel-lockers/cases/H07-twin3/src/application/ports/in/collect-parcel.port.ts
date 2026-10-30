import { ParcelState } from '../../../domain/parcel';

export interface CollectParcelCommand {
  readonly parcelId: string;
  readonly pickupCode: string;
}

export interface CollectParcelResult {
  readonly parcelId: string;
  readonly state: ParcelState;
  readonly statusCode: ParcelState;
}

export interface CollectParcelPort {
  collect(command: CollectParcelCommand): Promise<CollectParcelResult>;
}
