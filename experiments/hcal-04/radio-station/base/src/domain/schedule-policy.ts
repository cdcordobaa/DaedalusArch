import { HostUnavailableError, ShowOverlapError } from './errors';
import type { Host } from './host';
import type { Show } from './show';

export class SchedulePolicy {
  assertCanSchedule(host: Host, existing: readonly Show[], candidate: Show): void {
    if (!host.active) {
      throw new HostUnavailableError(`Host ${host.name} is not active`);
    }
    if (existing.some((s) => s.slot.overlaps(candidate.slot))) {
      throw new ShowOverlapError(`Slot already taken for ${candidate.title}`);
    }
  }
}
