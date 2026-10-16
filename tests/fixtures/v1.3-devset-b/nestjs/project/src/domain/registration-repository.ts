import { Registration } from './registration';

export const REGISTRATION_REPOSITORY = 'REGISTRATION_REPOSITORY';

export interface RegistrationRepository {
  findById(id: string): Promise<Registration | undefined>;
  findByAttendee(attendeeId: string): Promise<Registration[]>;
  save(registration: Registration): Promise<void>;
}
