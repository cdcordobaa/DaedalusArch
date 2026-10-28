import { Money } from '../../../domain/money';

export interface PayoutGateway {
  send(memberId: string, amount: Money): Promise<string>;
}
