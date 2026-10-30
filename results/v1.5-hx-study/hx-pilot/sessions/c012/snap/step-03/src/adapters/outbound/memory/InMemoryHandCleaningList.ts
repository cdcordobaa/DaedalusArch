import type { HandCleaningList } from '../../../application/ports/out/HandCleaningList';

export class InMemoryHandCleaningList implements HandCleaningList {
  private readonly ids: string[] = [];

  async add(costumeId: string): Promise<void> {
    this.ids.push(costumeId);
  }

  async list(): Promise<string[]> {
    return [...this.ids];
  }
}
