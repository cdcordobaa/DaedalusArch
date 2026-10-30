import { ParcelState } from '../../../domain/parcel';

export enum HttpStatusCode {
  Ok = 200,
  Conflict = 409,
}

export interface CollectParcelCommand {
  readonly parcelId: string;
  readonly pickupCode: string;
}

export interface CollectParcelResult {
  readonly parcelId: string;
  readonly state: ParcelState;
  readonly httpStatus: HttpStatusCode;
}

export interface CollectParcelPort {
  collect(command: CollectParcelCommand): Promise<CollectParcelResult>;
}
