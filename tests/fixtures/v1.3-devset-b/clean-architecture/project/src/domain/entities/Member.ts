import { DomainError } from '../errors/DomainError';

export class Member {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly email: string,
    readonly maxActiveLoans: number,
  ) {
    if (!email.includes('@')) throw new DomainError('INVALID_MEMBER', `Invalid e-mail: ${email}`);
    if (maxActiveLoans < 1) throw new DomainError('INVALID_MEMBER', 'A member may borrow at least one book');
  }
}
