import { DeliveryStage } from '../../../domain/delivery-stage';

export interface RecordDeliveryCommand {
  readonly freightRef: string;
  readonly stage: DeliveryStage;
  readonly signedBy: string | null;
}

export interface RecordDeliveryPort {
  record(command: RecordDeliveryCommand): Promise<void>;
}
