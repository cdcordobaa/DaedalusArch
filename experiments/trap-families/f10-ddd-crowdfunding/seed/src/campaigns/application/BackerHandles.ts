import type { BackerRepository } from '../../backers/domain/backer/BackerRepository';
import { BackerId } from '../../backers/domain/backer/value-objects/BackerId';

/** The name a creator sees for a backer in their messages. */
export class BackerHandles {
  constructor(private readonly backers: BackerRepository) {}

  handleOf(backerId: string): string {
    const backer = this.backers.find(BackerId.of(backerId));
    return backer === undefined ? 'a backer' : `@${backer.handle}`;
  }
}
