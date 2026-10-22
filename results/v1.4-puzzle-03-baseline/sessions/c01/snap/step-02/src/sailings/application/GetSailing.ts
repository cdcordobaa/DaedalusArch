import type { SailingView } from '../contracts/SailingView';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

export class GetSailing {
  constructor(private readonly sailings: SailingRepository) {}

  execute(sailingId: string): SailingView | undefined {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) return undefined;
    return { id: sailing.id.value, route: sailing.route, departsAt: sailing.departsAt, capacity: sailing.capacity, seatsLeft: sailing.seatsLeft() };
  }
}
