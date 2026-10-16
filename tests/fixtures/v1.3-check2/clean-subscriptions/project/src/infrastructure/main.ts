import { DataSource } from 'typeorm';
import { CancelSubscription } from '../application/use-cases/CancelSubscription';
import { ChangeSeats } from '../application/use-cases/ChangeSeats';
import { StartSubscription } from '../application/use-cases/StartSubscription';
import { StaticPlanCatalog } from './catalog/StaticPlanCatalog';
import { SubscriptionController } from './http/SubscriptionController';
import { subscriptionRouter } from './http/router';
import { InMemorySubscriptionRepository } from './persistence/InMemorySubscriptionRepository';
import { TypeOrmSubscriptionRepository } from './persistence/TypeOrmSubscriptionRepository';

export function compose(dataSource?: DataSource): ReturnType<typeof subscriptionRouter> {
  const subscriptions = dataSource === undefined ? new InMemorySubscriptionRepository() : new TypeOrmSubscriptionRepository(dataSource);
  const plans = new StaticPlanCatalog();
  return subscriptionRouter(
    new SubscriptionController(new StartSubscription(subscriptions, plans), new ChangeSeats(subscriptions, plans), new CancelSubscription(subscriptions)),
  );
}
