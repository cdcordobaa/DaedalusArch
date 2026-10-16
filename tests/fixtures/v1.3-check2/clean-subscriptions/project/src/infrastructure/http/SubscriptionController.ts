import { CancelSubscription } from '../../application/use-cases/CancelSubscription';
import { ChangeSeats } from '../../application/use-cases/ChangeSeats';
import { StartSubscription } from '../../application/use-cases/StartSubscription';
import { SubscriptionSummary } from '../../application/dto/SubscriptionSummary';

export interface StartBody {
  customerId: string;
  plan: string;
  seats: number;
}

export interface SeatsBody {
  seats: number;
}

export interface CancelBody {
  reason: string;
}

export class SubscriptionController {
  constructor(
    private readonly start: StartSubscription,
    private readonly changeSeats: ChangeSeats,
    private readonly cancelSubscription: CancelSubscription,
  ) {}

  async create(body: StartBody): Promise<SubscriptionSummary> {
    return this.start.execute(body.customerId, body.plan, body.seats);
  }

  async resize(id: string, body: SeatsBody): Promise<SubscriptionSummary> {
    return this.changeSeats.execute(id, body.seats);
  }

  async cancel(id: string, body: CancelBody): Promise<{ id: string; reason: string }> {
    const result = await this.cancelSubscription.execute(id, body.reason);
    return result;
  }
}
