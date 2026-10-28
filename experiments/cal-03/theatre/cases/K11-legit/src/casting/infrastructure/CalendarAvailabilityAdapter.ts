import { ActorAvailabilityPort } from '../application/ports/ActorAvailabilityPort';

export class CalendarAvailabilityAdapter implements ActorAvailabilityPort {
  private readonly busy = new Map<string, Array<[number, number]>>();
  private readonly inFlight = new Map<string, Promise<boolean>>();

  async isFree(actorId: string, from: number, to: number): Promise<boolean> {
    const key = `${actorId}:${from}:${to}`;
    const pending = this.inFlight.get(key);
    if (pending) {
      return pending;
    }
    const lookup = this.lookup(actorId, from, to).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, lookup);
    return lookup;
  }

  private async lookup(actorId: string, from: number, to: number): Promise<boolean> {
    const windows = this.busy.get(actorId) ?? [];
    return windows.every(([start, end]) => to <= start || from >= end);
  }
}
