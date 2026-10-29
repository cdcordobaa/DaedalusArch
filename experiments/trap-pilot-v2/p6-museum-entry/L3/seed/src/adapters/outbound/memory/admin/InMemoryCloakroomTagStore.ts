import type { CloakroomTagStore } from '../../../../application/ports/out/admin/CloakroomTagStore';
import type { CloakroomTag } from '../../../../domain/model/admin/CloakroomTag';

export class InMemoryCloakroomTagStore implements CloakroomTagStore {
  private readonly items: CloakroomTag[] = [];

  async add(item: CloakroomTag): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<CloakroomTag[]> {
    return [...this.items];
  }
}
