import type { BerthGiven } from '../contracts/PontoonView';
import { BerthingError } from '../domain/BerthingError';
import { Pontoon } from '../domain/pontoon/Pontoon';
import type { PontoonRepository } from '../domain/pontoon/PontoonRepository';

/** The harbour master's own work: pontoons, and berths for visiting boats. */
export class HarbourMaster {
  constructor(private readonly pontoons: PontoonRepository) {}

  addPontoon(name: string, berthLengthsM: readonly number[]): string {
    const pontoon = Pontoon.add(this.pontoons.nextId(), name, berthLengthsM);
    this.pontoons.put(pontoon);
    return pontoon.id;
  }

  assignBerth(pontoonId: string, occupant: string, boatLengthM: number): BerthGiven {
    const pontoon = this.load(pontoonId);
    const berth = pontoon.moor(occupant, boatLengthM);
    this.pontoons.put(pontoon);
    return { berth: berth.number, lengthM: berth.lengthM };
  }

  vacateBerth(pontoonId: string, occupant: string): void {
    const pontoon = this.load(pontoonId);
    pontoon.unmoor(occupant);
    this.pontoons.put(pontoon);
  }

  private load(pontoonId: string): Pontoon {
    const pontoon = this.pontoons.get(pontoonId);
    if (pontoon === undefined) throw new BerthingError(`no pontoon ${pontoonId}`);
    return pontoon;
  }
}
