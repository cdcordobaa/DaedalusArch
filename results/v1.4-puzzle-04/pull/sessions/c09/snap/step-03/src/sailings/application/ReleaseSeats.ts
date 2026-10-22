import { SailingError } from '../domain/SailingError';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** The group desk gives a party's seats back. */
export class ReleaseSeats {
  constructor(private readonly sailings: SailingRepository) {}

  execute(sailingId: string, holder: string): void {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) throw new SailingError(`no sailing ${sailingId}`);
    sailing.release(holder);
    this.sailings.save(sailing);
  }
}
