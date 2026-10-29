import type { WorkshopBooking } from '../../../../domain/model/admin/WorkshopBooking';

export interface WorkshopBookingStore {
  add(item: WorkshopBooking): Promise<void>;
  all(): Promise<WorkshopBooking[]>;
}
