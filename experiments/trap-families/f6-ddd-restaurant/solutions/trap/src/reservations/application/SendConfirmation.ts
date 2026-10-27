import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { TableBooked } from '../domain/reservation/events/TableBooked';
import type { ConfirmationNote } from './ConfirmationNote';
import type { Messages } from './ports/Messages';

export class SendConfirmation {
  constructor(
    private readonly messages: Messages,
    private readonly note: ConfirmationNote,
  ) {}

  handle(event: DomainEvent): void {
    const booked = event as TableBooked;
    const deposit = `${booked.currency} ${(booked.depositCents / 100).toFixed(2)}`;
    this.messages.add(`Reservation ${booked.reservationId} for ${String(booked.partySize)}: deposit ${deposit}. ${this.note.noteFor(booked.guestId)}`);
  }
}
