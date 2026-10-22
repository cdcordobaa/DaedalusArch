import { FulfilmentSaga } from '../domain/fulfilment/FulfilmentSaga';
import type { FulfilmentSagaRepository } from '../domain/fulfilment/FulfilmentSagaRepository';
import type { PaymentReceived } from '../domain/fulfilment/events/PaymentReceived';
import type { CommandBus } from './ports/CommandBus';

/** Process manager: reacts to events, records its own step, and asks the next context to act through a command. */
export class FulfilmentProcess {
  constructor(private readonly sagas: FulfilmentSagaRepository, private readonly bus: CommandBus) {}

  async start(orderId: string): Promise<void> {
    await this.sagas.save(FulfilmentSaga.start(orderId));
  }

  async onPaymentReceived(event: PaymentReceived): Promise<void> {
    const saga = await this.sagas.byId(event.orderId);
    if (saga === undefined) return;
    saga.paymentReceived();
    await this.sagas.save(saga);
    await this.bus.send({ kind: 'ShipOrder', orderId: event.orderId });
  }
}
