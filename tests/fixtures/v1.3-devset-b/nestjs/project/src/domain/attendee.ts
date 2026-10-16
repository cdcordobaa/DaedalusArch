import { DomainError } from './domain-error';

export class Attendee {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly email: string,
  ) {
    if (!email.includes('@')) throw new DomainError('invalid', `Invalid e-mail: ${email}`);
  }
}
