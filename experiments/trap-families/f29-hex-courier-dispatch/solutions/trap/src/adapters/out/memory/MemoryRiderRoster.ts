import type { RiderRoster } from '../../../application/ports/out/RiderRoster';
import type { Rider } from '../../../domain/Rider';

export class MemoryRiderRoster implements RiderRoster {
  private readonly riders = new Map<string, Rider>();
  private counter = 0;

  nextId(): string {
    this.counter += 1;
    return `R-${String(this.counter)}`;
  }

  save(rider: Rider): void {
    this.riders.set(rider.id, rider);
  }

  find(id: string): Rider | undefined {
    return this.riders.get(id);
  }

  list(): Rider[] {
    return [...this.riders.values()];
  }
}
