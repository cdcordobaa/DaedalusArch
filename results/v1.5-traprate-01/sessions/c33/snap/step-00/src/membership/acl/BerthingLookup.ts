import type { BerthingModule } from '../../berthing';
import type { PontoonLookup } from '../application/ports/PontoonLookup';

/** Answers membership's questions from what berthing publishes. */
export class BerthingLookup implements PontoonLookup {
  constructor(private readonly berthing: BerthingModule) {}

  exists(pontoonId: string): boolean {
    return this.berthing.pontoon(pontoonId) !== undefined;
  }
}
