import { Haul } from '../domain/haul/Haul';
import { HaulRepository } from '../domain/haul/HaulRepository';

export class InMemoryHaulRepository implements HaulRepository {
  private readonly rows = new Map<string, Haul>();

  async findByTruckAndShift(truckId: string, shiftDate: string): Promise<Haul[]> {
    return [...this.rows.values()].filter((h) => h.truckId === truckId && h.shiftDate === shiftDate);
  }

  async tonnesHauled(truckId: string, shiftDate: string): Promise<number> {
    return (await this.findByTruckAndShift(truckId, shiftDate)).reduce((sum, h) => sum + h.tonnes, 0);
  }

  async save(haul: Haul): Promise<void> {
    this.rows.set(haul.id, haul);
  }
}
