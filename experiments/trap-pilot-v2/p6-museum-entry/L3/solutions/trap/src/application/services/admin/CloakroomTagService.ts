import type { CloakroomTag } from '../../../domain/model/admin/CloakroomTag';
import type { CloakroomTagStore } from '../../ports/out/admin/CloakroomTagStore';

/** Staff-side list of a tag handed out at the cloakroom */
export class CloakroomTagService {
  constructor(private readonly store: CloakroomTagStore) {}

  async add(id: string, text: string, at: string): Promise<CloakroomTag> {
    if (text.trim() === '') throw new Error('text is required');
    const item: CloakroomTag = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<CloakroomTag[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
