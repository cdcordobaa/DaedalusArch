import { ParcelNotFoundError } from '../domain/errors';
import { CollectParcelCommand, CollectParcelPort, CollectParcelResult } from './ports/in/collect-parcel.port';
import { LockerDoorPort } from './ports/out/locker-door.port';
import { ParcelRepositoryPort } from './ports/out/parcel-repository.port';
import { RecipientNotifierPort } from './ports/out/recipient-notifier.port';

export class CollectParcelUseCase implements CollectParcelPort {
  constructor(
    private readonly parcels: ParcelRepositoryPort,
    private readonly doors: LockerDoorPort,
    private readonly notifier: RecipientNotifierPort,
  ) {}

  async collect(command: CollectParcelCommand): Promise<CollectParcelResult> {
    const parcel = await this.parcels.findById(command.parcelId);
    if (parcel === null) throw new ParcelNotFoundError(command.parcelId);
    parcel.collect(command.pickupCode);
    await this.doors.open(parcel.lockerId);
    await this.parcels.save(parcel);
    await this.notifier.notifyCollected(parcel.recipientPhone, parcel.id);
    return { parcelId: parcel.id, state: parcel.currentState };
  }
}
