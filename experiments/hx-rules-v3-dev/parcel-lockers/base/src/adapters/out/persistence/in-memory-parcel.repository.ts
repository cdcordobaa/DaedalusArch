import { ParcelRepositoryPort } from '../../../application/ports/out/parcel-repository.port';
import { Parcel } from '../../../domain/parcel';

export class InMemoryParcelRepository implements ParcelRepositoryPort {
  private readonly rows = new Map<string, Parcel>();

  async findById(id: string): Promise<Parcel | null> {
    return this.rows.get(id) ?? null;
  }

  async save(parcel: Parcel): Promise<void> {
    this.rows.set(parcel.id, parcel);
  }
}
