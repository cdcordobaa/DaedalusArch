export type Step = 'awaiting-payment' | 'awaiting-shipment' | 'done';

/** The process manager's own state: which step the fulfilment of one order is at. */
export class FulfilmentSaga {
  private constructor(readonly id: string, private step: Step) {}

  static start(orderId: string): FulfilmentSaga {
    return new FulfilmentSaga(orderId, 'awaiting-payment');
  }

  paymentReceived(): void {
    if (this.step !== 'awaiting-payment') throw new Error('payment already handled');
    this.step = 'awaiting-shipment';
  }

  shipped(): void {
    this.step = 'done';
  }

  get current(): Step {
    return this.step;
  }
}
