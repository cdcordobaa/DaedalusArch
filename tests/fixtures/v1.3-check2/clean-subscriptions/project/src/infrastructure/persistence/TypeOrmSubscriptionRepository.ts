import { DataSource, Repository } from 'typeorm';
import { Subscription, SubscriptionState } from '../../domain/model/Subscription';
import { SubscriptionRepository } from '../../domain/ports/SubscriptionRepository';
import { SubscriptionRow } from './orm/SubscriptionRow';

export class TypeOrmSubscriptionRepository implements SubscriptionRepository {
  private readonly rows: Repository<SubscriptionRow>;
  private counter = 0;

  constructor(dataSource: DataSource) {
    this.rows = dataSource.getRepository(SubscriptionRow);
  }

  async byId(id: string): Promise<Subscription | undefined> {
    const row = await this.rows.findOne({ where: { id } });
    return row === null ? undefined : toDomain(row);
  }

  async activeFor(customerId: string): Promise<Subscription[]> {
    return (await this.rows.find({ where: { customerId, state: 'active' } })).map(toDomain);
  }

  async save(subscription: Subscription): Promise<void> {
    await this.rows.save(this.rows.create({ ...subscription }));
  }

  nextId(): string {
    this.counter += 1;
    return `sub-${Date.now()}-${this.counter}`;
  }
}

function toDomain(row: SubscriptionRow): Subscription {
  return new Subscription(row.id, row.customerId, row.planCode, row.seats, row.state as SubscriptionState);
}
