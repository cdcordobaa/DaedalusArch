import { DeliveryStage } from '../../../domain/supply';

export interface RecordDeliveryCommand {
  readonly supplyRef: string;
  readonly stage: DeliveryStage;
}

export interface RecordDeliveryPort {
  record(command: RecordDeliveryCommand): Promise<void>;
}
