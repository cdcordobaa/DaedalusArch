import type { StyleGuide } from '../../../domain/model/office/StyleGuide';
import type { StyleGuides } from '../../ports/out/office/StyleGuides';

/** Keeps each client's house style and checks a draft sentence against it. */
export class StyleGuideService {
  constructor(private readonly guides: StyleGuides) {}

  async set(clientId: string, formal: boolean, avoid: string[]): Promise<StyleGuide> {
    const guide: StyleGuide = { clientId, formal, avoid: avoid.map((w) => w.toLowerCase()) };
    await this.guides.save(guide);
    return guide;
  }

  async flagged(clientId: string, sentence: string): Promise<string[]> {
    const guide = await this.guides.of(clientId);
    if (guide === null) return [];
    const words = sentence.toLowerCase().split(/[^\p{L}]+/u);
    return guide.avoid.filter((w) => words.includes(w));
  }
}
