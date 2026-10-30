import { ParcelRepositoryPort } from '../../../application/ports/out/parcel-repository.port';
import { Parcel } from '../../../domain/parcel';
import { replyOf } from '../../in/shared/reply';

export class InMemoryParcelRepository implements ParcelRepositoryPort {
  private readonly rows = new Map<string, Parcel>();

  async findById(id: string): Promise<Parcel | null> {
    return this.rows.get(id) ?? null;
  }

  async save(parcel: Parcel): Promise<void> {
    console.log(JSON.stringify(replyOf(201, { stored: parcel.id })));
    this.rows.set(parcel.id, parcel);
  }
}
