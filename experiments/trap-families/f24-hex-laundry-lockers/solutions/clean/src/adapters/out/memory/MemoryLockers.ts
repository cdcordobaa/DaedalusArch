import type { Lockers } from '../../../application/ports/out/Lockers';
import type { Locker } from '../../../domain/Locker';

export class MemoryLockers implements Lockers {
  private readonly rows = new Map<string, Locker>();

  nextId(): string {
    return `L-${String(this.rows.size + 1).padStart(3, '0')}`;
  }

  save(locker: Locker): void {
    this.rows.set(locker.id, locker);
  }

  byId(id: string): Locker | undefined {
    return this.rows.get(id);
  }

  inBuilding(buildingId: string): Locker[] {
    return [...this.rows.values()].filter((l) => l.buildingId === buildingId).sort((a, b) => a.bay - b.bay);
  }

  atBay(buildingId: string, bay: number): Locker | undefined {
    return this.inBuilding(buildingId).find((l) => l.bay === bay);
  }
}
