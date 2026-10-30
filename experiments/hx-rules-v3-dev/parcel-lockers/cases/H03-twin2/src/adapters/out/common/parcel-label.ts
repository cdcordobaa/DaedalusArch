import { Parcel } from '../../../domain/parcel';

export function parcelLabel(parcel: Parcel): string {
  return `${parcel.id}@${parcel.lockerId}`;
}
