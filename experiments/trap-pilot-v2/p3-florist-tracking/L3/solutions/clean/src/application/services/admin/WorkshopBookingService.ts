import type { WorkshopBooking } from '../../../domain/model/admin/WorkshopBooking';
import type { WorkshopBookingStore } from '../../ports/out/admin/WorkshopBookingStore';

/** Staff-side list of a place in a bouquet-making workshop */
export class WorkshopBookingService {
  constructor(private readonly store: WorkshopBookingStore) {}

  async add(id: string, text: string, at: string): Promise<WorkshopBooking> {
    if (text.trim() === '') throw new Error('text is required');
    const item: WorkshopBooking = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<WorkshopBooking[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
