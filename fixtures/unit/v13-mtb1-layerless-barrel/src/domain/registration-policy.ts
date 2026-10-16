import { InMemoryRegistrationRepository } from '../registrations';
import { Registration } from './registration';

/** Domain service that holds an infrastructure repository through the feature barrel (nestjs v10 + barrel-add). */
export class RegistrationPolicy {
  private readonly history = new InMemoryRegistrationRepository();

  registrationsOf(attendeeId: string): Registration[] {
    return this.history.findByAttendee(attendeeId);
  }
}
