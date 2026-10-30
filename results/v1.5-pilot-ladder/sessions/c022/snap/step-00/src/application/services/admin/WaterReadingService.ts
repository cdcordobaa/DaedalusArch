import type { WaterReading } from '../../../domain/model/admin/WaterReading';
import type { WaterReadingStore } from '../../ports/out/admin/WaterReadingStore';

/** Staff-side list of a reading of the water meter */
export class WaterReadingService {
  constructor(private readonly store: WaterReadingStore) {}

  async add(id: string, text: string, at: string): Promise<WaterReading> {
    if (text.trim() === '') throw new Error('text is required');
    const item: WaterReading = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<WaterReading[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
