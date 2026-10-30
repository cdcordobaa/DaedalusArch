import { OrderStatus } from '../../../domain/order-status';
import { ArtworkIssue } from '../../../domain/production';

export interface SendToPrintCommand {
  readonly orderId: string;
}

export interface SendToPrintResult {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly issues: readonly ArtworkIssue[];
  readonly retryLater?: boolean;
}

export interface SendToPrintPort {
  send(command: SendToPrintCommand): Promise<SendToPrintResult>;
}
