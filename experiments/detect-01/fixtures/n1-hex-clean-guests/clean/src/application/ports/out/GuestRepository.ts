import { Guest } from '../../../domain/model/Guest';

/** Driven port. */
export interface GuestRepository {
  byEmail(email: string): Promise<Guest | undefined>;
  save(guest: Guest): Promise<void>;
  nextId(): string;
}
