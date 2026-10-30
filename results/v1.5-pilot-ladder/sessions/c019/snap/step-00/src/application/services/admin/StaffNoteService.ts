import type { StaffNote } from '../../../domain/model/admin/StaffNote';
import type { StaffNoteStore } from '../../ports/out/admin/StaffNoteStore';

/** Staff-side list of a note the clinic staff keep on a day */
export class StaffNoteService {
  constructor(private readonly store: StaffNoteStore) {}

  async add(id: string, text: string, at: string): Promise<StaffNote> {
    if (text.trim() === '') throw new Error('text is required');
    const item: StaffNote = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<StaffNote[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
