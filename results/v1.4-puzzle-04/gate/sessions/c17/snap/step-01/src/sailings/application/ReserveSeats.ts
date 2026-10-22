import { SailingError } from '../domain/SailingError';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** Takes seats for a holder if the sailing has them; the sailing records the outcome as an event. */
export class ReserveSeats {
  constructor(private readonly sailings: SailingRepository) {}

  execute(sailingId: string, holder: string, seats: number): void {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) throw new SailingError(`no sailing ${sailingId}`);
    sailing.reserve(holder, seats);
    this.sailings.save(sailing);
  }
}
