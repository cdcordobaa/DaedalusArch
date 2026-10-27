import { SubscribeCommand, SubscribePort } from './ports/in/subscribe-port';
import { InMemoryPlanRepository } from '../adapters/out/persistence/in-memory-plan-repository';
import { SubscriptionRepository } from './ports/out/subscription-repository';
import { InvoiceRepository } from './ports/out/invoice-repository';
import { PaymentGateway } from './ports/out/payment-gateway';
import { NotificationSender } from './ports/out/notification-sender';
import { PricingPolicy } from '../domain/pricing-policy';
import { Subscription } from '../domain/subscription';
import { Invoice } from '../domain/invoice';
import { IneligibleCustomerError, PaymentDeclinedError, PlanNotFoundError } from '../domain/errors';

export class SubscribeUseCase implements SubscribePort {
  private readonly pricing = new PricingPolicy();

  constructor(
    private readonly plans: InMemoryPlanRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly invoices: InvoiceRepository,
    private readonly payments: PaymentGateway,
    private readonly notifier: NotificationSender,
  ) {}

  async execute(command: SubscribeCommand): Promise<Subscription> {
    const plan = await this.plans.findById(command.planId);
    if (!plan) throw new PlanNotFoundError(`Plan ${command.planId} not found`);

    const active = await this.subscriptions.countActiveByCustomer(command.customerId);
    if (!this.pricing.isEligible(active)) {
      throw new IneligibleCustomerError(`Customer ${command.customerId} has too many subscriptions`);
    }

    const now = new Date();
    const subscription = new Subscription(`sub-${now.getTime()}`, command.customerId, plan.id, now);
    const invoice = new Invoice(
      `inv-${subscription.id}`,
      subscription.id,
      command.customerId,
      this.pricing.priceFor(plan, active),
      now,
    );

    const result = await this.payments.charge(command.customerId, invoice.amount, invoice.id);
    if (!result.success) throw new PaymentDeclinedError(`Payment declined for ${invoice.id}`);

    invoice.markPaid();
    await this.subscriptions.save(subscription);
    await this.invoices.save(invoice);
    await this.notifier.sendInvoice(command.customerId, invoice);
    return subscription;
  }
}
