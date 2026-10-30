import type { GuidedTourStore } from '../../../../application/ports/out/admin/GuidedTourStore';
import type { GuidedTour } from '../../../../domain/model/admin/GuidedTour';

export class InMemoryGuidedTourStore implements GuidedTourStore {
  private readonly items: GuidedTour[] = [];

  async add(item: GuidedTour): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<GuidedTour[]> {
    return [...this.items];
  }
}
