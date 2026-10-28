import { ActorAvailabilityPort } from '../application/ports/ActorAvailabilityPort';
import { ActorRepository } from '../domain/actor/ActorRepository';

export class KnownActorAvailabilityAdapter implements ActorAvailabilityPort {
  constructor(private readonly actors: ActorRepository) {}

  async isFree(actorId: string, _from: number, _to: number): Promise<boolean> {
    const actor = await this.actors.findById(actorId);
    return actor !== undefined;
  }
}
