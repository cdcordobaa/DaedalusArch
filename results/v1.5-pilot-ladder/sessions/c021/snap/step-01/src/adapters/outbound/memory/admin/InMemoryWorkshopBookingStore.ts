import type { WorkshopBookingStore } from '../../../../application/ports/out/admin/WorkshopBookingStore';
import type { WorkshopBooking } from '../../../../domain/model/admin/WorkshopBooking';

export class InMemoryWorkshopBookingStore implements WorkshopBookingStore {
  private readonly items: WorkshopBooking[] = [];

  async add(item: WorkshopBooking): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<WorkshopBooking[]> {
    return [...this.items];
  }
}
