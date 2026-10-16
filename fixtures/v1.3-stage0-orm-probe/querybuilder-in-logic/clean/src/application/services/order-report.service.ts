import type { EntityManager } from 'typeorm';

/** Revenue from large orders (100,000 cents and more) of one customer. */
export class OrderReportService {
  constructor(private readonly manager: EntityManager) {}

  async largeOrderRevenueCents(customerId: string): Promise<number> {
    const row = await this.manager
      .createQueryBuilder()
      .select('COALESCE(SUM(o.totalCents), 0)', 'sum')
      .from('orders', 'o')
      .where('o.customerId = :customerId', { customerId })
      .andWhere('o.totalCents >= :threshold', { threshold: 100_000 })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }
}
