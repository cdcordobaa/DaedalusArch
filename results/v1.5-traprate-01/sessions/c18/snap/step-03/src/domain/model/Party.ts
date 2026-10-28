import { TenancyError } from '../errors/TenancyError';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A person on an agreement: the landlord or a tenant. */
export class Party {
  private constructor(
    readonly name: string,
    readonly email: string,
  ) {}

  static of(name: string, email: string): Party {
    if (name.trim() === '') throw new TenancyError('Every person on an agreement needs a name.');
    if (!EMAIL.test(email)) throw new TenancyError(`Not an email address: ${email}`);
    return new Party(name.trim(), email.toLowerCase());
  }
}
