import { Money } from '../../shared-kernel/value-objects/Money';
import { ActorAvailabilityPort } from '../application/ports/ActorAvailabilityPort';

export class CalendarAvailabilityAdapter implements ActorAvailabilityPort {
  private readonly busy = new Map<string, Array<[number, number]>>();

  async quote(_actorId: string, _from: number, _to: number): Promise<Money> {
    return Money.of(0);
  }

  async isFree(actorId: string, from: number, to: number): Promise<boolean> {
    const windows = this.busy.get(actorId) ?? [];
    return windows.every(([start, end]) => to <= start || from >= end);
  }
}
