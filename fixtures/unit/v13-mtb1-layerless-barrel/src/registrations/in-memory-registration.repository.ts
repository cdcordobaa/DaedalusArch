import { Registration } from '../domain/registration';

/** Infrastructure by file name (the `*.repository.ts` pattern), inside a feature folder that has no layer. */
export class InMemoryRegistrationRepository {
  private readonly rows: Registration[] = [];

  findByAttendee(attendeeId: string): Registration[] {
    return this.rows.filter((r) => r.attendeeId === attendeeId);
  }
}
