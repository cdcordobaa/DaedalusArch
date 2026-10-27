import { BerthingError } from '../domain/BerthingError';
import type { PontoonRepository } from '../domain/pontoon/PontoonRepository';

/** The harbour master closes pontoons when a storm is coming. */
export class StormWatch {
  constructor(private readonly pontoons: PontoonRepository) {}

  closePontoon(pontoonId: string): void {
    const pontoon = this.pontoons.get(pontoonId);
    if (pontoon === undefined) throw new BerthingError(`no pontoon ${pontoonId}`);
    pontoon.close();
    this.pontoons.put(pontoon);
  }
}
