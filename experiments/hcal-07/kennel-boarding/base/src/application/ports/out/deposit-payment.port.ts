import { DepositHold } from '../../../domain/deposit';

export interface DepositRequest {
  readonly bookingId: string;
  readonly ownerId: string;
  readonly amountCents: number;
}

export interface DepositPaymentPort {
  hold(request: DepositRequest): Promise<DepositHold>;
}
