import type { Money } from '../../../shared-kernel/Money';

export interface PaymentGateway {
  charge(clientEmail: string, amount: Money, surveyId: string): string;
}
