import { PayoutView } from '../../../domain/payout';

export interface PayoutsPort {
  payout(id: string): Promise<PayoutView>;
}
