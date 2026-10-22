import { SailingError } from '../domain/SailingError';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

export class CancelSailing {
  constructor(private readonly sailings: SailingRepository) {}

  execute(sailingId: string): void {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) throw new SailingError(`no sailing ${sailingId}`);
    sailing.cancel();
    this.sailings.save(sailing);
  }
}
