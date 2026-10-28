import { ChargeOutcome } from '../../../domain/charge-outcome';
import { Money } from '../../../domain/money';
export interface PaymentGatewayPort {
  charge(amount: Money, cardToken: string, reference: string): Promise<ChargeOutcome>;
}
