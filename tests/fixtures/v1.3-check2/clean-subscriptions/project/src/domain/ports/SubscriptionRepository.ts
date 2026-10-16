import { Subscription } from '../model/Subscription';

export interface SubscriptionRepository {
  byId(id: string): Promise<Subscription | undefined>;
  activeFor(customerId: string): Promise<Subscription[]>;
  save(subscription: Subscription): Promise<void>;
  nextId(): string;
}
