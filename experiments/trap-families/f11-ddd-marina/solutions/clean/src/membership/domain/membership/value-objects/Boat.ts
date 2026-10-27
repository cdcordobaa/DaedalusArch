import { MembershipError } from '../../MembershipError';

/** A member's boat: its name and its length overall, in metres. */
export class Boat {
  private constructor(
    readonly name: string,
    readonly lengthM: number,
  ) {}

  static of(name: string, lengthM: number): Boat {
    if (name.trim() === '') throw new MembershipError('a boat needs a name');
    if (!Number.isFinite(lengthM) || lengthM <= 0) throw new MembershipError('a boat length must be a positive number of metres');
    return new Boat(name, lengthM);
  }
}
