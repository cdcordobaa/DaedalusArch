import { Actor } from './Actor';

export interface ActorRepository {
  findById(id: string): Promise<Actor | undefined>;
  save(actor: Actor): Promise<void>;
}
