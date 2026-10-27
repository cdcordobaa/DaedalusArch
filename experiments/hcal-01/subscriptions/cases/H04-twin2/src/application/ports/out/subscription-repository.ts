import { Subscription } from '../../../domain/subscription';

export interface SubscriptionRepository {
  save(subscription: Subscription): Promise<void>;
  findById(id: string): Promise<Subscription | null>;
  countActiveByCustomer(customerId: string): Promise<number>;
  saveAll?(subscriptions: Subscription[]): Promise<void>;
}
