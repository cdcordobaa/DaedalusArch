import { Subscription } from '../../../domain/subscription';

export interface SqlTransaction {
  query(sql: string, params: unknown[]): Promise<unknown>;
}

export interface SubscriptionRepository {
  save(subscription: Subscription): Promise<void>;
  findById(id: string): Promise<Subscription | null>;
  countActiveByCustomer(customerId: string): Promise<number>;
  saveWithin?(subscription: Subscription, tx: SqlTransaction): Promise<void>;
}
