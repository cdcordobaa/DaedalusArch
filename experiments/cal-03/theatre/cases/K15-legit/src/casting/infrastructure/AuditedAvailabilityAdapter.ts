import { ActorAvailabilityPort } from '../application/ports/ActorAvailabilityPort';
import { CalendarAvailabilityAdapter } from './CalendarAvailabilityAdapter';

export class AuditedAvailabilityAdapter implements ActorAvailabilityPort {
  readonly asked: string[] = [];

  constructor(private readonly inner: CalendarAvailabilityAdapter) {}

  async isFree(actorId: string, from: number, to: number): Promise<boolean> {
    this.asked.push(actorId);
    return this.inner.isFree(actorId, from, to);
  }
}
