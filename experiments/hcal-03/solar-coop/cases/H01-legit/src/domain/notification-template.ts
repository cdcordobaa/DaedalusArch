import { Money } from './money';
import { ProductionCredit } from './production-credit';

export class PayoutNotificationTemplate {
  static subject(credit: ProductionCredit): string {
    return `Production credit for ${credit.period}`;
  }
  static body(credit: ProductionCredit, total: Money): string {
    return `${credit.kwh.toFixed(1)} kWh credited, ${credit.amount.cents} cents (running total ${total.cents})`;
  }
}
