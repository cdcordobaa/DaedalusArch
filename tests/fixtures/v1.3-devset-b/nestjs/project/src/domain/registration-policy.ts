import { Attendee } from './attendee';
import { DomainError } from './domain-error';
import { Registration } from './registration';
import { Workshop } from './workshop';

/** Domain service: rules that span a workshop, an attendee and their existing registrations. */
export class RegistrationPolicy {
  assertCanRegister(workshop: Workshop, attendee: Attendee, existing: readonly Registration[], now: Date): void {
    if (workshop.startsAt.getTime() <= now.getTime()) {
      throw new DomainError('conflict', `Workshop "${workshop.title}" has already started`);
    }
    if (existing.some((r) => r.isActive && r.workshopId === workshop.id && r.attendeeId === attendee.id)) {
      throw new DomainError('conflict', `${attendee.name} is already registered`);
    }
  }
}
