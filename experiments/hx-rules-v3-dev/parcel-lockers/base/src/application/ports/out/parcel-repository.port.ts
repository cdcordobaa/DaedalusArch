import { Parcel } from '../../../domain/parcel';

export interface ParcelRepositoryPort {
  findById(id: string): Promise<Parcel | null>;
  save(parcel: Parcel): Promise<void>;
}
