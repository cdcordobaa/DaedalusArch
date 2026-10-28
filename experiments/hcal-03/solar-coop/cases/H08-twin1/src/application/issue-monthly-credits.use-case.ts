import { CreditCalculator } from '../domain/credit-calculator';
import { ProductionCredit } from '../domain/production-credit';
import { IssueMonthlyCredits } from './ports/in/issue-monthly-credits.port';
import { CreditRepository } from './ports/out/credit-repository.port';
import { Clock } from './ports/out/clock.port';
import { InverterMonitoring } from './ports/out/inverter-monitoring.port';
import { Notifier } from './ports/out/notifier.port';
import { PayoutGateway } from './ports/out/payout.port';
import { ShareSubscriptionRepository } from './ports/out/share-subscription-repository.port';

export class IssueMonthlyCreditsUseCase implements IssueMonthlyCredits {
  constructor(
    private readonly subscriptions: ShareSubscriptionRepository,
    private readonly monitoring: InverterMonitoring,
    private readonly credits: CreditRepository,
    private readonly payouts: PayoutGateway,
    private readonly notifier: Notifier,
    private readonly clock: Clock,
  ) {}

  async execute(period: string): Promise<ProductionCredit[]> {
    const kwh = await this.monitoring.monthlyProductionKwh(period);
    const active = await this.subscriptions.findAllActive();
    const issued: ProductionCredit[] = [];
    for (const subscription of active) {
      const amount = CreditCalculator.creditFor(subscription.shares, kwh);
      if (!amount.isPositive()) continue;
      const credit = new ProductionCredit(
        `cr-${subscription.id}-${period}`,
        subscription.memberId,
        period,
        CreditCalculator.kwhShareFor(subscription.shares, kwh),
        amount,
      );
      const reference = await this.payouts.send(subscription.memberId, amount);
      credit.markPaid(reference);
      await this.credits.save(credit);
      await this.notifier.notify(subscription.memberId, 'Credit paid', `Credit for ${period} (${this.clock.now().toISOString()}): ${amount.cents} cents`);
      issued.push(credit);
    }
    return issued;
  }
}
