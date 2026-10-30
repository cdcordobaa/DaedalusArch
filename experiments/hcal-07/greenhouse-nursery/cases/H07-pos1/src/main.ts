import { DispatchController } from './adapters/in/http/dispatch.controller';
import { PalletPathWebhookHandler } from './adapters/in/webhook/palletpath-webhook.handler';
import { PalletPathFreightGateway } from './adapters/out/freight/palletpath-freight.gateway';
import { EmailGardenCentreNotifier } from './adapters/out/notification/email-garden-centre-notifier';
import { InMemoryDispatchRepository } from './adapters/out/persistence/in-memory-dispatch.repository';
import { BookFreightUseCase } from './application/book-freight.use-case';
import { CancelDispatchUseCase } from './application/cancel-dispatch.use-case';
import { RecordDeliveryUseCase } from './application/record-delivery.use-case';

const orders = new InMemoryDispatchRepository();
const notifier = new EmailGardenCentreNotifier();
const bookFreight = new BookFreightUseCase(orders, new PalletPathFreightGateway('demo-token'), notifier);
const recordDelivery = new RecordDeliveryUseCase(orders, notifier);

export const dispatchController = new DispatchController(bookFreight, new CancelDispatchUseCase(orders));
export const palletPathWebhook = new PalletPathWebhookHandler(recordDelivery);
