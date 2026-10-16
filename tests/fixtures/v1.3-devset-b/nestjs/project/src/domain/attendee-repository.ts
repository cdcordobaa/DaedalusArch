import { Attendee } from './attendee';

export const ATTENDEE_REPOSITORY = 'ATTENDEE_REPOSITORY';

export interface AttendeeRepository {
  findById(id: string): Promise<Attendee | undefined>;
  save(attendee: Attendee): Promise<void>;
}
