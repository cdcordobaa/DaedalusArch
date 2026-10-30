import { ParcelController } from './adapters/in/http/parcel.controller';
import { LockboxDoorGateway } from './adapters/out/lockers/lockbox-door.gateway';
import { SmsRecipientNotifier } from './adapters/out/notification/sms-recipient-notifier';
import { InMemoryParcelRepository } from './adapters/out/persistence/in-memory-parcel.repository';
import { CollectParcelUseCase } from './application/collect-parcel.use-case';

const collectParcel = new CollectParcelUseCase(new InMemoryParcelRepository(), new LockboxDoorGateway('demo-token'), new SmsRecipientNotifier());
export const parcelController = new ParcelController(collectParcel);
