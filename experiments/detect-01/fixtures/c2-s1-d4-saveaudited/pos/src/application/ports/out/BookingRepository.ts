import { AuditEntry } from '../../../domain/model/AuditRecord';
import { Booking } from '../../../domain/model/Booking';

/** Driven port: booking persistence. */
export interface BookingRepository {
  findById(id: string): Promise<Booking | undefined>;
  /** Saves the booking and its audit entries as one unit: all are stored or none are. */
  saveAudited(booking: Booking, entries: readonly AuditEntry[]): Promise<void>;
  nextAuditId(): string;
}
