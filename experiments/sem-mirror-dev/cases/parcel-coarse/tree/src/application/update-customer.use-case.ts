import { CustomerNotifierPort } from './ports/out/customer-notifier.port';
import { RefundsPort } from './ports/out/refunds.port';
import { TrackingPort } from './ports/out/tracking.port';

export class UpdateCustomerUseCase {
  constructor(
    private readonly tracking: TrackingPort,
    private readonly notifier: CustomerNotifierPort,
    private readonly refunds: RefundsPort,
  ) {}

  async execute(orderId: string, customerId: string, trackingNumber: string): Promise<void> {
    const update = await this.tracking.latest(trackingNumber);
    if (update.outcome === 'delivered') {
      await this.notifier.send(customerId, 'Your parcel has arrived.');
    } else if (update.outcome === 'failed') {
      await this.notifier.send(customerId, 'Sorry, the courier could not deliver your parcel.');
      await this.refunds.open(orderId);
    }
  }
}
