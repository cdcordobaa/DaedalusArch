import type { Pupil } from '../../../domain/model/Pupil';

export interface PupilStore {
  nextId(): string;
  save(pupil: Pupil): void;
  byId(id: string): Pupil | null;
  /** Every pupil, in id order. */
  all(): Pupil[];
}
