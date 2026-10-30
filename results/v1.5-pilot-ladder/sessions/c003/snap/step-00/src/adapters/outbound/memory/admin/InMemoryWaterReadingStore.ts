import type { WaterReadingStore } from '../../../../application/ports/out/admin/WaterReadingStore';
import type { WaterReading } from '../../../../domain/model/admin/WaterReading';

export class InMemoryWaterReadingStore implements WaterReadingStore {
  private readonly items: WaterReading[] = [];

  async add(item: WaterReading): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<WaterReading[]> {
    return [...this.items];
  }
}
