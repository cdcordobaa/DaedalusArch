import { SailingError } from '../domain/SailingError';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** Takes seats for a holder if the sailing has enough left; otherwise takes nothing. */
export class TryHoldSeats {
  constructor(private readonly sailings: SailingRepository) {}

  execute(sailingId: string, holder: string, seats: number): boolean {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) return false;
    if (!sailing.tryHold(holder, seats)) return false;
    this.sailings.save(sailing);
    return true;
  }
}

/** The group desk holds a block of seats for a party (coach tours, school trips). */
export class HoldSeats {
  constructor(private readonly sailings: SailingRepository) {}

  execute(sailingId: string, holder: string, seats: number): void {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) throw new SailingError(`no sailing ${sailingId}`);
    sailing.hold(holder, seats);
    this.sailings.save(sailing);
  }
}
