import { CommissionStatus } from '../../../domain/commission-status';

export interface OrderMetalCommand {
  readonly commissionId: string;
}

export interface OrderMetalResult {
  readonly commissionId: string;
  readonly status: CommissionStatus;
  readonly leadDays: number;
}

export interface OrderMetalPort {
  order(command: OrderMetalCommand): Promise<OrderMetalResult>;
}
