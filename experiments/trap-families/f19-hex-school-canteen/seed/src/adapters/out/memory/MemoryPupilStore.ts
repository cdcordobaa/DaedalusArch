import type { PupilStore } from '../../../application/ports/out/PupilStore';
import type { Pupil } from '../../../domain/model/Pupil';
import type { CanteenDatabase } from './CanteenDatabase';

export class MemoryPupilStore implements PupilStore {
  constructor(private readonly db: CanteenDatabase) {}

  nextId(): string {
    return this.db.next('P');
  }

  save(pupil: Pupil): void {
    this.db.pupils.set(pupil.id, pupil);
  }

  byId(id: string): Pupil | null {
    return this.db.pupils.get(id) ?? null;
  }

  all(): Pupil[] {
    return [...this.db.pupils.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  }
}
