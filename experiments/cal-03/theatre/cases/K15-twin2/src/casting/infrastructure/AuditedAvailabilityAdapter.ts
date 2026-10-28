import { ActorAvailabilityPort } from '../application/ports/ActorAvailabilityPort';

export class AuditedAvailabilityAdapter implements ActorAvailabilityPort {
  readonly asked: string[] = [];

  constructor(private readonly inner: ActorAvailabilityPort) {}

  async isFree(actorId: string, from: number, to: number): Promise<boolean> {
    this.asked.push(actorId);
    return this.inner.isFree(actorId, from, to);
  }
}
