import type { StaffNote } from '../../../../domain/model/admin/StaffNote';

export interface StaffNoteStore {
  add(item: StaffNote): Promise<void>;
  all(): Promise<StaffNote[]>;
}
