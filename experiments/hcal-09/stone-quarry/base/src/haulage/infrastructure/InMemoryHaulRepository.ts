import { Haul } from '../domain/haul/Haul';
import { HaulRepository } from '../domain/haul/HaulRepository';

export class InMemoryHaulRepository implements HaulRepository {
  private readonly rows = new Map<string, Haul>();

  async findByTruckAndShift(truckId: string, shiftDate: string): Promise<Haul[]> {
    return [...this.rows.values()].filter((h) => h.truckId === truckId && h.shiftDate === shiftDate);
  }

  async save(haul: Haul): Promise<void> {
    this.rows.set(haul.id, haul);
  }
}
