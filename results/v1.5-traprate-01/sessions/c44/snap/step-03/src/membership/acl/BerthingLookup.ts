import type { BerthingModule } from '../../berthing';
import type { PontoonLookup } from '../application/ports/PontoonLookup';

/** Answers membership's questions from what berthing publishes. */
export class BerthingLookup implements PontoonLookup {
  constructor(private readonly berthing: BerthingModule) {}

  exists(pontoonId: string): boolean {
    return this.berthing.pontoon(pontoonId) !== undefined;
  }

  reserveBerth(pontoonId: string, occupant: string, boatLengthM: number): { berth: number; lengthM: number } | undefined {
    return this.berthing.reserveBerth(pontoonId, occupant, boatLengthM);
  }

  releaseBerth(pontoonId: string, occupant: string): void {
    this.berthing.vacateBerth(pontoonId, occupant);
  }
}
