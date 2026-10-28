import type { BackerProfile } from '../contracts/BackerProfile';
import type { BackerRepository } from '../domain/backer/BackerRepository';
import { BackerId } from '../domain/backer/value-objects/BackerId';

export class ProfileQuery {
  constructor(private readonly backers: BackerRepository) {}

  profile(backerId: string): BackerProfile | undefined {
    if (!/^B-\d+$/.test(backerId)) return undefined;
    const backer = this.backers.find(BackerId.of(backerId));
    if (backer === undefined) return undefined;
    return {
      backerId: backer.id.value,
      handle: backer.handle,
      backedTotal: backer.backedTotal.units(),
      missedPayments: backer.missedPayments,
      standing: backer.standing(),
    };
  }
}
