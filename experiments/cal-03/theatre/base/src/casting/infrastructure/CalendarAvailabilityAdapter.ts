import { ActorAvailabilityPort } from '../application/ports/ActorAvailabilityPort';

export class CalendarAvailabilityAdapter implements ActorAvailabilityPort {
  private readonly busy = new Map<string, Array<[number, number]>>();

  async isFree(actorId: string, from: number, to: number): Promise<boolean> {
    const windows = this.busy.get(actorId) ?? [];
    return windows.every(([start, end]) => to <= start || from >= end);
  }
}
