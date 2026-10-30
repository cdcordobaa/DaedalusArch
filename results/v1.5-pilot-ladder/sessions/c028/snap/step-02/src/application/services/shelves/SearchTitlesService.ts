import { ShopError } from '../../../domain/errors/ShopError';
import type { SearchTitles, TitleView } from '../../ports/in/SearchTitles';
import type { Catalogue } from '../../ports/out/catalogue/Catalogue';

export class SearchTitlesService implements SearchTitles {
  constructor(private readonly catalogue: Catalogue) {}

  async search(text: string): Promise<TitleView[]> {
    if (text.trim().length < 2) throw new ShopError('type at least two letters');
    const found = await this.catalogue.search(text.trim());
    return found.map((e) => ({ isbn: e.isbn, title: e.title, subtitle: e.subtitle, author: e.author, year: e.year }));
  }
}
