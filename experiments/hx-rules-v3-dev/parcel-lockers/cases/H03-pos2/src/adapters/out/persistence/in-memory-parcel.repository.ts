import { ParcelRepositoryPort } from '../../../application/ports/out/parcel-repository.port';
import { Parcel } from '../../../domain/parcel';
import { maskPhone } from '../shared/phone-mask';

export class InMemoryParcelRepository implements ParcelRepositoryPort {
  private readonly rows = new Map<string, Parcel>();

  async findById(id: string): Promise<Parcel | null> {
    return this.rows.get(id) ?? null;
  }

  async save(parcel: Parcel): Promise<void> {
    console.log(`stored parcel ${parcel.id} for ${maskPhone(parcel.recipientPhone)}`);
    this.rows.set(parcel.id, parcel);
  }
}
