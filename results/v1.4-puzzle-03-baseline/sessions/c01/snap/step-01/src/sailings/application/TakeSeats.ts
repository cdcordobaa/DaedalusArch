import { SailingError } from '../domain/SailingError';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** A booking takes its seats, or nothing is taken. */
export class TakeSeats {
  constructor(private readonly sailings: SailingRepository) {}

  execute(sailingId: string, holder: string, seats: number): boolean {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) throw new SailingError(`no sailing ${sailingId}`);
    if (seats > sailing.seatsLeft()) return false;
    sailing.hold(holder, seats);
    this.sailings.save(sailing);
    return true;
  }
}
