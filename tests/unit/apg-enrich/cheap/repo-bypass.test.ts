import { runOn } from './helpers.js';

describe('repo-bypass proxy', () => {
  it('flags global accessors and raw clients outside the repository role and the infrastructure layer', async () => {
    const fx = await runOn({
      'src/order/application/order.service.ts': `import { DataSource, Repository, getRepository } from 'typeorm';
export class OrderRow { id = ''; }
export class OrderService {
  constructor(private readonly repo: Repository<OrderRow>, private readonly ds: DataSource) {}
  viaAccessor(): Promise<OrderRow | null> {
    const r = getRepository(OrderRow);
    return r.findOne({});
  }
  viaRaw(): Promise<unknown> {
    return this.ds.query('select 1');
  }
  viaInjected(): Promise<OrderRow | null> {
    const alias = this.repo;
    return alias.findOne({});
  }
}
`,
      'src/order/infrastructure/order.store.ts': `import { getRepository } from 'typeorm';
import { OrderRow } from '../application/order.service';
export class OrderStore {
  load(): unknown { return getRepository(OrderRow); }
}
`,
      'src/order/application/order.repository.ts': `import { getRepository } from 'typeorm';
import { OrderRow } from './order.service';
export class OrderRepository {
  load(): unknown { return getRepository(OrderRow); }
}
`,
    }, ['repo-bypass']);
    try {
      expect(fx.flags('repo-bypass').map((f) => `${f.className ?? ''}.${f.methodName ?? ''}:${String(f.evidence.startLine)}`).sort()).toEqual([
        'OrderService.viaAccessor:6',
        'OrderService.viaRaw:10',
      ]);
    } finally {
      fx.cleanup();
    }
  });
});
