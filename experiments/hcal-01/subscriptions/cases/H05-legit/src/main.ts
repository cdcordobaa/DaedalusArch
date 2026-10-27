import { SubscribeUseCase } from './application/subscribe-use-case';
import { CancelSubscriptionUseCase } from './application/cancel-subscription-use-case';
import { GenerateInvoiceUseCase } from './application/generate-invoice-use-case';
import { SubscriptionController } from './adapters/in/http/subscription-controller';
import { InMemoryPlanRepository } from './adapters/out/persistence/in-memory-plan-repository';
import { InMemorySubscriptionRepository } from './adapters/out/persistence/in-memory-subscription-repository';
import { InMemoryInvoiceRepository } from './adapters/out/persistence/in-memory-invoice-repository';
import { ProviderPaymentGateway } from './adapters/out/payment/provider-payment-gateway';
import { SmtpEmailSender } from './adapters/out/email/smtp-email-sender';

const PAYMENT_API_KEY = 'test-key';
const plans = new InMemoryPlanRepository();
const subscriptions = new InMemorySubscriptionRepository();
const invoices = new InMemoryInvoiceRepository();
const payments = new ProviderPaymentGateway(PAYMENT_API_KEY);
const notifier = new SmtpEmailSender('invoices@billing.example.com');

export const controller = new SubscriptionController(
  new SubscribeUseCase(plans, subscriptions, invoices, payments, notifier),
  new CancelSubscriptionUseCase(subscriptions),
  new GenerateInvoiceUseCase(plans, subscriptions, invoices, payments, notifier),
);
