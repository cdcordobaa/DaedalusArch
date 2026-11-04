import { PlacementStatus } from '../../../domain/placement-status';

export interface PrepareDeliveryCommand {
  readonly placementId: string;
}

export interface PrepareDeliveryResult {
  readonly placementId: string;
  readonly status: PlacementStatus;
  readonly hiveCount: number;
}

export interface PrepareDeliveryPort {
  prepare(command: PrepareDeliveryCommand): Promise<PrepareDeliveryResult>;
}
