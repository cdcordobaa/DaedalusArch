import { DomainError, MemberNotFoundError } from '../../../domain/errors';

export function statusFor(error: DomainError): number {
  return error instanceof MemberNotFoundError ? 404 : 400;
}
