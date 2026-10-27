import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { ReservationCompleted } from '../domain/reservation/events/ReservationCompleted';
import type { Messages } from './ports/Messages';

export class SendThankYou {
  constructor(private readonly messages: Messages) {}

  handle(event: DomainEvent): void {
    const completed = event as ReservationCompleted;
    this.messages.add(`Thank you for dining with us (reservation ${completed.reservationId}).`);
  }
}
