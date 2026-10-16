import { Change } from '../domain/model';
import { ChangeLog, UnitOfWork } from '../domain/ports/repositories';
import { Clock, Ids } from './ports';

export class Audit {
  constructor(private readonly log: ChangeLog, private readonly uow: UnitOfWork, private readonly clock: Clock, private readonly ids: Ids) {}

  /** Saves `after` with `save` and appends the audit record, atomically. */
  saved<T>(by: string, entity: Change['entity'], entityId: string, animalId: string | undefined, before: unknown, after: T, save: (x: T) => void): T {
    this.uow.atomic(() => {
      save(after);
      this.log.append({ id: this.ids.next(), entity, entityId, animalId, by, at: this.clock.now(), before: before ?? null, after });
    });
    return after;
  }

  atomic<T>(work: () => T): T { return this.uow.atomic(work); }

  trailOf(animalId: string): Change[] { return this.log.ofAnimal(animalId); }
  changesBy(actor: string, from: string, to: string): Change[] { return this.log.by(actor, from, to); }
}
