import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { BookingMade } from '../domain/booking/events/BookingMade';
import type { ConfirmationNote } from './ConfirmationNote';
import type { Confirmations } from './ports/Confirmations';

export class SendConfirmation {
  constructor(
    private readonly confirmations: Confirmations,
    private readonly note: ConfirmationNote,
  ) {}

  handle(event: DomainEvent): void {
    const made = event as BookingMade;
    const total = `${made.currency} ${(made.totalCents / 100).toFixed(2)}`;
    this.confirmations.add(`Booking ${made.bookingId}: ${total}. ${this.note.noteFor(made.memberId)}`);
  }
}
