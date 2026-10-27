import type { Drops } from '../../../application/ports/out/Drops';
import type { Drop } from '../../../domain/Drop';

export class MemoryDrops implements Drops {
  private readonly rows = new Map<string, Drop>();

  nextId(): string {
    return `D-${String(this.rows.size + 1).padStart(4, '0')}`;
  }

  save(drop: Drop): void {
    this.rows.set(drop.id, drop);
  }

  byId(id: string): Drop | undefined {
    return this.rows.get(id);
  }

  waitingIn(buildingId: string): Drop[] {
    return [...this.rows.values()].filter((d) => d.buildingId === buildingId && d.waiting);
  }
}
