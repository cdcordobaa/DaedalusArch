import type { Buildings } from '../../../application/ports/out/Buildings';
import type { Building } from '../../../domain/Building';

export class MemoryBuildings implements Buildings {
  private readonly rows = new Map<string, Building>();

  nextId(): string {
    return `B-${String(this.rows.size + 1).padStart(2, '0')}`;
  }

  add(building: Building): void {
    this.rows.set(building.id, building);
  }

  byId(id: string): Building | undefined {
    return this.rows.get(id);
  }
}
