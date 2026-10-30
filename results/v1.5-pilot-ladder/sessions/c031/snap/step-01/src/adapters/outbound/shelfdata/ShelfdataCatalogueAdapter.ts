import { ShelfdataNotFound } from 'shelfdata-sdk';
import type { ShelfdataClient, ShelfdataVolume } from 'shelfdata-sdk';
import { ShopError } from '../../../domain/errors/ShopError';
import type { CatalogueEntry, EditionFacts } from '../../../domain/model/CatalogueEntry';
import type { Catalogue } from '../../../application/ports/out/Catalogue';

export class ShelfdataCatalogueAdapter implements Catalogue {
  constructor(private readonly client: ShelfdataClient) {}

  async search(text: string): Promise<CatalogueEntry[]> {
    const found = await this.client.search({ title: text, max_results: 10 });
    return found.map((v: ShelfdataVolume) => ({ isbn: v.isbn_13, title: v.title_long, author: v.authors_display, year: v.pub_year }));
  }

  async edition(isbn: string): Promise<EditionFacts> {
    try {
      const v = await this.client.lookupIsbn(isbn);
      return { year: v.pub_year, pages: v.page_count };
    } catch (e) {
      if (e instanceof ShelfdataNotFound) throw new ShopError('the catalogue does not know ISBN ' + isbn);
      throw e;
    }
  }
}
