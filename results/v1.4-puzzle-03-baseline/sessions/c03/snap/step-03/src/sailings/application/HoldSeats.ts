import { SailingError } from '../domain/SailingError';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** The group desk holds a block of seats for a party (coach tours, school trips). */
export class HoldSeats {
  constructor(private readonly sailings: SailingRepository) {}

  execute(sailingId: string, holder: string, seats: number): void {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) throw new SailingError(`no sailing ${sailingId}`);
    sailing.hold(holder, seats);
    this.sailings.save(sailing);
  }

  /** Same as execute, but a sailing without enough seats takes nothing and answers false. */
  tryExecute(sailingId: string, holder: string, seats: number): boolean {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) throw new SailingError(`no sailing ${sailingId}`);
    if (Number.isInteger(seats) && seats > 0 && seats > sailing.seatsLeft()) return false;
    sailing.hold(holder, seats);
    this.sailings.save(sailing);
    return true;
  }
}
