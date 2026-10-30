import type { StyleGuide } from '../../../../domain/model/office/StyleGuide';
import type { StyleGuides } from '../../../../application/ports/out/office/StyleGuides';

export class InMemoryStyleGuides implements StyleGuides {
  private readonly guides: Record<string, StyleGuide> = {};

  async of(clientId: string): Promise<StyleGuide | null> {
    return this.guides[clientId] ?? null;
  }

  async save(guide: StyleGuide): Promise<void> {
    this.guides[guide.clientId] = guide;
  }
}
