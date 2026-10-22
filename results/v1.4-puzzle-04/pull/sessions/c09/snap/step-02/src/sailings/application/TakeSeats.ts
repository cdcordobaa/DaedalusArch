import { SailingError } from '../domain/SailingError';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** Takes seats for a booking if the sailing has them left. */
export class TakeSeats {
  constructor(private readonly sailings: SailingRepository) {}

  execute(sailingId: string, holder: string, seats: number): boolean {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) throw new SailingError(`no sailing ${sailingId}`);
    if (!sailing.tryTake(holder, seats)) return false;
    this.sailings.save(sailing);
    return true;
  }
}
