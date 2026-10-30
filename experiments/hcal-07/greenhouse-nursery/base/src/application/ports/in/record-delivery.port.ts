import { DeliveryOutcome } from '../../../domain/freight';

export interface RecordDeliveryCommand {
  readonly freightRef: string;
  readonly outcome: DeliveryOutcome;
  readonly signedBy: string | null;
}

export interface RecordDeliveryPort {
  record(command: RecordDeliveryCommand): Promise<void>;
}
