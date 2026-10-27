import type { OpenPools } from '../../../application/outbound/OpenPools';
import type { Pool } from '../../../domain/pooling/Pool';

export class InMemoryOpenPools implements OpenPools {
  private readonly pools = new Map<string, Pool>();

  withFreeSeats(): Pool[] {
    return [...this.pools.values()].filter((p) => p.hasFreeSeat());
  }

  nextId(): string {
    return `P${String(this.pools.size + 1)}`;
  }

  save(pool: Pool): void {
    this.pools.set(pool.id, pool);
  }
}
