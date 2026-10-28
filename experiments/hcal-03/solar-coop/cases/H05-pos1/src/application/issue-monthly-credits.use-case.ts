import { EmailNotifier } from '../adapters/out/notification/email.notifier';
import { CreditCalculator } from '../domain/credit-calculator';
import { ProductionCredit } from '../domain/production-credit';
import { IssueMonthlyCredits } from './ports/in/issue-monthly-credits.port';
import { CreditRepository } from './ports/out/credit-repository.port';
import { InverterMonitoring } from './ports/out/inverter-monitoring.port';
import { Notifier } from './ports/out/notifier.port';
import { PayoutGateway } from './ports/out/payout.port';
import { ShareSubscriptionRepository } from './ports/out/share-subscription-repository.port';

export class IssueMonthlyCreditsUseCase implements IssueMonthlyCredits {
  private readonly digest = new EmailNotifier();

  constructor(
    private readonly subscriptions: ShareSubscriptionRepository,
    private readonly monitoring: InverterMonitoring,
    private readonly credits: CreditRepository,
    private readonly payouts: PayoutGateway,
    private readonly notifier: Notifier,
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
      await this.notifier.notify(subscription.memberId, 'Credit paid', `Credit for ${period}: ${amount.cents} cents`);
      issued.push(credit);
    }
    await this.digest.notify('treasurer', 'Credits issued', `${issued.length} credits for ${period}`);
    return issued;
  }
}
