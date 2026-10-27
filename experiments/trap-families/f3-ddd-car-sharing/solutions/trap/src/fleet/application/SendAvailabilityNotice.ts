import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { CarAdded } from '../domain/car/events/CarAdded';
import type { Notices } from './ports/Notices';

export class SendAvailabilityNotice {
  constructor(private readonly notices: Notices) {}

  handle(event: DomainEvent): void {
    const added = event as CarAdded;
    this.notices.add(added.carId, `Car ${added.carId} (${added.plate}) is now available in zone ${added.zone}.`);
  }
}
