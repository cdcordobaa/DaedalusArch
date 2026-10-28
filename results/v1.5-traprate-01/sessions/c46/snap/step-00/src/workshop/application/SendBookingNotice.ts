import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { JobBooked } from '../domain/job/events/JobBooked';
import type { Notices } from './ports/Notices';

export class SendBookingNotice {
  constructor(private readonly notices: Notices) {}

  handle(event: DomainEvent): void {
    const booked = event as JobBooked;
    this.notices.add(booked.jobId, `Thanks, ${booked.customer}: your ${booked.bike} is booked in as ${booked.jobId}.`);
  }
}
