import { GenerateInvoiceCommand, GenerateInvoicePort } from './ports/in/generate-invoice-port';
import { PlanRepository } from './ports/out/plan-repository';
import { SubscriptionRepository } from './ports/out/subscription-repository';
import { InvoiceRepository } from './ports/out/invoice-repository';
import { PaymentGateway } from './ports/out/payment-gateway';
import { NotificationSender } from './ports/out/notification-sender';
import { Invoice } from '../domain/invoice';
import { PaymentDeclinedError, PlanNotFoundError, SubscriptionNotFoundError } from '../domain/errors';

export class GenerateInvoiceUseCase implements GenerateInvoicePort {
  constructor(
    private readonly plans: PlanRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly invoices: InvoiceRepository,
    private readonly payments: PaymentGateway,
    private readonly notifier: NotificationSender,
  ) {}

  async execute(command: GenerateInvoiceCommand): Promise<Invoice> {
    const subscription = await this.subscriptions.findById(command.subscriptionId);
    if (!subscription) {
      throw new SubscriptionNotFoundError(`Subscription ${command.subscriptionId} not found`);
    }
    const plan = await this.plans.findById(subscription.planId);
    if (!plan) throw new PlanNotFoundError(`Plan ${subscription.planId} not found`);

    const now = new Date();
    const invoice = new Invoice(
      `inv-${subscription.id}-${now.getTime()}`,
      subscription.id,
      subscription.customerId,
      plan.monthlyPrice,
      now,
    );
    const result = await this.payments.charge(subscription.customerId, invoice.amount, invoice.id);
    if (!result.success) throw new PaymentDeclinedError(`Payment declined for ${invoice.id}`);

    invoice.markPaid();
    await this.invoices.save(invoice);
    await this.notifier.sendInvoice(subscription.customerId, invoice);
    return invoice;
  }
}
