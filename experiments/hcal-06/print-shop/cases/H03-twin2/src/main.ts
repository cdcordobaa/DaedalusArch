import { ResendCommand } from './adapters/in/cli/resend.command';
import { OrderController } from './adapters/in/http/order.controller';
import { PrintHubWebhookHandler } from './adapters/in/webhook/printhub-webhook.handler';
import { ConsoleCustomerNotifier } from './adapters/out/notification/console-customer-notifier';
import { InMemoryOrderRepository } from './adapters/out/persistence/in-memory-order.repository';
import { PrintHubProductionGateway } from './adapters/out/printing/printhub-production.gateway';
import { RecordDispatchUseCase } from './application/record-dispatch.use-case';
import { SendToPrintUseCase } from './application/send-to-print.use-case';

const orders = new InMemoryOrderRepository();
const notifier = new ConsoleCustomerNotifier();
const sendToPrint = new SendToPrintUseCase(orders, new PrintHubProductionGateway('demo-key'), notifier);
const recordDispatch = new RecordDispatchUseCase(orders, notifier);

export const orderController = new OrderController(sendToPrint);
export const printHubWebhook = new PrintHubWebhookHandler(recordDispatch);
export const resendCommand = new ResendCommand(sendToPrint);
