import { DomainError } from '../catalog/errors';
import type { Email } from './Email';

export const DEFAULT_BORROWING_LIMIT = 3;

export class DuplicateMemberError extends DomainError {
  constructor(email: string) {
    super('DUPLICATE_MEMBER', `a member with e-mail ${email} is already registered`);
  }
}

/** A person who may borrow books, up to `borrowingLimit` at a time. */
export class Member {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly email: Email,
    readonly borrowingLimit: number,
  ) {}

  static register(id: string, name: string, email: Email): Member {
    if (name.trim() === '') throw new DomainError('INVALID_MEMBER', 'name is required');
    return new Member(id, name.trim(), email, DEFAULT_BORROWING_LIMIT);
  }
}
