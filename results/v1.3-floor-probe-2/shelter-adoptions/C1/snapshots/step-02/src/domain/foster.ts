import { InvalidOperation } from './errors';

export class FosterCarer {
  constructor(readonly id: string, readonly name: string, readonly email: string, readonly capacity: number, readonly species: string[], readonly phone?: string) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new InvalidOperation('capacity must be a positive integer');
  }

  checkCanTake(species: string, currentlyHosting: number): void {
    if (!this.species.includes(species)) throw new InvalidOperation(`${this.name} cannot host ${species}`);
    if (currentlyHosting >= this.capacity) throw new InvalidOperation(`${this.name} is full (${this.capacity})`);
  }
}

export class FosterPlacement {
  public endedAt?: string;
  constructor(readonly id: string, readonly animalId: string, readonly carerId: string, readonly startedAt: string) {}
  get active(): boolean { return this.endedAt === undefined; }
  end(at: string): void {
    if (!this.active) throw new InvalidOperation('placement already ended');
    this.endedAt = at;
  }
}
