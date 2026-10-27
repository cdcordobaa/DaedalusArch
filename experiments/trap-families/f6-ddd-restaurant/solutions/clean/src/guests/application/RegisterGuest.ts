import { Guest } from '../domain/guest/Guest';
import type { GuestRepository } from '../domain/guest/GuestRepository';

export class RegisterGuest {
  constructor(private readonly guests: GuestRepository) {}

  execute(name: string): string {
    const guest = Guest.register(this.guests.nextId(), name);
    this.guests.save(guest);
    return guest.id.value;
  }
}
