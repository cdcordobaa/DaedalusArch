import { CommissionStatus } from '../../../domain/commission-status';

export interface OrderMetalCommand {
  readonly commissionId: string;
}

export interface OrderMetalResult {
  readonly commissionId: string;
  readonly status: CommissionStatus;
}

export interface OrderMetalPort {
  order(command: OrderMetalCommand): Promise<OrderMetalResult>;
}
