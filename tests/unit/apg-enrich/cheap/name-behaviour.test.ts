import { camelTokens, roleFromName } from '../../../../src/apg-enrich/cheap/behaviour.js';
import { runOn } from './helpers.js';

describe('name-behaviour: roles from names', () => {
  it('splits camel case and reads the suffix role', () => {
    expect(camelTokens('CreateOrderDTO')).toEqual(['Create', 'Order', 'DTO']);
    expect(roleFromName('OrderRepository')).toBe('repository');
    expect(roleFromName('PlaceOrderUseCase')).toBe('service');
    expect(roleFromName('OrdersController')).toBe('controller');
    expect(roleFromName('MoneyValueObject')).toBe('entity');
    expect(roleFromName('Order')).toBe('unknown');
  });
});

describe('name-behaviour proxy', () => {
  it('flags a repository doing HTTP, a service with a direct ORM call and a domain class with ORM mapping', async () => {
    const fx = await runOn({
      'src/order/infrastructure/order.repository.ts': `import axios from 'axios';
export class OrderRepository {
  async load(id: string): Promise<unknown> {
    return axios.get('https://example.org/orders/' + id);
  }
}
`,
      'src/order/application/order.service.ts': `import { getRepository } from 'typeorm';
import { Order } from '../domain/order';
export class OrderService {
  count(): Promise<Order | null> {
    return getRepository(Order).findOne({});
  }
}
`,
      'src/order/domain/order.ts': `import { Column, Entity } from 'typeorm';
@Entity()
export class Order {
  @Column()
  status = 'open';
}
`,
    }, ['name-behaviour']);
    try {
      const kinds = fx.flags('name-behaviour').map((f) => `${f.kind}:${f.className ?? ''}:${f.methodName ?? ''}`).sort();
      expect(kinds).toEqual([
        'domain-persistence-mapping:Order:',
        'domain-persistence-mapping:Order:',
        'repository-does-outbound-io:OrderRepository:load',
        'service-direct-orm:OrderService:count',
      ]);
      const roles = fx.enrichment.nodeFacts.filter((n) => n.key === 'behaviourRole').map((n) => n.value).sort();
      expect(roles).toEqual(['adapter', 'persistence-mapping', 'repository']);
    } finally {
      fx.cleanup();
    }
  });

  it('does not flag a service that uses its injected repository', async () => {
    const fx = await runOn({
      'src/order/application/order.service.ts': `import { Repository } from 'typeorm';
export class OrderEntity { id = ''; }
export class OrderService {
  constructor(private readonly repo: Repository<OrderEntity>) {}
  save(e: OrderEntity): Promise<OrderEntity> {
    return this.repo.save(e);
  }
}
`,
    }, ['name-behaviour']);
    try {
      expect(fx.flags('name-behaviour')).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });
});
