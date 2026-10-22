import { Guest } from '../../domain/model/Guest';
import type { GuestView } from '../ports/in/GuestView';
import type { GuestRepository } from '../ports/out/GuestRepository';

export class RegisterGuestService {
  constructor(private readonly guests: GuestRepository) {}

  async register(name: string, email: string): Promise<GuestView> {
    if (!email.includes('@')) throw new Error('Malformed e-mail address');
    if ((await this.guests.byEmail(email)) !== undefined) throw new Error('E-mail already registered');
    const guest = new Guest(this.guests.nextId(), name, email);
    await this.guests.save(guest);
    return { id: guest.id, name: guest.displayName() };
  }
}
