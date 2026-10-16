import { BookingError } from '../errors/BookingError';

export class Guest {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly email: string,
  ) {
    if (!email.includes('@')) throw new BookingError('invalid', `Invalid e-mail: ${email}`);
  }
}
