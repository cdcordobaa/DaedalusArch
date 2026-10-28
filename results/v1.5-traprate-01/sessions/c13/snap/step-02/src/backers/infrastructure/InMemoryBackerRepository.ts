import { Backer, type BackerSnapshot } from '../domain/backer/Backer';
import type { BackerRepository } from '../domain/backer/BackerRepository';
import { BackerId } from '../domain/backer/value-objects/BackerId';

export class InMemoryBackerRepository implements BackerRepository {
  private readonly table = new Map<string, BackerSnapshot>();

  allocateId(): BackerId {
    return BackerId.of(`B-${String(this.table.size + 1).padStart(3, '0')}`);
  }

  find(id: BackerId): Backer | undefined {
    const row = this.table.get(id.value);
    return row === undefined ? undefined : Backer.fromSnapshot(row);
  }

  save(backer: Backer): void {
    this.table.set(backer.id.value, backer.snapshot());
  }
}
