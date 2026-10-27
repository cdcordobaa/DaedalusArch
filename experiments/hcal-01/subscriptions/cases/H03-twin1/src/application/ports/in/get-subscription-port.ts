import { Subscription } from '../../../domain/subscription';

export interface GetSubscriptionPort {
  execute(subscriptionId: string): Promise<Subscription | null>;
}
