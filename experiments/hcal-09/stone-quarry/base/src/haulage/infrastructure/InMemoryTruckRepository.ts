import { Truck } from '../domain/truck/Truck';
import { TruckRepository } from '../domain/truck/TruckRepository';

export class InMemoryTruckRepository implements TruckRepository {
  private readonly rows = new Map<string, Truck>();

  constructor(seed: readonly Truck[] = []) {
    for (const truck of seed) this.rows.set(truck.id, truck);
  }

  async findById(id: string): Promise<Truck | null> {
    return this.rows.get(id) ?? null;
  }
}
