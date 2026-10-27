import type { BerthingModule } from '../../berthing';
import type { PontoonLookup } from '../application/ports/PontoonLookup';

/** Answers membership's questions from what berthing publishes. */
export class BerthingLookup implements PontoonLookup {
  constructor(private readonly berthing: BerthingModule) {}

  exists(pontoonId: string): boolean {
    return this.berthing.pontoon(pontoonId) !== undefined;
  }

  take(pontoonId: string, memberId: string, boatLengthM: number): { berth: number; lengthM: number } | null {
    try {
      return this.berthing.assignBerth(pontoonId, memberId, boatLengthM);
    } catch (e) {
      if (e instanceof Error && /no free berth|is closed/.test(e.message)) return null;
      throw e;
    }
  }

  release(pontoonId: string, memberId: string): void {
    this.berthing.vacateBerth(pontoonId, memberId);
  }
}
