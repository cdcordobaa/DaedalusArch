import { ParcelNotFoundError } from '../domain/errors';
import { CollectParcelCommand, CollectParcelPort, CollectParcelResult } from './ports/in/collect-parcel.port';
import { LockerDoorPort } from './ports/out/locker-door.port';
import { ParcelRepositoryPort } from './ports/out/parcel-repository.port';
import { RecipientNotifierPort } from './ports/out/recipient-notifier.port';

interface Lookup {
  readonly statusCode: number;
  readonly parcel: import('../domain/parcel').Parcel | null;
}

export class CollectParcelUseCase implements CollectParcelPort {
  constructor(
    private readonly parcels: ParcelRepositoryPort,
    private readonly doors: LockerDoorPort,
    private readonly notifier: RecipientNotifierPort,
  ) {}

  private async lookup(id: string): Promise<Lookup> {
    const parcel = await this.parcels.findById(id);
    return { statusCode: parcel === null ? 404 : 200, parcel };
  }

  async collect(command: CollectParcelCommand): Promise<CollectParcelResult> {
    const found = await this.lookup(command.parcelId);
    if (found.statusCode === 404 || found.parcel === null) throw new ParcelNotFoundError(command.parcelId);
    const parcel = found.parcel;
    parcel.collect(command.pickupCode);
    await this.doors.open(parcel.lockerId);
    await this.parcels.save(parcel);
    await this.notifier.notifyCollected(parcel.recipientPhone, parcel.id);
    return { parcelId: parcel.id, state: parcel.currentState };
  }
}
