import { Actor } from '../domain/actor/Actor';
import { ActorRepository } from '../domain/actor/ActorRepository';

export class InMemoryActorRepository implements ActorRepository {
  private readonly rows = new Map<string, Actor>();

  async findById(id: string): Promise<Actor | undefined> {
    return this.rows.get(id);
  }

  async save(actor: Actor): Promise<void> {
    this.rows.set(actor.id, actor);
  }
}
