import type { StaffNoteStore } from '../../../../application/ports/out/admin/StaffNoteStore';
import type { StaffNote } from '../../../../domain/model/admin/StaffNote';

export class InMemoryStaffNoteStore implements StaffNoteStore {
  private readonly items: StaffNote[] = [];

  async add(item: StaffNote): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<StaffNote[]> {
    return [...this.items];
  }
}
